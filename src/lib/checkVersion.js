export async function checkVersion(axios, exec, currentVersion, update = false) {
    try {
        const { data } = await axios.get('https://registry.npmjs.org/@ds-sfdc/sfparty')
        const command = 'npm i -g @ds-sfdc/sfparty@latest'
        if (currentVersion !== data['dist-tags'].latest) {
            console.log(`${(update) ? global.icons.working : global.icons.fail} A newer version ${chalk.bgCyanBright(data['dist-tags'].latest)} is available.`)
            if (!update) {
                console.log(`Please upgrade by running ${chalk.cyanBright('sfparty update')}`)
                return 'A newer version'
            } else {
                console.log(`Updating the application using ${chalk.cyanBright(command)}`)
                exec('npm -v', (error, stdout, stderr) => {
                    if (error) {
                         global.logger.error("npm is not installed on this system. Please install npm and run the command again.")
                        return 'npm is not installed'
                    } else {
                        exec(command, (error, stdout, stderr) => {
                            if (error) {
                                global.logger.error(error)
                                reject(error)
                            } else {
                                console.log(stdout)
                                console.log(stderr)
                                resolve(true)
                            }
                        })
                    }
                })
            }
        } else {
            if (update) {
                console.log(`${global.icons.success} You are on the latest version.`)
                return 'You are on the latest version'
            }
        }
    } catch (error) {
        global.logger.error(error)
        throw error
    }
}


