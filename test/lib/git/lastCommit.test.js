import path from 'path'
import * as fs from 'fs'
import * as child_process from 'child_process'
import { lastCommit } from '../../../src/lib/gitUtils.js'

const dir = '/test'
const fileName = 'index.yaml'

const fileUtils = {
	createDirectory: vi.fn(),
	readFile: vi.fn((filePath) => {
		if (filePath.indexOf('project') !== -1) {
			return { git: { lastCommit: 'lastCommit' } }
		}
	}),
	fileExists: vi.fn((filePath) => {
		if (filePath.indexOf('project') !== -1) {
			return true
		}
		return false
	}),
}

vi.mock('fs', async (importOriginal) => {
	const actual = await importOriginal()
	return {
		...actual,
		default: actual,
		existsSync: vi.fn(),
		statSync: vi.fn(),
	}
})

beforeEach(() => {
	vi.clearAllMocks()
})

test('should return lastCommit and latestCommit if file exists', async () => {
	fs.existsSync.mockReturnValue(true)
	const execSyncMock = vi.fn().mockReturnValue('testCommit')
	const result = await lastCommit({
		dir: 'project',
		existsSync: fs.existsSync,
		execSync: execSyncMock,
		fileUtils,
	})
	expect(result).toEqual({
		lastCommit: 'lastCommit',
		latestCommit: 'testCommit',
	})
})

test('should return only latestCommit if file does not exist', async () => {
	fs.existsSync.mockReturnValue(false)
	fileUtils.fileExists.mockReturnValue(false)
	const execSyncMock = vi.fn().mockReturnValue('testCommit')
	const result = await lastCommit({
		dir: __dirname,
		existsSync: fs.existsSync,
		execSync: execSyncMock,
		fileUtils,
	})
	expect(result).toEqual({
		lastCommit: undefined,
		latestCommit: 'testCommit',
	})
})

it('should handle missing file gracefully', async () => {
	fs.existsSync.mockImplementation(() => false)
	const execSyncMock = vi.fn().mockReturnValue('testCommit')

	const result = await lastCommit({
		dir,
		fileName,
		existsSync: fs.existsSync,
		execSync: execSyncMock,
		fileUtils,
	})

	expect(result).toEqual({
		lastCommit: undefined,
		latestCommit: 'testCommit',
	})
})

it('should return only latest commit if lastCommit is undefined', async () => {
	vi.spyOn(fs, 'existsSync').mockImplementation(() => true)
	vi.spyOn(fileUtils, 'readFile').mockImplementation(() => ({ git: {} }))
	vi.spyOn(child_process, 'execSync').mockImplementation(() => 'latestCommit')

	const result = await lastCommit({
		dir: '/test',
		fileUtils,
		fs,
		existsSync: fs.existsSync,
		execSync: child_process.execSync,
	})

	expect(result).toEqual({
		lastCommit: undefined,
		latestCommit: 'latestCommit',
	})
	expect(fs.existsSync).toHaveBeenCalledWith('/test/.sfdx/sfparty/index.yaml')
	expect(fileUtils.readFile).toHaveBeenCalledWith(
		'/test/.sfdx/sfparty/index.yaml',
	)
	expect(child_process.execSync).toHaveBeenCalledWith(
		'git log --format=format:%H -1',
		{ cwd: '/test', encoding: 'utf-8' },
	)
})

test('should throw an error when execSync returns an error', async () => {
	vi.spyOn(child_process, 'execSync').mockImplementation(() => {
		throw new Error('execSync error')
	})

	try {
		await lastCommit({
			dir: '/test',
			fileUtils,
			fs,
			existsSync: fs.existsSync,
			execSync: child_process.execSync,
		})
	} catch (e) {
		expect(e.message).toBe('execSync error')
	}
})

// Mock execSync to simulate branch detection
vi.mock('child_process', () => ({
	...vi.importActual('child_process'),
	execSync: vi.fn((command) => {
		if (command === 'git rev-parse --abbrev-ref HEAD') {
			return 'currentBranch' // Simulate current branch name
		}
		return 'testCommit' // Simulate latest commit hash
	}),
}))

test('should throw an error when execSync returns an error', async () => {
	vi.spyOn(child_process, 'execSync').mockImplementationOnce(() => {
		throw new Error('execSync error')
	})

	await expect(
		lastCommit({
			dir: '/test',
			fileUtils,
			fs,
			existsSync: fs.existsSync,
			execSync: child_process.execSync,
		}),
	).rejects.toThrow('execSync error')
})
