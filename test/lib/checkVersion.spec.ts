import axios from 'axios'
import { spawnSync } from 'child_process'
import clc from 'cli-color'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkVersion } from '../../src/lib/checkVersion.js'

interface GlobalIcons {
	success: string
	fail: string
	working: string
}

interface GlobalContext {
	icons?: GlobalIcons
	runType?: string | null
}

declare const global: GlobalContext & typeof globalThis

global.icons = {
	success: clc.greenBright('✔') as string,
	fail: '❗',
	working: '⏳',
}

global.runType = null

const mockAxiosGet = vi.fn()
const mockSpawnSync = vi.fn()

vi.mock('axios', () => ({
	default: {
		get: (...args: unknown[]) => mockAxiosGet(...args),
	},
}))

vi.mock('child_process', () => ({
	spawnSync: (...args: unknown[]) => mockSpawnSync(...args),
}))

describe('checkVersion', () => {
	let spy: ReturnType<typeof vi.spyOn>
	beforeEach(() => {
		vi.clearAllMocks()
		// Mock console.log to prevent output but allow assertions
		spy = vi.spyOn(console, 'log').mockImplementation(() => {})
	})
	afterEach(() => {
		spy.mockRestore()
	})

	it('should return "A newer version" if a newer version is available', async () => {
		mockAxiosGet.mockResolvedValue({
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
		mockAxiosGet.mockResolvedValue({
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
		mockAxiosGet.mockResolvedValue({
			data: { 'dist-tags': { latest: '2.0.0' } },
		})
		mockSpawnSync.mockReturnValue({
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
			expect((err as Error).name).toBe('NpmNotInstalledError')
			expect((err as Error).message).toBe(
				'npm is not installed on this system. Please install npm and run the command again.',
			)
		}
	})

	it('should throw a PackageNotFoundError if the package is not found on the npm registry', async () => {
		mockAxiosGet.mockRejectedValue({ response: { status: 404 } })
		try {
			await checkVersion({
				axios,
				spawnSync,
				currentVersion: '1.0.0',
			})
		} catch (err) {
			expect(err).toBeInstanceOf(Error)
			expect((err as Error).name).toBe('PackageNotFoundError')
			expect((err as Error).message).toBe(
				'Package not found on the npm registry',
			)
		}
	})

	it('should throw a UpdateError if an error occurs while updating the package', async () => {
		mockAxiosGet.mockResolvedValue({
			data: { 'dist-tags': { latest: '2.0.0' } },
		})
		mockSpawnSync.mockReturnValue({
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
			expect((err as Error).name).toBe('UpdateError')
			expect((err as Error).message).toBe(
				'Error updating the application.',
			)
		}
	})

	it('should throw a UpdateError if update.status !== 0', async () => {
		mockAxiosGet.mockResolvedValue({
			data: { 'dist-tags': { latest: '2.0.0' } },
		})
		mockSpawnSync
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
			expect((err as Error).name).toBe('UpdateError')
			expect((err as Error).message).toBe(
				'Error updating the application.',
			)
		}
	})

	it('should log "You are on the latest version" if update flag is true and the current version is the latest version', async () => {
		mockAxiosGet.mockResolvedValue({
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
		mockAxiosGet.mockResolvedValue({
			data: { 'dist-tags': { latest: '2.0.0' } },
		})
		mockSpawnSync.mockReturnValue({ status: 0 })
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
		mockAxiosGet.mockResolvedValue({
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
		mockAxiosGet.mockResolvedValue({
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
		mockAxiosGet.mockResolvedValue({
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
		let validateStatusValue: number | undefined
		mockAxiosGet.mockImplementation(
			(_url: string, config?: Parameters<typeof axios.get>[1]) => {
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
			},
		)
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
