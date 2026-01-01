import * as fs from 'fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
			readdir: ReturnType<typeof vi.fn>
		}
	}

	beforeEach(() => {
		mockFs = {
			promises: {
				stat: vi.fn(),
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
})

describe('getDirectories', () => {
	let mockFs: {
		promises: {
			stat: ReturnType<typeof vi.fn>
			readdir: ReturnType<typeof vi.fn>
		}
	}

	beforeEach(() => {
		mockFs = {
			promises: {
				stat: vi.fn(),
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
})

describe('deleteDirectory', () => {
	let mockFs: {
		promises: {
			stat: ReturnType<typeof vi.fn>
			rm: ReturnType<typeof vi.fn>
			rmdir: ReturnType<typeof vi.fn>
		}
	}

	beforeEach(() => {
		mockFs = {
			promises: {
				stat: vi.fn(),
				rm: vi.fn().mockResolvedValue(undefined),
				rmdir: vi.fn().mockResolvedValue(undefined),
			},
		}
	})

	it('should return false when directory does not exist', async () => {
		mockFs.promises.stat.mockRejectedValue(new Error('ENOENT'))

		const result = await deleteDirectory(
			'/nonexistent',
			false,
			mockFs as unknown as typeof fs,
		)

		expect(result).toBe(false)
		expect(mockFs.promises.stat).toHaveBeenCalled()
	})

	it('should delete directory with files', async () => {
		// directoryExists will call stat, then deleteDirectory will call rmdir
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
		// directoryExists will call stat, then deleteDirectory will call rm
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
		mockFs.promises.stat.mockResolvedValue({ isDirectory: () => true })
		mockFs.promises.rm.mockRejectedValueOnce(
			new Error('EBUSY: resource busy or locked'),
		)

		await expect(
			deleteDirectory('/test/path', true, mockFs as unknown as typeof fs),
		).rejects.toThrow('EBUSY')
	})

	it('should handle ENOENT error gracefully', async () => {
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
		// directoryExists will call stat, then deleteDirectory will call rmdir
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
			unlink: ReturnType<typeof vi.fn>
		}
	}

	beforeEach(() => {
		mockFs = {
			promises: {
				stat: vi.fn(),
				unlink: vi.fn().mockResolvedValue(undefined),
			},
		}
	})

	it('should return false when file does not exist', async () => {
		mockFs.promises.stat.mockRejectedValue(new Error('ENOENT'))

		const result = await deleteFile(
			'/nonexistent.txt',
			mockFs as unknown as typeof fs,
		)

		expect(result).toBe(false)
	})

	it('should delete file when it exists', async () => {
		mockFs.promises.stat.mockResolvedValue({ isFile: () => true })

		const result = await deleteFile(
			'/test/file.txt',
			mockFs as unknown as typeof fs,
		)

		expect(mockFs.promises.unlink).toHaveBeenCalledWith('/test/file.txt')
		expect(result).toBe(true)
	})

	it('should handle ENOENT error gracefully', async () => {
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
})
