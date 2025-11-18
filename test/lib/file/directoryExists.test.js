import { directoryExists } from '../../../src/lib/fileUtils'
import * as fs from 'fs'

vi.mock('fs', () => {
	return {
		existsSync: vi.fn(),
		statSync: vi.fn(),
	}
})

it('should return true if the directory exists and is a directory', () => {
	fs.existsSync.mockReturnValue(true)
	fs.statSync.mockReturnValue({ isDirectory: () => true })

	const dirPath = '/some/directory'
	const result = directoryExists({ dirPath, fs })
	expect(result).toBe(true)
	expect(fs.existsSync).toHaveBeenCalledWith(dirPath)
	expect(fs.statSync).toHaveBeenCalledWith(dirPath)
})

it('should return false if the directory exists but is not a directory', () => {
	fs.existsSync.mockReturnValue(true)
	fs.statSync.mockReturnValue({ isDirectory: () => false })

	const dirPath = '/some/directory'
	const result = directoryExists({ dirPath, fs })
	expect(result).toBe(false)
	expect(fs.existsSync).toHaveBeenCalledWith(dirPath)
	expect(fs.statSync).toHaveBeenCalledWith(dirPath)
})

it('should return false if the directory does not exist', () => {
	fs.existsSync.mockReturnValue(false)

	const dirPath = '/some/directory'
	const result = directoryExists({ dirPath, fs })
	expect(result).toBe(false)
	expect(fs.existsSync).toHaveBeenCalledWith(dirPath)
	expect(fs.statSync).toHaveBeenCalled()
})
