import { describe, expect, it } from 'vitest'
import { updateFileStats } from '../../../src/party/combine.js'

describe('updateFileStats', () => {
	it('should return original stats when stats is undefined', () => {
		const fileStats = {
			atime: new Date('2023-01-01'),
			mtime: new Date('2023-01-01'),
		}
		const result = updateFileStats(fileStats, undefined)
		expect(result).toEqual(fileStats)
		// This covers line 43: if (!stats) return fileStats
	})
	it('should set atime when fileStats.atime is undefined', () => {
		const fileStats = {
			atime: undefined,
			mtime: undefined,
		}
		const stats = {
			atime: new Date('2023-01-01T10:00:00Z'),
			mtime: new Date('2023-01-01T10:00:00Z'),
		}
		const result = updateFileStats(fileStats, stats)
		expect(result.atime).toEqual(stats.atime)
		expect(result.mtime).toEqual(stats.mtime)
	})
	it('should set mtime when fileStats.mtime is undefined', () => {
		const fileStats = {
			atime: new Date('2023-01-01T10:00:00Z'),
			mtime: undefined,
		}
		const stats = {
			atime: new Date('2023-01-01T10:00:00Z'),
			mtime: new Date('2023-01-01T11:00:00Z'),
		}
		const result = updateFileStats(fileStats, stats)
		expect(result.mtime).toEqual(stats.mtime)
	})
	it('should update atime when stats.atime is greater', () => {
		const fileStats = {
			atime: new Date('2023-01-01T10:00:00Z'),
			mtime: new Date('2023-01-01T10:00:00Z'),
		}
		const stats = {
			atime: new Date('2023-01-01T11:00:00Z'), // Newer
			mtime: new Date('2023-01-01T10:00:00Z'),
		}
		const result = updateFileStats(fileStats, stats)
		expect(result.atime).toEqual(stats.atime)
		expect(result.atime).not.toEqual(fileStats.atime)
	})
	it('should update mtime when stats.mtime is greater', () => {
		const fileStats = {
			atime: new Date('2023-01-01T10:00:00Z'),
			mtime: new Date('2023-01-01T10:00:00Z'),
		}
		const stats = {
			atime: new Date('2023-01-01T10:00:00Z'),
			mtime: new Date('2023-01-01T11:00:00Z'), // Newer
		}
		const result = updateFileStats(fileStats, stats)
		expect(result.mtime).toEqual(stats.mtime)
		expect(result.mtime).not.toEqual(fileStats.mtime)
	})
	it('should not update atime when stats.atime is not greater', () => {
		const fileStats = {
			atime: new Date('2023-01-01T11:00:00Z'),
			mtime: new Date('2023-01-01T11:00:00Z'),
		}
		const stats = {
			atime: new Date('2023-01-01T10:00:00Z'), // Older
			mtime: new Date('2023-01-01T11:00:00Z'),
		}
		const result = updateFileStats(fileStats, stats)
		expect(result.atime).toEqual(fileStats.atime)
		expect(result.atime).not.toEqual(stats.atime)
	})
	it('should not update mtime when stats.mtime is not greater', () => {
		const fileStats = {
			atime: new Date('2023-01-01T11:00:00Z'),
			mtime: new Date('2023-01-01T11:00:00Z'),
		}
		const stats = {
			atime: new Date('2023-01-01T11:00:00Z'),
			mtime: new Date('2023-01-01T10:00:00Z'), // Older
		}
		const result = updateFileStats(fileStats, stats)
		expect(result.mtime).toEqual(fileStats.mtime)
		expect(result.mtime).not.toEqual(stats.mtime)
	})
	it('should handle errors gracefully', () => {
		const fileStats = {
			atime: new Date('2023-01-01'),
			mtime: new Date('2023-01-01'),
		}
		// Create stats that might cause an error
		const stats = {
			get atime() {
				throw new Error('Test error')
			},
			mtime: new Date('2023-01-01'),
		}
		const result = updateFileStats(fileStats, stats)
		// Should return original fileStats on error
		expect(result).toEqual(fileStats)
	})
})
//# sourceMappingURL=updateFileStats.test.js.map
