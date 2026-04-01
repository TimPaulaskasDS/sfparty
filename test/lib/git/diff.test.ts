import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { beforeEach, expect, test, vi } from 'vitest'
import { diff } from '../../../src/lib/gitUtils.js'

vi.mock('fs', () => ({
	existsSync: vi.fn(),
}))

const mockStream = {
	setEncoding: vi.fn(),
	on: vi.fn(),
}

vi.mock('child_process', async (importOriginal) => {
	const actual = await importOriginal<typeof import('child_process')>()
	return {
		...actual,
		execSync: vi.fn(),
		spawn: vi.fn(() => ({
			stdout: mockStream,
			stderr: mockStream,
			on: vi.fn(),
			kill: vi.fn(),
		})),
	}
})

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
		// SEC-008: Error message now sanitizes paths
		expect((error as Error).message).toEqual(
			'The directory "dir" does not exist',
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
		// SEC-008: Error message now sanitizes paths
		expect((error as Error).message).toEqual(
			`The directory "dir" is not a git repository`,
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
		on: vi.fn((event, callback) => {
			if (event === 'close') {
				callback(0)
			}
		}),
		stdout: {
			setEncoding: vi.fn(),
			on: vi.fn((event, callback) => {
				if (event === 'data') {
					callback('A\tfile1.txt\nM\tfile2.txt\nD\tfile3.txt')
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
		kill: vi.fn(),
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
		on: vi.fn(),
		stderr: {
			on: vi.fn(),
		},
		stdout: {
			setEncoding: vi.fn(),
			on: vi.fn(),
		},
		kill: vi.fn(),
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
		on: vi.fn((event, callback) => {
			if (event === 'close') {
				callback(0)
			}
		}),
		stderr: {
			on: vi.fn(),
		},
		stdout: {
			setEncoding: vi.fn(),
			on: vi.fn((event, callback) => {
				if (event === 'data') {
					callback(`\t\t\nA\tfile1.txt\nM\tfile2.txt\nfile3.txt\n`)
				}
			}),
		},
		kill: vi.fn(),
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
		on: vi.fn((event, callback: (code: number) => void) => {
			if (event === 'close') {
				callback(1)
			}
		}),
		stderr: {
			on: vi.fn(),
		},
		stdout: {
			setEncoding: vi.fn(),
			on: vi.fn(),
		},
		kill: vi.fn(),
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
		on: vi.fn((event, callback) => {
			if (event === 'close') {
				callback(0)
			}
		}),
		stdout: {
			setEncoding: vi.fn(),
			on: vi.fn((event, callback) => {
				if (event === 'data') {
					// Use '!' which is not in status object (A,C,D,M,R,T,U,X are the only ones)
					callback('!\tfile1.txt\n')
				}
			}),
		},
		stderr: {
			on: vi.fn(),
		},
		kill: vi.fn(),
	} as unknown as ReturnType<typeof spawn>
	;(spawn as ReturnType<typeof vi.fn>)
		.mockReturnValueOnce(git)
		.mockReturnValueOnce(gitDiff)

	const files = await diff({ dir: '/path/to/dir', gitRef, existsSync, spawn })
	// When statusType is undefined, should default to type 'A' (line 176) and action 'add' (line 180)
	expect(files).toEqual([{ type: 'A', path: 'file1.txt', action: 'add' }])
})

test('should handle gitDiff.on error event (covers line 248-250)', async () => {
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
			on: vi.fn(),
		},
		stderr: {
			on: vi.fn(),
		},
		on: vi.fn((event, callback) => {
			if (event === 'error') {
				// Trigger error event to cover lines 248-250
				setTimeout(
					() => callback(new Error('git diff process error')),
					0,
				)
			}
		}),
		kill: vi.fn(),
	} as unknown as ReturnType<typeof spawn>
	;(spawn as ReturnType<typeof vi.fn>)
		.mockReturnValueOnce(git)
		.mockReturnValueOnce(gitDiff)

	await expect(
		diff({ dir: '/path/to/dir', gitRef, existsSync, spawn }),
	).rejects.toThrow('git diff process error')
})

test('should handle git.on error event after handlers registered (covers line 253-255)', async () => {
	;(existsSync as ReturnType<typeof vi.fn>)
		.mockReturnValueOnce(true)
		.mockReturnValueOnce(true)

	// Track all error handlers registered
	const errorHandlers: Array<(error: Error) => void> = []

	const git = {
		on: vi.fn((event, callback) => {
			if (event === 'error') {
				// Store all error handlers - both the one at line 171 and line 253
				errorHandlers.push(callback)
			} else if (event === 'close') {
				// After close handler is registered, trigger error on the SECOND handler (line 253-255)
				// The first handler (line 171) throws, but we want to test the second one
				setTimeout(() => {
					// Call the second error handler (index 1) which is at line 253-255
					if (errorHandlers.length > 1) {
						// The second handler calls innerReject, not throw
						errorHandlers[1](
							new Error('git process error after setup'),
						)
					}
				}, 10)
			}
		}),
	} as unknown as ReturnType<typeof spawn>
	;(spawn as ReturnType<typeof vi.fn>).mockReturnValueOnce(git)

	// The first error handler throws, but the second one (line 253-255) calls innerReject
	// We need to catch the error from innerReject, not the thrown error
	await expect(
		diff({ dir: '/path/to/dir', gitRef, existsSync, spawn }),
	).rejects.toThrow('git process error after setup')
})

test('should clear timeout when timeoutCleared is false in then handler (covers line 266)', async () => {
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
					callback('A\tfile1.txt\n')
				}
			}),
		},
		stderr: {
			on: vi.fn(),
		},
		on: vi.fn((event, callback) => {
			if (event === 'close') {
				setTimeout(() => callback(0), 5)
			}
		}),
		kill: vi.fn(),
	} as unknown as ReturnType<typeof spawn>
	;(spawn as ReturnType<typeof vi.fn>)
		.mockReturnValueOnce(git)
		.mockReturnValueOnce(gitDiff)

	// Set a longer timeout so the operation completes before timeout
	process.env.SFPARTY_GIT_TIMEOUT = '10000'

	const files = await diff({ dir: '/path/to/dir', gitRef, existsSync, spawn })
	expect(files).toEqual([{ type: 'add', path: 'file1.txt', action: 'add' }])

	delete process.env.SFPARTY_GIT_TIMEOUT
})
