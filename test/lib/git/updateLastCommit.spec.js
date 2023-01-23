import path from 'path'
import * as fileUtils from '../../../src/lib/fileUtils.js'
import { updateLastCommit } from '../../../src/lib/gitUtils.js'

let dir, latest

beforeEach(() => {
	dir = '/test/directory'
	latest = '1234567890abcdef'
})

afterEach(() => {
	jest.resetModules()
})

it('should throw an error if latest is not a string', () => {
	latest = {}
	expect(() => updateLastCommit(dir, latest, fileUtils)).toThrowError(
		'updateLastCommit received a object instead of string',
	)
})

it('should not update lastCommit property if latest is undefined', () => {
	latest = undefined
	fileUtils.fileExists = jest.fn(() => true)
	fileUtils.readFile = jest.fn(() => ({
		git: { lastCommit: '1111111111abcdef' },
	}))
	fileUtils.saveFile = jest.fn()
	updateLastCommit(dir, latest, fileUtils)
	expect(fileUtils.fileExists).not.toHaveBeenCalled()
	expect(fileUtils.readFile).not.toHaveBeenCalled()
	expect(fileUtils.saveFile).not.toHaveBeenCalled()
})

it('should update lastCommit property in index.yaml file', () => {
	// mock the fileExists method of fileUtils
	fileUtils.fileExists = jest.fn(() => true)
	// mock the readFile method of fileUtils
	fileUtils.readFile = jest.fn(() => ({
		git: { lastCommit: '1111111111abcdef' },
	}))
	// mock the saveFile method of fileUtils
	fileUtils.saveFile = jest.fn()
	updateLastCommit(dir, latest, fileUtils)
	expect(fileUtils.readFile).toHaveBeenCalled()
	expect(fileUtils.saveFile).toHaveBeenCalledWith(
		{ git: { lastCommit: latest } },
		'/test/directory/.sfdx/sfparty/index.yaml',
	)
})

it('should use existing index.yaml if it exists', () => {
	fileUtils.fileExists = jest.fn(() => false)
	fileUtils.readFile = jest.fn()
	fileUtils.saveFile = jest.fn()
	updateLastCommit(dir, latest, fileUtils)
	expect(fileUtils.fileExists).toHaveBeenCalled()
	expect(fileUtils.readFile).not.toHaveBeenCalled()
	expect(fileUtils.saveFile).toHaveBeenCalled()
})

it('should save the default definition if file does not exist', () => {
	fileUtils.fileExists = jest.fn(() => false)
	fileUtils.readFile = jest.fn()
	fileUtils.saveFile = jest.fn()

	const defaultDefinition = {
		git: {
			lastCommit: latest,
			latestCommit: undefined,
		},
		local: {
			lastDate: undefined,
		},
	}

	updateLastCommit(dir, latest, fileUtils)
	expect(fileUtils.fileExists).toHaveBeenCalled()
	expect(fileUtils.readFile).not.toHaveBeenCalled()
	expect(fileUtils.saveFile).toHaveBeenCalledWith(
		defaultDefinition,
		'/test/directory/.sfdx/sfparty/index.yaml',
	)
})
