import * as fs from 'fs'
import { beforeEach, expect, it, vi } from 'vitest'

// Override any hoisted mocks from combine.test.ts and split.test.ts by providing our own mock
// that returns the actual implementation. This ensures we get the real fileUtils.
vi.mock('../../../src/lib/fileUtils.js', async () => {
	const actual = await import('../../../src/lib/fileUtils.js')
	return actual
})

import {
	clearVerifiedDirectoriesCache,
	directoryExists,
} from '../../../src/lib/fileUtils.js'

beforeEach(() => {
	// Clear the module-level cache to ensure test isolation
	clearVerifiedDirectoriesCache()
})

it('should return true if the directory exists and is a directory', async () => {
	const mockFs = {
		promises: {
			stat: vi.fn().mockResolvedValue({
				isDirectory: () => true,
			} as fs.Stats),
		},
	}

	const dirPath = '/some/directory'
	const result = await directoryExists({
		dirPath,
		fs: mockFs as unknown as typeof fs,
	})
	expect(result).toBe(true)
	expect(mockFs.promises.stat).toHaveBeenCalledWith(dirPath)
})

it('should return false if the directory exists but is not a directory', async () => {
	const mockFs = {
		promises: {
			stat: vi.fn().mockResolvedValue({
				isDirectory: () => false,
			} as fs.Stats),
		},
	}

	const dirPath = '/some/directory'
	const result = await directoryExists({
		dirPath,
		fs: mockFs as unknown as typeof fs,
	})
	expect(result).toBe(false)
	expect(mockFs.promises.stat).toHaveBeenCalledWith(dirPath)
})

it('should return false if the directory does not exist', async () => {
	const mockFs = {
		promises: {
			stat: vi.fn().mockRejectedValue(new Error('ENOENT')),
		},
	}

	const dirPath = '/some/directory'
	const result = await directoryExists({
		dirPath,
		fs: mockFs as unknown as typeof fs,
	})
	expect(result).toBe(false)
	expect(mockFs.promises.stat).toHaveBeenCalledWith(dirPath)
})
