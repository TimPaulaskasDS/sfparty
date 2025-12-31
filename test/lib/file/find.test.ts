import * as fs from 'fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { find } from '../../../src/lib/fileUtils.js'

describe('find', () => {
	let mockFs: {
		promises: {
			stat: ReturnType<typeof vi.fn>
		}
	}

	beforeEach(() => {
		mockFs = {
			promises: {
				stat: vi.fn(),
			},
		}
	})

	it('should find file in current directory', async () => {
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
		mockFs.promises.stat
			.mockRejectedValueOnce(new Error('ENOENT')) // Not found in subdir
			.mockResolvedValueOnce({ isFile: () => true } as fs.Stats) // Found in parent

		const result = await find(
			'package.json',
			'/test/project/subdir',
			mockFs as unknown as typeof fs,
		)

		expect(result).toBe('/test/project/package.json')
	})

	it('should traverse up to root', async () => {
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

		const result = await find(
			'file*.txt',
			'/test/path',
			mockFs as unknown as typeof fs,
		)
		// Should replace * with unicode escape
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
})
