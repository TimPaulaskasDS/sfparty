#!/usr/bin/env node
'use strict'
import { exec } from 'child_process'
import { readFileSync } from 'fs'
import path from 'path'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import winston from 'winston'
import chalk from 'chalk'
import convertHrtime from 'convert-hrtime'
import axios from 'axios'
import { marked } from 'marked'
import markedTerminal from 'marked-terminal'

import * as fileUtils from './lib/fileUtils.js'
import * as pkgObj from '../package.json'  assert { type: "json" }
import * as yargOptions from './meta/yargs.js'
import * as metadataSplit from './party/split.js'
import * as metadataCombine from './party/combine.js'
import * as labelDefinition from './meta/CustomLabels.js'
import * as profileDefinition from './meta/Profiles.js'
import * as permsetDefinition from './meta/PermissionSets.js'
import * as workflowDefinition from './meta/Workflows.js'
import * as git from './lib/gitUtils.js'

const processStartTime = process.hrtime.bigint()

marked.setOptions({
    // Define custom renderer
    renderer: new markedTerminal
})

global.__basedir = undefined

global.logger = winston.createLogger({
    levels: {
        error: 0,
        warn: 1,
        info: 2,
        http: 3,
        verbose: 4,
        debug: 5,
        silly: 6
    },
    format: winston.format.cli(),
    defaultMeta: { service: 'sfparty' },
    transports: [
        new winston.transports.Console(),
    ],
})

global.icons = {
    "warn": '🔕',
    "success": chalk.greenBright('✔'),
    "fail": '❗',
    "working": '⏳',
    "party": '🎉',
    "delete": '❌💀❌',
}

global.displayError = (error, quit = false) => {
    global.logger.error(error)
    console.info(error)
    if (quit) process.exit(1)
}

const typeArray = [
    'label',
    'profile',
    'permset',
    'workflow',
]

global.git = {
    enabled: false,
    last: undefined,
    latest: undefined,
    append: false,
    delta: false,
}

global.metaTypes = {
    label: {
        type: labelDefinition.metadataDefinition.filetype,
        definition: labelDefinition.metadataDefinition,
        add: { files: [], directories: [] },
        remove: { files: [], directories: [] },
    },
    profile: {
        type: profileDefinition.metadataDefinition.filetype,
        definition: profileDefinition.metadataDefinition,
        add: { files: [], directories: [] },
        remove: { files: [], directories: [] },
    },
    permset: {
        type: permsetDefinition.metadataDefinition.filetype,
        definition: permsetDefinition.metadataDefinition,
        add: { files: [], directories: [] },
        remove: { files: [], directories: [] },
    },
    workflow: {
        type: workflowDefinition.metadataDefinition.filetype,
        definition: workflowDefinition.metadataDefinition,
        add: { files: [], directories: [] },
        remove: { files: [], directories: [] },
    },
}


let types = []
const packageDir = getRootPath()

let errorMessage = chalk.red('Please specify the action of ' + chalk.whiteBright.bgRedBright('split') + ' or ' + chalk.whiteBright.bgRedBright('combine') + '.')

displayHeader() // display header mast

