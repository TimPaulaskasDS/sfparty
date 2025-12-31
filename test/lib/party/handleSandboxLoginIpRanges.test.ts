import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as fileUtilsModule from '../../../src/lib/fileUtils.js'
import { handleSandboxLoginIpRanges } from '../../../src/party/split.js'

const mockReadFile = vi.fn()
const mockDeleteDirectory = vi.fn()
const mockCreateDirectory = vi.fn()
const mockSaveFile = vi.fn()

vi.mock('../../../src/lib/fileUtils.js', () => ({
	readFile: (...args: unknown[]) => mockReadFile(...args),
	deleteDirectory: (...args: unknown[]) => mockDeleteDirectory(...args),
	createDirectory: (...args: unknown[]) => mockCreateDirectory(...args),
	saveFile: (...args: unknown[]) => mockSaveFile(...args),
}))

describe('handleSandboxLoginIpRanges', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockReadFile.mockReset()
		mockDeleteDirectory.mockReset()
		mockCreateDirectory.mockReset()
		mockSaveFile.mockReset()
	})

	it('should read, delete, create, and save loginIpRanges-sandbox.yaml when it exists', async () => {
		const yamlContent = `loginIpRanges:
- startAddress: 4.78.246.194
  endAddress: 4.78.246.194`
		const targetDir = '/target'

		mockReadFile.mockResolvedValue(yamlContent)
		mockDeleteDirectory.mockResolvedValue(undefined)
		mockCreateDirectory.mockResolvedValue(undefined)
		mockSaveFile.mockResolvedValue(true)

		await handleSandboxLoginIpRanges(targetDir, fileUtilsModule)

		expect(mockReadFile).toHaveBeenCalledWith(
			expect.stringContaining('loginIpRanges-sandbox.yaml'),
		)
		expect(mockDeleteDirectory).toHaveBeenCalledWith(targetDir, true)
		expect(mockCreateDirectory).toHaveBeenCalledWith(targetDir)
		expect(mockSaveFile).toHaveBeenCalledWith(
			yamlContent,
			expect.stringContaining('loginIpRanges-sandbox.yaml'),
			'yaml',
		)
	})

	it('should not save file when loginIpRanges-sandbox.yaml does not exist', async () => {
		const targetDir = '/target'

		mockReadFile.mockResolvedValue(null)
		mockDeleteDirectory.mockResolvedValue(undefined)
		mockCreateDirectory.mockResolvedValue(undefined)

		await handleSandboxLoginIpRanges(targetDir, fileUtilsModule)

		expect(mockReadFile).toHaveBeenCalled()
		expect(mockDeleteDirectory).toHaveBeenCalled()
		expect(mockCreateDirectory).toHaveBeenCalled()
		expect(mockSaveFile).not.toHaveBeenCalled()
	})
})
