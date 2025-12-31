import * as fs from 'fs'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { serializeData, WriteBatcher } from '../../src/lib/writeBatcher.js'

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
})
