import fs from 'fs'
import path from 'path'

export interface OperationTiming {
	operation: string
	startTime: bigint
	endTime?: bigint
	duration?: number // milliseconds
	file?: string
	fileSize?: number
	metadata?: Record<string, unknown>
}

export interface FileTiming {
	file: string
	fileSize: number
	operations: OperationTiming[]
	totalDuration: number // milliseconds
	queueWaitTime?: number // milliseconds
	readTime?: number // milliseconds
	parseTime?: number // milliseconds
	writeTime?: number // milliseconds
	error?: string
}

export class PerformanceLogger {
	private fileTimings: Map<string, FileTiming> = new Map()
	private activeOperations: Map<string, OperationTiming> = new Map()
	private startTime: bigint = process.hrtime.bigint()
	private logFile?: string

	constructor(logFile?: string) {
		this.logFile = logFile
	}

	/**
	 * Start timing an operation
	 */
	startOperation(
		operation: string,
		file?: string,
		metadata?: Record<string, unknown>,
	): string {
		const operationId = `${operation}_${Date.now()}_${Math.random()}`
		const timing: OperationTiming = {
			operation,
			startTime: process.hrtime.bigint(),
			file,
			metadata,
		}
		this.activeOperations.set(operationId, timing)
		return operationId
	}

	/**
	 * End timing an operation
	 */
	endOperation(operationId: string, fileSize?: number): void {
		const timing = this.activeOperations.get(operationId)
		if (!timing) return

		timing.endTime = process.hrtime.bigint()
		timing.duration = Number(timing.endTime - timing.startTime) / 1_000_000 // Convert to milliseconds
		if (fileSize !== undefined) {
			timing.fileSize = fileSize
		}

		this.activeOperations.delete(operationId)

		// Add to file timing if file is specified
		if (timing.file) {
			this.addOperationToFile(timing.file, timing)
		}
	}

	/**
	 * Record file size for a file
	 */
	setFileSize(file: string, size: number): void {
		const timing = this.getOrCreateFileTiming(file)
		timing.fileSize = size
	}

	/**
	 * Record queue wait time (time before processing started)
	 */
	setQueueWaitTime(file: string, waitTime: number): void {
		const timing = this.getOrCreateFileTiming(file)
		timing.queueWaitTime = waitTime
	}

	/**
	 * Record read operation timing
	 */
	recordRead(file: string, duration: number): void {
		const timing = this.getOrCreateFileTiming(file)
		timing.readTime = duration
	}

	/**
	 * Record parse operation timing
	 */
	recordParse(file: string, duration: number): void {
		const timing = this.getOrCreateFileTiming(file)
		timing.parseTime = duration
	}

	/**
	 * Record write operation timing
	 */
	recordWrite(file: string, duration: number): void {
		const timing = this.getOrCreateFileTiming(file)
		timing.writeTime = duration
	}

	/**
	 * Mark a file as complete
	 */
	completeFile(file: string, success: boolean, error?: string): void {
		const timing = this.getOrCreateFileTiming(file)
		if (!success) {
			// Mark as failed - use provided error message or default
			timing.error = error || 'Operation failed'
		}
		// Calculate total duration from read, parse, and write times
		const readTime = timing.readTime || 0
		const parseTime = timing.parseTime || 0
		const writeTime = timing.writeTime || 0
		timing.totalDuration = readTime + parseTime + writeTime
	}

	/**
	 * Get timing summary for a file
	 */
	getFileTiming(file: string): FileTiming | undefined {
		return this.fileTimings.get(file)
	}

	/**
	 * Get all file timings
	 */
	getAllTimings(): FileTiming[] {
		return Array.from(this.fileTimings.values())
	}

	/**
	 * Get summary statistics
	 */
	getSummary(): {
		totalFiles: number
		successful: number
		failed: number
		totalDuration: number
		averageDuration: number
		slowestFiles: Array<{ file: string; duration: number }>
		fastestFiles: Array<{ file: string; duration: number }>
		bottlenecks: {
			avgReadTime: number
			avgParseTime: number
			avgWriteTime: number
		}
	} {
		const timings = this.getAllTimings()
		const successful = timings.filter((t) => !t.error)
		const failed = timings.filter((t) => t.error)
		const durations = successful
			.map((t) => t.totalDuration)
			.filter((d) => d > 0)

		const totalDuration =
			Number(process.hrtime.bigint() - this.startTime) / 1_000_000

		const avgDuration =
			durations.length > 0
				? durations.reduce((a, b) => a + b, 0) / durations.length
				: 0

		const slowestFiles = successful
			.map((t) => ({ file: t.file, duration: t.totalDuration }))
			.sort((a, b) => b.duration - a.duration)
			.slice(0, 10)

		const fastestFiles = successful
			.map((t) => ({ file: t.file, duration: t.totalDuration }))
			.sort((a, b) => a.duration - b.duration)
			.slice(0, 10)

		// Calculate average times for each operation type
		const readTimes = successful
			.map((t) => t.readTime)
			.filter((t): t is number => t !== undefined)
		const parseTimes = successful
			.map((t) => t.parseTime)
			.filter((t): t is number => t !== undefined)
		const writeTimes = successful
			.map((t) => t.writeTime)
			.filter((t): t is number => t !== undefined)

		const avgReadTime =
			readTimes.length > 0
				? readTimes.reduce((a, b) => a + b, 0) / readTimes.length
				: 0
		const avgParseTime =
			parseTimes.length > 0
				? parseTimes.reduce((a, b) => a + b, 0) / parseTimes.length
				: 0
		const avgWriteTime =
			writeTimes.length > 0
				? writeTimes.reduce((a, b) => a + b, 0) / writeTimes.length
				: 0

		return {
			totalFiles: timings.length,
			successful: successful.length,
			failed: failed.length,
			totalDuration,
			averageDuration: avgDuration,
			slowestFiles,
			fastestFiles,
			bottlenecks: {
				avgReadTime,
				avgParseTime,
				avgWriteTime,
			},
		}
	}

