import * as fs from 'fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Override any hoisted mocks from combine.test.ts and split.test.ts by providing our own mock
// that returns the actual implementation. This ensures we get the real fileUtils.
vi.mock('../../../src/lib/fileUtils.js', async () => {
	const actual = await import('../../../src/lib/fileUtils.js')
	return actual
})

import {
	deleteDirectory,
	deleteFile,
	getDirectories,
	getFiles,
} from '../../../src/lib/fileUtils.js'

describe('getFiles', () => {
	let mockFs: {
		promises: {
			stat: ReturnType<typeof vi.fn>
			lstat: ReturnType<typeof vi.fn>
			readdir: ReturnType<typeof vi.fn>
		}
	}

	beforeEach(() => {
		mockFs = {
			promises: {
				stat: vi.fn(),
				lstat: vi.fn(() =>
					Promise.resolve({
						isSymbolicLink: () => false,
						isDirectory: () => true,
					} as fs.Stats),
				),
				readdir: vi.fn(),
			},
		}
	})

	it('should return sorted list of files without filter', async () => {
		mockFs.promises.stat.mockResolvedValue({ isDirectory: () => true })
		mockFs.promises.readdir.mockResolvedValue([
			'file3.txt',
			'file1.txt',
			'file2.txt',
		])

		const result = await getFiles(
			'/test/path',
			undefined,
			mockFs as unknown as typeof fs,
		)

		expect(result).toEqual(['file1.txt', 'file2.txt', 'file3.txt'])
		expect(mockFs.promises.stat).toHaveBeenCalled()
		expect(mockFs.promises.readdir).toHaveBeenCalledWith('/test/path')
	})

	it('should filter files by extension', async () => {
		mockFs.promises.stat.mockResolvedValue({ isDirectory: () => true })
		mockFs.promises.readdir.mockResolvedValue([
			'file1.xml',
			'file2.json',
			'file3.xml',
		])

		const result = await getFiles(
			'/test/path',
			'.xml',
			mockFs as unknown as typeof fs,
		)

		expect(result).toEqual(['file1.xml', 'file3.xml'])
		expect(mockFs.promises.readdir).toHaveBeenCalledWith('/test/path')
	})

	it('should return empty array when directory does not exist', async () => {
		mockFs.promises.stat.mockRejectedValue(new Error('ENOENT'))

		const result = await getFiles(
			'/nonexistent',
			undefined,
			mockFs as unknown as typeof fs,
		)

		expect(result).toEqual([])
		expect(mockFs.promises.readdir).not.toHaveBeenCalled()
	})

	it('should handle case-insensitive filter', async () => {
		mockFs.promises.stat.mockResolvedValue({ isDirectory: () => true })
		mockFs.promises.readdir.mockResolvedValue(['File1.XML', 'file2.json'])

		const result = await getFiles(
			'/test/path',
			'.xml',
			mockFs as unknown as typeof fs,
		)

		expect(result).toEqual(['File1.XML'])
		expect(mockFs.promises.readdir).toHaveBeenCalledWith('/test/path')
	})

	it('should return empty array when readdir fails (covers line 284)', async () => {
		mockFs.promises.stat.mockResolvedValue({ isDirectory: () => true })
		// readdir fails - should catch and return empty array (line 284)
		mockFs.promises.readdir.mockRejectedValue(
			new Error('Permission denied'),
		)

		const result = await getFiles(
			'/test/path',
			undefined,
			mockFs as unknown as typeof fs,
		)

		expect(result).toEqual([])
	})
})

