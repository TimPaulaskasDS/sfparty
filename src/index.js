#!/usr/bin/env node
'use strict'
import { exec, spawnSync } from 'child_process'
import { readFileSync } from 'fs'
import path from 'path'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import winston from 'winston'
import clc from 'cli-color'
import convertHrtime from 'convert-hrtime'
import axios from 'axios'
import { marked } from 'marked'
import markedTerminal from 'marked-terminal'
import pkgObj from './lib/pkgObj.cjs'
import * as fileUtils from './lib/fileUtils.js'
import * as yargOptions from './meta/yargs.js'
import * as metadataSplit from './party/split.js'
import * as metadataCombine from './party/combine.js'
import * as labelDefinition from './meta/CustomLabels.js'
import * as profileDefinition from './meta/Profiles.js'
import * as permsetDefinition from './meta/PermissionSets.js'
import * as workflowDefinition from './meta/Workflows.js'
import { checkVersion } from './lib/checkVersion.js'
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
    "success": clc.greenBright('✔'),
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

let errorMessage = clc.red('Please specify the action of ' + clc.whiteBright.bgRedBright('split') + ' or ' + clc.whiteBright.bgRedBright('combine') + '.')

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
            global.logger.info(clc.magentaBright(`${global.icons.party} TEST ${global.icons.party}`))
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
            checkVersion({axios, spawnSync, currentVersion: pkgObj.version, update: true})
        }
    })
    .command({
        command: '[version]',
        alias: 'version',
        builder: (yargs) => {
            yargs
                .check(yargCheck)
        },
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
                                    gitMode({status: 'not active'})
                                    resolve(false)
                                } else {
                                    gitMode({status: 'active', lastCommit: data.lastCommit, latestCommit: data.latestCommit})
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
                        gitMode({status: 'active', gitRef})
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

function gitMode({ status, gitRef, lastCommit, latestCommit }) {
    let statusMessage
    let displayMessage
    if (status == 'not active') {
        statusMessage = clc.bgMagentaBright('not active:')
        displayMessage = `no prior commit - processing all`
    } else {
        statusMessage = clc.magentaBright('active:')
        if (gitRef === undefined) {
            displayMessage = `${clc.bgBlackBright(data.lastCommit) + '..' + clc.bgBlackBright(data.latestCommit)}`
            console.log(`${clc.yellowBright('git mode')} ${clc.magentaBright('active:')} ${clc.bgBlackBright(data.lastCommit) + '..' + clc.bgBlackBright(data.latestCommit)}`)
        } else {
            displayMessage = `${clc.magentaBright('active:')} ${clc.bgBlackBright(gitRef)}`
            console.log(`${clc.yellowBright('git mode')} ${clc.magentaBright('active:')} ${clc.bgBlackBright(gitRef)}`)
        }
    }
    console.log(`${clc.yellowBright('git mode')} ${status}:)} ${displayMessage}`)
    console.log()
}

function yargCheck(argv, options) {
    const argvKeys = Object.keys(argv)
    const invalidKeys = argvKeys.filter(key =>
        !['_', '$0'].includes(key) &&
        !options.string.includes(key) && 
        !options.boolean.includes(key) && 
        !options.array.includes(key)
        )

    if (!argv._.includes('update')) {
        checkVersion({axios, spawnSync, currentVersion: pkgObj.version, update: false})        
    }
    
    if (invalidKeys.length > 0) {
        const invalidKeysWithColor = invalidKeys.map(key => clc.redBright(key))
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
            throw new Error(clc.redBright('You cannot specify ' + clc.whiteBright.bgRedBright('--name') + ' when using multiple types.'))
        }
    } else {
        switch (argv.type) {
            case 'label':
                if ((typeof name != 'undefined' && name != '')) {
                    throw new Error(clc.redBright('You cannot specify ' + clc.whiteBright.bgRedBright('--name') + '  when using label.'))
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
        durationMessage = message + clc.magentaBright(`<1s`)
    } else if (minutes > 0) {
        durationMessage = message + clc.magentaBright(`${minutes}m ${seconds}s`)
    } else {
        durationMessage = message + clc.magentaBright(`${seconds}s`)
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

        console.log(`${clc.bgBlackBright('Source path:')} ${sourceDir}`)
        console.log(`${clc.bgBlackBright('Target path:')} ${targetDir}`)
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
            let message = `Split ${clc.bgBlackBright((processed.current > promList.length) ? promList.length : processed.current)} file(s) ${(processed.errors > 0) ? 'with ' + clc.bgBlackBright.red(processed.errors) + ' error(s) ' : ''}in `
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
        console.log(`${clc.bgBlackBright(processed.total)} ${typeItem} file(s) to process`)

        // Abort if there are no files to process
        if (processed.total == 0) {
            resolve(true)
            return
        }

        console.log()
        console.log(`${clc.bgBlackBright('Source path:')} ${sourceDir}`)
        console.log(`${clc.bgBlackBright('Target path:')} ${targetDir}`)
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
            let message = `Combined ${clc.bgBlackBright(successes)} file(s) ${(errors > 0) ? 'with ' + clc.bgBlackBright(errors) + 'error(s) ' : ''}in `
            displayMessageAndDuration(startTime, message)
            resolve(true)
        })
    })
}

function gitFiles(data) {
    data.forEach(item => {
        if (item.path.indexOf(packageDir + '-party/') == 0) {
            const pathArray = item.path.split('/')
            if (pathArray.length > 3) {
                if (getDirectories().includes(pathArray[3])) {
                    switch (item.action) {
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
    let versionString = `sfparty v${pkgObj.version}${(process.stdout.columns > pkgObj.description.length + 15) ? ' - ' + pkgObj.description : ''}`
    let titleMessage = `${global.icons.party} ${clc.yellowBright(versionString)} ${global.icons.party}`
    titleMessage = titleMessage.padEnd((process.stdout.columns / 2) + versionString.length / 1.65)
    titleMessage = titleMessage.padStart(process.stdout.columns)
    titleMessage = clc.blackBright(box.vertical) + '  ' + titleMessage + '      ' + clc.blackBright(box.vertical)
    console.log(`${clc.blackBright(box.topLeft + box.horizontal.repeat(process.stdout.columns - 2) + box.topRight)}`)
    console.log(titleMessage)
    console.log(`${clc.blackBright(box.bottomLeft + box.horizontal.repeat(process.stdout.columns - 2) + box.bottomRight)}`)
    console.log()
}

function getRootPath(packageDir) {
    let rootPath = fileUtils.find('sfdx-project.json')
    let defaultDir
    if (rootPath) {
        global.__basedir = fileUtils.fileInfo(rootPath).dirname
        let packageJSON
        try {
            packageJSON = JSON.parse(readFileSync(rootPath))            
        } catch (error) {
            if (error.message.indexOf('JSON at position') > 0) {
                global.displayError('sfdx-project.json has invalid JSON', true)
            } else {
                global.displayError(error, true)
            }
        }
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
