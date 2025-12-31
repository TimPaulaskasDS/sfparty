import { describe, expect, it } from 'vitest'
import { sortJSON } from '../../../src/party/combine.js'

describe('sortJSON', () => {
	it('should return original value when json is not an array', () => {
		const input = { key: 'value' }
		const result = sortJSON(input, 'key')
		expect(result).toEqual(input)
	})

	it('should return original value when key is undefined', () => {
		const input = [{ name: 'A' }, { name: 'B' }]
		const result = sortJSON(input, undefined)
		expect(result).toEqual(input)
	})

	it('should sort array by key when a[key] < b[key]', () => {
		const array = [{ fullName: 'B' }, { fullName: 'A' }]
		const result = sortJSON(array, 'fullName')
		expect(result).toEqual([{ fullName: 'A' }, { fullName: 'B' }])
		// This covers line 929: if (a[key] < b[key]) return -1
	})

	it('should sort array by key when a[key] > b[key]', () => {
		const array = [{ fullName: 'A' }, { fullName: 'B' }]
		const result = sortJSON(array, 'fullName')
		expect(result).toEqual([{ fullName: 'A' }, { fullName: 'B' }])
		// This covers line 930: if (a[key] > b[key]) return 1
	})

	it('should return 0 when a[key] === b[key]', () => {
		const array = [{ fullName: 'A' }, { fullName: 'A' }]
		const result = sortJSON(array, 'fullName')
		expect(result).toEqual([{ fullName: 'A' }, { fullName: 'A' }])
		// This covers line 931: return 0
	})
})