yargs(hideBin(process.argv))
    .command({
        command: 'help',
        alias: 'h',
        handler: (argv) => {
            const data = readFileSync(path.join(process.cwd(), 'README.md'), "utf8")
            console.log(marked(data))
        }
    })
    .command({
        command: '[test]',
        alias: 'test',
        handler: (argv) => {
            // THIS IS A PLACE TO TEST NEW CODE
            global.logger.info(chalk.magentaBright(`${global.icons.party} TEST ${global.icons.party}`))
        }
    })
    .command({
        command: '[update]',
        alias: 'update',
        builder: (yargs) => {
            yargs
                .check(yargCheck)
        },
        handler: (argv) => {
            checkVersion(pkgObj.default.version, true)
        }
    })
    .command({
        command: '[split]',
        alias: 'split',
        description: 'splits metadata xml to yaml/json files',
        builder: (yargs) => {
            yargs
                .example(yargOptions.splitExamples)
                .options(yargOptions.splitOptions)
                .choices('format', ['json', 'yaml'])
                .check(yargCheck)
        },
        handler: (argv) => {
            checkVersion(pkgObj.default.version)
            global.format = argv.format
            splitHandler(argv, processStartTime)
        }
    })
    .command({
        command: '[combine]',
        alias: 'combine',
        description: 'combines yaml/json files into metadata xml',
        builder: (yargs) => {
            yargs
                .example(yargOptions.combineExamples)
                .options(yargOptions.combineOptions)
                .choices('format', ['json', 'yaml'])
                .check(yargCheck)
        },
        handler: (argv) => {
            checkVersion(pkgObj.default.version)
            global.format = argv.format
            const startProm = new Promise((resolve, reject) => {
                if (argv.git !== undefined) {
                    let gitRef = argv.git.trim()
                    global.git.append = argv.append || global.git.append
                    global.git.delta = argv.delta || global.git.delta
                    if (argv.git === '') {
                        const commit = git.lastCommit(global.__basedir, "-1")
                        commit
                            .then((data, error) => {
                                global.git.latest = data.latestCommit
                                global.git.last = data.lastCommit
                                if (data.last === undefined) {
                                    console.log(`${chalk.yellowBright('git mode')} ${chalk.bgMagentaBright('not active:')} no prior commit - processing all`)
                                    resolve(false)
                                } else {
                                    console.log(`${chalk.yellowBright('git mode')} ${chalk.magentaBright('active:')} ${chalk.bgBlackBright(data.lastCommit) + '..' + chalk.bgBlackBright(data.latestCommit)}`)
                                    console.log()
                                    const diff = git.diff(global.__basedir, `${data.lastCommit}..${data.latestCommit}`)
                                    diff
                                        .then((data, error) => {
                                            gitFiles(data)
                                            resolve(true)
                                        })
                                        .catch((error) => {
                                            global.logger.error(error)
                                            reject(error)
                                        })
                                }
                            })
                            .catch((error) => {
                                global.logger.error(error)
                                throw error
                            })
                    } else {
                        console.log(`${chalk.yellowBright('git mode')} ${chalk.magentaBright('active:')} ${chalk.bgBlackBright(gitRef)}`)
                        console.log()
                        const diff = git.diff(global.__basedir, gitRef)
                        diff
                            .then((data, error) => {
                                gitFiles(data)
                                resolve(true)
                            })
                            .catch((error) => {
                                global.logger.error(error)
                                reject(error)
                            })
                    }
                } else {
                    resolve(false)
                }
            })
            startProm.then((result) => {
                global.git.enabled = result
                combineHandler(argv, processStartTime)
            })
            startProm.catch((error) => {
                global.displayError(error, true)
            })
        }
    })
    .demandCommand(1, errorMessage)
    .example([
        ['$0 split --type=profile --all'],
        ['$0 split --type=profile --name="Profile Name"'],
        ['$0 combine --type=permset --all'],
        ['$0 combine --type=permset --name="Permission Set Name"'],
    ])
    .help(false)
    .argv
    .parse

function yargCheck(argv, options) {
    const argvKeys = Object.keys(argv)
    const invalidKeys = argvKeys.filter(key =>
        !['_', '$0'].includes(key) &&
        !options.string.includes(key) && 
        !options.boolean.includes(key) && 
        !options.array.includes(key)
        )

    if (invalidKeys.length > 0) {
        const invalidKeysWithColor = invalidKeys.map(key => chalk.redBright(key))
        throw new Error(`Invalid options specified: ${invalidKeysWithColor.join(', ')}`)
    }

    const name = argv.name
    types = (argv.type !== undefined) ? argv.type.split(',') : typeArray
    types.forEach(type => {
        type = type.trim()
        if (!typeArray.includes(type)) {
            throw new Error(`Invalid type: ${type}`)
        }
    })

    if (types.length > 1) {
        // if using multiple types you cannot specify name
        if ((typeof name != 'undefined' && name != '')) {
            throw new Error(chalk.redBright('You cannot specify ' + chalk.whiteBright.bgRedBright('--name') + ' when using multiple types.'))
        }
    } else {
        switch (argv.type) {
            case 'label':
                if ((typeof name != 'undefined' && name != '')) {
                    throw new Error(chalk.redBright('You cannot specify ' + chalk.whiteBright.bgRedBright('--name') + '  when using label.'))
                }
                break
        }
    }
    return true
}

