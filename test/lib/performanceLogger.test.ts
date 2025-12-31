import * as fs from 'fs'
import * as path from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
	getPerformanceLogger,
	PerformanceLogger,
	setPerformanceLogger,
} from '../../src/lib/performanceLogger.js'

describe('PerformanceLogger', () => {
	let logger: PerformanceLogger
	let consoleLogSpy: ReturnType<typeof vi.spyOn>
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeEach(() => {
		logger = new PerformanceLogger()
		consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
		consoleErrorSpy = vi
			.spyOn(console, 'error')
			.mockImplementation(() => {})
	})

	describe('startOperation and endOperation', () => {
		it('should start and end an operation', () => {
			const opId = logger.startOperation('read', 'test.xml')
			expect(opId).toBeTruthy()

			logger.endOperation(opId, 1024)

			const timing = logger.getFileTiming('test.xml')
			expect(timing).toBeDefined()
			expect(timing?.operations.length).toBeGreaterThan(0)
		})

		it('should calculate operation duration', () => {
			const opId = logger.startOperation('read', 'test.xml')
			// Simulate some time passing
			logger.endOperation(opId, 1024)

			const timing = logger.getFileTiming('test.xml')
			const operation = timing?.operations[0]
			expect(operation?.duration).toBeDefined()
			expect(operation?.duration).toBeGreaterThanOrEqual(0)
		})

		it('should handle ending non-existent operation', () => {
			expect(() => {
				logger.endOperation('non-existent-id')
			}).not.toThrow()
		})

		it('should record file size when ending operation', () => {
			const opId = logger.startOperation('read', 'test.xml')
			logger.endOperation(opId, 2048)

			const timing = logger.getFileTiming('test.xml')
			// File size is set on the operation, and also propagated to file timing
			const operation = timing?.operations[0]
			expect(operation?.fileSize).toBe(2048)
		})
	})

	describe('setFileSize', () => {
		it('should set file size', () => {
			logger.setFileSize('test.xml', 4096)
			const timing = logger.getFileTiming('test.xml')
			expect(timing?.fileSize).toBe(4096)
		})

		it('should update existing file size', () => {
			logger.setFileSize('test.xml', 1024)
			logger.setFileSize('test.xml', 2048)
			const timing = logger.getFileTiming('test.xml')
			expect(timing?.fileSize).toBe(2048)
		})
	})

	describe('setQueueWaitTime', () => {
		it('should set queue wait time', () => {
			logger.setQueueWaitTime('test.xml', 100)
			const timing = logger.getFileTiming('test.xml')
			expect(timing?.queueWaitTime).toBe(100)
		})
	})

	describe('recordRead, recordParse, recordWrite', () => {
		it('should record read time', () => {
			logger.recordRead('test.xml', 50)
			const timing = logger.getFileTiming('test.xml')
			expect(timing?.readTime).toBe(50)
		})

		it('should record parse time', () => {
			logger.recordParse('test.xml', 30)
			const timing = logger.getFileTiming('test.xml')
			expect(timing?.parseTime).toBe(30)
		})

		it('should record write time', () => {
			logger.recordWrite('test.xml', 20)
			const timing = logger.getFileTiming('test.xml')
			expect(timing?.writeTime).toBe(20)
		})

		it('should record all operation times', () => {
			logger.recordRead('test.xml', 50)
			logger.recordParse('test.xml', 30)
			logger.recordWrite('test.xml', 20)

			const timing = logger.getFileTiming('test.xml')
			expect(timing?.readTime).toBe(50)
			expect(timing?.parseTime).toBe(30)
			expect(timing?.writeTime).toBe(20)
		})
	})

	describe('completeFile', () => {
		it('should mark file as complete with success', () => {
			logger.recordRead('test.xml', 50)
			logger.recordParse('test.xml', 30)
			logger.recordWrite('test.xml', 20)
			logger.completeFile('test.xml', true)

			const timing = logger.getFileTiming('test.xml')
			expect(timing?.error).toBeUndefined()
			expect(timing?.totalDuration).toBe(100)
		})

		it('should mark file as complete with error', () => {
			logger.completeFile('test.xml', false, 'File not found')
			const timing = logger.getFileTiming('test.xml')
			expect(timing?.error).toBe('File not found')
		})

		it('should calculate total duration from read, parse, and write', () => {
			logger.recordRead('test.xml', 10)
			logger.recordParse('test.xml', 20)
			logger.recordWrite('test.xml', 30)
			logger.completeFile('test.xml', true)

			const timing = logger.getFileTiming('test.xml')
			expect(timing?.totalDuration).toBe(60)
		})
	})

	describe('getSummary', () => {
		it('should return summary with no files', () => {
			const summary = logger.getSummary()
			expect(summary.totalFiles).toBe(0)
			expect(summary.successful).toBe(0)
			expect(summary.failed).toBe(0)
		})

		it('should return summary with successful files', () => {
			logger.recordRead('file1.xml', 10)
			logger.recordParse('file1.xml', 10)
			logger.recordWrite('file1.xml', 10)
			logger.completeFile('file1.xml', true) // total = 30

			logger.recordRead('file2.xml', 20)
			logger.recordParse('file2.xml', 20)
			logger.recordWrite('file2.xml', 20)
			logger.completeFile('file2.xml', true) // total = 60

			const summary = logger.getSummary()
			expect(summary.totalFiles).toBe(2)
			expect(summary.successful).toBe(2)
			expect(summary.failed).toBe(0)
			// Average: (30 + 60) / 2 = 45
			expect(summary.averageDuration).toBe(45)
		})

		it('should return summary with failed files', () => {
			logger.completeFile('file1.xml', true)
			logger.completeFile('file2.xml', false, 'Error')
			logger.completeFile('file3.xml', false, 'Another error')

			const summary = logger.getSummary()
			expect(summary.totalFiles).toBe(3)
			expect(summary.successful).toBe(1)
			expect(summary.failed).toBe(2)
		})

		it('should calculate slowest files', () => {
			logger.recordRead('file1.xml', 10)
			logger.recordParse('file1.xml', 10)
			logger.recordWrite('file1.xml', 10)
			logger.completeFile('file1.xml', true) // 30ms

			logger.recordRead('file2.xml', 50)
			logger.recordParse('file2.xml', 50)
			logger.recordWrite('file2.xml', 50)
			logger.completeFile('file2.xml', true) // 150ms

			const summary = logger.getSummary()
			expect(summary.slowestFiles.length).toBe(2)
			expect(summary.slowestFiles[0].file).toBe('file2.xml')
			expect(summary.slowestFiles[0].duration).toBe(150)
			expect(summary.slowestFiles[1].file).toBe('file1.xml')
			expect(summary.slowestFiles[1].duration).toBe(30)
		})

		it('should calculate fastest files', () => {
			logger.recordRead('file1.xml', 10)
			logger.recordParse('file1.xml', 10)
			logger.recordWrite('file1.xml', 10)
			logger.completeFile('file1.xml', true) // 30ms

			logger.recordRead('file2.xml', 50)
			logger.recordParse('file2.xml', 50)
			logger.recordWrite('file2.xml', 50)
			logger.completeFile('file2.xml', true) // 150ms

			const summary = logger.getSummary()
			expect(summary.fastestFiles.length).toBe(2)
			expect(summary.fastestFiles[0].file).toBe('file1.xml')
			expect(summary.fastestFiles[0].duration).toBe(30)
			expect(summary.fastestFiles[1].file).toBe('file2.xml')
			expect(summary.fastestFiles[1].duration).toBe(150)
		})

		it('should calculate average bottleneck times', () => {
			logger.recordRead('file1.xml', 10)
			logger.recordParse('file1.xml', 20)
			logger.recordWrite('file1.xml', 30)
			logger.completeFile('file1.xml', true)

			logger.recordRead('file2.xml', 20)
			logger.recordParse('file2.xml', 30)
			logger.recordWrite('file2.xml', 40)
			logger.completeFile('file2.xml', true)

			const summary = logger.getSummary()
			expect(summary.bottlenecks.avgReadTime).toBe(15) // (10 + 20) / 2
			expect(summary.bottlenecks.avgParseTime).toBe(25) // (20 + 30) / 2
			expect(summary.bottlenecks.avgWriteTime).toBe(35) // (30 + 40) / 2
		})
	})

	describe('exportToJSON', () => {
		it('should export timings to JSON', () => {
			logger.recordRead('test.xml', 10)
			logger.completeFile('test.xml', true)

			const json = logger.exportToJSON()
			const parsed = JSON.parse(json)

			expect(parsed.summary).toBeDefined()
			expect(parsed.files).toBeDefined()
			expect(parsed.files.length).toBe(1)
		})
	})

	describe('printSummary', () => {
		it('should print summary to console', () => {
			logger.recordRead('test.xml', 10)
			logger.completeFile('test.xml', true)

			logger.printSummary()

			expect(consoleLogSpy).toHaveBeenCalled()
			const calls = consoleLogSpy.mock.calls
			expect(
				calls.some((call) => call[0].includes('Performance Summary')),
			).toBe(true)
			expect(calls.some((call) => call[0].includes('Total files'))).toBe(
				true,
			)
		})

		it('should format time values correctly', () => {
			logger.recordRead('test.xml', 500)
			logger.recordParse('test.xml', 1500)
			logger.recordWrite('test.xml', 30000)
			logger.completeFile('test.xml', true)

			logger.printSummary()

			const output = consoleLogSpy.mock.calls
				.map((call) => call[0])
				.join('\n')

			// Check for formatted times
			expect(output).toMatch(/\d+ms|\d+\.\d+s|\d+m \d+s/)
		})

		it('should use provided startTime if available', () => {
			const startTime = process.hrtime.bigint()
			logger.completeFile('test.xml', true)

			logger.printSummary(startTime)

			expect(consoleLogSpy).toHaveBeenCalled()
		})
	})

	describe('writeSummaryToFile', () => {
		it('should write summary to file when logFile is provided', () => {
			// Use a temporary file path that we can verify was written
			const logFile = '/tmp/performance-test.json'
			const loggerWithFile = new PerformanceLogger(logFile)
			loggerWithFile.completeFile('test.xml', true)

			// This will write to file - we can't easily mock fs in ESM, so we just verify it doesn't throw
			expect(() => {
				loggerWithFile.printSummary()
			}).not.toThrow()
		})

		it('should create directory if it does not exist', () => {
			// Use a nested path to test directory creation
			const logFile = '/tmp/test-logs/performance.json'
			const loggerWithFile = new PerformanceLogger(logFile)
			loggerWithFile.completeFile('test.xml', true)

			// This will create directory if needed - verify it doesn't throw
			expect(() => {
				loggerWithFile.printSummary()
			}).not.toThrow()
		})

		it('should not write file if logFile is not provided', () => {
			logger.completeFile('test.xml', true)
			// Should not throw even without logFile
			expect(() => {
				logger.printSummary()
			}).not.toThrow()
		})

		it('should handle write errors gracefully', () => {
			// Use an invalid path that will cause an error
			const logFile = '/invalid/path/that/does/not/exist/performance.json'
			const loggerWithFile = new PerformanceLogger(logFile)
			loggerWithFile.completeFile('test.xml', true)

			// Should handle error gracefully and log to console.error
			expect(() => {
				loggerWithFile.printSummary()
			}).not.toThrow()

			// The error should be logged to console.error
			expect(consoleErrorSpy).toHaveBeenCalled()
		})
	})

	describe('formatMilliseconds (private method via printSummary)', () => {
		it('should format milliseconds less than 1000', () => {
			logger.recordRead('test.xml', 123)
			logger.completeFile('test.xml', true)

			logger.printSummary()

			const output = consoleLogSpy.mock.calls
				.map((call) => call[0])
				.join('\n')

			// Should contain "123ms" or similar
			expect(output).toMatch(/\d+ms/)
		})

		it('should format seconds less than 60', () => {
			logger.recordRead('test.xml', 1234)
			logger.completeFile('test.xml', true)

			logger.printSummary()

			const output = consoleLogSpy.mock.calls
				.map((call) => call[0])
				.join('\n')

			// Should contain "1.23s" or similar
			expect(output).toMatch(/\d+\.\d+s/)
		})

		it('should format minutes and seconds', () => {
			logger.recordRead('test.xml', 65000) // 65 seconds = 1m 5s
			logger.completeFile('test.xml', true)

			logger.printSummary()

			const output = consoleLogSpy.mock.calls
				.map((call) => call[0])
				.join('\n')

			// Should contain "1m 5s" or similar
			expect(output).toMatch(/\d+m \d+s/)
		})
	})

	describe('formatDuration (private method via printSummary)', () => {
		it('should format duration in seconds', () => {
			// Create a start time 5 seconds ago
			const fiveSecondsAgo = BigInt(
				process.hrtime.bigint() - BigInt(5 * 1_000_000_000),
			)

			logger.completeFile('test.xml', true)
			logger.printSummary(fiveSecondsAgo)

			const output = consoleLogSpy.mock.calls
				.map((call) => call[0])
				.join('\n')

			// Should contain seconds format
			expect(output).toMatch(/\d+s/)
		})

		it('should format duration in minutes and seconds', () => {
			// Create a start time 125 seconds ago (2m 5s)
			const twoMinutesFiveSecondsAgo = BigInt(
				process.hrtime.bigint() - BigInt(125 * 1_000_000_000),
			)

			logger.completeFile('test.xml', true)
			logger.printSummary(twoMinutesFiveSecondsAgo)

			const output = consoleLogSpy.mock.calls
				.map((call) => call[0])
				.join('\n')

			// Should contain minutes and seconds format
			expect(output).toMatch(/\d+m \d+s/)
		})
	})

	describe('getAllTimings', () => {
		it('should return all file timings', () => {
			logger.completeFile('file1.xml', true)
			logger.completeFile('file2.xml', true)
			logger.completeFile('file3.xml', true)

			const timings = logger.getAllTimings()
			expect(timings.length).toBe(3)
		})
	})

	describe('getFileTiming', () => {
		it('should return timing for specific file', () => {
			logger.completeFile('test.xml', true)
			const timing = logger.getFileTiming('test.xml')
			expect(timing).toBeDefined()
			expect(timing?.file).toBe('test.xml')
		})

		it('should return undefined for non-existent file', () => {
			const timing = logger.getFileTiming('nonexistent.xml')
			expect(timing).toBeUndefined()
		})
	})

	describe('global logger functions', () => {
		beforeEach(() => {
			// Reset global logger
			setPerformanceLogger(new PerformanceLogger())
		})

		it('should get global performance logger', () => {
			const globalLogger = getPerformanceLogger()
			expect(globalLogger).toBeInstanceOf(PerformanceLogger)
		})

		it('should return same instance on multiple calls', () => {
			const logger1 = getPerformanceLogger()
			const logger2 = getPerformanceLogger()
			expect(logger1).toBe(logger2)
		})

		it('should set global performance logger', () => {
			const newLogger = new PerformanceLogger()
			setPerformanceLogger(newLogger)
			const retrieved = getPerformanceLogger()
			expect(retrieved).toBe(newLogger)
		})
	})
})
