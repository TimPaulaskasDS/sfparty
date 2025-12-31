import { describe, expect, it } from 'vitest'
import { compareKeysForXmlOrder } from '../../../src/party/combine.js'

describe('compareKeysForXmlOrder', () => {
	it('should return -1 when a < b and no xmlOrder', () => {
		const result = compareKeysForXmlOrder('a', 'b', undefined)
		expect(result).toBe(-1)
	})
	it('should return 1 when a > b and no xmlOrder', () => {
		const result = compareKeysForXmlOrder('b', 'a', undefined)
		expect(result).toBe(1)
	})
	it('should return 0 when a === b and no xmlOrder', () => {
		const result = compareKeysForXmlOrder('a', 'a', undefined)
		expect(result).toBe(0)
	})
	it('should return -1 when aIndex < bIndex and aIndex !== 99', () => {
		const xmlOrder = ['first', 'second', 'third']
		const result = compareKeysForXmlOrder('first', 'second', xmlOrder)
		expect(result).toBe(-1)
	})
	it('should return 1 when aIndex > bIndex and bIndex !== 99', () => {
		const xmlOrder = ['first', 'second', 'third']
		const result = compareKeysForXmlOrder('second', 'first', xmlOrder)
		expect(result).toBe(1)
	})
	it('should return -1 when a is in order and b is not (aIndex < bIndex)', () => {
		const xmlOrder = ['first']
		const result = compareKeysForXmlOrder('first', 'unknown', xmlOrder)
		expect(result).toBe(-1)
	})
	it('should return 1 when a is not in order and b is in order (aIndex > bIndex)', () => {
		const xmlOrder = ['first']
		const result = compareKeysForXmlOrder('unknown', 'first', xmlOrder)
		expect(result).toBe(1)
	})
	it('should fall back to string comparison when both keys not in order', () => {
		const xmlOrder = ['first']
		const result = compareKeysForXmlOrder('unknown1', 'unknown2', xmlOrder)
		expect(result).toBe(-1) // 'unknown1' < 'unknown2'
	})
	it('should return 0 when both keys not in order and equal', () => {
		const xmlOrder = ['first']
		const result = compareKeysForXmlOrder('unknown', 'unknown', xmlOrder)
		expect(result).toBe(0)
	})
	it('should handle empty xmlOrder array', () => {
		const result = compareKeysForXmlOrder('a', 'b', [])
		expect(result).toBe(-1) // Falls back to string comparison
	})
})
//# sourceMappingURL=compareKeysForXmlOrder.test.js.map
