import clc from 'cli-color'
import ora from 'ora'
import path from 'path'
import { suppressTerminalErrors } from './terminalUtils.js'
import { type ResourceStats, TUI, type TUIStats } from './tui.js'

interface GlobalContext {
	consoleTransport?: {
		silent?: boolean
	}
	logger?: {
		warn: (message: string) => void
		error: (message: string) => void
		info: (message: string) => void
	}
}

declare const global: GlobalContext & typeof globalThis

/**
 * TUI-based ProgressTracker with beautiful real-time display
 * Replaces the simple ora spinner with a full TUI interface
 * Falls back to ora spinner if TUI is not available (non-TTY, etc.)
 */
export class TUIProgressTracker {
	private tui: TUI | null = null
	private fallbackSpinner: ReturnType<typeof ora> | null = null
	private useTUI: boolean
	private total: number
	private completed: number = 0 // Only successful files
	private processed: number = 0 // All processed files (successful + failed)
	private errors: number = 0
	private currentFile: string = ''
	private lastUpdateTime: number = 0
	private readonly updateInterval: number = 100 // Update every 100ms for smooth display
	private queueStatsGetter:
		| (() => {
				queueLength: number
				batchSize: number
				isFlushing: boolean
		  } | null)
		| null = null
	// Track which files have been completed to prevent double-counting
	private completedFiles: Set<string> = new Set()

	constructor(total: number, operation: string = 'Processing') {
		this.total = total
		this.useTUI = process.stdout.isTTY && process.env.TERM !== 'dumb'

		// Disable Winston console transport when TUI is active to prevent console output
		if (this.useTUI && global.consoleTransport) {
			global.consoleTransport.silent = true
		}

		// Suppress terminal capability errors early - before TUI initialization
		if (this.useTUI) {
			suppressTerminalErrors()
		}

		try {
			if (this.useTUI) {
				this.tui = new TUI('sfparty')
				this.tui.init(total, operation)
			} else {
				// Fallback to ora spinner for non-TTY environments
				this.fallbackSpinner = ora('Starting...').start()
			}
		} catch (error) {
			// If TUI fails to initialize, fall back to spinner
			this.useTUI = false
			this.tui = null
			this.fallbackSpinner = ora('Starting...').start()
			// Log error in development (but don't break the tool)
			if (process.env.DEBUG) {
				console.error('TUI initialization failed:', error)
			}
		}
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
		if (this.tui) {
			this.tui.setStartupInfo(info)
		}
	}

	setQueueStatsGetter(
		getter: () => {
			queueLength: number
			batchSize: number
			isFlushing: boolean
		} | null,
	): void {
		this.queueStatsGetter = getter
	}

	addActive(file: string): void {
		this.currentFile = path.basename(file)
		if (this.tui) {
			this.tui.addFile(file, 'processing')
			// Log when starting to process a file
			this.tui.log(`{cyan-fg}Processing: ${path.basename(file)}{/}`)
		}
		this.updateDisplay()
	}

	readComplete(file: string, success: boolean): void {
		// Prevent double-counting: only process each file once
		const fileKey = path.basename(file)
		if (this.completedFiles.has(fileKey)) {
			// File already processed, skip to prevent double-counting
			return
		}
		this.completedFiles.add(fileKey)

		// Track all processed files (for progress)
		this.processed++
		// Only increment completed for successful files
		if (success) {
			this.completed++
		}
		// Don't increment errors here - TUI will count errors from files marked as 'error'
		// This ensures errors = count of unique files with errors (never exceeds files)
		this.currentFile = fileKey
		if (this.tui) {
			this.tui.addFile(file, success ? 'completed' : 'error')
			// Log completion status
			if (success) {
				this.tui.log(`{green-fg}Completed: ${fileKey}{/}`)
			} else {
				this.tui.log(`{red-fg}Failed: ${fileKey}{/}`)
			}
		}
		this.updateDisplay()
	}

	writeComplete(_file: string, _success: boolean): void {
		// Don't double-count errors - errors are already counted in readComplete
		// Only update display for write completion
		this.updateDisplay()
	}

	complete(file: string, _duration: string, success: boolean): void {
		// Prevent double-counting: only process each file once
		const fileKey = path.basename(file)
		if (this.completedFiles.has(fileKey)) {
			// File already processed, skip to prevent double-counting
			return
		}
		this.completedFiles.add(fileKey)

		// Track all processed files (for progress)
		this.processed++
		// Only increment completed for successful files
		if (success) {
			this.completed++
		}
		// Don't increment errors here - TUI will count errors from files marked as 'error'
		// This ensures errors = count of unique files with errors (never exceeds files)
		this.currentFile = fileKey
		if (this.tui) {
			// Use success parameter to determine status
			this.tui.addFile(file, success ? 'completed' : 'error')
		}
		this.updateDisplay()
	}

	flushing(count: number): void {
		if (this.tui) {
			// Use shorter message to prevent wrapping
			this.tui.log(
				`{yellow-fg}Flushing: ${count.toLocaleString()} writes{/}`,
			)
		} else if (this.fallbackSpinner) {
			this.fallbackSpinner.text = `Flushing writes... ${count.toLocaleString()} remaining`
		}
		this.updateDisplay()
	}

