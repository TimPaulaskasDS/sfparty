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

beforeEach(() => {
	vi.clearAllMocks()
})

test('should return lastCommit and latestCommit if file exists', async () => {
	;(fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true)
	const execFileSyncMock = vi.fn().mockReturnValue('testCommit')
	const result = await lastCommit({
		dir: 'project',
		existsSync: fs.existsSync,
		execFileSync: execFileSyncMock,
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
	const execFileSyncMock = vi.fn().mockReturnValue('testCommit')
	const result = await lastCommit({
		dir: __dirname,
		existsSync: fs.existsSync,
		execFileSync: execFileSyncMock,
		fileUtils: fileUtils as unknown as typeof fileUtilsType,
	})
	expect(result).toEqual({
		lastCommit: undefined,
		latestCommit: 'testCommit',
	})
})

it('should handle missing file gracefully', async () => {
	;(fs.existsSync as ReturnType<typeof vi.fn>).mockImplementation(() => false)
	const execFileSyncMock = vi.fn().mockReturnValue('testCommit')

	const result = await lastCommit({
		dir,
		fileName,
		existsSync: fs.existsSync,
		execFileSync: execFileSyncMock,
		fileUtils: fileUtils as unknown as typeof fileUtilsType,
	})

	expect(result).toEqual({
		lastCommit: undefined,
		latestCommit: 'testCommit',
	})
})

it('should return only latest commit if lastCommit is undefined', async () => {
	vi.spyOn(fs, 'existsSync').mockImplementation(() => true)
	vi.spyOn(fileUtils, 'readFile').mockImplementation(() => ({ git: {} }))
	const execFileSyncMock = vi
		.fn()
		.mockReturnValueOnce('currentBranch') // First call for branch name
		.mockReturnValueOnce('latestCommit') // Second call for latest commit

	const result = await lastCommit({
		dir: '/test',
		fileUtils: fileUtils as unknown as typeof fileUtilsType,
		existsSync: fs.existsSync,
		execFileSync: execFileSyncMock,
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

test('should throw an error when execFileSync returns an error', async () => {
	const execFileSyncMock = vi.fn().mockImplementation(() => {
		throw new Error('execFileSync error')
	})

	try {
		await lastCommit({
			dir: '/test',
			fileUtils: fileUtils as unknown as typeof fileUtilsType,
			existsSync: fs.existsSync,
			execFileSync: execFileSyncMock,
		})
	} catch (e) {
		expect(e).toBeInstanceOf(Error)
		expect((e as Error).message).toBe('execFileSync error')
	}
})

// Mock child_process to support execFileSync
vi.mock('child_process', () => ({
	execFileSync: vi.fn(),
}))

test('should throw an error when execFileSync returns an error', async () => {
	const execFileSyncMock = vi.fn().mockImplementationOnce(() => {
		throw new Error('execFileSync error')
	})

	await expect(
		lastCommit({
			dir: '/test',
			fileUtils: fileUtils as unknown as typeof fileUtilsType,
			existsSync: fs.existsSync,
			execFileSync: execFileSyncMock,
		}),
	).rejects.toThrow('execFileSync error')
})

test('should use branch-specific commit when branches object exists', async () => {
	// Test for gitUtils.js line 185 - branch-specific commit path
	vi.spyOn(fs, 'existsSync').mockImplementation(() => true)
	vi.spyOn(fileUtils, 'readFile').mockImplementation(() => ({
		git: {
			lastCommit: 'default-commit',
			branches: {
				'test-branch': 'branch-specific-commit',
			},
		},
	}))
	const execFileSyncMock = vi
		.fn()
		.mockReturnValueOnce('test-branch') // First call for branch name
		.mockReturnValueOnce('latest-commit') // Second call for latest commit

	const result = await lastCommit({
		dir: '/test',
		fileUtils: fileUtils as unknown as typeof fileUtilsType,
		existsSync: fs.existsSync,
		execFileSync: execFileSyncMock,
	})

	expect(result).toEqual({
		lastCommit: 'branch-specific-commit',
		latestCommit: 'latest-commit',
	})
})
