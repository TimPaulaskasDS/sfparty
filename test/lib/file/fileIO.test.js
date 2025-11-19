import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
	fileInfo,
	readFile,
	saveFile,
	writeFile,
} from '../../../src/lib/fileUtils.js'

describe('fileInfo', () => {
	let mockFs

	beforeEach(() => {
		mockFs = {
			existsSync: vi.fn(),
			statSync: vi.fn(),
		}
	})

	it('should return file info when file exists', () => {
		const mockStats = { size: 1024, mtime: new Date() }
		mockFs.existsSync.mockReturnValue(true)
		mockFs.statSync.mockReturnValue(mockStats)

		const result = fileInfo('/test/path/example.txt', mockFs)

		expect(result.dirname).toBe('/test/path')
		expect(result.basename).toBe('example')
		expect(result.filename).toBe('example.txt')
		expect(result.extname).toBe('.txt')
		expect(result.exists).toBe(true)
		expect(result.stats).toBe(mockStats)
	})

	it('should return undefined stats when file does not exist', () => {
		mockFs.existsSync.mockReturnValue(false)

		const result = fileInfo('/nonexistent.txt', mockFs)

		expect(result.exists).toBe(false)
		expect(result.stats).toBeUndefined()
	})
})

describe('saveFile', () => {
	let mockFs

	beforeEach(() => {
		mockFs = {
			writeFileSync: vi.fn(),
		}
		global.logger = { error: vi.fn() }
	})

	it('should save JSON file with tabs', () => {
		const data = { key: 'value', nested: { prop: 123 } }

		const result = saveFile(data, '/test/file.json', 'json', mockFs)

		expect(result).toBe(true)
		expect(mockFs.writeFileSync).toHaveBeenCalledWith(
			'/test/file.json',
			expect.stringContaining('\t'),
		)
	})

	it('should save YAML file', () => {
		const data = { key: 'value' }

		const result = saveFile(data, '/test/file.yaml', 'yaml', mockFs)

		expect(result).toBe(true)
		expect(mockFs.writeFileSync).toHaveBeenCalledWith(
			'/test/file.yaml',
			expect.stringContaining('key: value'),
		)
	})

	it('should infer format from file extension', () => {
		const data = { key: 'value' }

		saveFile(data, '/test/file.json', undefined, mockFs)

		expect(mockFs.writeFileSync).toHaveBeenCalled()
	})

	it('should throw error on write failure', () => {
		mockFs.writeFileSync.mockImplementation(() => {
			throw new Error('Write failed')
		})

		expect(() => saveFile({}, '/test/file.json', 'json', mockFs)).toThrow(
			'Write failed',
		)
	})
})

describe('readFile', () => {
	let mockFs

	beforeEach(() => {
		mockFs = {
			existsSync: vi.fn(),
			statSync: vi.fn(),
			readFileSync: vi.fn(),
		}
		global.logger = { error: vi.fn() }
	})

	it('should read and parse JSON file', () => {
		mockFs.existsSync.mockReturnValue(true)
		mockFs.statSync.mockReturnValue({ isFile: () => true })
		mockFs.readFileSync.mockReturnValue('{"key":"value"}')

		const result = readFile('/test/file.json', true, mockFs)

		expect(result).toEqual({ key: 'value' })
	})

	it('should read and parse YAML file', () => {
		mockFs.existsSync.mockReturnValue(true)
		mockFs.statSync.mockReturnValue({ isFile: () => true })
		mockFs.readFileSync.mockReturnValue('key: value')

		const result = readFile('/test/file.yaml', true, mockFs)

		expect(result).toEqual({ key: 'value' })
	})

	it('should read XML file as promise', async () => {
		mockFs.existsSync.mockReturnValue(true)
		mockFs.statSync.mockReturnValue({ isFile: () => true })
		mockFs.readFileSync.mockReturnValue('<root><item>value</item></root>')

		const result = readFile('/test/file.xml', true, mockFs)

		expect(result).toBeInstanceOf(Promise)
		const parsed = await result
		expect(parsed).toHaveProperty('root')
	})

	it('should read raw text when convert is false', () => {
		mockFs.existsSync.mockReturnValue(true)
		mockFs.statSync.mockReturnValue({ isFile: () => true })
		mockFs.readFileSync.mockReturnValue('raw text')

		const result = readFile('/test/file.txt', false, mockFs)

		expect(result).toBe('raw text')
	})

	it('should return undefined when file does not exist', () => {
		mockFs.existsSync.mockReturnValue(false)

		const result = readFile('/nonexistent.txt', true, mockFs)

		expect(result).toBeUndefined()
	})

	it('should throw error on YAML parsing failure', () => {
		mockFs.existsSync.mockReturnValue(true)
		mockFs.statSync.mockReturnValue({ isFile: () => true })
		mockFs.readFileSync.mockReturnValue('invalid: yaml: content:')

		expect(() => readFile('/test/file.yaml', true, mockFs)).toThrow()
	})
})

describe('writeFile', () => {
	let mockFs

	beforeEach(() => {
		mockFs = {
			writeFileSync: vi.fn(),
			utimesSync: vi.fn(),
		}
		global.logger = { error: vi.fn() }
	})

	it('should write file with custom timestamps', () => {
		const atime = new Date('2024-01-01')
		const mtime = new Date('2024-01-02')

		writeFile('/test/file.txt', 'content', atime, mtime, mockFs)

		expect(mockFs.writeFileSync).toHaveBeenCalledWith(
			'/test/file.txt',
			'content',
			{ mode: 0o644 },
		)
		expect(mockFs.utimesSync).toHaveBeenCalledWith(
			'/test/file.txt',
			atime,
			mtime,
		)
	})

	it('should use current date when timestamps are undefined', () => {
		writeFile('/test/file.txt', 'content', undefined, undefined, mockFs)

		expect(mockFs.writeFileSync).toHaveBeenCalled()
		expect(mockFs.utimesSync).toHaveBeenCalled()
		const [, atime, mtime] = mockFs.utimesSync.mock.calls[0]
		expect(atime).toBeInstanceOf(Date)
		expect(mtime).toBeInstanceOf(Date)
	})

	it('should throw error on write failure', () => {
		mockFs.writeFileSync.mockImplementation(() => {
			throw new Error('Write failed')
		})

		expect(() =>
			writeFile(
				'/test/file.txt',
				'content',
				undefined,
				undefined,
				mockFs,
			),
		).toThrow('Write failed')
	})
})

describe('readFile - XML error handling', () => {
	let mockFs

	beforeEach(() => {
		mockFs = {
			existsSync: vi.fn(),
			statSync: vi.fn(),
			readFileSync: vi.fn(),
		}
		global.logger = { error: vi.fn() }
	})

	it('should reject on invalid XML', async () => {
		// Test for fileUtils.js line 186 - error handling in convertXML
		mockFs.existsSync.mockReturnValue(true)
		mockFs.statSync.mockReturnValue({ isFile: () => true })
		mockFs.readFileSync.mockReturnValue('<root><unclosed>')

		const result = readFile('/test/file.xml', true, mockFs)

		await expect(result).rejects.toThrow()
	})
})
