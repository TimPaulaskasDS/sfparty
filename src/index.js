#!/usr/bin/env node
'use strict'
import { readFileSync } from 'fs'
import path from 'path'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import winston from 'winston'
import chalk from 'chalk'
import convertHrtime from 'convert-hrtime'
import * as fileUtils from './lib/fileUtils.js'
import * as pkgObj from '../package.json'  assert { type: "json" }
import * as metadataSplit from './party/split.js'
import * as metadataCombine from './party/combine.js'
import * as labelDefinition from './meta/CustomLabels.js'
import * as profileDefinition from './meta/Profiles.js'
import * as permsetDefinition from './meta/PermissionSets.js'
import * as workflowDefinition from './meta/Workflows.js'

const startTime = process.hrtime.bigint()


global.logger = winston.createLogger({
    levels: winston.config.syslog.levels,
    format: winston.format.cli(),
    defaultMeta: { service: 'sfparty' },
    transports: [
        new winston.transports.Console(),
    ],
});

global.processed = {
    total: 0,
    errors: 0,
    current: 1,
}

global.icons = {
    "warn": '🔕',
    "success": chalk.greenBright('✔'),
    "fail": '❗',
    "working": '⏳',
    "party": '🎉',
}

const typeArray = [
    'label',
    'profile',
    'permset',
    'workflow',
]

