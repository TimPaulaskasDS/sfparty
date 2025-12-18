import { execFileSync } from 'child_process'
import * as os from 'os'
import { beforeEach, expect, it, vi } from 'vitest'
import { log } from '../../../src/lib/gitUtils.js'

vi.mock('child_process', () => {
	return {
		execFileSync: vi.fn(),
	}
})

beforeEach(() => {
	vi.resetAllMocks()
})

it('should return an array of git commit hashes', () => {
	const commits: string[] = [
		'1234567890abcdef',
		'234567890abcdef1',
		'34567890abcdef12',
	]
	vi.mocked(execFileSync).mockReturnValue(commits.join(os.EOL))
	const dir = process.cwd()
	const gitRef = 'HEAD~1..HEAD'
	const result = log(dir, gitRef, execFileSync)
	expect(execFileSync).toHaveBeenCalledWith(
		'git',
		['log', '--format=format:%H', gitRef],
		{ cwd: dir, encoding: 'utf-8' },
	)
	expect(result).toEqual(commits)
})

it('should throw an error if git is not installed or no entry found in path', () => {
	const error = new Error('ENOENT')
	vi.mocked(execFileSync).mockImplementation(() => {
		throw error
	})
	const dir = process.cwd()
	const gitRef = 'HEAD~1..HEAD'
	try {
		log(dir, gitRef, execFileSync)
		expect.fail('Should have thrown an error')
	} catch (err) {
		expect(err).toBeInstanceOf(Error)
		// Test line 219: error message modification for ENOENT
		expect((err as Error).message).toBe(
			'git not installed or no entry found in path',
		)
	}
})

it('should throw error for invalid git reference (empty string)', () => {
	const dir = process.cwd()
	const gitRef = ''
	expect(() => log(dir, gitRef, execFileSync)).toThrow(
		'Invalid git reference',
	)
})

it('should throw error for invalid git reference (invalid characters)', () => {
	const dir = process.cwd()
	const gitRef = 'HEAD; rm -rf /'
	expect(() => log(dir, gitRef, execFileSync)).toThrow(
		'Git reference contains invalid characters',
	)
})
