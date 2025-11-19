import * as child_process from 'child_process'
import * as fs from 'fs'
import path from 'path'
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
	const execFileSyncMock = vi.fn().mockReturnValue('testCommit')
	const result = await lastCommit({
		dir: 'project',
		existsSync: fs.existsSync,
		execFileSync: execFileSyncMock,
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
	const execFileSyncMock = vi.fn().mockReturnValue('testCommit')
	const result = await lastCommit({
		dir: __dirname,
		existsSync: fs.existsSync,
		execFileSync: execFileSyncMock,
		fileUtils,
	})
	expect(result).toEqual({
		lastCommit: undefined,
		latestCommit: 'testCommit',
	})
})

it('should handle missing file gracefully', async () => {
	fs.existsSync.mockImplementation(() => false)
	const execFileSyncMock = vi.fn().mockReturnValue('testCommit')

	const result = await lastCommit({
		dir,
		fileName,
		existsSync: fs.existsSync,
		execFileSync: execFileSyncMock,
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
	const execFileSyncMock = vi.fn().mockReturnValue('latestCommit')

	const result = await lastCommit({
		dir: '/test',
		fileUtils,
		fs,
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
			fileUtils,
			fs,
			existsSync: fs.existsSync,
			execFileSync: execFileSyncMock,
		})
	} catch (e) {
		expect(e.message).toBe('execFileSync error')
	}
})

test('should throw an error when execFileSync returns an error', async () => {
	const execFileSyncMock = vi.fn().mockImplementationOnce(() => {
		throw new Error('execFileSync error')
	})

	await expect(
		lastCommit({
			dir: '/test',
			fileUtils,
			fs,
			existsSync: fs.existsSync,
			execFileSync: execFileSyncMock,
		}),
	).rejects.toThrow('execFileSync error')
})
