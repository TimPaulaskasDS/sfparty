import { directoryExists } from '../../../src/lib/fileUtils'

jest.mock('fs', () => {
	return {
		existsSync: jest.fn(),
		statSync: jest.fn(),
	}
})

it('should return true if the directory exists and is a directory', () => {
	const fs = require('fs')
	fs.existsSync.mockReturnValue(true)
	fs.statSync.mockReturnValue({ isDirectory: () => true })

	const dirPath = '/some/directory'
	const result = directoryExists({ dirPath, fs })
	expect(result).toBe(true)
	expect(fs.existsSync).toHaveBeenCalledWith(dirPath)
	expect(fs.statSync).toHaveBeenCalledWith(dirPath)
})

it('should return false if the directory exists but is not a directory', () => {
	const fs = require('fs')
	fs.existsSync.mockReturnValue(true)
	fs.statSync.mockReturnValue({ isDirectory: () => false })

	const dirPath = '/some/directory'
	const result = directoryExists({ dirPath, fs })
	expect(result).toBe(false)
	expect(fs.existsSync).toHaveBeenCalledWith(dirPath)
	expect(fs.statSync).toHaveBeenCalledWith(dirPath)
})

it('should return false if the directory does not exist', () => {
	const fs = require('fs')
	fs.existsSync.mockReturnValue(false)

	const dirPath = '/some/directory'
	const result = directoryExists({ dirPath, fs })
	expect(result).toBe(false)
	expect(fs.existsSync).toHaveBeenCalledWith(dirPath)
	expect(fs.statSync).toHaveBeenCalled()
})
