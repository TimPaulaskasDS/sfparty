import clc from 'cli-color'
import semver from 'semver'

class NpmNotInstalledError extends Error {
	constructor(message) {
		super(message)
		this.name = 'NpmNotInstalledError'
	}
}

class PackageNotFoundError extends Error {
	constructor(message) {
		super(message)
		this.name = 'PackageNotFoundError'
	}
}

class UpdateError extends Error {
	constructor(message) {
		super(message)
		this.name = 'UpdateError'
	}
}

export async function checkVersion({
	axios,
	spawnSync,
	currentVersion,
	update = false,
}) {
	let result
	try {
		const { data } = await axios.get(
			'https://registry.npmjs.org/@ds-sfdc/sfparty',
			{
				params: {
					field: 'dist-tags.latest',
				},
			},
		)
		result = data
	} catch (error) {
		// do not display errors
	}

	let updateCommand
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
	}

	if (result !== undefined) {
		const latestVersion = result['dist-tags'].latest
		if (semver.gt(latestVersion, currentVersion)) {
			const version = clc.bgMagenta(result['dist-tags'].latest)
			const icon = update ? global.icons.working : global.icons.fail
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
					const update = spawnSync(command[0], command.slice(1))
					if (update.status !== 0) {
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
					`${global.icons.success} You are on the latest version.`,
				)
			}
			return 'You are on the latest version'
		}
	}
}
