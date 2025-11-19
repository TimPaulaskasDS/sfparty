import axios from 'axios'
import { spawnSync } from 'child_process'
import clc from 'cli-color'
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
		spy = vi.spyOn(console, 'log')
	})
	afterEach(() => {
		spy.mockRestore()
	})

	it('should return "A newer version" if a newer version is available', async () => {
		axios.get.mockResolvedValue({
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
		axios.get.mockResolvedValue({
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
		axios.get.mockResolvedValue({
			data: { 'dist-tags': { latest: '2.0.0' } },
		})
		spawnSync.mockReturnValue({
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
			expect(err.name).toBe('NpmNotInstalledError')
			expect(err.message).toBe(
				'npm is not installed on this system. Please install npm and run the command again.',
			)
		}
	})

	it('should throw a PackageNotFoundError if the package is not found on the npm registry', async () => {
		axios.get.mockRejectedValue({ response: { status: 404 } })
		try {
			await checkVersion({
				axios,
				spawnSync,
				currentVersion: '1.0.0',
			})
		} catch (err) {
			expect(err.name).toBe('PackageNotFoundError')
			expect(err.message).toBe('Package not found on the npm registry')
		}
	})

	it('should throw a UpdateError if an error occurs while updating the package', async () => {
		axios.get.mockResolvedValue({
			data: { 'dist-tags': { latest: '2.0.0' } },
		})
		spawnSync.mockReturnValue({
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
			expect(err.name).toBe('UpdateError')
			expect(err.message).toBe('Error updating the application.')
		}
	})

	it('should throw a UpdateError if update.status !== 0', async () => {
		axios.get.mockResolvedValue({
			data: { 'dist-tags': { latest: '2.0.0' } },
		})
		spawnSync.mockImplementationOnce(() => ({ status: 0 }))
		spawnSync.mockImplementationOnce(() => ({
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
			expect(err.name).toBe('UpdateError')
			expect(err.message).toBe('Error updating the application.')
		}
	})

	it('should log "You are on the latest version" if update flag is true and the current version is the latest version', async () => {
		axios.get.mockResolvedValue({
			data: { 'dist-tags': { latest: '1.0.0' } },
		})
		await checkVersion({
			axios,
			spawnSync,
			currentVersion: '1.0.0',
			update: true,
		})
		expect(console.log).toHaveBeenCalledWith(
			`${global.icons.success} You are on the latest version.`,
		)
	})

	it('should log "Application updated successfully." after successful update', async () => {
		axios.get.mockResolvedValue({
			data: { 'dist-tags': { latest: '2.0.0' } },
		})
		spawnSync.mockReturnValue({ status: 0 })
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
		axios.get.mockResolvedValue({
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
		axios.get.mockResolvedValue({
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
		axios.get.mockResolvedValue({
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
})
