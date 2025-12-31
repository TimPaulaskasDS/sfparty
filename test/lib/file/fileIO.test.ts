import * as fs from 'fs'
import * as yaml from 'js-yaml'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
	fileInfo,
	readFile,
	saveFile,
	writeFile,
} from '../../../src/lib/fileUtils.js'

// Mock js-yaml - use actual implementation by default, can be overridden in tests
vi.mock('js-yaml', async () => {
	const actual = await vi.importActual<typeof import('js-yaml')>('js-yaml')
	return {
		...actual,
		load: vi.fn((...args: Parameters<typeof actual.load>) =>
			actual.load(...args),
		),
	}
})

describe('fileInfo', () => {
	let mockFs: {
		existsSync: ReturnType<typeof vi.fn>
		statSync: ReturnType<typeof vi.fn>
	}

	beforeEach(() => {
		mockFs = {
			existsSync: vi.fn(),
			statSync: vi.fn(),
		}
	})

	it('should return file info when file exists', () => {
		const mockStats = { size: 1024, mtime: new Date() } as fs.Stats
		mockFs.existsSync.mockReturnValue(true)
		mockFs.statSync.mockReturnValue(mockStats)

		const result = fileInfo(
			'/test/path/example.txt',
			mockFs as unknown as typeof fs,
		)

		expect(result.dirname).toBe('/test/path')
		expect(result.basename).toBe('example')
		expect(result.filename).toBe('example.txt')
		expect(result.extname).toBe('.txt')
		expect(result.exists).toBe(true)
		expect(result.stats).toBe(mockStats)
	})

	it('should return undefined stats when file does not exist', () => {
		mockFs.existsSync.mockReturnValue(false)

		const result = fileInfo(
			'/nonexistent.txt',
			mockFs as unknown as typeof fs,
		)

		expect(result.exists).toBe(false)
		expect(result.stats).toBeUndefined()
	})
})

describe('saveFile', () => {
	let mockFs: {
		writeFileSync: ReturnType<typeof vi.fn>
	}

	beforeEach(() => {
		mockFs = {
			writeFileSync: vi.fn(),
		}
		;(
			global as { logger?: { error: (error: Error | unknown) => void } }
		).logger = {
			error: vi.fn(),
		}
	})

	it('should save JSON file with tabs', () => {
		const data = { key: 'value', nested: { prop: 123 } }

		const result = saveFile(
			data,
			'/test/file.json',
			'json',
			mockFs as unknown as typeof fs,
		)

		expect(result).toBe(true)
		expect(mockFs.writeFileSync).toHaveBeenCalledWith(
			'/test/file.json',
			expect.stringContaining('\t'),
		)
	})

	it('should save YAML file', () => {
		const data = { key: 'value' }

		const result = saveFile(
			data,
			'/test/file.yaml',
			'yaml',
			mockFs as unknown as typeof fs,
		)

		expect(result).toBe(true)
		expect(mockFs.writeFileSync).toHaveBeenCalledWith(
			'/test/file.yaml',
			expect.stringContaining('key: value'),
		)
	})

	it('should infer format from file extension', () => {
		const data = { key: 'value' }

		saveFile(
			data,
			'/test/file.json',
			undefined,
			mockFs as unknown as typeof fs,
		)

		expect(mockFs.writeFileSync).toHaveBeenCalled()
	})

	it('should throw error on write failure', () => {
		mockFs.writeFileSync.mockImplementation(() => {
			throw new Error('Write failed')
		})

		expect(() =>
			saveFile(
				{},
				'/test/file.json',
				'json',
				mockFs as unknown as typeof fs,
			),
		).toThrow('Write failed')
	})
})

describe('readFile', () => {
	let mockFs: {
		existsSync: ReturnType<typeof vi.fn>
		statSync: ReturnType<typeof vi.fn>
		readFileSync: ReturnType<typeof vi.fn>
	}

	beforeEach(() => {
		mockFs = {
			existsSync: vi.fn(),
			statSync: vi.fn(),
			readFileSync: vi.fn(),
		}
		;(
			global as { logger?: { error: (error: Error | unknown) => void } }
		).logger = {
			error: vi.fn(),
		}
	})

	it('should read and parse JSON file', () => {
		mockFs.existsSync.mockReturnValue(true)
		mockFs.statSync.mockReturnValue({ isFile: () => true })
		mockFs.readFileSync.mockReturnValue('{"key":"value"}')

		const result = readFile(
			'/test/file.json',
			true,
			mockFs as unknown as typeof fs,
		)

		expect(result).toEqual({ key: 'value' })
	})

	it('should read and parse YAML file', () => {
		mockFs.existsSync.mockReturnValue(true)
		mockFs.statSync.mockReturnValue({ isFile: () => true })
		mockFs.readFileSync.mockReturnValue('key: value')

		const result = readFile(
			'/test/file.yaml',
			true,
			mockFs as unknown as typeof fs,
		)

		expect(result).toEqual({ key: 'value' })
	})

	it('should read XML file as promise', async () => {
		mockFs.existsSync.mockReturnValue(true)
		mockFs.statSync.mockReturnValue({ isFile: () => true })
		mockFs.readFileSync.mockReturnValue('<root><item>value</item></root>')

		const result = readFile(
			'/test/file.xml',
			true,
			mockFs as unknown as typeof fs,
		)

		expect(result).toBeInstanceOf(Promise)
		const parsed = await result
		expect(parsed).toHaveProperty('root')
	})

	it('should read raw text when convert is false', () => {
		mockFs.existsSync.mockReturnValue(true)
		mockFs.statSync.mockReturnValue({ isFile: () => true })
		mockFs.readFileSync.mockReturnValue('raw text')

		const result = readFile(
			'/test/file.txt',
			false,
			mockFs as unknown as typeof fs,
		)

		expect(result).toBe('raw text')
	})

	it('should return undefined when file does not exist', () => {
		mockFs.existsSync.mockReturnValue(false)

		const result = readFile(
			'/nonexistent.txt',
			true,
			mockFs as unknown as typeof fs,
		)

		expect(result).toBeUndefined()
	})

	it('should throw error on YAML parsing failure', () => {
		mockFs.existsSync.mockReturnValue(true)
		mockFs.statSync.mockReturnValue({ isFile: () => true })
		mockFs.readFileSync.mockReturnValue('invalid: yaml: content:')

		expect(() =>
			readFile('/test/file.yaml', true, mockFs as unknown as typeof fs),
		).toThrow()
	})
})

