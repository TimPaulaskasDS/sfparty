import clc from 'cli-color'
import ora from 'ora'
import path from 'path'
import { type ResourceStats, TUI, type TUIStats } from './tui.js'

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
	private completed: number = 0
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

	constructor(total: number, operation: string = 'Processing') {
		this.total = total
		this.useTUI = process.stdout.isTTY && process.env.TERM !== 'dumb'

		// Suppress terminal capability errors early - before TUI initialization
		if (this.useTUI) {
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
		if (success) {
			this.completed++
		} else {
			this.errors++
		}
		this.currentFile = path.basename(file)
		if (this.tui) {
			this.tui.addFile(file, success ? 'completed' : 'error')
			// Log completion status
			if (success) {
				this.tui.log(`{green-fg}Completed: ${path.basename(file)}{/}`)
			} else {
				this.tui.log(`{red-fg}Failed: ${path.basename(file)}{/}`)
			}
		}
		this.updateDisplay()
	}

	writeComplete(_file: string, success: boolean): void {
		if (!success) {
			this.errors++
		}
		this.updateDisplay()
	}

	complete(file: string, _duration: string, success: boolean): void {
		if (success) {
			this.completed++
		} else {
			this.errors++
		}
		this.currentFile = path.basename(file)
		if (this.tui) {
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
			this.completed === this.total
		) {
			if (this.tui) {
				const stats: TUIStats = {
					completed: this.completed,
					total: this.total,
					errors: this.errors,
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
}
