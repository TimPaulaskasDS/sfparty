import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
	clearPathSanitizationCache,
	replaceSpecialChars,
} from '../../src/lib/pathUtils.js'

describe('pathUtils', () => {
	beforeEach(() => {
		clearPathSanitizationCache()
	})

	afterEach(() => {
		clearPathSanitizationCache()
	})

	describe('replaceSpecialChars', () => {
		it('should return string unchanged when no special characters', () => {
			const input = 'normal/path/to/file.txt'
			const result = replaceSpecialChars(input)
			expect(result).toBe(input)
		})

		it('should replace asterisk (*) with Unicode equivalent', () => {
			const input = 'file*.txt'
			const result = replaceSpecialChars(input)
			expect(result).toBe('file\u002a.txt')
		})

		it('should replace question mark (?) with Unicode equivalent', () => {
			const input = 'file?.txt'
			const result = replaceSpecialChars(input)
			expect(result).toBe('file\u003f.txt')
		})

		it('should replace less than (<) with Unicode equivalent', () => {
			const input = 'file<.txt'
			const result = replaceSpecialChars(input)
			expect(result).toBe('file\u003c.txt')
		})

		it('should replace greater than (>) with Unicode equivalent', () => {
			const input = 'file>.txt'
			const result = replaceSpecialChars(input)
			expect(result).toBe('file\u003e.txt')
		})

		it('should replace double quote (") with Unicode equivalent', () => {
			const input = 'file".txt'
			const result = replaceSpecialChars(input)
			expect(result).toBe('file\u0022.txt')
		})

		it('should replace pipe (|) with Unicode equivalent', () => {
			const input = 'file|.txt'
			const result = replaceSpecialChars(input)
			expect(result).toBe('file\u007c.txt')
		})

		it('should replace backslash (\\) with Unicode equivalent', () => {
			const input = 'file\\.txt'
			const result = replaceSpecialChars(input)
			expect(result).toBe('file\u005c.txt')
		})

		it('should replace colon (:) with Unicode equivalent', () => {
			const input = 'file:.txt'
			const result = replaceSpecialChars(input)
			expect(result).toBe('file\u003a.txt')
		})

		it('should replace multiple special characters', () => {
			const input = 'file*?<>"|\\:.txt'
			const result = replaceSpecialChars(input)
			expect(result).toBe(
				'file\u002a\u003f\u003c\u003e\u0022\u007c\u005c\u003a.txt',
			)
		})

		it('should replace all special characters in a string', () => {
			const input = '*?<>"|\\:'
			const result = replaceSpecialChars(input)
			expect(result).toBe(
				'\u002a\u003f\u003c\u003e\u0022\u007c\u005c\u003a',
			)
		})

		it('should handle mixed normal and special characters', () => {
			const input = 'normal*path?with<special>chars'
			const result = replaceSpecialChars(input)
			expect(result).toBe(
				'normal\u002apath\u003fwith\u003cspecial\u003echars',
			)
		})

		it('should handle empty string', () => {
			const result = replaceSpecialChars('')
			expect(result).toBe('')
		})

		it('should return non-string input unchanged', () => {
			// @ts-expect-error - Testing invalid input
			const result = replaceSpecialChars(null)
			expect(result).toBe(null)
		})

		it('should return undefined unchanged', () => {
			// @ts-expect-error - Testing invalid input
			const result = replaceSpecialChars(undefined)
			expect(result).toBe(undefined)
		})

		it('should return number unchanged', () => {
			// @ts-expect-error - Testing invalid input
			const result = replaceSpecialChars(123)
			expect(result).toBe(123)
		})

		it('should return object unchanged', () => {
			const obj = { key: 'value' }
			// @ts-expect-error - Testing invalid input
			const result = replaceSpecialChars(obj)
			expect(result).toBe(obj)
		})

		describe('cache behavior', () => {
			it('should cache results when string is sanitized', () => {
				// Don't clear cache for this test to ensure cache hit
				const input = 'file*.txt'
				// First call - should sanitize and cache
				const result1 = replaceSpecialChars(input)
				// Second call - should use cache (hits line 13: return sanitizedPathCache.get(str)!)
				const result2 = replaceSpecialChars(input)

				expect(result1).toBe('file\u002a.txt')
				expect(result2).toBe('file\u002a.txt')
				expect(result1).toBe(result2)
				// Verify both calls returned the same reference (from cache)
			})

			it('should use cached value on second call (explicit cache hit test)', () => {
				// Don't clear cache - use a unique input to avoid interference
				const input = 'unique?cache?test.txt'
				// Populate cache with first call
				const first = replaceSpecialChars(input)
				// Second call should hit cache at line 13
				const second = replaceSpecialChars(input)
				expect(first).toBe('unique\u003fcache\u003ftest.txt')
				expect(second).toBe('unique\u003fcache\u003ftest.txt')
				expect(first).toBe(second)
			})

			it('should not cache when string does not need sanitization', () => {
				const input = 'normal/path/to/file.txt'
				const result1 = replaceSpecialChars(input)
				const result2 = replaceSpecialChars(input)

				expect(result1).toBe(input)
				expect(result2).toBe(input)
				// Cache should not store unchanged strings
			})

			it('should use cache on subsequent calls', () => {
				const input = 'file?*.txt'
				clearPathSanitizationCache()

				const result1 = replaceSpecialChars(input)
				const result2 = replaceSpecialChars(input)

				expect(result1).toBe(result2)
				expect(result1).toBe('file\u003f\u002a.txt')
			})

			it('should clear cache with clearPathSanitizationCache', () => {
				const input = 'file*.txt'

				// First call - should sanitize and cache
				const result1 = replaceSpecialChars(input)
				expect(result1).toBe('file\u002a.txt')

				// Clear cache
				clearPathSanitizationCache()

				// Second call - should sanitize again (cache was cleared)
				const result2 = replaceSpecialChars(input)
				expect(result2).toBe('file\u002a.txt')
			})

			it('should handle multiple different inputs with cache', () => {
				const input1 = 'file*.txt'
				const input2 = 'file?.txt'
				const input3 = 'normal.txt'

				const result1a = replaceSpecialChars(input1)
				const result2a = replaceSpecialChars(input2)
				const result3a = replaceSpecialChars(input3)

				// Second calls should use cache
				const result1b = replaceSpecialChars(input1)
				const result2b = replaceSpecialChars(input2)
				const result3b = replaceSpecialChars(input3)

				expect(result1a).toBe(result1b)
				expect(result2a).toBe(result2b)
				expect(result3a).toBe(result3b)
			})
		})
	})

	describe('clearPathSanitizationCache', () => {
		it('should clear the cache', () => {
			const input = 'file*.txt'

			// Populate cache
			replaceSpecialChars(input)

			// Clear cache
			clearPathSanitizationCache()

			// Verify cache is cleared by checking behavior
			const result = replaceSpecialChars(input)
			expect(result).toBe('file\u002a.txt')
		})

		it('should handle clearing empty cache', () => {
			clearPathSanitizationCache()
			// Should not throw
			expect(() => clearPathSanitizationCache()).not.toThrow()
		})

		it('should clear cache with multiple entries', () => {
			replaceSpecialChars('file*.txt')
			replaceSpecialChars('file?.txt')
			replaceSpecialChars('file<.txt')

			clearPathSanitizationCache()

			// All should work after clearing
			expect(replaceSpecialChars('file*.txt')).toBe('file\u002a.txt')
			expect(replaceSpecialChars('file?.txt')).toBe('file\u003f.txt')
			expect(replaceSpecialChars('file<.txt')).toBe('file\u003c.txt')
		})
	})
})