describe('writeFile', () => {
	let mockFs: {
		writeFileSync: ReturnType<typeof vi.fn>
		utimesSync: ReturnType<typeof vi.fn>
	}

	beforeEach(() => {
		mockFs = {
			writeFileSync: vi.fn(),
			utimesSync: vi.fn(),
		}
		;(
			global as { logger?: { error: (error: Error | unknown) => void } }
		).logger = {
			error: vi.fn(),
		}
	})

	it('should write file with custom timestamps', () => {
		const atime = new Date('2024-01-01')
		const mtime = new Date('2024-01-02')

		writeFile(
			'/test/file.txt',
			'content',
			atime,
			mtime,
			mockFs as unknown as typeof fs,
		)

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
		// Test lines 343-344: finalAtime and finalMtime when atime/mtime are undefined
		// When explicitly passing undefined (not omitting the parameter), the default parameter doesn't apply
		// and the parameter is actually undefined, triggering lines 343-344
		writeFile(
			'/test/file.txt',
			'content',
			undefined as unknown as Date,
			undefined as unknown as Date,
			mockFs as unknown as typeof fs,
		)

		expect(mockFs.writeFileSync).toHaveBeenCalled()
		expect(mockFs.utimesSync).toHaveBeenCalled()
		const [, atime, mtime] = mockFs.utimesSync.mock.calls[0]
		expect(atime).toBeInstanceOf(Date)
		expect(mtime).toBeInstanceOf(Date)
		// Verify that new Date() was called (lines 343-344)
		expect(atime.getTime()).toBeGreaterThan(0)
		expect(mtime.getTime()).toBeGreaterThan(0)
		// Verify these are new Date() instances, not the undefined we passed
		expect(atime).not.toBeUndefined()
		expect(mtime).not.toBeUndefined()
	})

	it('should use provided timestamps when defined', () => {
		// Test lines 343-344: when atime and mtime are defined (not undefined)
		const atime = new Date('2024-01-01')
		const mtime = new Date('2024-01-02')
		writeFile(
			'/test/file.txt',
			'content',
			atime,
			mtime,
			mockFs as unknown as typeof fs,
		)

		expect(mockFs.utimesSync).toHaveBeenCalledWith(
			'/test/file.txt',
			atime,
			mtime,
		)
		// Verify the provided dates are used (not new Date())
		expect(mockFs.utimesSync.mock.calls[0][1]).toBe(atime)
		expect(mockFs.utimesSync.mock.calls[0][2]).toBe(mtime)
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
				mockFs as unknown as typeof fs,
			),
		).toThrow('Write failed')
	})

	it('should validate path when global.__basedir is set', () => {
		// Test line 334: writeFile with global.__basedir
		;(global as { __basedir?: string }).__basedir = '/workspace'
		const atime = new Date('2024-01-01')
		const mtime = new Date('2024-01-02')

		writeFile(
			'file.txt',
			'content',
			atime,
			mtime,
			mockFs as unknown as typeof fs,
		)

		expect(mockFs.writeFileSync).toHaveBeenCalled()
		;(global as { __basedir?: string }).__basedir = undefined
	})

	it('should sanitize error paths in error messages', () => {
		// Test lines 355-362: writeFile error handling with path sanitization
		;(global as { __basedir?: string }).__basedir = '/workspace'
		;(
			global as { logger?: { error: (error: Error | unknown) => void } }
		).logger = {
			error: vi.fn(),
		}
		mockFs.writeFileSync.mockImplementation(() => {
			throw new Error('Error writing to /workspace/path/to/file.txt')
		})

		try {
			writeFile(
				'path/to/file.txt',
				'content',
				undefined,
				undefined,
				mockFs as unknown as typeof fs,
			)
			expect.fail('Should have thrown an error')
		} catch (error) {
			expect(error).toBeInstanceOf(Error)
			expect((error as Error).message).toContain('<workspace>')
			expect(
				(
					global as {
						logger?: { error: (error: Error | unknown) => void }
					}
				).logger?.error,
			).toHaveBeenCalled()
		}
		;(global as { __basedir?: string }).__basedir = undefined
	})

	it('should handle errors without path in message', () => {
		;(
			global as { logger?: { error: (error: Error | unknown) => void } }
		).logger = {
			error: vi.fn(),
		}
		mockFs.writeFileSync.mockImplementation(() => {
			throw new Error('Generic error')
		})

		expect(() =>
			writeFile(
				'/test/file.txt',
				'content',
				undefined,
				undefined,
				mockFs as unknown as typeof fs,
			),
		).toThrow('Generic error')
		expect(
			(global as { logger?: { error: (error: Error | unknown) => void } })
				.logger?.error,
		).toHaveBeenCalled()
	})
})

