import clc from 'cli-color'
import semver from 'semver'

class NpmNotInstalledError extends Error {
    constructor(message) {
        super(message)
        this.name = "NpmNotInstalledError"
    }
}

class PackageNotFoundError extends Error {
    constructor(message) {
        super(message)
        this.name = "PackageNotFoundError"
    }
}

class UpdateError extends Error {
    constructor(message) {
        super(message)
        this.name = "UpdateError"
    }
}

export async function checkVersion({axios, spawnSync, currentVersion, update = false}) {
    try {
        const { data } = await axios.get('https://registry.npmjs.org/@ds-sfdc/sfparty', {
            params: {
                field: 'dist-tags.latest'
            }
        })
        const latestVersion = data['dist-tags'].latest
        if (semver.gt(latestVersion, currentVersion)) {
            let icon
            const version = clc.bgCyanBright(data['dist-tags'].latest)
            if (update) {
                icon = global.icons.working
            } else {
                icon = global.icons.fail
            }
            console.log(`${icon} A newer version ${version} is available.`)
            if (!update) {
                console.log(`Please upgrade by running ${clc.cyanBright('sfparty update')}`)
                return 'A newer version'
            } else {
                let command = 'npm i -g @ds-sfdc/sfparty@latest'.split(' ')
                console.log(`Updating the application using ${clc.cyanBright(command.join(' '))}`)
                try {
                    const npmVersion = spawnSync('npm', ['-v'])
                    if (npmVersion.stderr && npmVersion.stderr.toString().trim() === 'command not found') {
                        throw new NpmNotInstalledError("npm is not installed on this system. Please install npm and run the command again.")
                    }
                    const update = spawnSync(command[0], command.slice(1))
                    if (update.status !== 0) {
                        throw new UpdateError("Error updating the application.")
                    }
                    console.log("Application updated successfully.")
                } catch (err) {
                    throw err
                }
            }
        } else {
            if (update) {
                console.log(`${global.icons.success} You are on the latest version.`)
            }
            return 'You are on the latest version'
        }
    } catch (error) {
        if (error.response && error.response.status === 404) {
            error = new PackageNotFoundError("Package not found on the npm registry")
        }
        throw error
    }
}