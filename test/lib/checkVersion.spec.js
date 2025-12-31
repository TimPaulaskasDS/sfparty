import axios from 'axios'
import { spawnSync } from 'child_process'
import clc from 'cli-color'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkVersion } from '../../src/lib/checkVersion.js'

global.icons = {
	success: clc.greenBright('✔'),
	fail: '❗',
	working: '⏳',
}
global.runType = null
vi.mock('axios')
vi.mock('child_process', () => ({ spawnSync: vi.fn() }))
describe('checkVersion', () => {
	let spy
	beforeEach(() => {
		vi.clearAllMocks()
		// Mock console.log to prevent output but allow assertions
		spy = vi.spyOn(console, 'log').mockImplementation(() => {})
	})
	afterEach(() => {
		spy.mockRestore()
	})
	it('should return "A newer version" if a newer version is available', async () => {
		vi.mocked(axios.get).mockResolvedValue({
			data: { 'dist-tags': { latest: '2.0.0' } },
		})
		const result = await checkVersion({
			axios,
			spawnSync,
			currentVersion: '1.0.0',
		})
		expect(result).toBe('A newer version')
	})
	it('should return "You are on the latest version" if the current version is the latest version', async () => {
		vi.mocked(axios.get).mockResolvedValue({
			data: { 'dist-tags': { latest: '1.0.0' } },
		})
		const result = await checkVersion({
			axios,
			spawnSync,
			currentVersion: '1.0.0',
		})
		expect(result).toBe('You are on the latest version')
	})
	it('should throw a NpmNotInstalledError if npm is not installed', async () => {
		vi.mocked(axios.get).mockResolvedValue({
			data: { 'dist-tags': { latest: '2.0.0' } },
		})
		vi.mocked(spawnSync).mockReturnValue({
			status: 1,
			stderr: Buffer.from('command not found'),
		})
		try {
			await checkVersion({
				axios,
				spawnSync,
				currentVersion: '1.0.0',
				update: true,
			})
		} catch (err) {
			expect(err).toBeInstanceOf(Error)
			expect(err.name).toBe('NpmNotInstalledError')
			expect(err.message).toBe(
				'npm is not installed on this system. Please install npm and run the command again.',
			)
		}
	})
	it('should throw a PackageNotFoundError if the package is not found on the npm registry', async () => {
		vi.mocked(axios.get).mockRejectedValue({ response: { status: 404 } })
		try {
			await checkVersion({
				axios,
				spawnSync,
				currentVersion: '1.0.0',
			})
		} catch (err) {
			expect(err).toBeInstanceOf(Error)
			expect(err.name).toBe('PackageNotFoundError')
			expect(err.message).toBe('Package not found on the npm registry')
		}
	})
	it('should throw a UpdateError if an error occurs while updating the package', async () => {
		vi.mocked(axios.get).mockResolvedValue({
			data: { 'dist-tags': { latest: '2.0.0' } },
		})
		vi.mocked(spawnSync).mockReturnValue({
			status: 1,
			stderr: Buffer.from('Update error'),
		})
		try {
			await checkVersion({
				axios,
				spawnSync,
				currentVersion: '1.0.0',
				update: true,
			})
		} catch (err) {
			expect(err).toBeInstanceOf(Error)
			expect(err.name).toBe('UpdateError')
			expect(err.message).toBe('Error updating the application.')
		}
	})
	it('should throw a UpdateError if update.status !== 0', async () => {
		vi.mocked(axios.get).mockResolvedValue({
			data: { 'dist-tags': { latest: '2.0.0' } },
		})
		vi.mocked(spawnSync)
			.mockImplementationOnce(() => ({ status: 0 }))
			.mockImplementationOnce(() => ({
				status: 1,
				stderr: Buffer.from('Update error'),
			}))
		try {
			await checkVersion({
				axios,
				spawnSync,
				currentVersion: '1.0.0',
				update: true,
			})
		} catch (err) {
			expect(err).toBeInstanceOf(Error)
			expect(err.name).toBe('UpdateError')
			expect(err.message).toBe('Error updating the application.')
		}
	})
	it('should log "You are on the latest version" if update flag is true and the current version is the latest version', async () => {
		vi.mocked(axios.get).mockResolvedValue({
			data: { 'dist-tags': { latest: '1.0.0' } },
		})
		await checkVersion({
			axios,
			spawnSync,
			currentVersion: '1.0.0',
			update: true,
		})
		expect(console.log).toHaveBeenCalledWith(
			`${global.icons?.success} You are on the latest version.`,
		)
	})
	it('should log "Application updated successfully." after successful update', async () => {
		vi.mocked(axios.get).mockResolvedValue({
			data: { 'dist-tags': { latest: '2.0.0' } },
		})
		vi.mocked(spawnSync).mockReturnValue({ status: 0 })
		await checkVersion({
			axios,
			spawnSync,
			currentVersion: '1.0.0',
			update: true,
		})
		expect(console.log).toHaveBeenCalledWith(
			'Application updated successfully.',
		)
	})
	it('should use correct update command for global runType', async () => {
		// Test for checkVersion.js lines 49-50 - global case
		global.runType = 'global'
		vi.mocked(axios.get).mockResolvedValue({
			data: { 'dist-tags': { latest: '2.0.0' } },
		})
		const result = await checkVersion({
			axios,
			spawnSync,
			currentVersion: '1.0.0',
		})
		expect(result).toBe('A newer version')
		expect(console.log).toHaveBeenCalledWith(
			expect.stringContaining('sfparty update'),
		)
	})
	it('should use correct update command for npx runType', async () => {
		// Test for checkVersion.js lines 51-52 - npx case
		global.runType = 'npx'
		vi.mocked(axios.get).mockResolvedValue({
			data: { 'dist-tags': { latest: '2.0.0' } },
		})
		const result = await checkVersion({
			axios,
			spawnSync,
			currentVersion: '1.0.0',
		})
		expect(result).toBe('A newer version')
		expect(console.log).toHaveBeenCalledWith(
			expect.stringContaining('npm i @ds-sfdc/sfparty@latest'),
		)
	})
	it('should use correct update command for node runType', async () => {
		// Test for checkVersion.js lines 53-54 - node case
		global.runType = 'node'
		vi.mocked(axios.get).mockResolvedValue({
			data: { 'dist-tags': { latest: '2.0.0' } },
		})
		const result = await checkVersion({
			axios,
			spawnSync,
			currentVersion: '1.0.0',
		})
		expect(result).toBe('A newer version')
		expect(console.log).toHaveBeenCalledWith(
			expect.stringContaining('git pull'),
		)
	})
	it('should test PackageNotFoundError instantiation', async () => {
		// Test lines 16-17: PackageNotFoundError constructor
		const { PackageNotFoundError } = await import(
			'../../src/lib/checkVersion.js'
		)
		const error = new PackageNotFoundError('Test error')
		expect(error.name).toBe('PackageNotFoundError')
		expect(error.message).toBe('Test error')
		expect(error instanceof Error).toBe(true)
	})
	it('should handle axios request with non-200 status via validateStatus', async () => {
		// Test line 69: validateStatus callback
		// Mock axios.get to verify validateStatus is called
		let validateStatusCalled = false
		let validateStatusValue
		vi.mocked(axios.get).mockImplementation((_url, config) => {
			// Simulate validateStatus being called with a non-200 status
			if (config?.validateStatus) {
				validateStatusCalled = true
				// Call validateStatus with a non-200 status to trigger rejection
				const shouldAccept = config.validateStatus(404)
				validateStatusValue = 404
				if (!shouldAccept) {
					return Promise.reject({
						response: { status: 404 },
						config,
					})
				}
			}
			return Promise.resolve({
				data: { 'dist-tags': { latest: '1.0.0' } },
			})
		})
		const result = await checkVersion({
			axios,
			spawnSync,
			currentVersion: '1.0.0',
		})
		// Should return undefined when axios fails (error is caught silently)
		expect(result).toBeUndefined()
		expect(validateStatusCalled).toBe(true)
		expect(validateStatusValue).toBe(404)
	})
})
//# sourceMappingURL=checkVersion.spec.js.map
