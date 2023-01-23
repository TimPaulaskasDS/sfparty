import { execSync, spawn } from 'child_process'
import { existsSync } from 'fs'
import { diff } from '../../../src/lib/gitUtils'

jest.mock('fs', () => ({
	existsSync: jest.fn(),
}))
jest.mock('child_process', () => ({
	execSync: jest.fn(),
}))
const mockStream = {
	setEncoding: jest.fn(),
	on: jest.fn(),
}
jest.mock('child_process', () => ({
	spawn: jest.fn(() => ({
		stdout: mockStream,
		stderr: mockStream,
	})),
}))

const gitRef = 'HEAD~1..HEAD'

beforeEach(() => {
	jest.clearAllMocks()
})

test('rejects if directory does not exist', async () => {
	const existsSync = jest.fn().mockReturnValueOnce(false)
	const spawn = jest.fn()
	try {
		await diff({ dir: '/path/to/dir', gitRef, existsSync, spawn })
		fail('Expected function to throw an error')
	} catch (error) {
		expect(error.message).toEqual(
			'The directory "/path/to/dir" does not exist',
		)
	}
})

test('rejects if .git directory does not exist', async () => {
	existsSync.mockReturnValueOnce(true).mockReturnValueOnce(false)

	try {
		await diff({ dir: '/path/to/dir', gitRef, existsSync, spawn })
		fail('Expected function to throw an error')
	} catch (error) {
		expect(error.message).toEqual(
			`The directory "/path/to/dir" is not a git repository`,
		)
	}
})

test('rejects when git is not installed', async () => {
	existsSync.mockReturnValueOnce(true).mockReturnValueOnce(true)
	const git = {
		on: jest.fn().mockImplementationOnce((event, callback) => {
			if (event === 'error') {
				callback(new Error('Command failed'))
			}
		}),
	}
	spawn.mockReturnValueOnce(git)

	try {
		await diff({ dir: '/path/to/dir', existsSync, spawn })
		fail('Expected function to throw an error')
	} catch (error) {
		expect(error.message).toEqual('Git is not installed on this machine')
	}
})

test('resolves with files when git diff command is successful', async () => {
	existsSync.mockReturnValueOnce(true).mockReturnValueOnce(true)
	const git = {
		on: jest.fn((event, callback) => {
			if (event === 'close') {
				callback(0)
			}
		}),
	}
	const gitDiff = {
		stdout: {
			setEncoding: jest.fn(),
			on: jest.fn((event, callback) => {
				if (event === 'data') {
					callback('A\tfile1.txt\nM\tfile2.txt\nD\tfile3.txt')
				} else if (event === 'close') {
					callback(0)
				}
			}),
		},
		stderr: {
			on: jest.fn((event, callback) => {
				if (event === 'data') {
					callback('')
				}
			}),
		},
	}
	spawn.mockReturnValueOnce(git).mockReturnValueOnce(gitDiff)

	const files = await diff({ dir: '/path/to/dir', gitRef, existsSync, spawn })
	expect(files).toEqual([
		{ type: 'add', path: 'file1.txt', action: 'add' },
		{ type: 'modify', path: 'file2.txt', action: 'add' },
		{ type: 'delete', path: 'file3.txt', action: 'delete' },
	])
})

test('rejects when git diff command fails', async () => {
	existsSync.mockReturnValueOnce(true).mockReturnValueOnce(true)
	const git = {
		on: jest.fn((event, callback) => {
			if (event === 'close') {
				callback(0)
			}
		}),
	}
	const gitDiff = {
		stderr: {
			on: jest.fn(),
		},
		stdout: {
			setEncoding: jest.fn(),
			on: jest.fn(),
		},
	}
	gitDiff.stderr.on.mockImplementation((_, cb) => cb('Command failed'))
	spawn.mockReturnValueOnce(git).mockReturnValueOnce(gitDiff)

	try {
		await diff({ dir: '/path/to/dir', gitRef, existsSync, spawn })
		fail('Expected function to throw an error')
	} catch (error) {
		expect(error.message).toEqual(
			'git diff command failed with error: Command failed',
		)
	}
})

test('ignores files when git diff output does not have a tab character', async () => {
	existsSync.mockReturnValueOnce(true).mockReturnValueOnce(true)
	const git = {
		on: jest.fn((event, callback) => {
			if (event === 'close') {
				callback(0)
			}
		}),
	}
	const gitDiff = {
		stderr: {
			on: jest.fn(),
		},
		stdout: {
			setEncoding: jest.fn(),
			on: jest.fn((event, callback) => {
				if (event === 'data') {
					callback(`\t\t\nA\tfile1.txt\nM\tfile2.txt\nfile3.txt\n`)
				}
				if (event === 'close') {
					callback(0)
				}
			}),
		},
	}
	spawn.mockReturnValueOnce(git).mockReturnValueOnce(gitDiff)

	const files = await diff({ dir: '/path/to/dir', gitRef, existsSync, spawn })
	expect(files).toEqual([
		{ type: 'add', path: 'file1.txt', action: 'add' },
		{ type: 'modify', path: 'file2.txt', action: 'add' },
	])
})

test('rejects when git --version command fails', async () => {
	existsSync.mockReturnValueOnce(true).mockReturnValueOnce(true)
	const git = {
		on: jest.fn((event, callback) => {
			if (event === 'close') {
				callback(1)
			}
		}),
	}
	spawn.mockReturnValueOnce(git)

	try {
		await diff({ dir: '/path/to/dir', gitRef, existsSync, spawn })
		fail('Expected function to throw an error')
	} catch (error) {
		expect(error.message).toEqual(
			'git --version command failed with code 1',
		)
	}
})

test('rejects when git diff command fails', async () => {
	existsSync.mockReturnValueOnce(true).mockReturnValueOnce(true)
	const git = {
		on: jest.fn((event, callback) => {
			if (event === 'close') {
				callback(0)
			}
		}),
	}
	const gitDiff = {
		stderr: {
			on: jest.fn(),
		},
		stdout: {
			setEncoding: jest.fn(),
			on: jest.fn((event, callback) => {
				if (event === 'close') {
					callback(1)
				}
			}),
		},
	}
	spawn.mockReturnValueOnce(git).mockReturnValueOnce(gitDiff)

	try {
		await diff({ dir: '/path/to/dir', gitRef, existsSync, spawn })
		fail('Expected function to throw an error')
	} catch (error) {
		expect(error.message).toEqual('git diff command failed with code 1')
	}
})
