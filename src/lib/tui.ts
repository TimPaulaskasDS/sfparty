import blessed from 'blessed'
import contrib from 'blessed-contrib'

export interface TUIStats {
	completed: number // Only successful files
	processed?: number // All processed files (successful + failed) - for progress tracking
	total: number
	errors: number
	currentFile: string
	queueLength?: number
	batchSize?: number
	isFlushing?: boolean
	totalWritesEstimate?: number // Estimated total writes based on files processed
	writesCompleted?: number // Writes that have been flushed
}

export interface ResourceStats {
	cpuCores: number
	totalMemory: number
	freeMemory: number
	usedMemory: number
	memoryUsagePercent: number
	concurrency: number
}

/**
 * Beautiful TUI (Text User Interface) for sfparty
 * Provides real-time progress tracking, resource monitoring, and visual feedback
 */
export class TUI {
	private screen: any
	private grid: contrib.grid
	private progressBox: any
	private statsBox: any
	private resourceBox: any
	private fileListBox: any
	private completedFilesBox: any
	private logBox: any
	private headerBox: any = null // Reference to header box for updates
	private startTime: bigint
	private completedFiles: string[] = []
	private maxCompletedFiles: number = 20
	private filesWithErrors: Set<string> = new Set() // Track unique files with errors
	private stats: TUIStats
	private resourceStats: ResourceStats | null = null
	private fileItems: string[] = []
	private maxFileItems: number = 10
	private isInitialized: boolean = false
	private keyHandler: (() => void) | null = null
	private resizeHandler: (() => void) | null = null
	private peakQueueLength: number = 0
	private operation: string = 'Processing' // Track operation type (Split/Combine)

