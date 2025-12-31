import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
	deleteDirectory,
	deleteFile,
	getDirectories,
	getFiles,
} from '../../../src/lib/fileUtils.js'

describe('getFiles', () => {
	let mockFs
	beforeEach(() => {
		mockFs = {
			existsSync: vi.fn(),
			statSync: vi.fn(),
			readdirSync: vi.fn(),
		}
	})
	it('should return sorted list of files without filter', () => {
		mockFs.existsSync.mockReturnValue(true)
		mockFs.statSync.mockReturnValue({ isDirectory: () => true })
		mockFs.readdirSync.mockReturnValue([
			'file3.txt',
			'file1.txt',
			'file2.txt',
		])
		const result = getFiles('/test/path', undefined, mockFs)
		expect(result).toEqual(['file1.txt', 'file2.txt', 'file3.txt'])
	})
	it('should filter files by extension', () => {
		mockFs.existsSync.mockReturnValue(true)
		mockFs.statSync.mockReturnValue({ isDirectory: () => true })
		mockFs.readdirSync.mockReturnValue([
			'file1.xml',
			'file2.json',
			'file3.xml',
		])
		const result = getFiles('/test/path', '.xml', mockFs)
		expect(result).toEqual(['file1.xml', 'file3.xml'])
	})
	it('should return empty array when directory does not exist', () => {
		mockFs.existsSync.mockReturnValue(false)
		const result = getFiles('/nonexistent', undefined, mockFs)
		expect(result).toEqual([])
	})
	it('should handle case-insensitive filter', () => {
		mockFs.existsSync.mockReturnValue(true)
		mockFs.statSync.mockReturnValue({ isDirectory: () => true })
		mockFs.readdirSync.mockReturnValue(['File1.XML', 'file2.json'])
		const result = getFiles('/test/path', '.xml', mockFs)
		expect(result).toEqual(['File1.XML'])
	})
})
describe('getDirectories', () => {
	let mockFs
	beforeEach(() => {
		mockFs = {
			existsSync: vi.fn(),
			statSync: vi.fn(),
			readdirSync: vi.fn(),
		}
	})
	it('should return list of directories', () => {
		mockFs.existsSync.mockReturnValue(true)
		mockFs.statSync.mockReturnValue({ isDirectory: () => true })
		mockFs.readdirSync.mockReturnValue([
			{ name: 'dir1', isDirectory: () => true },
			{ name: 'file1.txt', isDirectory: () => false },
			{ name: 'dir2', isDirectory: () => true },
		])
		const result = getDirectories('/test/path', mockFs)
		expect(result).toEqual(['dir1', 'dir2'])
	})
	it('should return empty array when path does not exist', () => {
		mockFs.existsSync.mockReturnValue(false)
		const result = getDirectories('/nonexistent', mockFs)
		expect(result).toEqual([])
	})
})
describe('deleteDirectory', () => {
	let mockFs
	beforeEach(() => {
		mockFs = {
			existsSync: vi.fn(),
			statSync: vi.fn(),
			readdirSync: vi.fn(),
			lstatSync: vi.fn(),
			unlinkSync: vi.fn(),
			rmdirSync: vi.fn(),
		}
	})
	it('should return false when directory does not exist', () => {
		mockFs.existsSync.mockReturnValue(false)
		mockFs.statSync.mockReturnValue({ isDirectory: () => false })
		const result = deleteDirectory('/nonexistent', false, mockFs)
		expect(result).toBe(false)
	})
	it('should delete directory with files', () => {
		mockFs.existsSync.mockReturnValue(true)
		mockFs.statSync.mockReturnValue({ isDirectory: () => true })
		mockFs.readdirSync.mockReturnValue(['file1.txt', 'file2.txt'])
		mockFs.lstatSync.mockReturnValue({ isDirectory: () => false })
		deleteDirectory('/test/path', false, mockFs)
		expect(mockFs.unlinkSync).toHaveBeenCalledTimes(2)
		expect(mockFs.rmdirSync).toHaveBeenCalledWith('/test/path')
	})
	it('should recursively delete subdirectories', () => {
		mockFs.existsSync.mockReturnValue(true)
		mockFs.statSync.mockReturnValue({ isDirectory: () => true })
		mockFs.readdirSync
			.mockReturnValueOnce(['subdir'])
			.mockReturnValueOnce([])
		mockFs.lstatSync.mockReturnValue({ isDirectory: () => true })
		deleteDirectory('/test/path', true, mockFs)
		expect(mockFs.rmdirSync).toHaveBeenCalledTimes(2)
	})
	it('should use rmdirSync fallback when unlinkSync throws error', () => {
		// Test for fileUtils.js line 51 - error handling catch block
		mockFs.existsSync.mockReturnValue(true)
		mockFs.statSync.mockReturnValue({ isDirectory: () => true })
		mockFs.readdirSync.mockReturnValue(['locked-file.txt'])
		mockFs.lstatSync.mockReturnValue({ isDirectory: () => false })
		mockFs.unlinkSync.mockImplementation(() => {
			throw new Error('EBUSY: resource busy or locked')
		})
		deleteDirectory('/test/path', false, mockFs)
		expect(mockFs.unlinkSync).toHaveBeenCalledWith(
			'/test/path/locked-file.txt',
		)
		expect(mockFs.rmdirSync).toHaveBeenCalledWith(
			'/test/path/locked-file.txt',
		)
		expect(mockFs.rmdirSync).toHaveBeenCalledWith('/test/path')
	})
	it('should handle existsSync check in else block', () => {
		// Test line 125: if (fsTmp.existsSync(sanitizedPath))
		// This tests the existsSync check inside the else block
		// directoryExists returns true (enters else block), then existsSync on line 125 returns true
		mockFs.existsSync.mockReturnValue(true)
		mockFs.statSync.mockReturnValue({ isDirectory: () => true })
		mockFs.readdirSync.mockReturnValue([])
		deleteDirectory('/test/path', false, mockFs)
		// Verify existsSync was called (line 125)
		expect(mockFs.existsSync).toHaveBeenCalled()
		expect(mockFs.rmdirSync).toHaveBeenCalledWith('/test/path')
	})
	it('should handle existsSync returning false in else block', () => {
		// Test line 125: when directoryExists returns true but existsSync on line 125 returns false
		// This tests the branch where the if block on line 125 is skipped
		// directoryExists calls existsSync and statSync, so we need to mock those for directoryExists to return true
		// Then on line 125, existsSync should return false
		mockFs.existsSync
			.mockReturnValueOnce(true) // For directoryExists check
			.mockReturnValueOnce(false) // For line 125 check
		mockFs.statSync.mockReturnValue({ isDirectory: () => true })
		const result = deleteDirectory('/test/path', false, mockFs)
		// Verify existsSync was called twice (once for directoryExists, once on line 125)
		expect(mockFs.existsSync).toHaveBeenCalledTimes(2)
		// When existsSync returns false on line 125, the function returns nothing (void)
		expect(result).toBeUndefined()
		// rmdirSync should not be called since the if block was skipped
		expect(mockFs.rmdirSync).not.toHaveBeenCalled()
	})
})
describe('deleteFile', () => {
	let mockFs
	beforeEach(() => {
		mockFs = {
			existsSync: vi.fn(),
			statSync: vi.fn(),
			unlinkSync: vi.fn(),
		}
	})
	it('should return false when file does not exist', () => {
		mockFs.existsSync.mockReturnValue(false)
		const result = deleteFile('/nonexistent.txt', mockFs)
		expect(result).toBe(false)
	})
	it('should delete file when it exists', () => {
		mockFs.existsSync.mockReturnValue(true)
		mockFs.statSync.mockReturnValue({ isFile: () => true })
		deleteFile('/test/file.txt', mockFs)
		expect(mockFs.unlinkSync).toHaveBeenCalledWith('/test/file.txt')
	})
})
//# sourceMappingURL=fileOperations.test.js.map
