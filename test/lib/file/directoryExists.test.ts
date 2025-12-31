import * as fs from 'fs'
import { beforeAll, beforeEach, expect, it, vi } from 'vitest'

// Import the actual implementation using dynamic import to bypass hoisted mocks
// This is necessary because combine.test.ts and split.test.ts have module-level mocks
// that leak to other test files. We use dynamic imports to get the real implementation.
let directoryExists: typeof import('../../../src/lib/fileUtils.js')['directoryExists']
let clearVerifiedDirectoriesCache: typeof import('../../../src/lib/fileUtils.js')['clearVerifiedDirectoriesCache']

// Load the actual implementation once before all tests
beforeAll(async () => {
	// Use dynamic import to get the actual implementation, bypassing any mocks
	const fileUtilsModule = await import('../../../src/lib/fileUtils.js')
	directoryExists = fileUtilsModule.directoryExists
	clearVerifiedDirectoriesCache =
		fileUtilsModule.clearVerifiedDirectoriesCache
})

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
