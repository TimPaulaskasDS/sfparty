import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDirectory } from '../../../src/lib/fileUtils.js'

describe('createDirectory', () => {
	let mockFs

	beforeEach(() => {
		mockFs = {
			existsSync: vi.fn(),
			mkdirSync: vi.fn(),
		}
	})

	it('should create directory when it does not exist', () => {
		mockFs.existsSync.mockReturnValue(false)

		createDirectory('/test/path', mockFs)

		expect(mockFs.existsSync).toHaveBeenCalledWith('/test/path')
		expect(mockFs.mkdirSync).toHaveBeenCalledWith('/test/path', {
			recursive: true,
		})
	})

	it('should not create directory when it already exists', () => {
		mockFs.existsSync.mockReturnValue(true)

		createDirectory('/existing/path', mockFs)

		expect(mockFs.existsSync).toHaveBeenCalledWith('/existing/path')
		expect(mockFs.mkdirSync).not.toHaveBeenCalled()
	})

	it('should replace special characters in path', () => {
		mockFs.existsSync.mockReturnValue(false)

		createDirectory('/test/*path', mockFs)

		expect(mockFs.existsSync).toHaveBeenCalledWith('/test/\u002apath')
		expect(mockFs.mkdirSync).toHaveBeenCalledWith('/test/\u002apath', {
			recursive: true,
		})
	})
})