	done(_waitForWrites: boolean = false): void {
		// This method is deprecated - use doneWithWrites() instead
		this.doneWithWrites()
	}

	/**
	 * Mark as truly done after all writes are flushed
	 * Returns a promise that resolves when cleanup is complete
	 */
	doneWithWrites(): Promise<void> {
		const success = this.errors === 0

		if (this.tui) {
			this.tui.complete(success)
			// Wait a moment to show completion message, then cleanup BEFORE any console output
			return new Promise((resolve) => {
				setTimeout(() => {
					// Cleanup TUI first to prevent overwriting
					this.tui?.cleanup()
					// Re-enable Winston console transport after TUI is done
					if (global.consoleTransport) {
						global.consoleTransport.silent = false
					}
					// Small delay to ensure terminal is fully restored before console output
					setTimeout(() => {
						resolve()
					}, 100)
				}, 2000)
			})
		} else if (this.fallbackSpinner) {
			if (success) {
				this.fallbackSpinner.succeed(
					`Completed ${this.completed}/${this.total} file(s)`,
				)
			} else {
				this.fallbackSpinner.warn(
					`Completed ${this.completed}/${this.total} file(s) with ${this.errors} error(s)`,
				)
			}
			return Promise.resolve()
		}
		return Promise.resolve()
	}

	updateResourceStats(resourceStats: ResourceStats): void {
		if (this.tui) {
			this.tui.updateResourceStats(resourceStats)
		}
	}

	private updateDisplay(): void {
		const now = Date.now()
		if (
			now - this.lastUpdateTime >= this.updateInterval ||
			this.processed === this.total
		) {
			if (this.tui) {
				const stats: TUIStats = {
					completed: this.completed, // Only successful files
					total: this.total,
					errors: 0, // Don't pass errors - TUI will count from files marked as 'error'
					currentFile: this.currentFile,
				}

				// Add queue stats if available
				if (this.queueStatsGetter) {
					const queueStats = this.queueStatsGetter()
					if (queueStats) {
						stats.queueLength = queueStats.queueLength
						stats.batchSize = queueStats.batchSize
						stats.isFlushing = queueStats.isFlushing

						if (
							queueStats.isFlushing &&
							queueStats.queueLength &&
							queueStats.queueLength > 0
						) {
							// Only log occasionally to avoid spam - use shorter message to prevent wrapping
							if (
								queueStats.queueLength % 10000 === 0 ||
								queueStats.queueLength < 1000
							) {
								this.tui.log(
									`{yellow-fg}Flushing: ${queueStats.queueLength.toLocaleString()} writes{/}`,
								)
							}
						}
					}
				}

				this.tui.updateStats(stats)
			} else if (this.fallbackSpinner) {
				// Fallback to simple spinner display
				const percentage =
					this.total > 0
						? Math.floor((this.completed / this.total) * 100)
						: 0
				const totalWidth = String(this.total).length
				const paddedCount = String(this.completed).padStart(
					totalWidth,
					' ',
				)
				const paddedPercent = String(percentage).padStart(3, ' ')

				const displayText = this.currentFile
					? `(${paddedPercent}%) ${paddedCount}/${this.total} - ${clc.cyan(this.currentFile)}`
					: `(${paddedPercent}%) ${paddedCount}/${this.total} - Processing...`

				this.fallbackSpinner.text = displayText
			}
			this.lastUpdateTime = now
		}
	}

	getStats(): {
		readsCompleted: number
		writesCompleted: number
		errors: number
		total: number
	} {
		return {
			readsCompleted: this.completed,
			writesCompleted: this.completed,
			errors: this.errors,
			total: this.total,
		}
	}

	/**
	 * Log a warning message to TUI log box if TUI is active, otherwise to console
	 */
	logWarning(message: string): void {
		if (this.tui) {
			// Log to TUI status log box - this will not output to console
			this.tui.log(`{yellow-fg}${message}{/}`)
		} else if (this.fallbackSpinner) {
			// For fallback spinner, use logger (console transport will be enabled)
			// Only log if console transport is not silenced
			if (!global.consoleTransport || !global.consoleTransport.silent) {
				global.logger?.warn(message)
			}
		} else {
			// No TUI and no spinner - use logger directly
			global.logger?.warn(message)
		}
	}

	/**
	 * Log an error message to TUI log box if TUI is active, otherwise to console
	 */
	logError(message: string): void {
		if (this.tui) {
			// Log to TUI status log box - this will not output to console
			this.tui.log(`{red-fg}${message}{/}`)
		} else if (this.fallbackSpinner) {
			// For fallback spinner, use logger (console transport will be enabled)
			// Only log if console transport is not silenced
			if (!global.consoleTransport || !global.consoleTransport.silent) {
				global.logger?.error(message)
			}
		} else {
			// No TUI and no spinner - use logger directly
			global.logger?.error(message)
		}
	}
}

// Global instance to allow access from Combine/Split classes
let globalProgressTracker: TUIProgressTracker | null = null

export function setGlobalProgressTracker(
	tracker: TUIProgressTracker | null,
): void {
	globalProgressTracker = tracker
}

export function getGlobalProgressTracker(): TUIProgressTracker | null {
	return globalProgressTracker
}
