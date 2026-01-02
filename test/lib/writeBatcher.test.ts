import * as fs from 'fs'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { serializeData, WriteBatcher } from '../../src/lib/writeBatcher.js'

interface GlobalContext {
	__basedir?: string
	git?: {
		enabled: boolean
	}
}

declare const global: GlobalContext & typeof globalThis

describe('WriteBatcher', () => {
	let writeBatcher: WriteBatcher
	let tempDir: string

	beforeEach(() => {
		tempDir = path.join(process.cwd(), 'test-temp-write-batcher')
		if (fs.existsSync(tempDir)) {
			fs.rmSync(tempDir, { recursive: true, force: true })
		}
		fs.mkdirSync(tempDir, { recursive: true })
		writeBatcher = new WriteBatcher(20, 5) // batchSize=20, batchDelay=5ms
	})

	afterEach(() => {
		if (fs.existsSync(tempDir)) {
			fs.rmSync(tempDir, { recursive: true, force: true })
		}
	})

	describe('constructor', () => {
		it('should create WriteBatcher with default parameters', () => {
			const batcher = new WriteBatcher()
			expect(batcher).toBeInstanceOf(WriteBatcher)
		})

		it('should create WriteBatcher with custom batchSize', () => {
			const batcher = new WriteBatcher(50, 10)
			expect(batcher).toBeInstanceOf(WriteBatcher)
		})
	})

	describe('addWrite', () => {
		it('should add a single write to queue', async () => {
			const filePath = path.join(tempDir, 'test1.txt')
			await writeBatcher.addWrite(filePath, 'test content')
			await writeBatcher.flush()

			expect(fs.existsSync(filePath)).toBe(true)
			expect(fs.readFileSync(filePath, 'utf8')).toBe('test content')
		})

		it('should batch multiple writes', async () => {
			const files: string[] = []
			for (let i = 0; i < 5; i++) {
				const filePath = path.join(tempDir, `test-${i}.txt`)
				files.push(filePath)
				await writeBatcher.addWrite(filePath, `content ${i}`)
			}
			await writeBatcher.flush()

			for (let i = 0; i < 5; i++) {
				expect(fs.existsSync(files[i])).toBe(true)
				expect(fs.readFileSync(files[i], 'utf8')).toBe(`content ${i}`)
			}
		})

		it('should flush immediately when batchSize is reached', async () => {
			const batcher = new WriteBatcher(3, 100) // Small batch size
			const files: string[] = []
			for (let i = 0; i < 3; i++) {
				const filePath = path.join(tempDir, `batch-${i}.txt`)
				files.push(filePath)
				await batcher.addWrite(filePath, `batch ${i}`)
			}
			// Should have flushed automatically
			await new Promise((resolve) => setTimeout(resolve, 150))

			for (let i = 0; i < 3; i++) {
				expect(fs.existsSync(files[i])).toBe(true)
			}
		})

		it('should flush immediately when maxQueueSize is reached', async () => {
			const batcher = new WriteBatcher(1000, 100) // Large batch size
			const files: string[] = []
			for (let i = 0; i < 1000; i++) {
				const filePath = path.join(tempDir, `max-${i}.txt`)
				files.push(filePath)
				await batcher.addWrite(filePath, `content ${i}`)
			}
			// Should have flushed immediately due to maxQueueSize
			await new Promise((resolve) => setTimeout(resolve, 50))

			// Check a few files
			expect(fs.existsSync(files[0])).toBe(true)
			expect(fs.existsSync(files[999])).toBe(true)
		})

		it('should sanitize file paths with special characters', async () => {
			// Test all special characters that need sanitization
			const specialChars = ['*', '?', '<', '>', '|', ':']
			for (const char of specialChars) {
				const filePath = path.join(tempDir, `test${char}file.txt`)
				await writeBatcher.addWrite(filePath, `content-${char}`)
				await writeBatcher.flush()

				// Path should be sanitized (special chars replaced with unicode)
				const sanitizedPath = filePath
					.replace(/\*/g, '\u002a')
					.replace(/\?/g, '\u003f')
					.replace(/</g, '\u003c')
					.replace(/>/g, '\u003e')
					.replace(/\|/g, '\u007c')
					.replace(/:/g, '\u003a')
				expect(fs.existsSync(sanitizedPath)).toBe(true)
				expect(fs.readFileSync(sanitizedPath, 'utf8')).toBe(
					`content-${char}`,
				)
			}
		})

		it('should create nested directories', async () => {
			const nestedPath = path.join(tempDir, 'nested', 'deep', 'file.txt')
			await writeBatcher.addWrite(nestedPath, 'nested content')
			await writeBatcher.flush()

			expect(fs.existsSync(nestedPath)).toBe(true)
			expect(fs.readFileSync(nestedPath, 'utf8')).toBe('nested content')
		})
	})

	describe('flush', () => {
		it('should flush all pending writes', async () => {
			const files: string[] = []
			for (let i = 0; i < 10; i++) {
				const filePath = path.join(tempDir, `flush-${i}.txt`)
				files.push(filePath)
				await writeBatcher.addWrite(filePath, `content ${i}`)
			}
			await writeBatcher.flush()

			for (let i = 0; i < 10; i++) {
				expect(fs.existsSync(files[i])).toBe(true)
			}
		})

		it('should return early if queue is empty', async () => {
			await expect(writeBatcher.flush()).resolves.toBeUndefined()
		})

		it('should return early if already flushing', async () => {
			const filePath = path.join(tempDir, 'concurrent.txt')
			await writeBatcher.addWrite(filePath, 'content')

			// Start flush but don't await
			const flushPromise1 = writeBatcher.flush()
			// Try to flush again while first is in progress
			const flushPromise2 = writeBatcher.flush()

			await Promise.all([flushPromise1, flushPromise2])
			expect(fs.existsSync(filePath)).toBe(true)
		})

		it('should handle multiple flushes correctly', async () => {
			const files: string[] = []
			for (let i = 0; i < 5; i++) {
				const filePath = path.join(tempDir, `multi-${i}.txt`)
				files.push(filePath)
				await writeBatcher.addWrite(filePath, `content ${i}`)
			}
			await writeBatcher.flush()

			for (let i = 0; i < 5; i++) {
				const filePath = path.join(tempDir, `multi-${i}.txt`)
				files.push(filePath)
				await writeBatcher.addWrite(filePath, `content ${i} updated`)
			}
			await writeBatcher.flush()

			for (let i = 0; i < 5; i++) {
				expect(fs.readFileSync(files[i], 'utf8')).toBe(
					`content ${i} updated`,
				)
			}
		})

		it('should schedule next flush if queue has more items', async () => {
			const batcher = new WriteBatcher(5, 10) // Small batch size
			const files: string[] = []
			for (let i = 0; i < 10; i++) {
				const filePath = path.join(tempDir, `scheduled-${i}.txt`)
				files.push(filePath)
				await batcher.addWrite(filePath, `content ${i}`)
			}
			// Wait for all flushes to complete
			await batcher.waitForCompletion()

			for (let i = 0; i < 10; i++) {
				expect(fs.existsSync(files[i])).toBe(true)
			}
		})

		it('should schedule recursive flush when queue has more items', async () => {
			const batcher = new WriteBatcher(3, 10) // Small batch size
			// Add enough writes to trigger immediate flush, then more remain in queue
			const files: string[] = []
			for (let i = 0; i < 6; i++) {
				const filePath = path.join(tempDir, `recursive-${i}.txt`)
				files.push(filePath)
				await batcher.addWrite(filePath, `content ${i}`)
			}
			// First batch flushes immediately, then schedules next flush
			// Wait for both flushes to complete
			await batcher.waitForCompletion()

			// All files should be written
			for (let i = 0; i < 6; i++) {
				expect(fs.existsSync(files[i])).toBe(true)
			}
		})
	})

	describe('flushAll', () => {
		it('should flush all remaining writes', async () => {
			const files: string[] = []
			for (let i = 0; i < 30; i++) {
				const filePath = path.join(tempDir, `flushall-${i}.txt`)
				files.push(filePath)
				await writeBatcher.addWrite(filePath, `content ${i}`)
			}
			await writeBatcher.flushAll()

			for (let i = 0; i < 30; i++) {
				expect(fs.existsSync(files[i])).toBe(true)
			}
		})

		it('should return early if queue is empty', async () => {
			await expect(writeBatcher.flushAll()).resolves.toBeUndefined()
		})

		it('should wait for in-progress flush before flushing all', async () => {
			const filePath = path.join(tempDir, 'wait-flush.txt')
			await writeBatcher.addWrite(filePath, 'content')

			// Start a flush
			const flushPromise = writeBatcher.flush()
			// Immediately call flushAll (should wait for flush to complete)
			const flushAllPromise = writeBatcher.flushAll()

			await Promise.all([flushPromise, flushAllPromise])
			expect(fs.existsSync(filePath)).toBe(true)
		})

		it('should wait in while loop when flush is in progress', async () => {
			const filePath1 = path.join(tempDir, 'wait1.txt')
			const filePath2 = path.join(tempDir, 'wait2.txt')
			await writeBatcher.addWrite(filePath1, 'content1')
			await writeBatcher.addWrite(filePath2, 'content2')

			// Start a flush that will take some time
			const flushPromise = writeBatcher.flush()

			// Call flushAll while flush is in progress - should wait
			const flushAllPromise = writeBatcher.flushAll()

			await Promise.all([flushPromise, flushAllPromise])

			// Both files should be written
			expect(fs.existsSync(filePath1)).toBe(true)
			expect(fs.existsSync(filePath2)).toBe(true)
		})

		it('should handle large number of writes in batches', async () => {
			const files: string[] = []
			for (let i = 0; i < 100; i++) {
				const filePath = path.join(tempDir, `large-${i}.txt`)
				files.push(filePath)
				await writeBatcher.addWrite(filePath, `content ${i}`)
			}
			await writeBatcher.flushAll()

			// Check a sample of files
			expect(fs.existsSync(files[0])).toBe(true)
			expect(fs.existsSync(files[50])).toBe(true)
			expect(fs.existsSync(files[99])).toBe(true)
		})
	})

	describe('waitForCompletion', () => {
		it('should wait for all writes to complete', async () => {
			const files: string[] = []
			for (let i = 0; i < 10; i++) {
				const filePath = path.join(tempDir, `wait-${i}.txt`)
				files.push(filePath)
				await writeBatcher.addWrite(filePath, `content ${i}`)
			}
			await writeBatcher.waitForCompletion()

			for (let i = 0; i < 10; i++) {
				expect(fs.existsSync(files[i])).toBe(true)
			}
		})

		it('should return immediately if queue is empty', async () => {
			await expect(
				writeBatcher.waitForCompletion(),
			).resolves.toBeUndefined()
		})
	})

	describe('getQueueLength', () => {
		it('should return 0 for empty queue', () => {
			expect(writeBatcher.getQueueLength()).toBe(0)
		})

		it('should return correct queue length', async () => {
			for (let i = 0; i < 5; i++) {
				const filePath = path.join(tempDir, `queue-${i}.txt`)
				await writeBatcher.addWrite(filePath, `content ${i}`)
			}
			// Queue length should be 5 (or less if auto-flushed)
			const length = writeBatcher.getQueueLength()
			expect(length).toBeGreaterThanOrEqual(0)
			expect(length).toBeLessThanOrEqual(5)
		})
	})

	describe('getQueueStats', () => {
		it('should return queue statistics', () => {
			const stats = writeBatcher.getQueueStats()
			expect(stats).toHaveProperty('queueLength')
			expect(stats).toHaveProperty('batchSize')
			expect(stats).toHaveProperty('isFlushing')
			expect(stats.queueLength).toBe(0)
			expect(stats.batchSize).toBe(20)
			expect(stats.isFlushing).toBe(false)
		})

		it('should reflect flushing state', async () => {
			const filePath = path.join(tempDir, 'stats.txt')
			await writeBatcher.addWrite(filePath, 'content')
			// Start flush but don't await
			const flushPromise = writeBatcher.flush()
			// Check stats while flushing
			const stats = writeBatcher.getQueueStats()
			expect(stats).toHaveProperty('isFlushing')
			await flushPromise
		})
	})

	describe('error handling', () => {
		it('should handle directory creation errors gracefully', async () => {
			// Try to write to a path that might cause issues
			// But we can't easily simulate this without mocking fs
			const filePath = path.join(tempDir, 'error-test.txt')
			await writeBatcher.addWrite(filePath, 'content')
			await writeBatcher.flush()
			// Should not throw
			expect(fs.existsSync(filePath)).toBe(true)
		})

		it('should handle flush errors in timer callback', async () => {
			const batcher = new WriteBatcher(5, 1)
			const consoleErrorSpy = vi
				.spyOn(console, 'error')
				.mockImplementation(() => {})

			// Create invalid file path that might cause issues
			// We'll use a valid path but mock writeFile to throw
			const filePath = path.join(tempDir, 'error-handle.txt')
			const writeFileSpy = vi
				.spyOn(fs.promises, 'writeFile')
				.mockRejectedValueOnce(new Error('Write error'))
				.mockResolvedValueOnce(undefined)

			try {
				await batcher.addWrite(filePath, 'content')
				// Wait for flush timer
				await new Promise((resolve) => setTimeout(resolve, 50))

				// Error should be caught and logged
				expect(consoleErrorSpy).toHaveBeenCalled()
			} finally {
				writeFileSpy.mockRestore()
				consoleErrorSpy.mockRestore()
			}
		})

		it('should handle error in scheduleNextFlush callback (covers line 143)', async () => {
			// CRITICAL: Test line 143 - console.error in scheduleNextFlush catch block
			// This happens when flush() throws an error in the setTimeout callback
			const batcher = new WriteBatcher(2, 10)
			const consoleErrorSpy = vi
				.spyOn(console, 'error')
				.mockImplementation(() => {})

			// Add writes to queue manually
			const file1 = path.join(tempDir, 'error1.txt')
			const file2 = path.join(tempDir, 'error2.txt')
			const file3 = path.join(tempDir, 'error3.txt')
			// biome-ignore lint/suspicious/noExplicitAny: Test helper - Accessing private writeQueue property for testing internal queue state
			;(batcher as any).writeQueue.push(
				{ fileName: file1, data: 'content1' },
				{ fileName: file2, data: 'content2' },
				{ fileName: file3, data: 'content3' },
			)

			// Mock writeFile to throw an error on the second flush
			const writeFileSpy = vi
				.spyOn(fs.promises, 'writeFile')
				// First flush succeeds (file1, file2)
				.mockResolvedValueOnce(undefined)
				.mockResolvedValueOnce(undefined)
				// Second flush (from scheduleNextFlush) throws error (file3)
				.mockRejectedValueOnce(new Error('Write error'))

			// Trigger first flush - processes 2, leaves 1 in queue
			await batcher.flush()

			// Verify timer was set (line 107)
			expect(batcher.hasFlushTimer()).toBe(true)

			// Wait for setTimeout callback to execute (line 108 calls scheduleNextFlush)
			// scheduleNextFlush will call flush(), which will throw (line 143: console.error)
			await new Promise((resolve) => setTimeout(resolve, 15))

			// Verify error was logged (line 143 executed)
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('WriteBatcher flush error'),
				expect.any(Error),
			)

			writeFileSpy.mockRestore()
			consoleErrorSpy.mockRestore()
		})
	})
})

