import * as fs from 'fs'
import yaml from 'js-yaml'
import * as path from 'path'

// Copy replaceSpecialChars to avoid circular dependency
function replaceSpecialChars(str: string): string {
	if (typeof str !== 'string') return str
	return str
		.replace(/\*/g, '\u002a')
		.replace(/\?/g, '\u003f')
		.replace(/</g, '\u003c')
		.replace(/>/g, '\u003e')
		.replace(/\|/g, '\u007c')
		.replace(/:/g, '\u003a')
}

/**
 * Write batcher for optimizing file I/O operations
 * Collects multiple file writes and executes them in batches to reduce I/O overhead
 */
export class WriteBatcher {
	private writeQueue: Array<{
		fileName: string
		data: string
	}> = []
	private readonly batchSize: number
	private readonly batchDelay: number
	private flushTimer: NodeJS.Timeout | null = null
	private flushing = false

	constructor(batchSize = 20, batchDelay = 5) {
		this.batchSize = batchSize
		this.batchDelay = batchDelay
	}

	/**
	 * Add a file write to the batch queue
	 */
	async addWrite(fileName: string, data: string): Promise<void> {
		const sanitizedFileName = this.sanitizePath(fileName)
		this.writeQueue.push({ fileName: sanitizedFileName, data })

		// Force flush if queue gets too large (prevents accumulation of 100k+ writes)
		// This is especially important when writes come in faster than they can be flushed
		const maxQueueSize = 1000
		if (this.writeQueue.length >= maxQueueSize) {
			// Queue is getting large - flush immediately to prevent accumulation
			await this.flush()
		} else if (this.writeQueue.length >= this.batchSize) {
			// Flush immediately if batch size reached
			await this.flush()
		} else {
			// Schedule flush after very short delay if not already scheduled
			// Reduced delay to prevent blocking
			if (!this.flushTimer && !this.flushing) {
				this.flushTimer = setTimeout(
					() => {
						this.flush().catch((err) => {
							// Error handling in flush
							console.error('WriteBatcher flush error:', err)
						})
					},
					Math.max(1, this.batchDelay),
				) // Minimum 1ms delay
			}
		}
	}

	/**
	 * Flush all pending writes
	 */
	async flush(): Promise<void> {
		if (this.flushing || this.writeQueue.length === 0) {
			return
		}

		if (this.flushTimer) {
			clearTimeout(this.flushTimer)
			this.flushTimer = null
		}

		this.flushing = true
		const writes = this.writeQueue.splice(0, this.batchSize)

		try {
			// Group writes by directory to batch directory creation
			const writesByDir = new Map<
				string,
				Array<{ fileName: string; data: string }>
			>()
			for (const write of writes) {
				const dir = path.dirname(write.fileName)
				if (!writesByDir.has(dir)) {
					writesByDir.set(dir, [])
				}
				writesByDir.get(dir)!.push(write)
			}

			// Create all directories first (in parallel)
			const dirPromises = Array.from(writesByDir.keys()).map((dir) =>
				fs.promises.mkdir(dir, { recursive: true }).catch(() => {
					// Directory might already exist, ignore error
				}),
			)
			await Promise.all(dirPromises)

			// Execute all writes in parallel
			await Promise.all(
				writes.map(async ({ fileName, data }) => {
					// Write file (directory already created)
					await fs.promises.writeFile(fileName, data, 'utf8')
				}),
			)
		} finally {
			this.flushing = false
			// If there are more writes, schedule another flush
			if (this.writeQueue.length > 0) {
				this.flushTimer = setTimeout(() => {
					this.flush().catch((err) => {
						console.error('WriteBatcher flush error:', err)
					})
				}, this.batchDelay)
			}
		}
	}

	/**
	 * Get the current queue length
	 */
	getQueueLength(): number {
		return this.writeQueue.length
	}

	/**
	 * Get queue statistics for visualization
	 */
	getQueueStats(): {
		queueLength: number
		batchSize: number
		isFlushing: boolean
	} {
		return {
			queueLength: this.writeQueue.length,
			batchSize: this.batchSize,
			isFlushing: this.flushing,
		}
	}

	/**
	 * Flush all remaining writes in batches (for final flush)
	 * Processes writes in chunks to avoid EMFILE (too many open files) errors
	 */
	async flushAll(): Promise<void> {
		if (this.flushTimer) {
			clearTimeout(this.flushTimer)
			this.flushTimer = null
		}

		if (this.writeQueue.length === 0) {
			return
		}

		// Wait for any in-progress flush to complete
		while (this.flushing) {
			await new Promise((resolve) => setTimeout(resolve, 1))
		}

		// Process all remaining writes in batches to avoid EMFILE errors
		// Use a reasonable batch size (50-100) to balance performance and file descriptor limits
		const finalFlushBatchSize = 50

		while (this.writeQueue.length > 0) {
			this.flushing = true
			const writes = this.writeQueue.splice(0, finalFlushBatchSize) // Take a batch

			try {
				// Group writes by directory to batch directory creation
				const writesByDir = new Map<
					string,
					Array<{ fileName: string; data: string }>
				>()
				for (const write of writes) {
					const dir = path.dirname(write.fileName)
					if (!writesByDir.has(dir)) {
						writesByDir.set(dir, [])
					}
					writesByDir.get(dir)!.push(write)
				}

				// Create all directories first (in parallel, but limited)
				const dirPromises = Array.from(writesByDir.keys()).map((dir) =>
					fs.promises.mkdir(dir, { recursive: true }).catch(() => {
						// Directory might already exist, ignore error
					}),
				)
				await Promise.all(dirPromises)

				// Execute writes in parallel (batch size limits concurrent file opens)
				await Promise.all(
					writes.map(async ({ fileName, data }) => {
						// Write file (directory already created)
						await fs.promises.writeFile(fileName, data, 'utf8')
					}),
				)
			} finally {
				this.flushing = false
			}
		}
	}

	/**
	 * Wait for all pending writes to complete
	 * More aggressive flushing to prevent blocking
	 */
	async waitForCompletion(): Promise<void> {
		// Use flushAll for final flush - it's more efficient
		await this.flushAll()
	}

	private sanitizePath(filePath: string): string {
		return replaceSpecialChars(filePath)
	}
}

/**
 * Serialize JSON to YAML or JSON string
 */
export function serializeData(json: unknown, format: string): string {
	switch (format) {
		case 'json':
			return JSON.stringify(json, null, '\t')
		case 'yaml':
			// Use js-yaml with optimized options for better performance
			return yaml.dump(json, {
				indent: 2,
				lineWidth: -1, // Disable line width limit (faster)
				noRefs: true, // Don't use anchors/aliases (faster)
				skipInvalid: false,
				sortKeys: false, // Don't sort keys (faster)
			})
		default:
			throw new Error(`Unsupported format: ${format}`)
	}
}
