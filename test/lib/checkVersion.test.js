import axios from 'axios'
import { spawnSync } from 'child_process'
import clc from 'cli-color'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkVersion } from '../../src/lib/checkVersion.js'

global.icons = {
	success: String(clc.greenBright('✔')),
	error: String(clc.redBright('✖')),
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
			stderr: { toString: () => 'command not found' },
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
			stderr: { toString: () => 'Update error' },
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
				stderr: { toString: () => 'Update error' },
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
})
//# sourceMappingURL=checkVersion.test.js.map