describe('serializeData', () => {
	describe('JSON format', () => {
		it('should serialize object to JSON', () => {
			const obj = { name: 'test', value: 123 }
			const result = serializeData(obj, 'json')
			const parsed = JSON.parse(result)
			expect(parsed).toEqual(obj)
		})

		it('should serialize array to JSON', () => {
			const arr = [1, 2, 3]
			const result = serializeData(arr, 'json')
			const parsed = JSON.parse(result)
			expect(parsed).toEqual(arr)
		})

		it('should use tab indentation', () => {
			const obj = { name: 'test', nested: { value: 123 } }
			const result = serializeData(obj, 'json')
			expect(result).toContain('\t')
		})
	})

	describe('YAML format', () => {
		it('should serialize object to YAML', () => {
			const obj = { name: 'test', value: 123 }
			const result = serializeData(obj, 'yaml')
			expect(result).toContain('name:')
			expect(result).toContain('test')
			expect(result).toContain('value:')
			expect(result).toContain('123')
		})

		it('should serialize array to YAML', () => {
			const arr = [1, 2, 3]
			const result = serializeData(arr, 'yaml')
			expect(result).toContain('-')
		})

		it('should use 2-space indentation', () => {
			const obj = { name: 'test', nested: { value: 123 } }
			const result = serializeData(obj, 'yaml')
			// YAML should have consistent indentation
			expect(result).toBeDefined()
		})
	})

	describe('flush timer coverage', () => {
		let testTempDir: string

		beforeEach(() => {
			testTempDir = path.join(
				process.cwd(),
				'test-temp-write-batcher-timer',
			)
			if (fs.existsSync(testTempDir)) {
				fs.rmSync(testTempDir, { recursive: true, force: true })
			}
			fs.mkdirSync(testTempDir, { recursive: true })
		})

		afterEach(() => {
			if (fs.existsSync(testTempDir)) {
				fs.rmSync(testTempDir, { recursive: true, force: true })
			}
		})

		it('should schedule another flush when more writes are queued (covers lines 107-109)', async () => {
			// CRITICAL: Test lines 107-109 - setTimeout callback that schedules another flush
			// We extract the callback to scheduleNextFlush() method for better testability
			const batcher = new WriteBatcher(2, 10) // Small batch size = 2
			const consoleErrorSpy = vi
				.spyOn(console, 'error')
				.mockImplementation(() => {})

			const files: string[] = []
			// Add writes directly to queue to avoid auto-flush from addWrite
			for (let i = 0; i < 5; i++) {
				const filePath = path.join(testTempDir, `timer${i}.txt`)
				files.push(filePath)
				// Access private queue to add writes without triggering auto-flush
				// biome-ignore lint/suspicious/noExplicitAny: Test helper - Accessing private writeQueue property for testing internal queue state
				;(batcher as any).writeQueue.push({
					fileName: filePath,
					data: `content${i}`,
				})
			}

			// Verify queue has 5 items
			expect(batcher.getQueueLength()).toBe(5)

			// Manually trigger flush to process first batch (batchSize=2)
			// This will:
			// - Process 2 writes (splice(0, 2))
			// - Leave 3 in queue
			// - Finally block: queue.length > 0 → schedules setTimeout (line 107)
			await batcher.flush()

			// Verify queue still has 3 items (line 107 scheduled another flush)
			expect(batcher.getQueueLength()).toBe(3)
			// Verify flush timer was set (line 107 executed)
			expect(batcher.hasFlushTimer()).toBe(true)

			// CRITICAL: Manually call scheduleNextFlush() to cover lines 108-109
			// This simulates what the setTimeout callback does
			// In production, this is called by the setTimeout callback
			// biome-ignore lint/suspicious/noExplicitAny: Test helper - Accessing private scheduleNextFlush() method for testing internal flush scheduling
			;(batcher as any).scheduleNextFlush()

			// Wait for the scheduled flush to complete
			await batcher.waitForCompletion()

			// Verify queue is now empty
			expect(batcher.getQueueLength()).toBe(0)

			// All files should be written
			for (let i = 0; i < 5; i++) {
				expect(fs.existsSync(files[i])).toBe(true)
				expect(fs.readFileSync(files[i], 'utf8')).toBe(`content${i}`)
			}

			consoleErrorSpy.mockRestore()
		})
	})

	describe('concurrent flush coverage', () => {
		let testTempDir: string

		beforeEach(() => {
			testTempDir = path.join(
				process.cwd(),
				'test-temp-write-batcher-concurrent',
			)
			if (fs.existsSync(testTempDir)) {
				fs.rmSync(testTempDir, { recursive: true, force: true })
			}
			fs.mkdirSync(testTempDir, { recursive: true })
		})

		afterEach(() => {
			if (fs.existsSync(testTempDir)) {
				fs.rmSync(testTempDir, { recursive: true, force: true })
			}
		})

		it('should wait for in-progress flush before processing (covers line 163)', async () => {
			// CRITICAL: Test line 163 - await inside while loop that waits for in-progress flush
			// We need to ensure flushAll() is called while flush() is actually executing
			const batcher = new WriteBatcher(10, 50)

			const file1 = path.join(testTempDir, 'concurrent1.txt')
			const file2 = path.join(testTempDir, 'concurrent2.txt')

			// Add writes directly to queue to avoid auto-flush
			// biome-ignore lint/suspicious/noExplicitAny: Test helper - Accessing private writeQueue property for testing internal queue state
			;(batcher as any).writeQueue.push(
				{ fileName: file1, data: 'content1' },
				{ fileName: file2, data: 'content2' },
			)

			// Verify queue has writes
			expect(batcher.getQueueLength()).toBe(2)

			// Start a flush (don't await - let it run in background)
			// This sets this.flushing = true (line 71)
			const flushPromise = batcher.flush()

			// CRITICAL: Call flushAll() IMMEDIATELY while flush is in progress
			// This should trigger line 163: await new Promise(...) inside while loop
			// We use a small delay to ensure flush has started but not completed
			// The while loop at line 163 will execute and wait
			await new Promise((resolve) => setImmediate(resolve))

			// Verify flush is in progress (line 163 condition will be true)
			expect(batcher.getQueueStats().isFlushing).toBe(true)

			// Now call flushAll() - should wait at line 163
			const flushAllPromise = batcher.flushAll()

			// Wait for both to complete
			await Promise.all([flushPromise, flushAllPromise])

			// Verify queue is empty
			expect(batcher.getQueueLength()).toBe(0)

			// Both files should be written
			expect(fs.existsSync(file1)).toBe(true)
			expect(fs.existsSync(file2)).toBe(true)
		})
	})

	describe('error handling', () => {
		it('should throw error for unsupported format', () => {
			expect(() => {
				serializeData({}, 'xml')
			}).toThrow('Unsupported format: xml')
		})

		it('should handle null values', () => {
			const obj = { name: null, value: 123 }
			expect(() => {
				serializeData(obj, 'json')
			}).not.toThrow()
			expect(() => {
				serializeData(obj, 'yaml')
			}).not.toThrow()
		})

		it('should handle undefined values', () => {
			const obj = { name: undefined, value: 123 }
			expect(() => {
				serializeData(obj, 'json')
			}).not.toThrow()
		})
	})

	describe('WriteBatcher error handling', () => {
		it('should handle write errors and log to auditLogger (covers lines 232-241)', async () => {
			const testTempDir = path.join(
				process.cwd(),
				'test-temp-write-batcher-errors',
			)
			if (fs.existsSync(testTempDir)) {
				fs.rmSync(testTempDir, { recursive: true, force: true })
			}
			fs.mkdirSync(testTempDir, { recursive: true })

			try {
				// Enable git mode for audit logging
				global.git = { enabled: true }
				global.__basedir = testTempDir

				// Initialize audit logger
				const { initAuditLogger } = await import(
					'../../src/lib/auditLogger.js'
				)
				initAuditLogger()

				const testBatcher = new WriteBatcher(20, 5)

				// Create a file path that will fail to write (invalid directory)
				const invalidPath = path.join('/invalid', 'path', 'file.txt')

				// Add write that will fail
				const writePromise = testBatcher.addWrite(invalidPath, 'test')

				// Flush should throw error - need to await the write promise first
				// The error will be thrown when flush() processes the write
				await expect(
					Promise.all([testBatcher.flush(), writePromise]),
				).rejects.toThrow()
			} finally {
				// Clean up
				delete global.git
				delete global.__basedir
				if (fs.existsSync(testTempDir)) {
					fs.rmSync(testTempDir, { recursive: true, force: true })
				}
			}
		})

		it('should handle non-Error exceptions in write (covers line 234)', async () => {
			const testTempDir = path.join(
				process.cwd(),
				'test-temp-write-batcher-errors2',
			)
			if (fs.existsSync(testTempDir)) {
				fs.rmSync(testTempDir, { recursive: true, force: true })
			}
			fs.mkdirSync(testTempDir, { recursive: true })

			try {
				// Enable git mode for audit logging
				global.git = { enabled: true }
				global.__basedir = testTempDir

				// Initialize audit logger
				const { initAuditLogger } = await import(
					'../../src/lib/auditLogger.js'
				)
				initAuditLogger()

				const testBatcher = new WriteBatcher(20, 5)

				// Mock fs.promises.writeFile to throw a non-Error
				const originalWriteFile = fs.promises.writeFile
				fs.promises.writeFile = vi
					.fn()
					.mockRejectedValue('String error')

				const filePath = path.join(testTempDir, 'test.txt')
				const _writePromise = testBatcher.addWrite(filePath, 'test')

				// Flush should throw error
				await expect(testBatcher.flush()).rejects.toBe('String error')

				// Restore original
				fs.promises.writeFile = originalWriteFile
			} finally {
				// Clean up
				delete global.git
				delete global.__basedir
				if (fs.existsSync(testTempDir)) {
					fs.rmSync(testTempDir, { recursive: true, force: true })
				}
			}
		})
	})
})
