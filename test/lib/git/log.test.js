import { execFileSync } from 'child_process'
import * as os from 'os'
import { log } from '../../../src/lib/gitUtils'

vi.mock('child_process', () => {
	return {
		execFileSync: vi.fn(),
	}
})
beforeEach(() => {
	vi.resetAllMocks()
})
it('should return an array of git commit hashes', () => {
	const commits = ['1234567890abcdef', '234567890abcdef1', '34567890abcdef12']
	execFileSync.mockReturnValue(commits.join(os.EOL))
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
	const error = { message: 'ENOENT' }
	execFileSync.mockImplementation(() => {
		throw error
	})
	const dir = process.cwd()
	const gitRef = 'HEAD~1..HEAD'
	expect(() => log(dir, gitRef, execFileSync)).toThrow()
})
//# sourceMappingURL=log.test.js.map
