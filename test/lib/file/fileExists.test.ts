import * as fs from 'fs'
import { expect, it, vi } from 'vitest'

// Override any hoisted mocks from combine.test.ts and split.test.ts by providing our own mock
// that returns the actual implementation. This ensures we get the real fileUtils.
vi.mock('../../../src/lib/fileUtils.js', async () => {
	const actual = await import('../../../src/lib/fileUtils.js')
	return actual
})

import { fileExists } from '../../../src/lib/fileUtils.js'

it('should return true if file exists', async () => {
	const mockFs = {
		promises: {
			lstat: vi.fn().mockResolvedValue({
				isSymbolicLink: () => false,
				isFile: () => true,
			} as fs.Stats),
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
			lstat: vi.fn().mockRejectedValue(new Error('ENOENT')),
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
			lstat: vi.fn().mockResolvedValue({
				isSymbolicLink: () => false,
				isFile: () => false,
			} as fs.Stats),
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