	constructor(title: string = 'sfparty') {
		// Suppress terminal capability errors BEFORE any blessed operations
		// This must happen before blessed.screen() is called
		const originalStderrWrite = process.stderr.write.bind(process.stderr)
		process.stderr.write = function (
			chunk: any,
			encoding?: any,
			cb?: any,
		): boolean {
			const message = chunk?.toString() || ''
			// Filter out terminal capability errors - be very aggressive
			if (
				message.includes('xterm-256color.Setulc') ||
				message.includes('stack.pop') ||
				message.includes('out.push') ||
				message.includes('var v,') ||
				message.includes('stack.push') ||
				message.includes('stack =') ||
				message.includes('out =') ||
				message.includes('return out.join') ||
				message.includes('Error on xterm') ||
				message.includes('\\u001b[58::') ||
				message.includes('%p1%{65536}') ||
				message.includes('\x1b[58::')
			) {
				// Call callback if provided to prevent hanging
				if (typeof cb === 'function') {
					cb()
				}
				return true // Suppress these messages
			}
			if (cb) {
				return originalStderrWrite(chunk, encoding, cb)
			} else if (encoding) {
				return originalStderrWrite(chunk, encoding)
			} else {
				return originalStderrWrite(chunk)
			}
		}

		this.startTime = process.hrtime.bigint()
		this.stats = {
			completed: 0,
			total: 0,
			errors: 0,
			currentFile: '',
		}

		// Create screen
		this.screen = blessed.screen({
			smartCSR: true,
			title,
			fullUnicode: true,
			cursor: {
				artificial: true,
				shape: 'block',
				blink: true,
			},
		})

		// Create grid layout - increased to 15 rows to accommodate moved boxes
		this.grid = new contrib.grid({
			screen: this.screen,
			rows: 15,
			cols: 12,
		})

		// Header (rows 0-1, full width) - 2 rows to ensure content displays (TUI quirk)
		this.headerBox = this.grid.set(0, 0, 2, 12, blessed.box, {
			content: this.createHeader(title),
			tags: true,
			style: {
				fg: 'yellow',
				bold: true,
				bg: 'black',
			},
		})

		// Progress section (rows 2-5, cols 0-8) - made taller to fit all content
		this.progressBox = this.grid.set(2, 0, 4, 8, blessed.box, {
			label: ' Progress ',
			border: {
				type: 'line',
			},
			tags: true,
			style: {
				border: {
					fg: 'cyan',
				},
				fg: 'white',
			},
		})

		// Progress bar will be rendered as text in the progress box content
		// No separate progressbar widget - we'll draw it manually with characters

		// Stats box (row 2, cols 8-12) - made taller to match progress box
		this.statsBox = this.grid.set(2, 8, 4, 4, blessed.box, {
			label: ' Statistics ',
			border: {
				type: 'line',
			},
			tags: true,
			style: {
				border: {
					fg: 'green',
				},
				fg: 'white',
			},
		})

		// Resource monitoring (rows 6-9, cols 0-6) - made 1 line taller
		this.resourceBox = this.grid.set(6, 0, 4, 6, blessed.box, {
			label: ' System Resources ',
			border: {
				type: 'line',
			},
			tags: true,
			style: {
				border: {
					fg: 'magenta',
				},
				fg: 'white',
			},
		})

		// File list (rows 6-9, cols 6-12) - Processing queue, made 1 line taller
		this.fileListBox = this.grid.set(6, 6, 4, 6, blessed.list, {
			label: ' Processing Queue ',
			border: {
				type: 'line',
			},
			tags: true, // Enable tag parsing for colors
			style: {
				border: {
					fg: 'yellow',
				},
				selected: {
					bg: 'blue',
					fg: 'white',
				},
			},
			keys: true,
			mouse: true,
			scrollable: true,
			alwaysScroll: true,
			scrollbar: {
				ch: ' ',
				inverse: true,
			},
		})

		// Completed files queue (rows 10-14, cols 6-12) - same height as Status Log (5 rows)
		this.completedFilesBox = this.grid.set(10, 6, 5, 6, blessed.list, {
			label: ' Completed Files ',
			border: {
				type: 'line',
			},
			tags: true,
			style: {
				border: {
					fg: 'green',
				},
				selected: {
					bg: 'blue',
					fg: 'white',
				},
			},
			keys: true,
			mouse: true,
			scrollable: true,
			alwaysScroll: true,
			scrollbar: {
				ch: ' ',
				inverse: true,
			},
		})

		// Log box (rows 10-14, cols 0-6) - same height and position as Completed Files (5 rows, starts at row 10)
		this.logBox = this.grid.set(10, 0, 5, 6, blessed.log, {
			label: ' Status Log ',
			border: {
				type: 'line',
			},
			tags: true, // Enable tag parsing for colors - CRITICAL for tags to work
			style: {
				border: {
					fg: 'blue',
				},
			},
			keys: true,
			mouse: true,
			scrollable: true,
			alwaysScroll: true,
			scrollbar: {
				ch: ' ',
				inverse: true,
			},
		})

		// Handle keyboard
		const keyHandler = () => {
			this.cleanup()
			process.exit(0)
		}
		this.screen.key(['q', 'C-c'], keyHandler)

		// Handle resize
		const resizeHandler = () => {
			this.render()
		}
		this.screen.on('resize', resizeHandler)

		// Store handlers for cleanup
		this.keyHandler = keyHandler
		this.resizeHandler = resizeHandler

		this.isInitialized = true
		this.render()
	}

	private createHeader(title: string): string {
		const version = 'v2.0.2'
		// Use operation-specific description
		const description =
			this.operation.toLowerCase() === 'combine'
				? 'Salesforce metadata XML combiner for CI/CD'
				: 'Salesforce metadata XML splitter for CI/CD'
		const width = this.screen.width || 80
		// Two lines: app name/version on first line, description on second line
		// Removed emojis as they cause unicode width issues with box borders
		const nameLine = `${title} ${version}`
		const namePadding = Math.floor((width - nameLine.length - 2) / 2) // -2 for box borders
		const descPadding = Math.floor((width - description.length - 2) / 2) // -2 for box borders
		// First line: app name and version, second line: description
		return `{yellow-fg}{bold}${' '.repeat(Math.max(0, namePadding))}${nameLine}${' '.repeat(Math.max(0, namePadding))}{/bold}{/yellow-fg}\n${' '.repeat(Math.max(0, descPadding))}${description}${' '.repeat(Math.max(0, descPadding))}`
	}