describe('readFile - XML error handling', () => {
	let mockFs: {
		existsSync: ReturnType<typeof vi.fn>
		statSync: ReturnType<typeof vi.fn>
		readFileSync: ReturnType<typeof vi.fn>
	}

	beforeEach(() => {
		mockFs = {
			existsSync: vi.fn(),
			statSync: vi.fn(),
			readFileSync: vi.fn(),
		}
		;(
			global as { logger?: { error: (error: Error | unknown) => void } }
		).logger = {
			error: vi.fn(),
		}
	})

	it('should reject on invalid XML', async () => {
		// Test for fileUtils.js line 186 - error handling in convertXML
		mockFs.existsSync.mockReturnValue(true)
		mockFs.statSync.mockReturnValue({ isFile: () => true })
		mockFs.readFileSync.mockReturnValue('<root><unclosed>')

		const result = readFile(
			'/test/file.xml',
			true,
			mockFs as unknown as typeof fs,
		)

		await expect(result).rejects.toThrow()
	})

	it('should validate path when global.__basedir is set in readFile', () => {
		// Test line 249: readFile with global.__basedir
		;(global as { __basedir?: string }).__basedir = '/workspace'
		mockFs.existsSync.mockReturnValue(true)
		mockFs.statSync.mockReturnValue({ isFile: () => true })
		mockFs.readFileSync.mockReturnValue('{"key":"value"}')

		const result = readFile(
			'file.json',
			true,
			mockFs as unknown as typeof fs,
		)

		expect(result).toEqual({ key: 'value' })
		;(global as { __basedir?: string }).__basedir = undefined
	})

	it('should handle YAML parsing warnings', () => {
		// Test line 265: YAML onWarning callback
		mockFs.existsSync.mockReturnValue(true)
		mockFs.statSync.mockReturnValue({ isFile: () => true })
		mockFs.readFileSync.mockReturnValue('key: value')

		// Mock yaml.load to call onWarning callback
		vi.mocked(yaml.load).mockImplementation(
			(_data: string, options?: Parameters<typeof yaml.load>[1]) => {
				if (options && 'onWarning' in options && options.onWarning) {
					// Call onWarning to trigger the error path (line 265)
					// The actual onWarning receives a YAMLException object
					// Create a mock that stringifies to the message
					class MockYAMLException {
						message = 'Test YAML warning message'
						toString() {
							return this.message
						}
					}
					const mockWarning =
						new MockYAMLException() as unknown as Parameters<
							NonNullable<
								Extract<
									Parameters<typeof yaml.load>[1],
									{ onWarning: unknown }
								>['onWarning']
							>
						>[0]
					options.onWarning.call(null, mockWarning)
				}
				// Don't return since onWarning throws
				return { key: 'value' }
			},
		)

		// The onWarning callback should throw an error
		expect(() => {
			readFile('/test/file.yaml', true, mockFs as unknown as typeof fs)
		}).toThrow('YAML parsing file.yaml: Test YAML warning message')

		// Reset mock for other tests
		vi.mocked(yaml.load).mockReset()
	})

	it('should sanitize error paths in readFile error messages', () => {
		// Test lines 287-294: readFile error handling with path sanitization
		;(global as { __basedir?: string }).__basedir = '/workspace'
		;(
			global as { logger?: { error: (error: Error | unknown) => void } }
		).logger = {
			error: vi.fn(),
		}
		mockFs.existsSync.mockReturnValue(true)
		mockFs.statSync.mockReturnValue({ isFile: () => true })
		mockFs.readFileSync.mockImplementation(() => {
			throw new Error('Error reading /workspace/path/to/file.yaml')
		})

		try {
			readFile('path/to/file.yaml', true, mockFs as unknown as typeof fs)
			expect.fail('Should have thrown an error')
		} catch (error) {
			expect(error).toBeInstanceOf(Error)
			expect((error as Error).message).toContain('<workspace>')
			expect(
				(
					global as {
						logger?: { error: (error: Error | unknown) => void }
					}
				).logger?.error,
			).toHaveBeenCalled()
		}
		;(global as { __basedir?: string }).__basedir = undefined
	})
})
