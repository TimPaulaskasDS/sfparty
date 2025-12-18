import * as fileUtilsModule from '../../../src/lib/fileUtils.js'
import { updateLastCommit } from '../../../src/lib/gitUtils.js'

let dir, latest
beforeEach(() => {
	dir = '/test/directory'
	latest = '1234567890abcdef'
})
afterEach(() => {
	vi.resetModules()
})
it('should throw an error if latest is not a string', () => {
	latest = {}
	expect(() =>
		updateLastCommit({ dir, latest, fileUtils: fileUtilsModule }),
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
		.mockImplementation(() => {})
	updateLastCommit(dir, latest, fileUtilsModule)
	expect(fileExistsSpy).not.toHaveBeenCalled()
	expect(readFileSpy).not.toHaveBeenCalled()
	expect(saveFileSpy).not.toHaveBeenCalled()
})
vi.mock('child_process', async (importOriginal) => {
	const actual = await importOriginal()
	return {
		...actual,
		execFileSync: vi.fn().mockReturnValue('mock-branch'),
	}
})
// Then in your test:
it('should update lastCommit property in index.yaml for the current branch', () => {
	const fileExistsSpy = vi
		.spyOn(fileUtilsModule, 'fileExists')
		.mockReturnValue(true)
	const readFileSpy = vi.spyOn(fileUtilsModule, 'readFile').mockReturnValue({
		git: { branches: { 'mock-branch': '1111111111abcdef' } },
	})
	const saveFileSpy = vi
		.spyOn(fileUtilsModule, 'saveFile')
		.mockImplementation(() => {})
	updateLastCommit({ dir, latest, fileUtils: fileUtilsModule })
	expect(saveFileSpy).toHaveBeenCalledWith(
		{ git: { branches: { 'mock-branch': latest } } },
		'/test/directory/.sfdx/sfparty/index.yaml',
	)
})
it('should save the default definition with branches object if file does not exist', () => {
	const fileExistsSpy = vi
		.spyOn(fileUtilsModule, 'fileExists')
		.mockReturnValue(false)
	const saveFileSpy = vi
		.spyOn(fileUtilsModule, 'saveFile')
		.mockImplementation(() => {})
	const defaultDefinitionWithBranches = {
		git: {
			branches: { 'mock-branch': latest },
		},
		local: {
			lastDate: undefined,
		},
	}
	updateLastCommit({ dir, latest, fileUtils: fileUtilsModule })
	expect(saveFileSpy).toHaveBeenCalledWith(
		defaultDefinitionWithBranches,
		'/test/directory/.sfdx/sfparty/index.yaml',
	)
})
//# sourceMappingURL=updateLastCommit.test.js.map
