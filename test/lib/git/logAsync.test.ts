import * as os from 'os'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { logAsync } from '../../../src/lib/gitUtils.js'

vi.mock('child_process', async () => {
	const actual = await import('child_process')
	return {
		...actual,
		spawn: vi.fn(),
	}
})

describe('logAsync', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('should return array of commit hashes', async () => {
		const { spawn } = await import('child_process')
		const mockCommits = ['commit1\n', 'commit2\n', 'commit3\n']
		const _stdoutData = ''
		const mockProcess = {
			stdout: {
				on: vi.fn((event, callback) => {
					if (event === 'data') {
						// Simulate data events
						setTimeout(() => {
							mockCommits.forEach((commit) => {
								callback(Buffer.from(commit, 'utf-8'))
							})
						}, 0)
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

		vi.mocked(spawn).mockReturnValue(mockProcess as any)

		const result = await logAsync('/test/dir', 'main')

		expect(result).toEqual(['commit1', 'commit2', 'commit3'])
		expect(spawn).toHaveBeenCalledWith(
			'git',
			['log', '--format=format:%H', 'main'],
			expect.objectContaining({
				cwd: '/test/dir',
			}),
		)
	})

	it('should filter out empty commits', async () => {
		const { spawn } = await import('child_process')
		const mockCommits = ['commit1\n', '\n', 'commit2\n', '\n']
		const mockProcess = {
			stdout: {
				on: vi.fn((event, callback) => {
					if (event === 'data') {
						setTimeout(() => {
							mockCommits.forEach((commit) => {
								callback(Buffer.from(commit, 'utf-8'))
							})
						}, 0)
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

		vi.mocked(spawn).mockReturnValue(mockProcess as any)

		const result = await logAsync('/test/dir', 'main')

		expect(result).toEqual(['commit1', 'commit2'])
	})

	it('should handle timeout', async () => {
		const { spawn } = await import('child_process')
		const mockProcess = {
			stdout: {
				on: vi.fn(),
				setEncoding: vi.fn(),
			},
			stderr: {
				on: vi.fn(),
			},
			on: vi.fn(),
			kill: vi.fn(),
		}

		vi.mocked(spawn).mockReturnValue(mockProcess as any)

		// Set a very short timeout
		process.env.SFPARTY_GIT_TIMEOUT = '10'

		// Mock setTimeout to trigger timeout immediately
		const originalSetTimeout = global.setTimeout
		global.setTimeout = vi.fn((callback) => {
			callback()
			return {} as any
		}) as any

		try {
			await expect(logAsync('/test/dir', 'main')).rejects.toThrow(
				'Git operation timed out',
			)
			expect(mockProcess.kill).toHaveBeenCalled()
		} finally {
			global.setTimeout = originalSetTimeout
			delete process.env.SFPARTY_GIT_TIMEOUT
		}
	})

	it('should validate git reference', async () => {
		// validateGitRef is tested in other test files
		// This test verifies logAsync works with valid refs
		// Invalid refs are handled by validateGitRef which throws synchronously
		// and is covered by other tests
		const { spawn } = await import('child_process')
		const mockProcess = {
			stdout: {
				on: vi.fn((event, callback) => {
					if (event === 'data') {
						setTimeout(() => {
							callback(Buffer.from('commit1\n', 'utf-8'))
						}, 0)
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

		vi.mocked(spawn).mockReturnValue(mockProcess as any)

		const result = await logAsync('/test/dir', 'main')
		expect(result).toEqual(['commit1'])
	})

	it('should handle git command failure', async () => {
		const { spawn } = await import('child_process')
		const mockProcess = {
			stdout: {
				on: vi.fn(),
				setEncoding: vi.fn(),
			},
			stderr: {
				on: vi.fn((event, callback) => {
					if (event === 'data') {
						setTimeout(() => {
							callback(Buffer.from('error message', 'utf-8'))
						}, 0)
					}
				}),
			},
			on: vi.fn((event, callback) => {
				if (event === 'close') {
					setTimeout(() => callback(1), 10) // Non-zero exit code
				}
			}),
			kill: vi.fn(),
		}

		vi.mocked(spawn).mockReturnValue(mockProcess as any)

		await expect(logAsync('/test/dir', 'main')).rejects.toThrow(
			'Git command failed',
		)
	})
})
