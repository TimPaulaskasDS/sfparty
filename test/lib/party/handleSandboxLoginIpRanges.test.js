import { describe, expect, it, vi } from 'vitest'
import * as fileUtils from '../../../src/lib/fileUtils.js'
import { handleSandboxLoginIpRanges } from '../../../src/party/split.js'

vi.mock('../../../src/lib/fileUtils.js', () => ({
	readFile: vi.fn(),
	deleteDirectory: vi.fn(),
	createDirectory: vi.fn(),
	saveFile: vi.fn(),
}))
describe('handleSandboxLoginIpRanges', () => {
	it('should read, delete, create, and save loginIpRanges-sandbox.yaml when it exists', () => {
		const yamlContent = `loginIpRanges:
- startAddress: 4.78.246.194
  endAddress: 4.78.246.194`
		const targetDir = '/target'
		vi.mocked(fileUtils.readFile).mockReturnValue(yamlContent)
		vi.mocked(fileUtils.deleteDirectory).mockReturnValue(undefined)
		vi.mocked(fileUtils.createDirectory).mockReturnValue(undefined)
		vi.mocked(fileUtils.saveFile).mockReturnValue(true)
		handleSandboxLoginIpRanges(targetDir, fileUtils)
		expect(fileUtils.readFile).toHaveBeenCalledWith(
			expect.stringContaining('loginIpRanges-sandbox.yaml'),
		)
		expect(fileUtils.deleteDirectory).toHaveBeenCalledWith(targetDir, true)
		expect(fileUtils.createDirectory).toHaveBeenCalledWith(targetDir)
		expect(fileUtils.saveFile).toHaveBeenCalledWith(
			yamlContent,
			expect.stringContaining('loginIpRanges-sandbox.yaml'),
			'yaml',
		)
	})
	it('should not save file when loginIpRanges-sandbox.yaml does not exist', () => {
		const targetDir = '/target'
		vi.mocked(fileUtils.readFile).mockReturnValue(null)
		vi.mocked(fileUtils.deleteDirectory).mockReturnValue(undefined)
		vi.mocked(fileUtils.createDirectory).mockReturnValue(undefined)
		handleSandboxLoginIpRanges(targetDir, fileUtils)
		expect(fileUtils.readFile).toHaveBeenCalled()
		expect(fileUtils.deleteDirectory).toHaveBeenCalled()
		expect(fileUtils.createDirectory).toHaveBeenCalled()
		expect(fileUtils.saveFile).not.toHaveBeenCalled()
	})
})
//# sourceMappingURL=handleSandboxLoginIpRanges.test.js.map
