import * as fs from 'fs'
import { expect, it, vi } from 'vitest'
import { directoryExists } from '../../../src/lib/fileUtils'

vi.mock('fs', () => {
	return {
		existsSync: vi.fn(),
		statSync: vi.fn(),
	}
})
it('should return true if the directory exists and is a directory', () => {
	vi.mocked(fs.existsSync).mockReturnValue(true)
	vi.mocked(fs.statSync).mockReturnValue({
		isDirectory: () => true,
	})
	const dirPath = '/some/directory'
	const result = directoryExists({ dirPath, fs })
	expect(result).toBe(true)
	expect(fs.existsSync).toHaveBeenCalledWith(dirPath)
	expect(fs.statSync).toHaveBeenCalledWith(dirPath)
})
it('should return false if the directory exists but is not a directory', () => {
	vi.mocked(fs.existsSync).mockReturnValue(true)
	vi.mocked(fs.statSync).mockReturnValue({
		isDirectory: () => false,
	})
	const dirPath = '/some/directory'
	const result = directoryExists({ dirPath, fs })
	expect(result).toBe(false)
	expect(fs.existsSync).toHaveBeenCalledWith(dirPath)
	expect(fs.statSync).toHaveBeenCalledWith(dirPath)
})
it('should return false if the directory does not exist', () => {
	vi.mocked(fs.existsSync).mockReturnValue(false)
	const dirPath = '/some/directory'
	const result = directoryExists({ dirPath, fs })
	expect(result).toBe(false)
	expect(fs.existsSync).toHaveBeenCalledWith(dirPath)
	// statSync should not be called when existsSync returns false due to short-circuit evaluation
	expect(fs.statSync).not.toHaveBeenCalled()
})
//# sourceMappingURL=directoryExists.spec.js.map
