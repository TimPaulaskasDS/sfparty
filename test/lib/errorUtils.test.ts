import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
	createSanitizedError,
	handleFileError,
	sanitizeErrorPath,
} from '../../src/lib/errorUtils.js'

describe('errorUtils', () => {
	let originalBasedir: string | undefined

	beforeEach(() => {
		originalBasedir = global.__basedir
	})

	afterEach(() => {
		global.__basedir = originalBasedir
	})

	describe('sanitizeErrorPath', () => {
		it('should return basename for normal file paths', () => {
			const result = sanitizeErrorPath('/path/to/file.txt')
			expect(result).toBe('file.txt')
		})

		it('should return basename for paths with multiple segments', () => {
			const result = sanitizeErrorPath('/very/long/path/to/file.txt')
			expect(result).toBe('file.txt')
		})

		it('should replace global.__basedir with <workspace>', () => {
			global.__basedir = '/workspace'
			const result = sanitizeErrorPath('/workspace/src/file.txt')
			expect(result).toBe('<workspace>/src/file.txt')
		})

		it('should replace global.__basedir when path contains it', () => {
			global.__basedir = '/home/user/project'
			const result = sanitizeErrorPath(
				'/home/user/project/src/lib/file.ts',
			)
			expect(result).toBe('<workspace>/src/lib/file.ts')
		})

		it('should return basename when path does not contain global.__basedir', () => {
			global.__basedir = '/workspace'
			const result = sanitizeErrorPath('/other/path/file.txt')
			expect(result).toBe('file.txt')
		})

		it('should return "unknown" for empty string', () => {
			const result = sanitizeErrorPath('')
			expect(result).toBe('unknown')
		})

		it('should return "unknown" for non-string input', () => {
			// @ts-expect-error - Testing invalid input
			const result = sanitizeErrorPath(null)
			expect(result).toBe('unknown')
		})

		it('should return "unknown" for undefined input', () => {
			// @ts-expect-error - Testing invalid input
			const result = sanitizeErrorPath(undefined)
			expect(result).toBe('unknown')
		})

		it('should return "unknown" for number input', () => {
			// @ts-expect-error - Testing invalid input
			const result = sanitizeErrorPath(123)
			expect(result).toBe('unknown')
		})

		it('should handle paths with only filename', () => {
			const result = sanitizeErrorPath('file.txt')
			expect(result).toBe('file.txt')
		})
	})

	describe('createSanitizedError', () => {
		it('should create error with sanitized paths in message', () => {
			const originalError = new Error('File not found: /path/to/file.txt')
			const sanitized = createSanitizedError(originalError)

			expect(sanitized.message).toBe('File not found: file.txt')
			expect(sanitized).toBeInstanceOf(Error)
		})

		it('should preserve stack trace', () => {
			const originalError = new Error('Test error')
			originalError.stack = 'Error: Test error\n    at test.js:1:1'
			const sanitized = createSanitizedError(originalError)

			expect(sanitized.stack).toBe(originalError.stack)
		})

		it('should use custom path pattern regex', () => {
			const originalError = new Error(
				'Files: /file1.txt and /file2.txt not found',
			)
			const customPattern = /\/file\d\.txt/g
			const sanitized = createSanitizedError(originalError, customPattern)

			expect(sanitized.message).toContain('file1.txt')
			expect(sanitized.message).toContain('file2.txt')
		})

		it('should handle multiple paths in message', () => {
			const originalError = new Error(
				'Files /path/to/file1.txt and /path/to/file2.txt not found',
			)
			const sanitized = createSanitizedError(originalError)

			expect(sanitized.message).toContain('file1.txt')
			expect(sanitized.message).toContain('file2.txt')
		})

		it('should handle paths with global.__basedir', () => {
			global.__basedir = '/workspace'
			const originalError = new Error(
				'File not found: /workspace/src/file.txt',
			)
			const sanitized = createSanitizedError(originalError)

			expect(sanitized.message).toBe(
				'File not found: <workspace>/src/file.txt',
			)
		})

		it('should handle error without paths in message', () => {
			const originalError = new Error('Simple error message')
			const sanitized = createSanitizedError(originalError)

			expect(sanitized.message).toBe('Simple error message')
		})
	})

	describe('handleFileError', () => {
		it('should throw sanitized error for Error with path in message', () => {
			const error = new Error('File not found: /path/to/file.txt')
			const logger = { error: vi.fn() }

			expect(() => handleFileError(error, logger)).toThrow('file.txt')
			expect(logger.error).toHaveBeenCalledTimes(1)
			expect(logger.error).toHaveBeenCalledWith(
				expect.objectContaining({
					message: expect.stringContaining('file.txt'),
				}),
			)
		})

		it('should throw sanitized error and call logger', () => {
			const error = new Error('Error: /workspace/file.txt')
			const logger = { error: vi.fn() }

			expect(() => handleFileError(error, logger)).toThrow()
			expect(logger.error).toHaveBeenCalledTimes(1)
		})

		it('should throw error without sanitization when message has no paths', () => {
			const error = new Error('Simple error message')
			const logger = { error: vi.fn() }

			expect(() => handleFileError(error, logger)).toThrow(
				'Simple error message',
			)
			expect(logger.error).toHaveBeenCalledWith(error)
		})

		it('should throw non-Error values without sanitization', () => {
			const error = 'String error'
			const logger = { error: vi.fn() }

			expect(() => handleFileError(error, logger)).toThrow('String error')
			expect(logger.error).toHaveBeenCalledWith(error)
		})

		it('should throw non-Error values and call logger', () => {
			const error = { code: 'ENOENT', message: 'File not found' }
			const logger = { error: vi.fn() }

			expect(() => handleFileError(error, logger)).toThrow()
			expect(logger.error).toHaveBeenCalledWith(error)
		})

		it('should work without logger parameter', () => {
			const error = new Error('File not found: /path/to/file.txt')

			expect(() => handleFileError(error)).toThrow()
		})

		it('should handle Error with empty message', () => {
			const error = new Error('')
			const logger = { error: vi.fn() }

			expect(() => handleFileError(error, logger)).toThrow('')
			expect(logger.error).toHaveBeenCalledWith(error)
		})

		it('should handle Error with path but no slash in message', () => {
			const error = new Error('File not found: file.txt')
			const logger = { error: vi.fn() }

			expect(() => handleFileError(error, logger)).toThrow('file.txt')
			expect(logger.error).toHaveBeenCalledWith(error)
		})

		it('should sanitize paths with global.__basedir', () => {
			global.__basedir = '/workspace'
			const error = new Error('File: /workspace/src/file.txt')
			const logger = { error: vi.fn() }

			expect(() => handleFileError(error, logger)).toThrow('<workspace>')
			expect(logger.error).toHaveBeenCalledWith(
				expect.objectContaining({
					message: expect.stringContaining('<workspace>'),
				}),
			)
		})
	})
})
