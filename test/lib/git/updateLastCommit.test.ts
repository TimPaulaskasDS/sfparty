import * as fs from 'fs'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as fileUtilsModule from '../../../src/lib/fileUtils.js'
import { updateLastCommit } from '../../../src/lib/gitUtils.js'

let dir: string, latest: string | undefined

beforeEach(() => {
	dir = '/test/directory'
	latest = '1234567890abcdef'
})

afterEach(() => {
	vi.resetModules()
})

it('should throw an error if latest is not a string', () => {
	latest = {} as unknown as string
	expect(() =>
		updateLastCommit({ dir, latest, fileUtils: fileUtilsModule, fs }),
	).toThrowError('updateLastCommit received a object instead of string')
})

it('should not update lastCommit property if latest is undefined', () => {
	latest = undefined
	const fileExistsSpy = vi
		.spyOn(fileUtilsModule, 'fileExists')
		.mockReturnValue(true)
	const readFileSpy = vi.spyOn(fileUtilsModule, 'readFile').mockReturnValue({
		git: { lastCommit: '1111111111abcdef' },
	})
	const saveFileSpy = vi
		.spyOn(fileUtilsModule, 'saveFile')
		.mockImplementation(() => true)
	updateLastCommit({ dir, latest, fileUtils: fileUtilsModule, fs })
	expect(fileExistsSpy).not.toHaveBeenCalled()
	expect(readFileSpy).not.toHaveBeenCalled()
	expect(saveFileSpy).not.toHaveBeenCalled()
})

vi.mock('child_process', async (importOriginal) => {
	const actual = await importOriginal<typeof import('child_process')>()
	return {
		...actual,
		execFileSync: vi.fn().mockReturnValue('mock-branch'),
	} as unknown as typeof import('child_process')
})

// Then in your test:
it('should update lastCommit property in index.yaml for the current branch', () => {
	vi.spyOn(fileUtilsModule, 'fileExists').mockReturnValue(true)
	vi.spyOn(fileUtilsModule, 'readFile').mockReturnValue({
		git: { branches: { 'mock-branch': '1111111111abcdef' } },
	})
	const saveFileSpy = vi
		.spyOn(fileUtilsModule, 'saveFile')
		.mockImplementation(() => true)

	updateLastCommit({ dir, latest, fileUtils: fileUtilsModule, fs })

	expect(saveFileSpy).toHaveBeenCalledWith(
		{ git: { branches: { 'mock-branch': latest } } },
		'/test/directory/.sfdx/sfparty/index.yaml',
	)
})

it('should save the default definition with branches object if file does not exist', () => {
	vi.spyOn(fileUtilsModule, 'fileExists').mockReturnValue(false)
	const saveFileSpy = vi
		.spyOn(fileUtilsModule, 'saveFile')
		.mockImplementation(() => true)

	const defaultDefinitionWithBranches = {
		git: {
			branches: { 'mock-branch': latest },
		},
		local: {
			lastDate: undefined,
		},
	}

	updateLastCommit({ dir, latest, fileUtils: fileUtilsModule, fs })

	expect(saveFileSpy).toHaveBeenCalledWith(
		defaultDefinitionWithBranches,
		'/test/directory/.sfdx/sfparty/index.yaml',
	)
})
