import * as fs from 'fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { find } from '../../../src/lib/fileUtils.js'

describe('find', () => {
	let mockFs: {
		promises: {
			stat: ReturnType<typeof vi.fn>
			lstat: ReturnType<typeof vi.fn>
			readlink: ReturnType<typeof vi.fn>
		}
	}

	beforeEach(() => {
		mockFs = {
			promises: {
				stat: vi.fn(),
				lstat: vi.fn(() =>
					Promise.resolve({
						isSymbolicLink: () => false,
						isFile: () => true,
					} as fs.Stats),
				),
				readlink: vi.fn(),
			},
		}
	})

	it('should find file in current directory', async () => {
		mockFs.promises.lstat.mockResolvedValue({
			isSymbolicLink: () => false,
			isFile: () => true,
		} as fs.Stats)
		mockFs.promises.stat.mockResolvedValue({
			isFile: () => true,
		} as fs.Stats)

		const result = await find(
			'package.json',
			'/test/project',
			mockFs as unknown as typeof fs,
		)

		expect(result).toBe('/test/project/package.json')
	})

	it('should find file in parent directory', async () => {
		// First call: lstat('/test/project/subdir/package.json') -> ENOENT
		// Second call: lstat('/test/project/package.json') -> success
		mockFs.promises.lstat
			.mockRejectedValueOnce(new Error('ENOENT')) // Not found in subdir
			.mockResolvedValueOnce({
				isSymbolicLink: () => false,
				isFile: () => true,
			} as fs.Stats) // Found in parent
		// stat() is called after lstat() succeeds
		mockFs.promises.stat.mockResolvedValueOnce({
			isFile: () => true,
		} as fs.Stats) // Found in parent

		const result = await find(
			'package.json',
			'/test/project/subdir',
			mockFs as unknown as typeof fs,
		)

		expect(result).toBe('/test/project/package.json')
	})

	it('should traverse up to root', async () => {
		mockFs.promises.lstat.mockRejectedValue(new Error('ENOENT'))
		mockFs.promises.stat.mockRejectedValue(new Error('ENOENT'))

		const result = await find(
			'nonexistent.txt',
			'/test/deep/path',
			mockFs as unknown as typeof fs,
		)

		expect(result).toBeNull()
	})

	it('should throw error when filename is not provided', async () => {
		await expect(
			find(
				undefined as unknown as string,
				'/test/path',
				mockFs as unknown as typeof fs,
			),
		).rejects.toThrow('filename is required')
	})

	it('should throw error when filename contains path', async () => {
		await expect(
			find(
				'path/to/file.txt',
				'/test/path',
				mockFs as unknown as typeof fs,
			),
		).rejects.toThrow('filename must be just a filename and not a path')
	})

	it('should throw error for parent directory reference', async () => {
		await expect(
			find('..', '/test/path', mockFs as unknown as typeof fs),
		).rejects.toThrow('filename must be just a filename and not a path')
	})

	it('should use process.cwd() when root is not provided', async () => {
		mockFs.promises.lstat.mockResolvedValue({
			isSymbolicLink: () => false,
			isFile: () => true,
		} as fs.Stats)
		mockFs.promises.stat.mockResolvedValue({
			isFile: () => true,
		} as fs.Stats)

		const result = await find(
			'package.json',
			undefined,
			mockFs as unknown as typeof fs,
		)

		expect(result).toContain('package.json')
	})

	it('should handle special characters in filename', async () => {
		mockFs.promises.stat.mockResolvedValue({
			isFile: () => true,
		} as fs.Stats)
		mockFs.promises.lstat.mockResolvedValue({
			isSymbolicLink: () => false,
			isFile: () => true,
		} as fs.Stats)

		const result = await find(
			'file*.txt',
			'/test/path',
			mockFs as unknown as typeof fs,
		)
		// Should replace * with unicode escape
		expect(mockFs.promises.lstat).toHaveBeenCalledWith(
			'/test/path/file\u002a.txt',
		)
		expect(mockFs.promises.stat).toHaveBeenCalledWith(
			'/test/path/file\u002a.txt',
		)
		expect(result).toBe('/test/path/file*.txt')
	})

	it('should return null at filesystem root', async () => {
		mockFs.promises.stat.mockRejectedValue(new Error('ENOENT'))

		const result = await find(
			'nonexistent.txt',
			'/',
			mockFs as unknown as typeof fs,
		)

		expect(result).toBeNull()
	})

	it('should continue searching when directory exists at expected file path (line 548)', async () => {
		// Line 548: stat exists but isFile() returns false (directory exists, not a file)
		mockFs.promises.lstat
			.mockResolvedValueOnce({
				isSymbolicLink: () => false,
				isFile: () => false, // Directory exists but is not a file
			} as fs.Stats)
			.mockResolvedValueOnce({
				isSymbolicLink: () => false,
				isFile: () => true, // File found in parent directory
			} as fs.Stats)
		mockFs.promises.stat
			.mockResolvedValueOnce({
				isFile: () => false, // Directory exists but is not a file
			} as fs.Stats)
			.mockResolvedValueOnce({
				isFile: () => true, // File found in parent directory
			} as fs.Stats)

		const result = await find(
			'package.json',
			'/test/project/subdir',
			mockFs as unknown as typeof fs,
		)

		// Should continue searching and find file in parent
		expect(result).toBe('/test/project/package.json')
		expect(mockFs.promises.lstat).toHaveBeenCalledTimes(2)
		expect(mockFs.promises.stat).toHaveBeenCalledTimes(2)
	})

	it('should handle symlink in find (covers line 845)', async () => {
		global.__basedir = '/workspace'
		const { find } = await import('../../../src/lib/fileUtils.js')
		// Mock lstat: first call in find(), second call in validateSymlink()
		mockFs.promises.lstat
			.mockResolvedValueOnce({
				isSymbolicLink: () => true,
				isFile: () => false,
			} as fs.Stats)
			.mockResolvedValueOnce({
				isSymbolicLink: () => true, // validateSymlink also calls lstat
				isFile: () => false,
			} as fs.Stats)
		mockFs.promises.readlink.mockResolvedValueOnce('target.txt') // Relative path - will be resolved
		mockFs.promises.stat.mockResolvedValueOnce({
			isFile: () => true,
		} as fs.Stats)

		const result = await find(
			'symlink.txt', // filename (first parameter)
			'/workspace', // root directory (second parameter)
			mockFs as unknown as typeof fs,
		)

		expect(result).toBe('/workspace/symlink.txt')
		expect(mockFs.promises.readlink).toHaveBeenCalled()
	})
})
