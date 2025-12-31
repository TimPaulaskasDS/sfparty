import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { beforeEach, expect, test, vi } from 'vitest'
import { diff } from '../../../src/lib/gitUtils.js'

vi.mock('fs', () => ({
	existsSync: vi.fn(),
}))
vi.mock('child_process', () => ({
	execSync: vi.fn(),
}))
const mockStream = {
	setEncoding: vi.fn(),
	on: vi.fn(),
}
vi.mock('child_process', () => ({
	spawn: vi.fn(() => ({
		stdout: mockStream,
		stderr: mockStream,
	})),
}))
const gitRef = 'HEAD~1..HEAD'
beforeEach(() => {
	vi.clearAllMocks()
})
test('rejects if directory does not exist', async () => {
	const existsSync = vi.fn().mockReturnValueOnce(false)
	const spawn = vi.fn()
	try {
		await diff({ dir: '/path/to/dir', gitRef, existsSync, spawn })
		throw new Error('Expected function to throw an error')
	} catch (error) {
		expect(error).toBeInstanceOf(Error)
		expect(error.message).toEqual(
			'The directory "/path/to/dir" does not exist',
		)
	}
})
test('rejects if .git directory does not exist', async () => {
	vi.mocked(existsSync).mockReturnValueOnce(true).mockReturnValueOnce(false)
	try {
		await diff({ dir: '/path/to/dir', gitRef, existsSync, spawn })
		throw new Error('Expected function to throw an error')
	} catch (error) {
		expect(error).toBeInstanceOf(Error)
		expect(error.message).toEqual(
			`The directory "/path/to/dir" is not a git repository`,
		)
	}
})
test('rejects when git is not installed', async () => {
	vi.mocked(existsSync).mockReturnValueOnce(true).mockReturnValueOnce(true)
	const git = {
		on: vi.fn().mockImplementationOnce((event, callback) => {
			if (event === 'error') {
				callback(new Error('Command failed'))
			}
		}),
	}
	vi.mocked(spawn).mockReturnValueOnce(git)
	try {
		await diff({ dir: '/path/to/dir', existsSync, spawn })
		throw new Error('Expected function to throw an error')
	} catch (error) {
		expect(error).toBeInstanceOf(Error)
		expect(error.message).toEqual('Git is not installed on this machine')
	}
})
test('resolves with files when git diff command is successful', async () => {
	vi.mocked(existsSync).mockReturnValueOnce(true).mockReturnValueOnce(true)
	const git = {
		on: vi.fn((event, callback) => {
			if (event === 'close') {
				callback(0)
			}
		}),
	}
	const gitDiff = {
		stdout: {
			setEncoding: vi.fn(),
			on: vi.fn((event, callback) => {
				if (event === 'data') {
					callback('A\tfile1.txt\nM\tfile2.txt\nD\tfile3.txt')
				} else if (event === 'close') {
					callback(0)
				}
			}),
		},
		stderr: {
			on: vi.fn((event, callback) => {
				if (event === 'data') {
					callback('')
				}
			}),
		},
	}
	vi.mocked(spawn).mockReturnValueOnce(git).mockReturnValueOnce(gitDiff)
	const files = await diff({ dir: '/path/to/dir', gitRef, existsSync, spawn })
	expect(files).toEqual([
		{ type: 'add', path: 'file1.txt', action: 'add' },
		{ type: 'modify', path: 'file2.txt', action: 'add' },
		{ type: 'delete', path: 'file3.txt', action: 'delete' },
	])
})
test('rejects when git diff command fails', async () => {
	vi.mocked(existsSync).mockReturnValueOnce(true).mockReturnValueOnce(true)
	const git = {
		on: vi.fn((event, callback) => {
			if (event === 'close') {
				callback(0)
			}
		}),
	}
	const gitDiff = {
		stderr: {
			on: vi.fn(),
		},
		stdout: {
			setEncoding: vi.fn(),
			on: vi.fn(),
		},
	}
	if (gitDiff.stderr && gitDiff.stderr.on) {
		vi.mocked(gitDiff.stderr.on).mockImplementation((_, cb) => {
			cb('Command failed')
			return {}
		})
	}
	vi.mocked(spawn).mockReturnValueOnce(git).mockReturnValueOnce(gitDiff)
	try {
		await diff({ dir: '/path/to/dir', gitRef, existsSync, spawn })
		throw new Error('Expected function to throw an error')
	} catch (error) {
		expect(error).toBeInstanceOf(Error)
		expect(error.message).toEqual(
			'git diff command failed with error: Command failed',
		)
	}
})
test('ignores files when git diff output does not have a tab character', async () => {
	vi.mocked(existsSync).mockReturnValueOnce(true).mockReturnValueOnce(true)
	const git = {
		on: vi.fn((event, callback) => {
			if (event === 'close') {
				callback(0)
			}
		}),
	}
	const gitDiff = {
		stderr: {
			on: vi.fn(),
		},
		stdout: {
			setEncoding: vi.fn(),
			on: vi.fn((event, callback) => {
				if (event === 'data') {
					callback(`\t\t\nA\tfile1.txt\nM\tfile2.txt\nfile3.txt\n`)
				}
				if (event === 'close') {
					callback(0)
				}
			}),
		},
	}
	vi.mocked(spawn).mockReturnValueOnce(git).mockReturnValueOnce(gitDiff)
	const files = await diff({ dir: '/path/to/dir', gitRef, existsSync, spawn })
	expect(files).toEqual([
		{ type: 'add', path: 'file1.txt', action: 'add' },
		{ type: 'modify', path: 'file2.txt', action: 'add' },
	])
})
test('rejects when git --version command fails', async () => {
	vi.mocked(existsSync).mockReturnValueOnce(true).mockReturnValueOnce(true)
	const git = {
		on: vi.fn((event, callback) => {
			if (event === 'close') {
				callback(1)
			}
		}),
	}
	vi.mocked(spawn).mockReturnValueOnce(git)
	try {
		await diff({ dir: '/path/to/dir', gitRef, existsSync, spawn })
		throw new Error('Expected function to throw an error')
	} catch (error) {
		expect(error).toBeInstanceOf(Error)
		expect(error.message).toEqual(
			'git --version command failed with code 1',
		)
	}
})
test('rejects when git diff command fails', async () => {
	vi.mocked(existsSync).mockReturnValueOnce(true).mockReturnValueOnce(true)
	const git = {
		on: vi.fn((event, callback) => {
			if (event === 'close') {
				callback(0)
			}
		}),
	}
	const gitDiff = {
		stderr: {
			on: vi.fn(),
		},
		stdout: {
			setEncoding: vi.fn(),
			on: vi.fn((event, callback) => {
				if (event === 'close') {
					callback(1)
				}
			}),
		},
	}
	vi.mocked(spawn).mockReturnValueOnce(git).mockReturnValueOnce(gitDiff)
	try {
		await diff({ dir: '/path/to/dir', gitRef, existsSync, spawn })
		throw new Error('Expected function to throw an error')
	} catch (error) {
		expect(error).toBeInstanceOf(Error)
		expect(error.message).toEqual('git diff command failed with code 1')
	}
})
//# sourceMappingURL=diff.spec.js.map