	/**
	 * Export timings to JSON
	 */
	exportToJSON(): string {
		return JSON.stringify(
			{
				summary: this.getSummary(),
				files: this.getAllTimings(),
			},
			null,
			2,
		)
	}

	/**
	 * Format milliseconds to human-readable string
	 * Examples: "123ms", "1.23s", "1m 5s"
	 */
	private formatMilliseconds(ms: number): string {
		if (ms < 1000) {
			return `${Math.round(ms)}ms`
		}
		const seconds = ms / 1000
		if (seconds < 60) {
			return `${seconds.toFixed(2)}s`
		}
		const minutes = Math.floor(seconds / 60)
		const remainingSeconds = Math.floor(seconds % 60)
		return `${minutes}m ${remainingSeconds}s`
	}

	/**
	 * Format duration in friendly format (e.g., "2m 5s")
	 */
	private formatDuration(seconds: number): string {
		const minutes = Math.floor(seconds / 60)
		const remainingSeconds = Math.floor(seconds % 60)

		if (minutes > 0) {
			return `${minutes}m ${remainingSeconds}s`
		}
		return `${remainingSeconds}s`
	}

	/**
	 * Print summary to console and optionally write to file
	 */
	printSummary(startTime?: bigint): void {
		const isCI = Boolean(process.env.CI)
		const summary = this.getSummary()
		// Use provided startTime if available, otherwise use internal calculation
		let totalDurationSeconds: number
		if (startTime) {
			const elapsed =
				Number(process.hrtime.bigint() - startTime) / 1_000_000_000
			totalDurationSeconds = elapsed
		} else {
			totalDurationSeconds = summary.totalDuration / 1000
		}

		// Only print to console outside of CI to avoid cluttering CI logs
		if (!isCI) {
			console.log('\n=== Performance Summary ===')
			console.log(`Total files: ${summary.totalFiles}`)
			console.log(`Successful: ${summary.successful}`)
			console.log(`Failed: ${summary.failed}`)
			console.log(
				`Total duration: ${this.formatDuration(totalDurationSeconds)}`,
			)
			console.log(
				`Average per file: ${this.formatMilliseconds(summary.averageDuration)}`,
			)

			console.log('\n=== Bottlenecks ===')
			console.log(
				`Average read time: ${this.formatMilliseconds(summary.bottlenecks.avgReadTime)}`,
			)
			console.log(
				`Average parse time: ${this.formatMilliseconds(summary.bottlenecks.avgParseTime)}`,
			)
			console.log(
				`Average write time: ${this.formatMilliseconds(summary.bottlenecks.avgWriteTime)}`,
			)

			if (summary.slowestFiles.length > 0) {
				console.log('\n=== Slowest Files (top 10) ===')
				summary.slowestFiles.forEach((item, index) => {
					console.log(
						`${index + 1}. ${path.basename(item.file)}: ${this.formatMilliseconds(item.duration)}`,
					)
				})
			}
		}

		// Always write to file if log file path is provided (even in CI)
		if (this.logFile) {
			this.writeSummaryToFile()
		}
	}

	/**
	 * Write performance summary to file
	 */
	private writeSummaryToFile(): void {
		if (!this.logFile) return

		try {
			// Ensure directory exists
			const logDir = path.dirname(this.logFile)
			if (!fs.existsSync(logDir)) {
				fs.mkdirSync(logDir, { recursive: true })
			}

			// Write JSON summary to file
			const summary = this.getSummary()
			const data = {
				timestamp: new Date().toISOString(),
				summary,
				files: this.getAllTimings(),
			}

			fs.writeFileSync(
				this.logFile,
				JSON.stringify(data, null, 2),
				'utf8',
			)
		} catch (error) {
			// Silently fail - don't break the app if logging fails
			console.error(`Failed to write performance log: ${error}`)
		}
	}

	private getOrCreateFileTiming(file: string): FileTiming {
		let timing = this.fileTimings.get(file)
		if (!timing) {
			timing = {
				file,
				fileSize: 0,
				operations: [],
				totalDuration: 0,
			}
			this.fileTimings.set(file, timing)
		}
		return timing
	}

	private addOperationToFile(file: string, operation: OperationTiming): void {
		const timing = this.getOrCreateFileTiming(file)
		timing.operations.push(operation)

		// Update specific timing fields based on operation type
		if (operation.duration !== undefined) {
			const opType = operation.operation.toLowerCase()
			if (opType.includes('read')) {
				timing.readTime = operation.duration
			} else if (opType.includes('parse') || opType.includes('xml')) {
				timing.parseTime = operation.duration
			} else if (opType.includes('write') || opType.includes('save')) {
				timing.writeTime = operation.duration
			}
		}
	}
}

// Global instance for easy access
let globalPerformanceLogger: PerformanceLogger | undefined

export function getPerformanceLogger(): PerformanceLogger {
	if (!globalPerformanceLogger) {
		globalPerformanceLogger = new PerformanceLogger()
	}
	return globalPerformanceLogger
}

export function setPerformanceLogger(logger: PerformanceLogger): void {
	globalPerformanceLogger = logger
}