	/**
	 * Initialize TUI with total file count
	 */
	init(total: number, operation: string = 'Processing'): void {
		this.operation = operation // Store operation type
		this.stats.total = total
		this.stats.completed = 0
		this.stats.errors = 0
		this.stats.currentFile = 'Initializing...'
		this.fileItems = []
		this.completedFiles = []
		this.filesWithErrors.clear() // Reset error tracking
		// Initialize completed files box with empty list
		if (this.completedFilesBox) {
			this.completedFilesBox.setItems([])
		}
		// Update header with operation-specific description
		if (this.headerBox) {
			this.headerBox.setContent(this.createHeader('sfparty'))
			this.render()
		}
		this.log(
			`{cyan-fg}Starting ${operation} operation: ${total} file(s){/}`,
		)
		this.updateProgress()
		this.render()
	}

	/**
	 * Set startup information to display in TUI
	 */
	setStartupInfo(info: {
		sourcePath?: string
		targetPath?: string
		totalFiles?: number
		systemResources?: string
		concurrency?: string
		writeBatcher?: string
	}): void {
		if (info.sourcePath) {
			this.log(`{cyan-fg}Source path: {/cyan-fg}${info.sourcePath}`)
		}
		if (info.targetPath) {
			this.log(`{cyan-fg}Target path: {/cyan-fg}${info.targetPath}`)
		}
		if (info.totalFiles !== undefined) {
			this.log(
				`{cyan-fg}Splitting a total of ${info.totalFiles} file(s){/}`,
			)
		}
		if (info.systemResources) {
			this.log(`{cyan-fg}${info.systemResources}{/}`)
		}
		if (info.concurrency) {
			this.log(`{cyan-fg}${info.concurrency}{/}`)
		}
		if (info.writeBatcher) {
			this.log(`{cyan-fg}${info.writeBatcher}{/}`)
		}
		this.render()
	}

	/**
	 * Update progress statistics
	 */
	updateStats(stats: Partial<TUIStats>): void {
		this.stats = { ...this.stats, ...stats }
		// Override errors count with actual count from files marked as errors
		// This ensures errors = number of unique files with errors (never exceeds files)
		// Errors can never exceed completed (files processed) or total (files to process)
		this.stats.errors = Math.min(
			this.filesWithErrors.size,
			this.stats.completed || 0,
			this.stats.total || 0,
		)
		this.updateProgress()
		this.render()
	}

	/**
	 * Update resource statistics
	 */
	updateResourceStats(resourceStats: ResourceStats): void {
		this.resourceStats = resourceStats
		this.updateResourceDisplay()
		this.render()
	}

	/**
	 * Add a file to the processing queue display
	 * Only shows pending and processing files - completed files are moved to completed queue
	 */
	addFile(
		file: string,
		status: 'pending' | 'processing' | 'completed' | 'error' = 'pending',
	): void {
		const basename = file.split('/').pop() || file

		// Handle completed files - move to completed queue
		if (status === 'completed' || status === 'error') {
			// Remove from processing queue - match by basename (strip tags for comparison)
			this.fileItems = this.fileItems.filter((item) => {
				// Extract filename from item (remove tags and icon)
				const itemBasename = item
					.replace(/\{[^}]+\}/g, '')
					.replace(/^[^\s]+\s+/, '')
					.trim()
				return (
					itemBasename !== basename &&
					!itemBasename.includes(basename) &&
					!basename.includes(itemBasename)
				)
			})
			this.fileListBox.setItems(this.fileItems)

			// Add to completed files queue - use more of the available width
			const maxFileNameLength = 50
			const displayName =
				basename.length > maxFileNameLength
					? basename.substring(0, maxFileNameLength - 3) + '...'
					: basename

			const icon = status === 'completed' ? '✓' : '✗'
			const color = status === 'completed' ? 'green' : 'red'
			const item = `{${color}-fg}${icon}{/} ${displayName}`

			// Track files with errors (deduplicated by basename)
			if (status === 'error' && !this.filesWithErrors.has(basename)) {
				this.filesWithErrors.add(basename)
				// Update stats.errors to match the count of unique files with errors
				this.stats.errors = this.filesWithErrors.size
			}

			// Check if already in completed list to avoid duplicates
			const alreadyCompleted = this.completedFiles.some((cf) => {
				const cfBasename = cf
					.replace(/\{[^}]+\}/g, '')
					.replace(/^[^\s]+\s+/, '')
					.trim()
				return cfBasename === displayName || cfBasename === basename
			})

