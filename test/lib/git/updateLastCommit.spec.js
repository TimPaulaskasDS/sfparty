import * as fileUtils from '../../../src/lib/fileUtils.js'
import { updateLastCommit } from '../../../src/lib/gitUtils.js'
import { execSync } from 'child_process'

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
	expect(() => updateLastCommit({ dir, latest, fileUtils })).toThrowError(
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

jest.mock('child_process', () => ({
	...jest.requireActual('child_process'), // This line ensures that other child_process methods are still available as normal
	execSync: jest.fn().mockReturnValue('mock-branch'),
}))

// Then in your test:
it('should update lastCommit property in index.yaml for the current branch', () => {
	fileUtils.fileExists = jest.fn(() => true)
	fileUtils.readFile = jest.fn(() => ({
		git: { branches: { 'mock-branch': '1111111111abcdef' } },
	}))
	fileUtils.saveFile = jest.fn()

	updateLastCommit({ dir, latest, fileUtils })

	expect(fileUtils.saveFile).toHaveBeenCalledWith(
		{ git: { branches: { 'mock-branch': latest } } },
		'/test/directory/.sfdx/sfparty/index.yaml',
	)
})

it('should save the default definition with branches object if file does not exist', () => {
	jest.mock('child_process', () => ({
		execSync: jest.fn().mockReturnValue('mock-branch'),
	}))
	fileUtils.fileExists = jest.fn(() => false)
	fileUtils.saveFile = jest.fn()

	const defaultDefinitionWithBranches = {
		git: {
			branches: { 'mock-branch': latest },
		},
		local: {
			lastDate: undefined,
		},
	}

	updateLastCommit({ dir, latest, fileUtils })

	expect(fileUtils.saveFile).toHaveBeenCalledWith(
		defaultDefinitionWithBranches,
		'/test/directory/.sfdx/sfparty/index.yaml',
	)
})
