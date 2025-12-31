import { describe, expect, it } from 'vitest'
import { compareKeysForKeyOrder } from '../../../src/party/split.js'

describe('compareKeysForKeyOrder', () => {
	it('should return 1 when a is not in keyOrder', () => {
		const keyOrder = ['first', 'second']
		const result = compareKeysForKeyOrder('unknown', 'first', keyOrder)
		expect(result).toBe(1)
	})

	it('should return -1 when aIndex < bIndex', () => {
		const keyOrder = ['first', 'second', 'third']
		const result = compareKeysForKeyOrder('first', 'second', keyOrder)
		expect(result).toBe(-1)
	})

	it('should return 1 when aIndex > bIndex', () => {
		const keyOrder = ['first', 'second', 'third']
		const result = compareKeysForKeyOrder('second', 'first', keyOrder)
		expect(result).toBe(1)
	})

	it('should return 0 when aIndex === bIndex', () => {
		const keyOrder = ['first', 'second']
		// Both keys at same position (shouldn't happen with unique keys, but tests the code path)
		const result = compareKeysForKeyOrder('first', 'first', keyOrder)
		expect(result).toBe(0)
	})

	it('should return 0 when both keys have same index in keyOrder', () => {
		const keyOrder = ['first']
		// When both are at index 0
		const result = compareKeysForKeyOrder('first', 'first', keyOrder)
		expect(result).toBe(0)
	})

	it('should handle when b is not in keyOrder but a is', () => {
		const keyOrder = ['first']
		const result = compareKeysForKeyOrder('first', 'unknown', keyOrder)
		// Logic: a='first' (index 0), b='unknown' (index -1)
		// if (keyOrder.indexOf(a) === -1) return 1  // Skip, a is in order
		// if (keyOrder.indexOf(a) < keyOrder.indexOf(b)) return -1  // 0 < -1 is false
		// if (keyOrder.indexOf(a) > keyOrder.indexOf(b)) return 1  // 0 > -1 is true, returns 1
		// So when b is not in order, a comes after b (moves unknown to end, but comparison puts a after)
		expect(result).toBe(1)
	})

	it('should return 1 when a is not in keyOrder (moves to end)', () => {
		const keyOrder = ['first', 'second']
		const result = compareKeysForKeyOrder('unknown', 'first', keyOrder)
		expect(result).toBe(1) // unknown moves to end
	})
})
