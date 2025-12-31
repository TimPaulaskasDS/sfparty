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
	;(existsSync as ReturnType<typeof vi.fn>).mockReturnValueOnce(false)
	const spawnMock = vi.fn()
	try {
		await diff({
			dir: '/path/to/dir',
			gitRef,
			existsSync,
			spawn: spawnMock,
		})
		throw new Error('Expected function to throw an error')
	} catch (error) {
		expect(error).toBeInstanceOf(Error)
		expect((error as Error).message).toEqual(
			'The directory "/path/to/dir" does not exist',
		)
	}
})

test('rejects if .git directory does not exist', async () => {
	;(existsSync as ReturnType<typeof vi.fn>)
		.mockReturnValueOnce(true)
		.mockReturnValueOnce(false)

	try {
		await diff({ dir: '/path/to/dir', gitRef, existsSync, spawn })
		throw new Error('Expected function to throw an error')
	} catch (error) {
		expect(error).toBeInstanceOf(Error)
		expect((error as Error).message).toEqual(
			`The directory "/path/to/dir" is not a git repository`,
		)
	}
})

test('rejects when git is not installed', async () => {
	;(existsSync as ReturnType<typeof vi.fn>)
		.mockReturnValueOnce(true)
		.mockReturnValueOnce(true)
	const git = {
		on: vi.fn().mockImplementationOnce((event, callback) => {
			if (event === 'error') {
				callback(new Error('Command failed'))
			}
		}),
	} as unknown as ReturnType<typeof spawn>
	;(spawn as ReturnType<typeof vi.fn>).mockReturnValueOnce(git)

	try {
		await diff({ dir: '/path/to/dir', existsSync, spawn })
		throw new Error('Expected function to throw an error')
	} catch (error) {
		expect(error).toBeInstanceOf(Error)
		expect((error as Error).message).toEqual(
			'Git is not installed on this machine',
		)
	}
})

test('resolves with files when git diff command is successful', async () => {
	;(existsSync as ReturnType<typeof vi.fn>)
		.mockReturnValueOnce(true)
		.mockReturnValueOnce(true)
	const git = {
		on: vi.fn((event, callback) => {
			if (event === 'close') {
				callback(0)
			}
		}),
	} as unknown as ReturnType<typeof spawn>
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
	} as unknown as ReturnType<typeof spawn>
	;(spawn as ReturnType<typeof vi.fn>)
		.mockReturnValueOnce(git)
		.mockReturnValueOnce(gitDiff)

	const files = await diff({ dir: '/path/to/dir', gitRef, existsSync, spawn })
	expect(files).toEqual([
		{ type: 'add', path: 'file1.txt', action: 'add' },
		{ type: 'modify', path: 'file2.txt', action: 'add' },
		{ type: 'delete', path: 'file3.txt', action: 'delete' },
	])
})

test('rejects when git diff command fails', async () => {
	;(existsSync as ReturnType<typeof vi.fn>)
		.mockReturnValueOnce(true)
		.mockReturnValueOnce(true)
	const git = {
		on: vi.fn((event, callback) => {
			if (event === 'close') {
				callback(0)
			}
		}),
	} as unknown as ReturnType<typeof spawn>
	const gitDiff = {
		stderr: {
			on: vi.fn(),
		},
		stdout: {
			setEncoding: vi.fn(),
			on: vi.fn(),
		},
	} as unknown as ReturnType<typeof spawn>
	if (gitDiff.stderr && gitDiff.stderr.on) {
		;(gitDiff.stderr.on as ReturnType<typeof vi.fn>).mockImplementation(((
			_: string,
			cb: (err: string) => void,
		) => {
			cb('Command failed')
			return {} as unknown as ReturnType<
				typeof import('stream').Readable.prototype.on
			>
		}) as unknown as (
			event: string | symbol,
			listener: (...args: unknown[]) => void,
		) => ReturnType<typeof import('stream').Readable.prototype.on>)
	}
	;(spawn as ReturnType<typeof vi.fn>)
		.mockReturnValueOnce(git)
		.mockReturnValueOnce(gitDiff)

	try {
		await diff({ dir: '/path/to/dir', gitRef, existsSync, spawn })
		throw new Error('Expected function to throw an error')
	} catch (error) {
		expect(error).toBeInstanceOf(Error)
		expect((error as Error).message).toEqual(
			'git diff command failed with error: Command failed',
		)
	}
})

