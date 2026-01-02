import * as fs from 'fs'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as fileUtilsModule from '../../../src/lib/fileUtils.js'
import { updateLastCommit } from '../../../src/lib/gitUtils.js'

let dir: string, latest: string | undefined

beforeEach(() => {
	dir = '/test/directory'
	latest = '1234567890abcdef'
})

it('should throw an error if latest is not a string', async () => {
	latest = {} as unknown as string
	await expect(
		updateLastCommit({ dir, latest, fileUtils: fileUtilsModule, fs }),
	).rejects.toThrow('updateLastCommit received a object instead of string')
})

it('should not update lastCommit property if latest is undefined', async () => {
	latest = undefined
	const fileExistsSpy = vi
		.spyOn(fileUtilsModule, 'fileExists')
		.mockResolvedValue(true)
	const readFileSpy = vi
		.spyOn(fileUtilsModule, 'readFile')
		.mockResolvedValue({
			git: { lastCommit: '1111111111abcdef' },
		})
	const saveFileSpy = vi
		.spyOn(fileUtilsModule, 'saveFile')
		.mockResolvedValue(true)
	await updateLastCommit({ dir, latest, fileUtils: fileUtilsModule, fs })
	expect(fileExistsSpy).not.toHaveBeenCalled()
	expect(readFileSpy).not.toHaveBeenCalled()
	expect(saveFileSpy).not.toHaveBeenCalled()
})

vi.mock('child_process', async (importOriginal) => {
	const actual = await importOriginal<typeof import('child_process')>()
	return {
		...actual,
		execFileSync: vi.fn().mockReturnValue('mock-branch'),
		spawn: vi.fn().mockImplementation((command, args, options) => {
			const mockProcess = {
				stdout: {
					on: vi.fn((event, callback) => {
						if (event === 'data') {
							// Simulate successful git command output
							setTimeout(() => callback('mock-branch'), 0)
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

// Then in your test:
it('should update lastCommit property in index.yaml for the current branch', async () => {
	vi.spyOn(fileUtilsModule, 'fileExists').mockResolvedValue(true)
	vi.spyOn(fileUtilsModule, 'readFile').mockResolvedValue({
		git: { branches: { 'mock-branch': '1111111111abcdef' } },
	})
	const saveFileSpy = vi
		.spyOn(fileUtilsModule, 'saveFile')
		.mockResolvedValue(true)

	await updateLastCommit({ dir, latest, fileUtils: fileUtilsModule, fs })

	expect(saveFileSpy).toHaveBeenCalledWith(
		{ git: { branches: { 'mock-branch': latest } } },
		'/test/directory/.sfdx/sfparty/index.yaml',
	)
})

it('should save the default definition with branches object if file does not exist', async () => {
	vi.spyOn(fileUtilsModule, 'fileExists').mockResolvedValue(false)
	const saveFileSpy = vi
		.spyOn(fileUtilsModule, 'saveFile')
		.mockResolvedValue(true)

	const defaultDefinitionWithBranches = {
		git: {
			branches: { 'mock-branch': latest },
		},
		local: {
			lastDate: undefined,
		},
	}

	await updateLastCommit({ dir, latest, fileUtils: fileUtilsModule, fs })

	expect(saveFileSpy).toHaveBeenCalledWith(
		defaultDefinitionWithBranches,
		'/test/directory/.sfdx/sfparty/index.yaml',
	)
})