describe('getDirectories', () => {
	let mockFs: {
		promises: {
			stat: ReturnType<typeof vi.fn>
			lstat: ReturnType<typeof vi.fn>
			readdir: ReturnType<typeof vi.fn>
		}
	}

	beforeEach(() => {
		mockFs = {
			promises: {
				stat: vi.fn(),
				lstat: vi.fn(() =>
					Promise.resolve({
						isSymbolicLink: () => false,
						isDirectory: () => true,
					} as fs.Stats),
				),
				readdir: vi.fn(),
			},
		}
	})

	it('should return list of directories', async () => {
		mockFs.promises.stat.mockResolvedValue({ isDirectory: () => true }) // For directoryExists check
		// readdir with withFileTypes: true returns Dirent objects
		mockFs.promises.readdir.mockResolvedValue([
			{ name: 'dir1', isDirectory: () => true },
			{ name: 'file1.txt', isDirectory: () => false },
			{ name: 'dir2', isDirectory: () => true },
		] as unknown as import('fs').Dirent[])

		const result = await getDirectories(
			'/test/path',
			mockFs as unknown as typeof fs,
		)

		expect(result).toEqual(['dir1', 'dir2'])
	})

	it('should return empty array when path does not exist', async () => {
		mockFs.promises.stat.mockRejectedValue(new Error('ENOENT'))

		const result = await getDirectories(
			'/nonexistent',
			mockFs as unknown as typeof fs,
		)

		expect(result).toEqual([])
	})

	it('should return empty array when readdir fails (covers line 306)', async () => {
		mockFs.promises.stat.mockResolvedValue({ isDirectory: () => true })
		// readdir fails - should catch and return empty array (line 306)
		mockFs.promises.readdir.mockRejectedValue(
			new Error('Permission denied'),
		)

		const result = await getDirectories(
			'/test/path',
			mockFs as unknown as typeof fs,
		)

		expect(result).toEqual([])
	})
})

describe('deleteDirectory', () => {
	let mockFs: {
		promises: {
			stat: ReturnType<typeof vi.fn>
			lstat: ReturnType<typeof vi.fn>
			rm: ReturnType<typeof vi.fn>
			rmdir: ReturnType<typeof vi.fn>
		}
	}

	beforeEach(() => {
		mockFs = {
			promises: {
				stat: vi.fn(),
				lstat: vi.fn(() =>
					Promise.resolve({
						isSymbolicLink: () => false,
						isDirectory: () => true,
					} as fs.Stats),
				),
				rm: vi.fn().mockResolvedValue(undefined),
				rmdir: vi.fn().mockResolvedValue(undefined),
			},
		}
	})

	it('should return false when directory does not exist', async () => {
		mockFs.promises.lstat.mockRejectedValue(new Error('ENOENT'))
		mockFs.promises.stat.mockRejectedValue(new Error('ENOENT'))

		const result = await deleteDirectory(
			'/nonexistent',
			false,
			mockFs as unknown as typeof fs,
		)

		expect(result).toBe(false)
		expect(mockFs.promises.lstat).toHaveBeenCalled()
	})

	it('should delete directory with files', async () => {
		// directoryExists will call lstat and stat, then deleteDirectory will call rmdir
		mockFs.promises.lstat.mockResolvedValue({
			isSymbolicLink: () => false,
			isDirectory: () => true,
		} as fs.Stats)
		mockFs.promises.stat.mockResolvedValue({ isDirectory: () => true })
		mockFs.promises.rmdir.mockResolvedValue(undefined)

		const result = await deleteDirectory(
			'/test/path',
			false,
			mockFs as unknown as typeof fs,
		)

		expect(mockFs.promises.rmdir).toHaveBeenCalledWith('/test/path')
		expect(result).toBe(true)
	})

	it('should recursively delete subdirectories', async () => {
		// directoryExists will call lstat and stat, then deleteDirectory will call rm
		mockFs.promises.lstat.mockResolvedValue({
			isSymbolicLink: () => false,
			isDirectory: () => true,
		} as fs.Stats)
		mockFs.promises.stat.mockResolvedValue({ isDirectory: () => true })
		mockFs.promises.rm.mockResolvedValue(undefined)

		const result = await deleteDirectory(
			'/test/path',
			true,
			mockFs as unknown as typeof fs,
		)

		expect(mockFs.promises.rm).toHaveBeenCalledWith('/test/path', {
			recursive: true,
			force: true,
		})
		expect(result).toBe(true)
	})

	it('should use rmdir fallback when rm throws error', async () => {
		// Test error handling - if rm fails, should handle gracefully
		mockFs.promises.lstat.mockResolvedValue({
			isSymbolicLink: () => false,
			isDirectory: () => true,
		} as fs.Stats)
		mockFs.promises.stat.mockResolvedValue({ isDirectory: () => true })
		mockFs.promises.rm.mockRejectedValueOnce(
			new Error('EBUSY: resource busy or locked'),
		)

		await expect(
			deleteDirectory('/test/path', true, mockFs as unknown as typeof fs),
		).rejects.toThrow('EBUSY')
	})

	it('should handle ENOENT error gracefully', async () => {
		mockFs.promises.lstat.mockResolvedValue({
			isSymbolicLink: () => false,
			isDirectory: () => true,
		} as fs.Stats)
		mockFs.promises.stat.mockResolvedValue({ isDirectory: () => true })
		mockFs.promises.rmdir.mockRejectedValueOnce({
			code: 'ENOENT',
		} as NodeJS.ErrnoException)

		const result = await deleteDirectory(
			'/test/path',
			false,
			mockFs as unknown as typeof fs,
		)

		expect(result).toBe(false)
	})

	it('should return true on successful deletion', async () => {
		// directoryExists will call lstat and stat, then deleteDirectory will call rmdir
		mockFs.promises.lstat.mockResolvedValue({
			isSymbolicLink: () => false,
			isDirectory: () => true,
		} as fs.Stats)
		mockFs.promises.stat.mockResolvedValue({ isDirectory: () => true })
		mockFs.promises.rmdir.mockResolvedValue(undefined)

		const result = await deleteDirectory(
			'/test/path',
			false,
			mockFs as unknown as typeof fs,
		)

		expect(result).toBe(true)
	})
})