test('ignores files when git diff output does not have a tab character', async () => {
	;(existsSync as ReturnType<typeof vi.fn>)
		.mockReturnValueOnce(true)
		.mockReturnValueOnce(true)
	const git = {
		on: vi.fn((event, callback) => {
			if (event === 'close') {
				callback(0)
			}
		}),
	} as unknown as ReturnType<typeof spawn>
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
	} as unknown as ReturnType<typeof spawn>
	;(spawn as ReturnType<typeof vi.fn>)
		.mockReturnValueOnce(git)
		.mockReturnValueOnce(gitDiff)

	const files = await diff({ dir: '/path/to/dir', gitRef, existsSync, spawn })
	expect(files).toEqual([
		{ type: 'add', path: 'file1.txt', action: 'add' },
		{ type: 'modify', path: 'file2.txt', action: 'add' },
	])
})

test('rejects when git --version command fails', async () => {
	;(existsSync as ReturnType<typeof vi.fn>)
		.mockReturnValueOnce(true)
		.mockReturnValueOnce(true)
	const git = {
		on: vi.fn((event, callback) => {
			if (event === 'close') {
				callback(1)
			}
		}),
	} as unknown as ReturnType<typeof spawn>
	;(spawn as ReturnType<typeof vi.fn>).mockReturnValueOnce(git)

	try {
		await diff({ dir: '/path/to/dir', gitRef, existsSync, spawn })
		throw new Error('Expected function to throw an error')
	} catch (error) {
		expect(error).toBeInstanceOf(Error)
		expect((error as Error).message).toEqual(
			'git --version command failed with code 1',
		)
	}
})

test('rejects when git diff command fails', async () => {
	;(existsSync as ReturnType<typeof vi.fn>)
		.mockReturnValueOnce(true)
		.mockReturnValueOnce(true)
	const git = {
		on: vi.fn((event, callback) => {
			if (event === 'close') {
				callback(0)
			}
		}),
	} as unknown as ReturnType<typeof spawn>
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
	} as unknown as ReturnType<typeof spawn>
	;(spawn as ReturnType<typeof vi.fn>)
		.mockReturnValueOnce(git)
		.mockReturnValueOnce(gitDiff)

	try {
		await diff({ dir: '/path/to/dir', gitRef, existsSync, spawn })
		throw new Error('Expected function to throw an error')
	} catch (error) {
		expect(error).toBeInstanceOf(Error)
		expect((error as Error).message).toEqual(
			'git diff command failed with code 1',
		)
	}
})

test('handles unknown status type with default action', async () => {
	// Test lines 174-178: statusType undefined branch
	// Use a status code that's definitely not in the status object
	;(existsSync as ReturnType<typeof vi.fn>)
		.mockReturnValueOnce(true)
		.mockReturnValueOnce(true)
	const git = {
		on: vi.fn((event, callback) => {
			if (event === 'close') {
				callback(0)
			}
		}),
	} as unknown as ReturnType<typeof spawn>
	const gitDiff = {
		stdout: {
			setEncoding: vi.fn(),
			on: vi.fn((event, callback) => {
				if (event === 'data') {
					// Use '!' which is not in status object (A,C,D,M,R,T,U,X are the only ones)
					callback('!\tfile1.txt\n')
				} else if (event === 'close') {
					callback(0)
				}
			}),
		},
		stderr: {
			on: vi.fn(),
		},
	} as unknown as ReturnType<typeof spawn>
	;(spawn as ReturnType<typeof vi.fn>)
		.mockReturnValueOnce(git)
		.mockReturnValueOnce(gitDiff)

	const files = await diff({ dir: '/path/to/dir', gitRef, existsSync, spawn })
	// When statusType is undefined, should default to type 'A' (line 176) and action 'add' (line 180)
	expect(files).toEqual([{ type: 'A', path: 'file1.txt', action: 'add' }])
})
