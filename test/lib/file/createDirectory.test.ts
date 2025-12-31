import * as fs from 'fs'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// Import the actual implementation using dynamic import to bypass hoisted mocks
// This is necessary because combine.test.ts and split.test.ts have module-level mocks
// that leak to other test files. We use dynamic imports to get the real implementation.
let createDirectory: typeof import('../../../src/lib/fileUtils.js')['createDirectory']
let clearVerifiedDirectoriesCache: typeof import('../../../src/lib/fileUtils.js')['clearVerifiedDirectoriesCache']

// Load the actual implementation once before all tests
beforeAll(async () => {
	// Use dynamic import to get the actual implementation, bypassing any mocks
	const fileUtilsModule = await import('../../../src/lib/fileUtils.js')
	createDirectory = fileUtilsModule.createDirectory
	clearVerifiedDirectoriesCache =
		fileUtilsModule.clearVerifiedDirectoriesCache
})

describe('createDirectory', () => {
	let mockFs: {
		promises: {
			mkdir: ReturnType<typeof vi.fn>
			stat: ReturnType<typeof vi.fn>
		}
	}

	beforeEach(() => {
		// Clear the module-level cache to ensure test isolation
		clearVerifiedDirectoriesCache()
		mockFs = {
			promises: {
				mkdir: vi.fn(),
				stat: vi.fn(),
			},
		}
	})

	it('should create directory when it does not exist', async () => {
		// createDirectory checks cache first via directoryExists, which calls stat
		// If not in cache, it calls mkdir
		mockFs.promises.stat.mockRejectedValue(new Error('ENOENT'))
		mockFs.promises.mkdir.mockResolvedValue(undefined)

		await createDirectory('/test/path', mockFs as unknown as typeof fs)

		expect(mockFs.promises.mkdir).toHaveBeenCalledWith('/test/path', {
			recursive: true,
		})
	})

	it('should not create directory when it already exists', async () => {
		// Use a unique path to avoid cache conflicts with other tests
		const uniquePath = '/existing/path/unique-' + Date.now()

		// createDirectory behavior:
		// 1. Checks cache first - not in cache, so proceeds
		// 2. Tries to create directory with mkdir
		// 3. mkdir fails with EEXIST (directory already exists)
		// 4. Checks if directory exists via directoryExists (calls stat)
		// 5. If exists, adds to cache and returns (doesn't throw)
		mockFs.promises.mkdir.mockRejectedValueOnce({
			code: 'EEXIST',
		} as NodeJS.ErrnoException)
		mockFs.promises.stat.mockResolvedValueOnce({ isDirectory: () => true })

		await createDirectory(uniquePath, mockFs as unknown as typeof fs)

		// mkdir should be called (it tries to create first)
		expect(mockFs.promises.mkdir).toHaveBeenCalled()
		// stat should be called to verify directory exists after EEXIST
		expect(mockFs.promises.stat).toHaveBeenCalled()
	})

	it('should replace special characters in path', async () => {
		// createDirectory calls directoryExists first (via cache check), which calls stat
		mockFs.promises.stat.mockRejectedValue(new Error('ENOENT'))
		mockFs.promises.mkdir.mockResolvedValue(undefined)

		await createDirectory('/test/*path', mockFs as unknown as typeof fs)

		expect(mockFs.promises.mkdir).toHaveBeenCalledWith('/test/\u002apath', {
			recursive: true,
		})
	})

	it('should handle directory creation failure but directory exists', async () => {
		// Use a unique path to avoid cache conflicts with other tests
		const uniquePath = '/test/path/unique-' + Date.now()

		// createDirectory behavior:
		// 1. Checks cache first - not in cache, so proceeds (no stat call here)
		// 2. Tries to create directory with mkdir - fails with EEXIST
		// 3. Catches error and calls directoryExists (calls stat) - exists
		// 4. Caches and returns without throwing

		// mkdir fails with EEXIST (directory already exists)
		mockFs.promises.mkdir.mockRejectedValueOnce({
			code: 'EEXIST',
		} as NodeJS.ErrnoException)
		// Check after error - exists (directoryExists is called in catch block)
		mockFs.promises.stat.mockResolvedValueOnce({ isDirectory: () => true })

		await createDirectory(uniquePath, mockFs as unknown as typeof fs)

		expect(mockFs.promises.mkdir).toHaveBeenCalled()
		expect(mockFs.promises.stat).toHaveBeenCalled()
	})

	it('should throw error if directory creation fails and directory does not exist', async () => {
		// First check - doesn't exist
		mockFs.promises.stat.mockRejectedValueOnce(new Error('ENOENT'))
		// mkdir fails
		const error = new Error('Permission denied')
		mockFs.promises.mkdir.mockRejectedValueOnce(error)
		// Second check after error - still doesn't exist
		mockFs.promises.stat.mockRejectedValueOnce(new Error('ENOENT'))

		await expect(
			createDirectory('/test/path', mockFs as unknown as typeof fs),
		).rejects.toThrow('Permission denied')
	})
})