function displayMessageAndDuration(startTime, message) {
    const diff = process.hrtime.bigint() - BigInt(startTime)
    let durationMessage
    let executionTime = convertHrtime(diff)
    let minutes = Math.floor((executionTime.seconds + Math.round(executionTime.milliseconds / 100000)) / 60)
    let seconds = Math.round((executionTime.seconds + Math.round(executionTime.milliseconds / 100000)) % 60)
    if (minutes == 0 && seconds == 0) {
        durationMessage = message + chalk.magentaBright(`<1s`)
    } else if (minutes > 0) {
        durationMessage = message + chalk.magentaBright(`${minutes}m ${seconds}s`)
    } else {
        durationMessage = message + chalk.magentaBright(`${seconds}s`)
    }
    console.log('\n' + durationMessage)
}

let callAmount = 0
process.on('SIGINT', function () {
    if (callAmount < 1) {
        console.log(`✅ Received abort command`)
        process.exit(1)
    }

    callAmount++
})

function splitHandler(argv, startTime) {
    const split = processSplit(types[0], argv)
    split.then((resolve) => {
        types.shift() // remove first item from array
        if (types.length > 0) {
            console.log()
            splitHandler(argv, startTime)
        } else {
            if (argv.type === undefined || argv.type.split(',').length > 1) {
                let message = `Split completed in `
                displayMessageAndDuration(startTime, message)
            }
        }
    })
}

function processSplit(typeItem, argv) {
    return new Promise((resolve, reject) => {
        const processed = {
            total: 0,
            errors: 0,
            current: 1,
        }
        const startTime = process.hrtime.bigint()

        if (!typeArray.includes(typeItem)) {
            global.logger.error('Metadata type not supported: ' + typeItem)
            process.exit(1)
        }

        const fileList = []
        const typeObj = global.metaTypes[typeItem]
        const type = typeObj.type
        const metaExtension = `.${type}-meta.xml`

        let sourceDir = argv.source || ''
        let targetDir = argv.target || ''
        let name = argv.name
        let all = (argv.type === undefined || argv.type.split(',').length > 1) ? true : argv.all

        if (type == global.metaTypes.label.type) {
            name = global.metaTypes.label.definition.root
        }
        sourceDir = path.join(global.__basedir, packageDir, 'main', 'default', typeObj.definition.directory)
        if (targetDir == '') {
            targetDir = path.join(global.__basedir, packageDir + '-party', 'main', 'default', typeObj.definition.directory)
        } else {
            targetDir = path.join(targetDir, 'main', 'default', typeObj.definition.directory)
        }
        let metaDirPath = sourceDir

        if (!all) {
            let metaFilePath = path.join(metaDirPath, name)
            if (!fileUtils.fileExists(metaFilePath)) {
                name += metaExtension
                metaFilePath = path.join(metaDirPath, name)
                if (!fileUtils.fileExists(metaFilePath)) {
                    global.logger.error('File not found: ' + metaFilePath)
                    process.exit(1)
                }
            }
            fileList.push(name)
        } else {
            if (fileUtils.directoryExists(sourceDir)) {
                fileUtils.getFiles(sourceDir, metaExtension).forEach(file => {
                    fileList.push(file)
                })
            }
        }

        processed.total = fileList.length

        if (processed.total == 0) resolve(true)

        console.log(`${chalk.bgBlackBright('Source path:')} ${sourceDir}`)
        console.log(`${chalk.bgBlackBright('Target path:')} ${targetDir}`)
        console.log()
        console.log(`Splitting a total of ${processed.total} file(s)`)
        console.log()

        const promList = []
        fileList.forEach(metaFile => {
            const metadataItem = new metadataSplit.Split({
                metadataDefinition: typeObj.definition,
                sourceDir: sourceDir,
                targetDir: targetDir,
                metaFilePath: path.join(sourceDir, metaFile),
                sequence: promList.length + 1,
                total: processed.total,
            })
            const metadataItemProm = metadataItem.split()
            promList.push(metadataItemProm)
            metadataItemProm.then((resolve, reject) => {
                if (resolve == false) {
                    processed.errors++
                    processed.current--
                } else {
                    processed.current++
                }
            })
        })
        Promise.allSettled(promList).then((results) => {
            let message = `Split ${chalk.bgBlackBright((processed.current > promList.length) ? promList.length : processed.current)} file(s) ${(processed.errors > 0) ? 'with ' + chalk.bgBlackBright.red(processed.errors) + ' error(s) ' : ''}in `
            displayMessageAndDuration(startTime, message)
            resolve(true)
        })
    })
}