describe('deleteFile', () => {
	let mockFs: {
		promises: {
			stat: ReturnType<typeof vi.fn>
			lstat: ReturnType<typeof vi.fn>
			unlink: ReturnType<typeof vi.fn>
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
				unlink: vi.fn().mockResolvedValue(undefined),
			},
		}
	})

	it('should return false when file does not exist', async () => {
		mockFs.promises.lstat.mockRejectedValue(new Error('ENOENT'))
		mockFs.promises.stat.mockRejectedValue(new Error('ENOENT'))

		const result = await deleteFile(
			'/nonexistent.txt',
			mockFs as unknown as typeof fs,
		)

		expect(result).toBe(false)
	})

	it('should delete file when it exists', async () => {
		mockFs.promises.lstat.mockResolvedValue({
			isSymbolicLink: () => false,
			isFile: () => true,
		} as fs.Stats)
		mockFs.promises.stat.mockResolvedValue({ isFile: () => true })

		const result = await deleteFile(
			'/test/file.txt',
			mockFs as unknown as typeof fs,
		)

		expect(mockFs.promises.unlink).toHaveBeenCalledWith('/test/file.txt')
		expect(result).toBe(true)
	})

	it('should handle ENOENT error gracefully', async () => {
		mockFs.promises.lstat.mockResolvedValue({
			isSymbolicLink: () => false,
			isFile: () => true,
		} as fs.Stats)
		mockFs.promises.stat.mockResolvedValue({ isFile: () => true })
		mockFs.promises.unlink.mockRejectedValueOnce({
			code: 'ENOENT',
		} as NodeJS.ErrnoException)

		const result = await deleteFile(
			'/test/file.txt',
			mockFs as unknown as typeof fs,
		)

		expect(result).toBe(false)
	})

	it('should throw error when unlink fails with non-ENOENT error (covers line 327)', async () => {
		mockFs.promises.lstat.mockResolvedValue({
			isSymbolicLink: () => false,
			isFile: () => true,
		} as fs.Stats)
		mockFs.promises.stat.mockResolvedValue({ isFile: () => true })
		// unlink fails with non-ENOENT error - should throw (line 327)
		const error = new Error('Permission denied')
		;(error as NodeJS.ErrnoException).code = 'EACCES'
		mockFs.promises.unlink.mockRejectedValueOnce(error)

		await expect(
			deleteFile('/test/file.txt', mockFs as unknown as typeof fs),
		).rejects.toThrow('Permission denied')
	})
})
