import * as fs from 'fs'

/**
 * Read queue for limiting concurrent file read operations
 * Reduces I/O contention by batching reads separately from processing concurrency
 * Also supports file prefetching/pre-reading for better performance
 */
export class ReadQueue {
	private readonly maxConcurrentReads: number
	private readQueue: Array<{
		filePath: string
		resolve: (data: string) => void
		reject: (error: Error) => void
	}> = []
	private activeReads = 0
	private fileCache = new Map<string, Promise<string>>() // Cache for prefetched files
	private readonly prefetchSize: number

	constructor(maxConcurrentReads = 5, prefetchSize = 10) {
		this.maxConcurrentReads = maxConcurrentReads
		this.prefetchSize = prefetchSize
	}

	/**
	 * Prefetch files in batches for better performance
	 * Currently disabled (prefetchSize = 0) as it was causing performance regression
	 */
	async prefetchFiles(filePaths: string[]): Promise<void> {
		// Prefetching disabled - was blocking and causing performance issues
		// The read queue handles concurrent reads efficiently without prefetching
		if (this.prefetchSize === 0) {
			return
		}

		// Pre-read files in batches to reduce I/O contention
		const batches: string[][] = []
		for (let i = 0; i < filePaths.length; i += this.prefetchSize) {
			batches.push(filePaths.slice(i, i + this.prefetchSize))
		}

		// Pre-read each batch
		for (const batch of batches) {
			await Promise.all(
				batch.map((filePath) => {
					// Check if already cached
					if (!this.fileCache.has(filePath)) {
						// Start reading and cache the promise
						const readPromise = this.performRead(filePath).catch(
							(error) => {
								// Remove from cache on error
								this.fileCache.delete(filePath)
								throw error
							},
						)
						this.fileCache.set(filePath, readPromise)
					}
				}),
			)
		}
	}

	/**
	 * Queue a file read operation
	 * Uses cache if file was prefetched
	 */
	async readFile(filePath: string): Promise<string> {
		// Check if file was prefetched
		const cached = this.fileCache.get(filePath)
		if (cached) {
			// File was prefetched, return cached promise
			this.fileCache.delete(filePath) // Remove from cache after use
			return cached
		}

		// Not prefetched, queue the read
		return new Promise((resolve, reject) => {
			this.readQueue.push({ filePath, resolve, reject })
			this.processQueue()
		})
	}

	/**
	 * Process the read queue
	 */
	private async processQueue(): Promise<void> {
		// Start reads up to the concurrency limit
		while (
			this.activeReads < this.maxConcurrentReads &&
			this.readQueue.length > 0
		) {
			const readTask = this.readQueue.shift()
			if (!readTask) break

			this.activeReads++
			this.performRead(readTask.filePath)
				.then((data) => {
					readTask.resolve(data)
				})
				.catch((error) => {
					readTask.reject(error)
				})
				.finally(() => {
					this.activeReads--
					// Process next item in queue
					this.processQueue()
				})
		}
	}

	/**
	 * Perform the actual file read
	 * Uses streams for large files (>1MB) to reduce memory pressure
	 */
	private async performRead(filePath: string): Promise<string> {
		// Check file size first
		let stats: fs.Stats
		try {
			stats = await fs.promises.stat(filePath)
		} catch (error) {
			throw new Error(`File not found: ${filePath}`)
		}

		const LARGE_FILE_THRESHOLD = 1024 * 1024 // 1MB

		// Use stream for large files to reduce memory pressure
		if (stats.size > LARGE_FILE_THRESHOLD) {
			return this.readFileStream(filePath)
		}

		// Use regular read for smaller files (faster for small files)
		return fs.promises.readFile(filePath, 'utf8')
	}

	/**
	 * Read large file using stream for better memory efficiency
	 */
	private async readFileStream(filePath: string): Promise<string> {
		return new Promise((resolve, reject) => {
			const chunks: string[] = []
			const stream = fs.createReadStream(filePath, { encoding: 'utf8' })

			stream.on('data', (chunk: string | Buffer) => {
				// With encoding: 'utf8', chunk is always string, but TypeScript types allow Buffer
				chunks.push(
					typeof chunk === 'string' ? chunk : chunk.toString('utf8'),
				)
			})

			stream.on('end', () => {
				resolve(chunks.join(''))
			})

			stream.on('error', (error) => {
				reject(error)
			})
		})
	}

	/**
	 * Wait for all queued reads to complete
	 */
	async waitForCompletion(): Promise<void> {
		while (this.readQueue.length > 0 || this.activeReads > 0) {
			await new Promise((resolve) => setTimeout(resolve, 10))
		}
	}
}

// Global read queue instance
let globalReadQueue: ReadQueue | null = null

/**
 * Initialize the global read queue
 */
export function initReadQueue(maxConcurrentReads = 5, prefetchSize = 10): void {
	globalReadQueue = new ReadQueue(maxConcurrentReads, prefetchSize)
}

/**
 * Prefetch files for better read performance
 */
export async function prefetchFiles(filePaths: string[]): Promise<void> {
	if (globalReadQueue) {
		await globalReadQueue.prefetchFiles(filePaths)
	}
}

/**
 * Get the global read queue
 */
export function getReadQueue(): ReadQueue | null {
	return globalReadQueue
}

/**
 * Wait for all queued reads to complete
 */
export async function waitForReadQueue(): Promise<void> {
	if (globalReadQueue) {
		await globalReadQueue.waitForCompletion()
	}
}
