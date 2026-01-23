/**
 * Tests for utility functions in fileUtils.ts
 */

import { describe, expect, it } from 'vitest'
import {
	checkDepth,
	estimateObjectSize,
	safeJSONParse,
} from '../../../src/lib/fileUtils.js'

describe('checkDepth', () => {
	it('should throw error when depth exceeds maxDepth', () => {
		const deepObject: Record<string, unknown> = {}
		let current = deepObject
		for (let i = 0; i < 101; i++) {
			current.nested = {}
			current = current.nested as Record<string, unknown>
		}

		expect(() => checkDepth(deepObject, 100)).toThrow(
			'exceeds maximum allowed depth',
		)
	})

	it('should not throw when depth is within limit', () => {
		const shallowObject = {
			level1: {
				level2: {
					level3: 'value',
				},
			},
		}

		expect(() => checkDepth(shallowObject, 100)).not.toThrow()
	})

	it('should handle null values', () => {
		expect(() => checkDepth(null, 100)).not.toThrow()
	})

	it('should handle non-object values', () => {
		expect(() => checkDepth('string', 100)).not.toThrow()
		expect(() => checkDepth(123, 100)).not.toThrow()
		expect(() => checkDepth(true, 100)).not.toThrow()
		expect(() => checkDepth(undefined, 100)).not.toThrow()
	})

	it('should handle arrays', () => {
		const deepArray: unknown[] = []
		let current: unknown[] = deepArray
		for (let i = 0; i < 101; i++) {
			current.push([])
			current = current[0] as unknown[]
		}

		expect(() => checkDepth(deepArray, 100)).toThrow(
			'exceeds maximum allowed depth',
		)
	})

	it('should handle mixed arrays and objects', () => {
		const mixed = {
			items: [
				{
					nested: {
						value: 'test',
					},
				},
			],
		}

		expect(() => checkDepth(mixed, 100)).not.toThrow()
	})
})

describe('estimateObjectSize', () => {
	it('should return 8 for null', () => {
		expect(estimateObjectSize(null)).toBe(8)
	})

	it('should return 8 for undefined', () => {
		expect(estimateObjectSize(undefined)).toBe(8)
	})

	it('should calculate string size correctly', () => {
		expect(estimateObjectSize('test')).toBe(8) // 4 chars * 2 = 8
		expect(estimateObjectSize('hello')).toBe(10) // 5 chars * 2 = 10
	})

	it('should return 8 for numbers', () => {
		expect(estimateObjectSize(123)).toBe(8)
		expect(estimateObjectSize(0)).toBe(8)
		expect(estimateObjectSize(-1)).toBe(8)
	})

	it('should return 8 for booleans', () => {
		expect(estimateObjectSize(true)).toBe(8)
		expect(estimateObjectSize(false)).toBe(8)
	})

	it('should calculate array size correctly', () => {
		const array = ['a', 'b', 'c']
		// 8 (overhead) + 2 (a) + 2 (b) + 2 (c) = 14
		expect(estimateObjectSize(array)).toBe(14)
	})

	it('should calculate object size correctly', () => {
		const obj = {
			key1: 'value1',
			key2: 123,
		}
		// 8 (overhead) + 8 (key1) + 12 (value1) + 8 (key2) + 8 (123) = 44
		expect(estimateObjectSize(obj)).toBe(44)
	})

	it('should handle nested objects', () => {
		const nested = {
			outer: {
				inner: 'value',
			},
		}
		// 8 (outer overhead) + 10 (outer key) + 8 (inner overhead) + 10 (inner key) + 10 (value) = 46
		expect(estimateObjectSize(nested)).toBeGreaterThan(0)
	})

	it('should handle nested arrays', () => {
		const nested = [
			[1, 2],
			[3, 4],
		]
		// Array overhead + nested arrays + numbers
		expect(estimateObjectSize(nested)).toBeGreaterThan(0)
	})

	it('should handle mixed structures', () => {
		const mixed = {
			items: ['a', 'b'],
			count: 5,
			active: true,
		}
		expect(estimateObjectSize(mixed)).toBeGreaterThan(0)
	})

	it('should return 8 for fallback case', () => {
		// This tests the fallback return at line 151
		// The function should handle all types, but if something unexpected happens, it returns 8
		expect(estimateObjectSize(Symbol('test'))).toBe(8)
	})
})

describe('safeJSONParse - additional coverage', () => {
	it('should handle JSON with deep nesting exceeding depth limit', () => {
		// Create deeply nested JSON
		const deepJson: Record<string, unknown> = {}
		let current = deepJson
		for (let i = 0; i < 101; i++) {
			current.nested = {}
			current = current.nested as Record<string, unknown>
		}

		const jsonString = JSON.stringify(deepJson)
		expect(() => safeJSONParse(jsonString)).toThrow(
			'exceeds maximum allowed depth',
		)
	})

	it('should handle JSON with arrays exceeding depth limit', () => {
		// Create deeply nested array
		const deepArray: unknown[] = []
		let current: unknown[] = deepArray
		for (let i = 0; i < 101; i++) {
			current.push([])
			current = current[0] as unknown[]
		}

		const jsonString = JSON.stringify(deepArray)
		expect(() => safeJSONParse(jsonString)).toThrow(
			'exceeds maximum allowed depth',
		)
	})

	it('should handle JSON exceeding size limit', () => {
		// Create a large JSON object (over 10MB)
		const largeObject: Record<string, string> = {}
		const largeString = 'x'.repeat(5 * 1024 * 1024) // 5MB string
		// Create 3 items of 5MB each = 15MB total
		for (let i = 0; i < 3; i++) {
			largeObject[`key${i}`] = largeString
		}

		const jsonString = JSON.stringify(largeObject)
		expect(() => safeJSONParse(jsonString)).toThrow('exceeds maximum limit')
	})

	it('should handle valid JSON with nested objects', () => {
		const validJson = JSON.stringify({
			level1: {
				level2: {
					level3: 'value',
				},
			},
		})
		const result = safeJSONParse(validJson)
		expect(result).toEqual({
			level1: {
				level2: {
					level3: 'value',
				},
			},
		})
	})

	it('should handle valid JSON with arrays', () => {
		const validJson = JSON.stringify({
			items: ['a', 'b', 'c'],
			count: 3,
		})
		const result = safeJSONParse(validJson)
		expect(result).toEqual({
			items: ['a', 'b', 'c'],
			count: 3,
		})
	})

	it('should handle JSON with null values', () => {
		const validJson = JSON.stringify({
			value: null,
			other: 'test',
		})
		const result = safeJSONParse(validJson)
		expect(result).toEqual({
			value: null,
			other: 'test',
		})
	})

	it('should handle JSON with primitive values', () => {
		const validJson = JSON.stringify({
			string: 'test',
			number: 123,
			boolean: true,
		})
		const result = safeJSONParse(validJson)
		expect(result).toEqual({
			string: 'test',
			number: 123,
			boolean: true,
		})
	})
})
