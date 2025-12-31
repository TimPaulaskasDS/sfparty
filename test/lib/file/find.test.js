import { beforeEach, describe, expect, it, vi } from 'vitest'
import { find } from '../../../src/lib/fileUtils.js'

describe('find', () => {
	let mockFs
	beforeEach(() => {
		mockFs = {
			statSync: vi.fn(),
		}
	})
	it('should find file in current directory', () => {
		mockFs.statSync.mockReturnValue({ isFile: () => true })
		const result = find('package.json', '/test/project', mockFs)
		expect(result).toBe('/test/project/package.json')
	})
	it('should find file in parent directory', () => {
		mockFs.statSync
			.mockReturnValueOnce({ isFile: () => false })
			.mockReturnValueOnce({ isFile: () => true })
		const result = find('package.json', '/test/project/subdir', mockFs)
		expect(result).toBe('/test/project/package.json')
	})
	it('should traverse up to root', () => {
		mockFs.statSync.mockImplementation(() => {
			throw new Error('ENOENT')
		})
		const result = find('nonexistent.txt', '/test/deep/path', mockFs)
		expect(result).toBeNull()
	})
	it('should throw error when filename is not provided', () => {
		expect(() => find(undefined, '/test/path', mockFs)).toThrow(
			'filename is required',
		)
	})
	it('should throw error when filename contains path', () => {
		expect(() => find('path/to/file.txt', '/test/path', mockFs)).toThrow(
			'filename must be just a filename and not a path',
		)
	})
	it('should throw error for parent directory reference', () => {
		expect(() => find('..', '/test/path', mockFs)).toThrow(
			'filename must be just a filename and not a path',
		)
	})
	it('should use process.cwd() when root is not provided', () => {
		mockFs.statSync.mockReturnValue({ isFile: () => true })
		const result = find('package.json', undefined, mockFs)
		expect(result).toContain('package.json')
	})
	it('should handle special characters in filename', () => {
		mockFs.statSync.mockReturnValue({ isFile: () => true })
		const result = find('file*.txt', '/test/path', mockFs)
		void result // Intentionally unused - just testing it doesn't throw
		// Should replace * with unicode escape
		expect(mockFs.statSync).toHaveBeenCalledWith(
			'/test/path/file\u002a.txt',
		)
	})
	it('should return null at filesystem root', () => {
		mockFs.statSync.mockImplementation(() => {
			throw new Error('ENOENT')
		})
		const result = find('nonexistent.txt', '/', mockFs)
		expect(result).toBeNull()
	})
})
//# sourceMappingURL=find.test.js.map