			if (!alreadyCompleted) {
				// Add to completed list
				this.completedFiles.push(item)

				// Keep only recent completed files
				if (this.completedFiles.length > this.maxCompletedFiles) {
					this.completedFiles.shift()
				}

				this.completedFilesBox.setItems(this.completedFiles)
			}

			this.render()
			return
		}

		// Don't add to processing queue if already completed
		const alreadyCompleted = this.completedFiles.some((cf) => {
			const cfBasename = cf
				.replace(/\{[^}]+\}/g, '')
				.replace(/^[^\s]+\s+/, '')
				.trim()
			return (
				cfBasename === basename ||
				cfBasename.includes(basename) ||
				basename.includes(cfBasename)
			)
		})
		if (alreadyCompleted) {
			return // Don't add back to processing queue if already completed
		}

		// Truncate long filenames to prevent layout shifts - use more of the available width
		const maxFileNameLength = 50
		const displayName =
			basename.length > maxFileNameLength
				? basename.substring(0, maxFileNameLength - 3) + '...'
				: basename

		let icon = '○'
		let color = 'white'

		switch (status) {
			case 'processing':
				icon = '⟳'
				color = 'cyan'
				break
			case 'pending':
				icon = '○'
				color = 'gray'
				break
		}

		// Use blessed tags properly - blessed supports {color-fg}text{/color-fg} or {color-fg}text{/} shorthand
		const item = `{${color}-fg}${icon}{/} ${displayName}`

		// Add to list if not already there
		const existingIndex = this.fileItems.findIndex((f) => {
			const fBasename = f
				.replace(/\{[^}]+\}/g, '')
				.replace(/^[^\s]+\s+/, '')
				.trim()
			return (
				fBasename === displayName ||
				fBasename === basename ||
				fBasename.includes(basename) ||
				basename.includes(fBasename)
			)
		})
		if (existingIndex >= 0) {
			this.fileItems[existingIndex] = item
		} else {
			this.fileItems.push(item)
		}

		// Keep only recent items (but we're removing completed ones, so this is just a safety limit)
		if (this.fileItems.length > this.maxFileItems) {
			this.fileItems.shift()
		}

		this.fileListBox.setItems(this.fileItems)
		this.render()
	}

	/**
	 * Log a message to the status log
	 */
	log(message: string): void {
		const timestamp = new Date().toLocaleTimeString()
		// Format numbers in the message (e.g., "Flushing batch: 123456 writes" -> "Flushing batch: 123,456 writes")
		const formattedMessage = message.replace(
			/(\d+)(\s+(?:writes|remaining))/g,
			(_, num, suffix) => {
				return `${parseInt(num, 10).toLocaleString()}${suffix}`
			},
		)
		// Use proper blessed tag format - blessed uses {color-fg}text{/color-fg} or {color-fg}text{/} for shorthand
		// Calculate available width for log messages - maximize space usage but prevent wrapping
		const logBoxWidth = this.logBox.width || 50
		// Use almost all of the available width - be very generous but leave 3-4 chars to prevent wrapping
		// Log box is 6 columns (half of 12), so it's quite wide
		// Subtract a bit more padding to prevent wrapping
		const availableWidth = Math.max(62, logBoxWidth - 4) // Leave 4 chars padding to prevent wrapping
		const maxMessageLength = availableWidth - 15 // Timestamp is ~15 chars
		const truncatedMessage =
			formattedMessage.length > maxMessageLength
				? formattedMessage.substring(0, maxMessageLength - 3) + '...'
				: formattedMessage

		this.logBox.log(`{gray-fg}[${timestamp}]{/} ${truncatedMessage}`)
		this.render()
	}

	/**
	 * Update progress display
	 * Now incorporates flushing writes into overall progress calculation
	 */
	private updateProgress(): void {
		const {
			completed,
			processed,
			total,
			errors,
			currentFile,
			isFlushing,
			queueLength,
			totalWritesEstimate,
			writesCompleted,
		} = this.stats
		// Use processed (all files) for progress, but completed (successful) for display
		// Fallback to completed + errors if processed not provided (for backward compatibility)
		const filesProcessed = processed ?? completed + errors

		// Track peak queue length to estimate total writes
		if (queueLength && queueLength > this.peakQueueLength) {
			this.peakQueueLength = queueLength
		}

		// Estimate total writes if not provided
		// Use peak queue + processed files as a rough estimate
		// Or use provided estimate if available
		const estimatedTotalWrites =
			totalWritesEstimate || this.peakQueueLength + filesProcessed * 100 // Rough estimate: peak + some per file
		const currentWritesRemaining = queueLength || 0
		const currentWritesCompleted =
			writesCompleted || estimatedTotalWrites - currentWritesRemaining

		// Calculate combined progress: files + writes
		// Weight: 70% files, 30% writes (files are more important, but writes matter too)
		// Use processed (all files) for progress calculation
		const fileProgress = total > 0 ? filesProcessed / total : 0
		const writeProgress =
			estimatedTotalWrites > 0
				? Math.max(
						0,
						Math.min(
							1,
							currentWritesCompleted / estimatedTotalWrites,
						),
					)
				: 0

		// Combined progress percentage
		let percent = Math.floor(
			(fileProgress * 0.7 + writeProgress * 0.3) * 100,
		)
		percent = Math.min(99, percent) // Cap at 99% until everything is truly done

		// Clear processing queue when all files are done
		if (filesProcessed >= total && this.fileItems.length > 0) {
			this.fileItems = []
			this.fileListBox.setItems([])
		}

		const elapsed =
			Number(process.hrtime.bigint() - this.startTime) / 1_000_000_000
		// Use processed (all files) for rate calculation
		const fileRate =
			elapsed > 0 ? (filesProcessed / elapsed).toFixed(2) : '0.00'

		// Calculate ETA as simple byproduct of elapsed time and % complete
		// Formula: ETA = (elapsed / percent) - elapsed
		// Or: ETA = elapsed * ((100 - percent) / percent)
		let eta: string
		if (percent > 0 && elapsed > 0) {
			const percentDecimal = percent / 100
			const totalEstimatedTime = elapsed / percentDecimal
			const remainingTime = totalEstimatedTime - elapsed

			if (remainingTime > 0) {
				// Show in appropriate format
				if (remainingTime < 60) {
					eta = `${remainingTime.toFixed(1)}s`
				} else {
					const minutes = Math.floor(remainingTime / 60)
					const seconds = Math.floor(remainingTime % 60)
					eta = `${minutes}m ${seconds}s`
				}
			} else {
				eta = '<1s'
			}
		} else {
			eta = '?'
		}

		// Progress bar is now rendered as text in the content, so no need to call setProgress

		// Truncate long filenames to prevent layout shifts
		const maxFileNameLength = 50
		const displayFile = currentFile
			? currentFile.length > maxFileNameLength
				? currentFile.substring(0, maxFileNameLength - 3) + '...'
				: currentFile
			: isFlushing
				? 'Flushing writes...'
				: 'Waiting...'

		// Create character-based progress bar - same width as memory bar (40 chars)
		const barWidth = 40
		const filled = Math.floor((percent / 100) * barWidth)
		const empty = barWidth - filled
		const progressBar = `{cyan-fg}[{/cyan-fg}{cyan-fg}${'█'.repeat(filled)}{/cyan-fg}{gray-fg}${'░'.repeat(empty)}{/gray-fg}{cyan-fg}]{/cyan-fg} {bold}${percent}%{/bold}`

		// Update progress box content - removed blank line after progress bar
		const flushingText =
			isFlushing && queueLength && queueLength > 0
				? `  {yellow-fg}(Flushing: ${queueLength.toLocaleString()} writes){/yellow-fg}`
				: ''
		const progressContent = ` {cyan-fg}Current File:{/cyan-fg} ${displayFile}

 ${progressBar}
 {green-fg}✓{/green-fg} ${completed}  {red-fg}✗{/red-fg} ${errors}  {yellow-fg}Total:{/yellow-fg} ${total}${flushingText}

 {cyan-fg}Elapsed:{/cyan-fg} ${this.formatDuration(elapsed)}  {cyan-fg}Speed:{/cyan-fg} ${fileRate} files/sec  {cyan-fg}ETA:{/cyan-fg} ${eta}`

		this.progressBox.setContent(progressContent)

		// Update stats box - removed Elapsed (it's in Progress box)
		// Success rate = (successful files / processed files) * 100
		// completed = successful files only, errors = failed files
		// processed = completed + errors (all files processed)
		// filesProcessed already calculated above in updateProgress()
		const successRate =
			filesProcessed > 0
				? ((completed / filesProcessed) * 100).toFixed(1)
				: '0.0'
		const statsContent = ` {green-fg}Success Rate:{/green-fg} {bold}${successRate}%{/bold}

 {yellow-fg}Completed:{/yellow-fg} {bold}${completed}{/bold}
 {red-fg}Errors:{/red-fg} {bold}${errors}{/bold}
 {cyan-fg}Remaining:{/cyan-fg} {bold}${total - filesProcessed}{/bold}`

		this.statsBox.setContent(statsContent)
	}

	/**
	 * Update resource display
	 */
	private updateResourceDisplay(): void {
		if (!this.resourceStats) return

		const {
			cpuCores,
			totalMemory,
			freeMemory,
			usedMemory,
			memoryUsagePercent,
			concurrency,
		} = this.resourceStats

		// Create memory bar - use same style as progress bar for consistency
		const memBarWidth = 40
		const memFilled = Math.floor((memoryUsagePercent / 100) * memBarWidth)
		const memEmpty = memBarWidth - memFilled
		const memBar = `{magenta-fg}[{/magenta-fg}{magenta-fg}${'█'.repeat(memFilled)}{/magenta-fg}{gray-fg}${'░'.repeat(memEmpty)}{/gray-fg}{magenta-fg}]{/magenta-fg}`

		const resourceContent = ` {magenta-fg}CPU Cores:{/magenta-fg} {bold}${cpuCores}{/bold}
 {magenta-fg}Concurrency:{/magenta-fg} {bold}${concurrency}{/bold}

 {magenta-fg}Memory Usage:{/magenta-fg} {bold}${memoryUsagePercent.toFixed(1)}%{/bold}
 ${' ' + memBar}

 {magenta-fg}Total RAM:{/magenta-fg} ${(totalMemory / 1024 / 1024 / 1024).toFixed(2)} GB
 {green-fg}Free RAM:{/green-fg} ${(freeMemory / 1024 / 1024 / 1024).toFixed(2)} GB
 {red-fg}Used RAM:{/red-fg} ${(usedMemory / 1024 / 1024 / 1024).toFixed(2)} GB`

		this.resourceBox.setContent(resourceContent)
	}

	/**
	 * Format duration in human-readable format
	 */
	private formatDuration(seconds: number): string {
		if (seconds < 60) {
			return `${seconds.toFixed(1)}s`
		}
		const minutes = Math.floor(seconds / 60)
		const secs = Math.floor(seconds % 60)
		return `${minutes}m ${secs}s`
	}

	/**
	 * Render the screen
	 */
	render(): void {
		if (this.isInitialized) {
			this.screen.render()
		}
	}

	/**
	 * Show completion message and cleanup
	 */
	complete(success: boolean = true): void {
		const { completed, total, errors } = this.stats
		const elapsed =
			Number(process.hrtime.bigint() - this.startTime) / 1_000_000_000

		// Clear processing queue when all files are done
		if (completed >= total) {
			this.fileItems = []
			this.fileListBox.setItems([])
		}

		if (success && errors === 0) {
			this.log(`{green-fg}✓ Operation completed successfully!{/}`)
			this.log(
				`{green-fg}Processed ${completed}/${total} file(s) in ${this.formatDuration(elapsed)}{/}`,
			)
		} else {
			this.log(
				`{yellow-fg}⚠ Operation completed with ${errors} error(s){/}`,
			)
			this.log(
				`{yellow-fg}Processed ${completed}/${total} file(s) in ${this.formatDuration(elapsed)}{/}`,
			)
		}

		this.render()
	}

	/**
	 * Cleanup and restore terminal
	 * Must be called before any console.log output to prevent overwriting
	 */
	cleanup(): void {
		if (this.isInitialized) {
			try {
				// Remove specific event listeners first
				if (this.keyHandler) {
					try {
						this.screen.removeListener('keypress', this.keyHandler)
					} catch {
						// Ignore if already removed
					}
				}
				if (this.resizeHandler) {
					try {
						this.screen.removeListener('resize', this.resizeHandler)
					} catch {
						// Ignore if already removed
					}
				}

				// Remove all other listeners to prevent keeping process alive
				this.screen.removeAllListeners()

				// Stop listening for input - this is critical to allow process to exit
				// Blessed screen keeps stdin open which prevents Node.js from exiting
				if (this.screen.input) {
					try {
						// Pause input to stop listening
						if (this.screen.input.pause) {
							this.screen.input.pause()
						}
						// Remove all listeners from input
						if (this.screen.input.removeAllListeners) {
							this.screen.input.removeAllListeners()
						}
						// Unref to allow process to exit
						if (this.screen.input.unref) {
							this.screen.input.unref()
						}
						// Destroy input stream to prevent terminal escape code errors
						if (this.screen.input.destroy) {
							this.screen.input.destroy()
						}
					} catch {
						// Ignore errors
					}
				}

				// Suppress terminal capability errors from stderr - do this early and aggressively
				// The xterm-256color.Setulc error is harmless but noisy
				const originalStderrWrite = process.stderr.write.bind(
					process.stderr,
				)
				process.stderr.write = function (
					chunk: any,
					encoding?: any,
					cb?: any,
				): boolean {
					const message = chunk?.toString() || ''
					// Filter out terminal capability errors - be very aggressive
					if (
						message.includes('xterm-256color.Setulc') ||
						message.includes('stack.pop') ||
						message.includes('out.push') ||
						message.includes('var v,') ||
						message.includes('stack.push') ||
						message.includes('stack =') ||
						message.includes('out =') ||
						message.includes('return out.join') ||
						message.includes('Error on xterm')
					) {
						// Call callback if provided to prevent hanging
						if (typeof cb === 'function') {
							cb()
						}
						return true // Suppress these messages
					}
					if (cb) {
						return originalStderrWrite(chunk, encoding, cb)
					} else if (encoding) {
						return originalStderrWrite(chunk, encoding)
					} else {
						return originalStderrWrite(chunk)
					}
				}

				// Clear the entire screen
				try {
					this.screen.clearRegion(
						0,
						this.screen.height,
						0,
						this.screen.width,
					)
				} catch {
					// Ignore if screen already destroyed
				}

				// Move cursor to top-left and show it
				try {
					this.screen.cursor.reset()
					this.screen.cursor.show()
				} catch {
					// Ignore if cursor already destroyed
				}

				// Destroy screen - this restores the terminal and removes listeners
				try {
					this.screen.destroy()
				} catch {
					// Screen might already be destroyed
				}

				// Ensure terminal is fully restored
				process.stdout.write('\x1b[?25h') // Show cursor
				process.stdout.write('\x1b[0m') // Reset colors
				process.stdout.write('\x1b[2J') // Clear screen
				process.stdout.write('\x1b[H') // Move cursor to home

				// Ensure stdout is flushed but don't close it
				process.stdout.write('')
			} catch (error) {
				// If cleanup fails, at least try to restore terminal
				try {
					process.stdout.write('\x1b[?25h') // Show cursor
					process.stdout.write('\x1b[0m') // Reset colors
					process.stdout.write('\x1b[2J') // Clear screen
					process.stdout.write('\x1b[H') // Move cursor to home
				} catch {
					// Ignore errors during cleanup
				}
			}
			this.isInitialized = false
			this.keyHandler = null
			this.resizeHandler = null
		}
	}

	/**
	 * Get the screen instance (for advanced usage)
	 */
	getScreen(): any {
		return this.screen
	}
}
