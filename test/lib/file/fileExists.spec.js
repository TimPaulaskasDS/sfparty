import fs from 'fs'
import { fileExists } from '../../../src/lib/fileUtils'

beforeEach(() => {
	fs.existsSync = jest.fn()
	fs.statSync = jest.fn()
})

it('should return true if file exists', () => {
	fs.existsSync.mockReturnValue(true)
	fs.statSync.mockReturnValue({ isFile: () => true })

	const filePath = '/path/to/file.txt'
	const result = fileExists({ filePath, fs })

	expect(result).toBe(true)
})

it('should return false if file does not exist', () => {
	fs.existsSync.mockReturnValue(false)

	const filePath = '/path/to/file.txt'
	const result = fileExists({ filePath, fs })

	expect(result).toBe(false)
})

it('should return false if file exists but is not a file', () => {
	fs.existsSync.mockReturnValue(true)
	fs.statSync.mockReturnValue({ isFile: () => false })

	const filePath = '/path/to/file.txt'
	const result = fileExists({ filePath, fs })

	expect(result).toBe(false)
})
