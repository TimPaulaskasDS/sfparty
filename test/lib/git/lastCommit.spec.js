import path from 'path'
import fs from 'fs'
import child_process, { execSync } from 'child_process'
import { lastCommit } from '../../../src/lib/gitUtils.js'

const dir = '/test'
const fileName = 'index.yaml'

const fileUtils = {
	createDirectory: jest.fn(),
	readFile: jest.fn((filePath) => {
		if (filePath.indexOf('project') !== -1) {
			return { git: { lastCommit: 'lastCommit' } }
		}
	}),
	fileExists: jest.fn((filePath) => {
		if (filePath.indexOf('project') !== -1) {
			return true
		}
		return false
	}),
}

jest.mock('fs', () => {
	return {
		existsSync: jest.fn(),
		statSync: jest.fn(),
	}
})

beforeEach(() => {
	jest.clearAllMocks()
	jest.mock('child_process', () => ({
		execSync: jest.fn(() => {
			return 'testCommit'
		}),
	}))
})

test('should return lastCommit and latestCommit if file exists', async () => {
	fs.existsSync.mockReturnValue(true)
	const result = await lastCommit({
		dir: 'project',
		existsSync: fs.existsSync,
		execSync: require('child_process').execSync,
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
	const result = await lastCommit({
		dir: __dirname,
		existsSync: fs.existsSync,
		execSync: require('child_process').execSync,
		fileUtils,
	})
	expect(result).toEqual({
		lastCommit: undefined,
		latestCommit: 'testCommit',
	})
})

it('should throw an error', async () => {
	jest.spyOn(fs, 'existsSync').mockImplementation(() => false)
	try {
		await lastCommit({
			dir,
			fileName,
			existsSync: fs.existsSync,
			execSync: require('child_process').execSync,
			fileUtils,
		})
	} catch (e) {
		expect(e.message).toBe(
			`ENOENT: no such file or directory, access '${path.join(
				dir,
				'.sfdx',
				'sfparty',
				fileName,
			)}'`,
		)
	}
})

it('should return only latest commit if lastCommit is undefined', async () => {
	jest.spyOn(fs, 'existsSync').mockImplementation(() => true)
	jest.spyOn(fileUtils, 'readFile').mockImplementation(() => ({ git: {} }))
	jest.spyOn(child_process, 'execSync').mockImplementation(
		() => 'latestCommit',
	)

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
	jest.spyOn(child_process, 'execSync').mockImplementation(() => {
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