function combineHandler(argv, startTime) {
    const combine = processCombine(types[0], argv)
    combine.then((resolve) => {
        types.shift() // remove first item from array
        if (types.length > 0) {
            console.log()
            combineHandler(argv, startTime)
        } else {
            if (global.git.latest !== undefined) {
                git.updateLastCommit(global.__basedir, global.git.latest)
            }
            if (argv.type === undefined || argv.type.split(',').length > 1) {
                let message = `Split completed in `
                displayMessageAndDuration(startTime, message)
            }
        }
    })
    combine.catch((error) => {
        throw error
    })

}

function processCombine(typeItem, argv) {
    return new Promise((resolve, reject) => {
        const processed = {
            total: 0,
            errors: 0,
            current: 1,
        }
        const startTime = process.hrtime.bigint()

        if (!typeArray.includes(typeItem)) {
            global.logger.error('Metadata type not supported: ' + typeItem)
            process.exit(1)
        }

        let processList = []
        const typeObj = global.metaTypes[typeItem]
        const type = typeObj.type

        let sourceDir = argv.source || ''
        let targetDir = argv.target || ''
        let name = argv.name
        let all = (argv.type === undefined || argv.type.split(',').length > 1) ? true : argv.all
        let addManifest = argv.package
        let desManifest = argv.destructive

        sourceDir = path.join(global.__basedir, packageDir + '-party', 'main', 'default', typeObj.definition.directory)
        if (targetDir == '') {
            targetDir = path.join(global.__basedir, packageDir, 'main', 'default', typeObj.definition.directory)
        } else {
            targetDir = path.join(targetDir, 'main', 'default', typeObj.definition.directory)
        }



        if (type == global.metaTypes.label.type) {
            if (!global.git.enabled || [...new Set([...global.metaTypes[typeItem].add.directories, ...global.metaTypes[typeItem].remove.directories])].includes(global.metaTypes[typeItem].definition.root)) {
                processList.push(global.metaTypes.label.definition.root)
            }
        } else if (!all) {
            let metaDirPath = path.join(sourceDir, name)
            if (!fileUtils.directoryExists(metaDirPath)) {
                global.logger.error('Directory not found: ' + metaDirPath)
                process.exit(1)
            }
            processList.push(name)
        } else {
            if (global.git.enabled) {
                processList = [...new Set([...global.metaTypes[typeItem].add.directories, ...global.metaTypes[typeItem].remove.directories])]
            } else {
                processList = fileUtils.getDirectories(sourceDir)
            }
        }

        processed.total = processList.length
        console.log(`${chalk.bgBlackBright(processed.total)} ${typeItem} file(s) to process`)

        // Abort if there are no files to process
        if (processed.total == 0) {
            resolve(true)
            return
        }

        console.log()
        console.log(`${chalk.bgBlackBright('Source path:')} ${sourceDir}`)
        console.log(`${chalk.bgBlackBright('Target path:')} ${targetDir}`)
        console.log()

        const promList = []
        processList.forEach(metaDir => {
            const metadataItem = new metadataCombine.Combine({
                metadataDefinition: typeObj.definition,
                sourceDir: sourceDir,
                targetDir: targetDir,
                metaDir: metaDir,
                sequence: promList.length + 1,
                total: processed.total,
                addManifest: addManifest,
                desManifest: desManifest,
            })
            const metadataItemProm = metadataItem.combine()
            promList.push(metadataItemProm)
            metadataItemProm.then((resolve, reject) => {
                processed.current++
            })
        })

        Promise.allSettled(promList).then((results) => {
            let successes = 0
            let errors = processed.errors++
            results.forEach(result => {
                if (result.value == true) {
                    successes++
                } else if (result.value == false) {
                    errors++
                }
            })
            let message = `Combined ${chalk.bgBlackBright(successes)} file(s) ${(errors > 0) ? 'with ' + chalk.bgBlackBright(errors) + 'error(s) ' : ''}in `
            displayMessageAndDuration(startTime, message)
            resolve(true)
        })
    })
}

function gitFiles(data) {
    data.forEach(item => {
        if (item.path.indexOf(packageDir + '-party' + path.sep) == 0) {
            const pathArray = item.path.split(path.sep)
            if (pathArray.length > 3) {
                if (getDirectories().includes(pathArray[3])) {
                    switch (git.action[item.type]) {
                        case 'add':
                            global.metaTypes[getKey(pathArray[3])].add.files.push(path.join(global.__basedir, item.path))
                            if (!global.metaTypes[getKey(pathArray[3])].add.directories.includes(pathArray[4])) {
                                global.metaTypes[getKey(pathArray[3])].add.directories.push(pathArray[4])
                            }
                            break
                        case 'delete':
                            global.metaTypes[getKey(pathArray[3])].remove.files.push(path.join(global.__basedir, item.path))
                            if (!global.metaTypes[getKey(pathArray[3])].remove.directories.includes(pathArray[4])) {
                                global.metaTypes[getKey(pathArray[3])].remove.directories.push(pathArray[4])
                            }
                            break
                    }
                }
            }
        }
    })
}

