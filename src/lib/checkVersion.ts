import type { AxiosInstance, AxiosResponse } from 'axios'
import type { SpawnSyncReturns } from 'child_process'
import clc from 'cli-color'
import semver from 'semver'

class NpmNotInstalledError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'NpmNotInstalledError'
	}
}

// Exported for potential future use
export class PackageNotFoundError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'PackageNotFoundError'
	}
}

class UpdateError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'UpdateError'
	}
}

interface NpmRegistryResponse {
	'dist-tags': {
		latest: string
	}
}

interface CheckVersionOptions {
	axios: AxiosInstance
	spawnSync: (command: string, args: string[]) => SpawnSyncReturns<Buffer>
	currentVersion: string
	update?: boolean
}

interface GlobalContext {
	runType?: 'global' | 'npx' | 'node'
	icons?: {
		working?: string
		fail?: string
		success?: string
	}
}

declare const global: GlobalContext & typeof globalThis

export async function checkVersion({
	axios,
	spawnSync,
	currentVersion,
	update = false,
}: CheckVersionOptions): Promise<string | undefined> {
	let result: NpmRegistryResponse | undefined
	try {
		// Security: Add timeout and limits to external API calls
		const { data }: AxiosResponse<NpmRegistryResponse> = await axios.get(
			'https://registry.npmjs.org/@ds-sfdc/sfparty',
			{
				params: {
					field: 'dist-tags.latest',
				},
				timeout: 5000, // 5 second timeout
				maxRedirects: 3,
				validateStatus: (status: number) => status === 200,
			},
		)
		result = data
	} catch (_error) {
		// do not display errors
	}

	let updateCommand: string
	switch (global.runType) {
		case 'global':
			updateCommand = 'sfparty update'
			break
		case 'npx':
			updateCommand = 'npm i @ds-sfdc/sfparty@latest'
			break
		case 'node':
			updateCommand = 'git pull'
			break
		default:
			updateCommand = 'npm i @ds-sfdc/sfparty@latest'
	}

	if (result !== undefined) {
		const latestVersion = result['dist-tags'].latest
		if (semver.gt(latestVersion, currentVersion)) {
			const version = clc.bgMagenta(result['dist-tags'].latest)
			const icon = update ? global.icons?.working : global.icons?.fail
			console.log()
			console.log(`${icon} A newer version ${version} is available.`)
			if (!update) {
				console.log(
					`Please upgrade by running ${clc.cyanBright(
						updateCommand,
					)}`,
				)
				return 'A newer version'
			} else {
				const command = 'npm i -g @ds-sfdc/sfparty@latest'.split(' ')
				console.log(
					`Updating the application using ${clc.cyanBright(
						command.join(' '),
					)}`,
				)
				try {
					const npmVersion = spawnSync('npm', ['-v'])
					if (
						npmVersion.stderr &&
						npmVersion.stderr.toString().trim() ===
							'command not found'
					) {
						throw new NpmNotInstalledError(
							'npm is not installed on this system. Please install npm and run the command again.',
						)
					}
					const updateResult = spawnSync(command[0], command.slice(1))
					if (updateResult.status !== 0) {
						throw new UpdateError('Error updating the application.')
					}
					console.log('Application updated successfully.')
				} catch (err) {
					throw err
				}
			}
		} else {
			if (update) {
				console.log(
					`${global.icons?.success} You are on the latest version.`,
				)
			}
			return 'You are on the latest version'
		}
	}
	return undefined
}
