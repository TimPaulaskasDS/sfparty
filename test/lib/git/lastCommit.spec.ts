import * as fs from 'fs'
import { beforeEach, expect, it, test, vi } from 'vitest'
import * as fileUtilsType from '../../../src/lib/fileUtils.js'
import { lastCommit } from '../../../src/lib/gitUtils.js'

const dir = '/test'
const fileName = 'index.yaml'

const fileUtils = {
	createDirectory: vi.fn(),
	readFile: vi.fn((filePath) => {
		if (filePath.indexOf('project') !== -1) {
			return { git: { lastCommit: 'lastCommit' } }
		}
		return undefined
	}),
	fileExists: vi.fn((filePath) => {
		if (filePath.indexOf('project') !== -1) {
			return true
		}
		return false
	}),
}

vi.mock('fs', () => ({
	default: {},
	existsSync: vi.fn(),
	statSync: vi.fn(),
}))

// Mock child_process to support spawn (used by execGitWithTimeout)
let mockLatestCommit = 'testCommit'
let mockBranchName = 'main'

vi.mock('child_process', async (importOriginal) => {
	const actual = await importOriginal<typeof import('child_process')>()
	return {
		...actual,
		execFileSync: vi.fn(),
		spawn: vi.fn().mockImplementation((command, args, options) => {
			// Determine which git command is being run based on args
			const isBranchCommand =
				args &&
				args.includes('rev-parse') &&
				args.includes('--abbrev-ref')
			const isLogCommand = args && args.includes('log')

			const mockProcess = {
				stdout: {
					on: vi.fn((event, callback) => {
						if (event === 'data') {
							// Return appropriate output based on command
							const output = isBranchCommand
								? mockBranchName
								: isLogCommand
									? mockLatestCommit
									: 'mock-output'
							setTimeout(() => callback(output), 0)
						} else if (event === 'close') {
							setTimeout(() => callback(0), 10)
						}
					}),
					setEncoding: vi.fn(),
				},
				stderr: {
					on: vi.fn(),
				},
				on: vi.fn((event, callback) => {
					if (event === 'close') {
						setTimeout(() => callback(0), 10)
					}
				}),
				kill: vi.fn(),
			}
			return mockProcess as any
		}),
	}
})

beforeEach(() => {
	vi.clearAllMocks()
	mockLatestCommit = 'testCommit'
	mockBranchName = 'main'
})

test('should return lastCommit and latestCommit if file exists', async () => {
	;(fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true)
	mockLatestCommit = 'testCommit'
	const result = await lastCommit({
		dir: 'project',
		existsSync: fs.existsSync,
		fileUtils: fileUtils as unknown as typeof fileUtilsType,
	})
	expect(result).toEqual({
		lastCommit: 'lastCommit',
		latestCommit: 'testCommit',
	})
})

test('should return only latestCommit if file does not exist', async () => {
	;(fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false)
	// Reset fileUtils.fileExists to return false for this test
	fileUtils.fileExists = vi.fn().mockResolvedValue(false)
	mockLatestCommit = 'testCommit'
	const result = await lastCommit({
		dir: __dirname,
		existsSync: fs.existsSync,
		fileUtils: fileUtils as unknown as typeof fileUtilsType,
	})
	expect(result).toEqual({
		lastCommit: undefined,
		latestCommit: 'testCommit',
	})
})

it('should handle missing file gracefully', async () => {
	;(fs.existsSync as ReturnType<typeof vi.fn>).mockImplementation(() => false)
	mockLatestCommit = 'testCommit'

	const result = await lastCommit({
		dir,
		fileName,
		existsSync: fs.existsSync,
		fileUtils: fileUtils as unknown as typeof fileUtilsType,
	})

	expect(result).toEqual({
		lastCommit: undefined,
		latestCommit: 'testCommit',
	})
})

it('should return only latest commit if lastCommit is undefined', async () => {
	vi.spyOn(fs, 'existsSync').mockImplementation(() => true)
	vi.spyOn(fileUtils, 'readFile').mockImplementation(() => ({
		git: {},
	}))
	mockLatestCommit = 'latestCommit'

	const result = await lastCommit({
		dir: '/test',
		fileUtils: fileUtils as unknown as typeof fileUtilsType,
		existsSync: fs.existsSync,
	})

	expect(result).toEqual({
		lastCommit: undefined,
		latestCommit: 'latestCommit',
	})
	expect(fs.existsSync).toHaveBeenCalledWith('/test/.sfdx/sfparty/index.yaml')
	expect(fileUtils.readFile).toHaveBeenCalledWith(
		'/test/.sfdx/sfparty/index.yaml',
	)
})

test('should throw an error when spawn returns an error', async () => {
	const { spawn } = await import('child_process')
	vi.mocked(spawn).mockImplementationOnce((command, args, options) => {
		const mockProcess = {
			stdout: {
				on: vi.fn(),
				setEncoding: vi.fn(),
			},
			stderr: {
				on: vi.fn(),
			},
			on: vi.fn((event, callback) => {
				if (event === 'error') {
					setTimeout(() => callback(new Error('spawn error')), 0)
				}
			}),
			kill: vi.fn(),
		}
		return mockProcess as any
	})

	await expect(
		lastCommit({
			dir: '/test',
			fileUtils: fileUtils as unknown as typeof fileUtilsType,
			existsSync: fs.existsSync,
		}),
	).rejects.toThrow()
})