function getKey(directory) {
    let key = undefined
    Object.keys(global.metaTypes).forEach(type => {
        if (global.metaTypes[type].definition.directory == directory) {
            key = type
        }
    })
    return key
}

function getDirectories() {
    const types = []
    Object.keys(global.metaTypes).forEach(type => {
        try {
            types.push(global.metaTypes[type].definition.directory)
        } catch (error) {
            throw error
        }
    })
    return types
}

function displayHeader() {
    const box = {
        topLeft: '╭',
        topRight: '╮',
        bottomLeft: '╰',
        bottomRight: '╯',
        horizontal: '─',
        vertical: '│',
    }
    let versionString = `sfparty v${pkgObj.default.version}${(process.stdout.columns > pkgObj.default.description.length + 15) ? ' - ' + pkgObj.default.description : ''}`
    let titleMessage = `${global.icons.party} ${chalk.yellowBright(versionString)} ${global.icons.party}`
    titleMessage = titleMessage.padEnd((process.stdout.columns / 2) + versionString.length / 1.65)
    titleMessage = titleMessage.padStart(process.stdout.columns)
    titleMessage = chalk.blackBright(box.vertical) + '  ' + titleMessage + '      ' + chalk.blackBright(box.vertical)
    console.log(`${chalk.blackBright(box.topLeft + box.horizontal.repeat(process.stdout.columns - 2) + box.topRight)}`)
    console.log(titleMessage)
    console.log(`${chalk.blackBright(box.bottomLeft + box.horizontal.repeat(process.stdout.columns - 2) + box.bottomRight)}`)
    console.log()
}

function getRootPath(packageDir) {
    let rootPath = fileUtils.find('sfdx-project.json')
    let defaultDir
    if (rootPath) {
        global.__basedir = fileUtils.fileInfo(rootPath).dirname
        let packageJSON = JSON.parse(readFileSync(rootPath))
        if (Array.isArray(packageJSON.packageDirectories)) {
            packageJSON.packageDirectories.every(directory => {
                if (directory.default || packageJSON.packageDirectories.length == 1) defaultDir = directory.path
                if (directory == packageDir) {
                    defaultDir = directory
                    return false
                }
                return true
            })
        }
    } else {
        global.logger.error('Could not determine base path of Salesforce source directory. No sfdx-project.json found. Please specify a source path or execute from Salesforce project directory.')
        process.exit(1)
    }
    if (packageDir && packageDir != defaultDir) {
        global.logger.error('Could not find directory in sfdx-project.json. Please specify a package directory path from the sfdx-project.json file.')
        process.exit(1)
    }

    return defaultDir
}

export async function checkVersion(currentVersion, update = false, test = false) {
    try {
        const { data } = await axios.get('https://registry.npmjs.org/@ds-sfdc/sfparty')
        const command = 'npm i -g @ds-sfdc/sfparty@latest'
        if (currentVersion !== data['dist-tags'].latest) {
            if (!test) console.log(`${(update) ? global.icons.working : global.icons.fail} A newer version ${chalk.bgCyanBright(data['dist-tags'].latest)} is available.`)
            if (!update) {
                if (test) return 'A newer version'
                console.log(`Please upgrade by running ${chalk.cyanBright('sfparty update')}`)
            } else {
                if (!test) console.log(`Updating the application using ${chalk.cyanBright(command)}`)
                exec('npm -v', (error, stdout, stderr) => {
                    if (error) {
                        if (test) 'npm is not installed'
                        global.logger.error("npm is not installed on this system. Please install npm and run the command again.")
                        return
                    } else {
                        exec(command, (error, stdout, stderr) => {
                            if (error) {
                                global.logger.error(error)
                                return
                            }
                            console.log(stdout)
                            console.log(stderr)
                        })
                    }
                })
            }
        } else {
            if (update) {
                if (test) return 'You are on the latest version'
                console.log(`${global.icons.success} You are on the latest version.`)
            }
        }
    } catch (error) {
        global.logger.error(error)
    }
}