const metaTypes = {
    label: {
        type: labelDefinition.metadataDefinition.filetype,
        definition: labelDefinition.metadataDefinition,
    },
    profile: {
        type: profileDefinition.metadataDefinition.filetype,
        definition: profileDefinition.metadataDefinition,
    },
    permset: {
        type: permsetDefinition.metadataDefinition.filetype,
        definition: permsetDefinition.metadataDefinition,
    },
    workflow: {
        type: workflowDefinition.metadataDefinition.filetype,
        definition: workflowDefinition.metadataDefinition,
    },
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
let errorMessage = chalk.red('Please specify the action of ' + chalk.whiteBright.bgRedBright('split') + ' or ' + chalk.whiteBright.bgRedBright('combine') + '.')

displayHeader() // display header mast

function displayHeader() {
    const table = {
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
    titleMessage = chalk.blackBright(table.vertical) + '  ' + titleMessage + '      ' + chalk.blackBright(table.vertical)
    console.log(`${chalk.blackBright(table.topLeft + table.horizontal.repeat(process.stdout.columns - 2) + table.topRight)}`)
    console.log(titleMessage)
    console.log(`${chalk.blackBright(table.bottomLeft + table.horizontal.repeat(process.stdout.columns - 2) + table.bottomRight)}`)
    console.log()
}

yargs(hideBin(process.argv))
    .alias('h', 'help')
    .command({
        command: '[split]',
        alias: 'split',
        description: 'splits metadata xml to yaml/json files',
        builder: (yargs) => {
            yargs
                .example([
                    ['$0 split --type=profile --all'],
                    ['$0 split --type=permset --name="Permission Set Name"'],
                    ['--source=packageDir --target=dir/dir'],
                    ['name portion of file: [name].profile-meta.xml'],
                    ['Example: --name="Admin" for Admin.profile-meta.xml'],
                    ['\nCommands not supporting name or all parameters:'],
                    ['$0 split --type=label'],
                ])
                .options({
                    type: {
                        demand: true,
                        alias: 'type',
                        description: 'type of metadata to split',
                        demandOption: true,
                        type: 'string',
                    },
                    format: {
                        demand: true,
                        alias: 'format',
                        default: 'yaml',
                        description: 'type of output',
                        demandOption: true,
                        type: 'string',
                    },
                    name: {
                        alias: 'n',
                        description: 'name of metadata file to split',
                        demandOption: false,
                        type: 'string',
                    },
                    all: {
                        alias: 'a',
                        description: 'all metadata files of type will be split',
                        demandOption: false,
                        type: 'boolean',
                    },
                    source: {
                        demand: false,
                        alias: 's',
                        description: 'package directory path specified in sfdx-project.json',
                        type: 'string',
                    },
                    target: {
                        demand: false,
                        alias: 't',
                        description: 'target path to directory to create yaml/json files',
                        type: 'string',
                    }
                })
                .choices('type', typeArray)
                .choices('format', ['json', 'yaml'])
                .check((argv, options) => {
                    const name = argv.name
                    const all = argv.all

                    switch (argv.type) {
                        case 'profile':
                        case 'permset':
                        case 'workflow':
                            if ((typeof name != 'undefined' || name == '') && (typeof all != 'undefined' && all)) {
                                throw new Error(chalk.redBright('You cannot specify ' + chalk.whiteBright.bgRedBright('--name') + ' and ' + chalk.whiteBright.bgRedBright('--all') + ' at the same time.'))
                            } else if (typeof name == 'undefined' && (typeof all == 'undefined' || !all)) {
                                throw new Error(chalk.redBright('You must specify the ' + chalk.whiteBright.bgRedBright('--name') + ' parameter or use the ' + chalk.whiteBright.bgRedBright('--all') + ' switch.'))
                            } else {
                                return true // tell Yargs that the arguments passed the check
                            }
                        case 'label':
                            if ((typeof name != 'undefined' && name != '') || (typeof all != 'undefined' && all)) {
                                throw new Error(chalk.redBright('You cannot specify ' + chalk.whiteBright.bgRedBright('--name') + ' or ' + chalk.whiteBright.bgRedBright('--all') + ' when using label.'))
                            }
                            return true
                    }
                })
        },
        handler: (argv) => {
            if (!typeArray.includes(argv.type)) {
                global.logger.error('Metadata type not supported: ' + type)
                process.exit(1)
            }
            const fileList = []
            const typeObj = metaTypes[argv.type]
            const type = typeObj.type
            const metaExtension = `.${type}-meta.xml`
            global.format = argv.format

            let sourceDir = argv.source || ''
            let targetDir = argv.target || ''
            let name = argv.name
            let all = argv.all
            let packageDir = getRootPath(sourceDir)

            if (type == metaTypes.label.type) {
                name = metaTypes.label.definition.root
            }
            sourceDir = path.join(global.__basedir, packageDir, 'main', 'default', typeObj.definition.directory)
            if (targetDir == '') {
                targetDir = path.join(global.__basedir, packageDir + '-party', 'main', 'default', typeObj.definition.directory)
            } else {
                targetDir = path.join(targetDir, 'main', 'default', typeObj.definition.directory)
            }
            let metaDirPath = sourceDir
            console.log(`${chalk.bgBlackBright('Source path:')} ${sourceDir}`)
            console.log(`${chalk.bgBlackBright('Target path:')} ${targetDir}`)
            console.log()

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

            global.processed.total = fileList.length
            console.log(`Splitting a total of ${fileList.length} file(s)`)
            console.log()
            const promList = []
            fileList.forEach(metaFile => {
                const metadataItem = new metadataSplit.Split({
                    metadataDefinition: typeObj.definition,
                    sourceDir: sourceDir,
                    targetDir: targetDir,
                    metaFilePath: path.join(sourceDir, metaFile),
                    sequence: promList.length + 1,
                })
                const metadataItemProm = metadataItem.split()
                promList.push(metadataItemProm)
                metadataItemProm.then((resolve, reject) => {
                    if (resolve == false) {
                        global.processed.errors++
                        global.processed.current--
                    } else {
                        global.processed.current++
                    }
                })
            })
            Promise.allSettled(promList).then((results) => {
                let message = `Split ${chalk.bgBlackBright((global.processed.current > promList.length) ? promList.length : global.processed.current)} file(s) ${(global.processed.errors > 0) ? 'with ' + chalk.bgBlackBright.red(global.processed.errors) + ' error(s) ' : ''}in `
                displayMessageAndDuration(startTime, message)
            })
        }
    })
    .command({
        command: '[combine]',
        alias: 'combine',
        description: 'combines yaml/json files into metadata xml',
        builder: (yargs) => {
            yargs
                .example([
                    ['$0 combine --type=profile --all'],
                    ['$0 combine --type=permset --name="Permission Set Name"'],
                    ['--source=packageDir --target=dir/dir'],
                    ['name portion of file: [name].profile-meta.xml'],
                    ['Example: --name="Admin" for Admin.profile-meta.xml'],
                    ['\nCommands not supporting name or all parameters:'],
                    ['$0 combine --type=label'],])
                .options({
                    type: {
                        demand: true,
                        alias: 'type',
                        description: 'type of metadata to combine',
                        demandOption: true,
                        type: 'string',
                    },
                    format: {
                        demand: true,
                        alias: 'format',
                        default: 'yaml',
                        description: 'type of output',
                        demandOption: true,
                        type: 'string',
                    },
                    name: {
                        alias: 'n',
                        description: 'name of metadata file to combine',
                        demandOption: false,
                        type: 'string',
                    },
                    all: {
                        alias: 'a',
                        description: 'all yaml/json files of type will be combined',
                        demandOption: false,
                        type: 'boolean',
                    },
                    source: {
                        demand: false,
                        alias: 's',
                        description: 'package directory path specified in sfdx-project.json',
                        type: 'string',
                    },
                    target: {
                        demand: false,
                        alias: 't',
                        description: 'target path to directory to create xml files',
                        type: 'string',
                    }
                })
                .choices('type', typeArray)
                .choices('format', ['json', 'yaml'])
                .check((argv, options) => {
                    const name = argv.name
                    const all = argv.all

                    switch (argv.type) {
                        case 'profile':
                        case 'permset':
                        case 'workflow':
                            if ((typeof name != 'undefined' || name == '') && (typeof all != 'undefined' && all)) {
                                throw new Error(chalk.redBright('You cannot specify ' + chalk.whiteBright.bgRedBright('--name') + ' and ' + chalk.whiteBright.bgRedBright('--all') + ' at the same time.'))
                            } else if (typeof name == 'undefined' && (typeof all == 'undefined' || !all)) {
                                throw new Error(chalk.redBright('You must specify the ' + chalk.whiteBright.bgRedBright('--name') + ' parameter or use the ' + chalk.whiteBright.bgRedBright('--all') + ' switch.'))
                            } else {
                                return true // tell Yargs that the arguments passed the check
                            }
                        case 'label':
                            if ((typeof name != 'undefined' && name != '') || (typeof all != 'undefined' && all)) {
                                throw new Error(chalk.redBright('You cannot specify ' + chalk.whiteBright.bgRedBright('--name') + ' or ' + chalk.whiteBright.bgRedBright('--all') + ' when using label.'))
                            }
                            return true
                    }
                })
        },
        handler: (argv) => {
            if (!typeArray.includes(argv.type)) {
                global.logger.error('Metadata type not supported: ' + type)
                process.exit(1)
            }
            let processList = []
            global.format = argv.format
            const typeObj = metaTypes[argv.type]
            const type = typeObj.type

            let sourceDir = argv.source || ''
            let targetDir = argv.target || ''
            let name = argv.name
            let all = argv.all
            let packageDir = getRootPath(sourceDir)

            sourceDir = path.join(global.__basedir, packageDir + '-party', 'main', 'default', typeObj.definition.directory)
            if (targetDir == '') {
                targetDir = path.join(global.__basedir, packageDir, 'main', 'default', typeObj.definition.directory)
            } else {
                targetDir = path.join(targetDir, 'main', 'default', typeObj.definition.directory)
            }

            console.log(`${chalk.bgBlackBright('Source path:')} ${sourceDir}`)
            console.log(`${chalk.bgBlackBright('Target path:')} ${targetDir}`)
            console.log()

            if (type == metaTypes.label.type) {
                processList.push(metaTypes.label.definition.root)
            } else if (!all) {
                let metaDirPath = path.join(sourceDir, name)
                if (!fileUtils.directoryExists(metaDirPath)) {
                    global.logger.error('Directory not found: ' + metaDirPath)
                    process.exit(1)
                }
                processList.push(name)
            } else {
                processList = fileUtils.getDirectories(sourceDir)
            }

            global.processed.total = processList.length
            console.log(`Combining a total of ${global.processed.total} file(s)`)
            console.log()

            const promList = []
            processList.forEach(metaDir => {
                const metadataItem = new metadataCombine.Combine({
                    metadataDefinition: typeObj.definition,
                    sourceDir: sourceDir,
                    targetDir: targetDir,
                    metaDir: metaDir,
                    sequence: promList.length + 1,
                })
                const metadataItemProm = metadataItem.combine()
                promList.push(metadataItemProm)
                metadataItemProm.then((resolve, reject) => {
                    global.processed.current++
                })
            })

            Promise.allSettled(promList).then((results) => {
                let successes = 0
                let errors = 0
                results.forEach(result => {
                    if (result.value == true) {
                        successes++
                    } else if (result.value == false) {
                        errors++
                    }
                })
                let message = `Combined ${chalk.bgBlackBright(successes)} file(s) ${(errors > 0) ? 'with ' + chalk.bgBlackBright(errors) + 'error(s) ' : ''}in `
                displayMessageAndDuration(startTime, message)
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
    .help()
    .argv
    .parse

function displayMessageAndDuration(startTime, message) {
    const diff = process.hrtime.bigint() - BigInt(startTime)
    let durationMessage
    let executionTime = convertHrtime(diff);
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

let callAmount = 0;
process.on('SIGINT', function () {
    if (callAmount < 1) {
        console.log(`✅ Received abort command`);
        process.exit(1)
    }

    callAmount++;
})