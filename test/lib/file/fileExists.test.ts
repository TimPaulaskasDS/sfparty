import * as fs from 'fs'
import { expect, it, vi } from 'vitest'
import { fileExists } from '../../../src/lib/fileUtils'

it('should return true if file exists', async () => {
	const mockFs = {
		promises: {
			stat: vi.fn().mockResolvedValue({ isFile: () => true } as fs.Stats),
		},
	}

	const filePath = '/path/to/file.txt'
	const result = await fileExists({
		filePath,
		fs: mockFs as unknown as typeof fs,
	})

	expect(result).toBe(true)
})

it('should return false if file does not exist', async () => {
	const mockFs = {
		promises: {
			stat: vi.fn().mockRejectedValue(new Error('ENOENT')),
		},
	}

	const filePath = '/path/to/file.txt'
	const result = await fileExists({
		filePath,
		fs: mockFs as unknown as typeof fs,
	})

	expect(result).toBe(false)
})

it('should return false if file exists but is not a file', async () => {
	const mockFs = {
		promises: {
			stat: vi
				.fn()
				.mockResolvedValue({ isFile: () => false } as fs.Stats),
		},
	}

	const filePath = '/path/to/file.txt'
	const result = await fileExists({
		filePath,
		fs: mockFs as unknown as typeof fs,
	})

	expect(result).toBe(false)
})
