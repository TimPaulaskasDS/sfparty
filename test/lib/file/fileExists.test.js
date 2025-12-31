import * as fs from 'fs'
import { expect, it, vi } from 'vitest'
import { fileExists } from '../../../src/lib/fileUtils'

vi.mock('fs', () => {
	return {
		existsSync: vi.fn(),
		statSync: vi.fn(),
	}
})
it('should return true if file exists', () => {
	vi.mocked(fs.existsSync).mockReturnValue(true)
	vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true })
	const filePath = '/path/to/file.txt'
	const result = fileExists({ filePath, fs })
	expect(result).toBe(true)
})
it('should return false if file does not exist', () => {
	vi.mocked(fs.existsSync).mockReturnValue(false)
	const filePath = '/path/to/file.txt'
	const result = fileExists({ filePath, fs })
	expect(result).toBe(false)
})
it('should return false if file exists but is not a file', () => {
	vi.mocked(fs.existsSync).mockReturnValue(true)
	vi.mocked(fs.statSync).mockReturnValue({ isFile: () => false })
	const filePath = '/path/to/file.txt'
	const result = fileExists({ filePath, fs })
	expect(result).toBe(false)
})
//# sourceMappingURL=fileExists.test.js.map
