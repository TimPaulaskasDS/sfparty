'use strict'

import path from 'path'
import fs from 'fs'
import os from 'os'
import { readFile } from 'fs'
import { Parser } from 'xml2js'
import logUpdate from 'log-update'
import chalk from 'chalk'
import convertHrtime from 'convert-hrtime'
import cliSpinners from 'cli-spinners'
import * as yaml from 'js-yaml'
import * as fileUtils from '../fileUtils.js'
import { permsetDefinition } from '../../meta/PermissionSets.js'

const spinner = cliSpinners['dots']

export class Permset {
    #fileName = {
        'fullName': undefined,
        'shortName': undefined,
    }
    #json
    #errorMessage = ''
    #index = 0
    #startTime = 0
    #spinnerMessage = ''

    constructor(config) {
        this.sourceDir = config.sourceDir
        this.targetDir = config.targetDir
        this.metaFilePath = config.metaFilePath
        this.sequence = config.sequence
    }

    get metaFilePath() {
        return this._metaFilePath
    }

    set metaFilePath(value) {
        value = value.trim()
        if (value === '') {
            throw 'The file path cannot be empty'
        }
        this._metaFilePath = value
        this.#fileName.fullName = fileUtils.fileInfo(value).filename
        this.#fileName.shortName = fileUtils.fileInfo(value).filename.replace('.permissionset-meta.xml', '')
    }

    split() {
        const that = this
        return new Promise((resolve, reject) => {

            if (!that.#fileName || !that.sourceDir || !that.targetDir || !that.metaFilePath) {
                global.logger.error('Invalid information passed to split')
                process.exit(1)
            }
            if (!fileUtils.fileExists(that.metaFilePath)) {
                global.logger.error(`file not found: ${that.metaFilePath}`)
                process.exit(1)
            }

            that.targetDir = path.join(that.targetDir, that.#fileName.shortName)
            let parser = new Parser()
            const getJSON = new Promise((resolve, reject) => {
                readFile(that.metaFilePath, function (err, data) {
                    parser.parseString(data, function (err, result) {
                        if (result) {
                            resolve(result)
                        } else {
                            global.logger.error(`error converting xml to json: ${that.metaFilePath}`)
                            process.exit(1)
                        }
                    })
                })
            })
            getJSON.then((result) => {
                // modify the json to remove unwanted arrays
                delete result.PermissionSet['$']
                let jsonString = JSON.stringify(result, (name, value) => {
                    if (name == '' || !isNaN(name) || permsetDefinition.directories.includes(name) || permsetDefinition.singleFiles.includes(name)) {
                        return value
                    } else {
                        return xml2json(value)
                    }
                })
                that.#json = JSON.parse(jsonString)

                Object.keys(that.#json.PermissionSet).forEach(key => {
                    const keyOrder = permsetDefinition.keyOrder[key]
                    const sortKey = permsetDefinition.sortKeys[key]

                    if (Array.isArray(that.#json.PermissionSet[key])) {
                        // sort json to order by sortKey
                        that.#json.PermissionSet[key].sort((a, b) => {
                            if (a[sortKey] < b[sortKey]) {
                                return -1;
                            }
                            if (a[sortKey] > b[sortKey]) {
                                return 1;
                            }
                            return 0;
                        })

                        // sort json keys in specified order
                        that.#json.PermissionSet[key].forEach(function (part, index) {
                            this[index] = Object.keys(this[index])
                                .sort((a, b) => {
                                    if (keyOrder.indexOf(a) < keyOrder.indexOf(b)) return -1
                                    if (keyOrder.indexOf(a) > keyOrder.indexOf(b)) return 1
                                    return 0
                                })
                                .reduce((accumulator, key) => {
                                    accumulator[key] = this[index][key]
                                    return accumulator
                                }, {})
                        }, that.#json.PermissionSet[key])
                    }
                })

                processFile(that)
                completeFile(that)
                resolve(true)
            })
        })

        function nextFrame(that) {
            return spinner.frames[that.#index = ++that.#index % spinner.frames.length]
        }

        function completeFile(that) {
            let executionTime = getTimeDiff(BigInt(that.#startTime))
            let durationMessage = `${executionTime.seconds}.${executionTime.milliseconds}s`
            let stateIcon = (that.#errorMessage == '') ? global.icons.success : global.icons.fail
            logUpdate(that.#spinnerMessage
                .replace('[%1]', that.sequence.toString().padStart(global.processed.total.toString().length, ' '))
                .replace('[%2]', `. Processed in ${durationMessage}.`)
                .replace('[%3]', `${that.#errorMessage}`)
                .replace('[%4]', `${stateIcon} `)
            )
            logUpdate.done()
        }

        function processFile(that) {
            that.#startTime = process.hrtime.bigint()
            that.#spinnerMessage = `[%1] of ${global.processed.total} - Permission Set: [%4]${chalk.yellowBright(that.#fileName.shortName)}[%2][%3]`

            fileUtils.deleteDirectory(that.targetDir, true) // recursive delete existing directory
            fileUtils.createDirectory(that.targetDir) // create directory

            Main(that)

            Object.keys(that.#json.PermissionSet).forEach(key => {
                that.sequence = global.processed.current
                logUpdate(that.#spinnerMessage
                    .replace('[%1]', that.sequence.toString().padStart(global.processed.total.toString().length, ' '))
                    .replace('[%2]', `\n${chalk.magentaBright(nextFrame(that))} ${key}`)
                    .replace('[%3]', `${that.#errorMessage}`)
                    .replace('[%4]', `${global.icons.working} `)
                )
                if (permsetDefinition.directories.includes(key)) {
                    processDirectory(that, key)
                } else if (permsetDefinition.singleFiles.includes(key)) {
                    singleFile(that, key)
                } else {
                    if (!permsetDefinition.ignore.includes(key) && !permsetDefinition.main.includes(key)) {
                        that.#errorMessage += `\n${global.icons.warn} Not processed: ${key}`
                    }
                }
            })

            return true
        }

        function Main(that) {
            let fileName = path.join(that.targetDir, `main.${global.format}`)
            let mainInfo = {}
            mainInfo.name = that.#fileName.shortName
            permsetDefinition.main.forEach(key => {
                if (that.#json.PermissionSet[key] !== undefined) {
                    mainInfo[key] = that.#json.PermissionSet[key]
                }
            })

            let jsonString = JSON.stringify(mainInfo, null, '\t')
            switch (global.format) {
                case 'json':
                    fs.writeFileSync(fileName, jsonString)
                    break
                case 'yaml':
                    let doc = yaml.dump(JSON.parse(jsonString))
                    fs.writeFileSync(fileName, doc)
            }
        }

        function processDirectory(that, key) {
            const objects = {}
            const myKey = permsetDefinition.sortKeys[key]
            const hasObject = that.#json.PermissionSet[key][0][myKey].split('.').length == 2
            fileUtils.createDirectory(path.join(that.targetDir, key)) // create directory

            // populate objects with data per object
            if (hasObject) {
                that.#json.PermissionSet[key].forEach(element => {
                    let [object] = element[myKey].toString().split('.')
                    if (objects[object] === undefined) {
                        objects[object] = {
                            object: object
                        }
                    }
                    if (objects[object][key] === undefined) {
                        objects[object][key] = []
                    }
                    element[myKey] = element[myKey].replace(`${object}.`, '')
                    objects[object][key].push(element)
                })
            } else {
                that.#json.PermissionSet[key].forEach(element => {
                    let object = element[myKey]
                    if (objects[object] === undefined) {
                        objects[object] = {
                            object: object
                        }
                    }
                    if (objects[object][key] === undefined) {
                        objects[object][key] = {}
                    }
                    delete element[myKey]

                    Object.keys(element).forEach(elemKey => {
                        objects[object][key][elemKey] = element[elemKey]
                    })
                })
            }

            Object.keys(objects).forEach(object => {
                let fileName = path.join(that.targetDir, key, `${object}.${global.format}`)

                let jsonString = JSON.stringify(objects[object], null, '\t')
                switch (global.format) {
                    case 'json':
                        fs.writeFileSync(fileName, jsonString)
                        break
                    case 'yaml':
                        let doc = yaml.dump(JSON.parse(jsonString))
                        fs.writeFileSync(fileName, doc)
                }
            })
        }

        function singleFile(that, key) {
            let fileName = path.join(that.targetDir, `${key}.${global.format}`)
            let currentJSON = {}
            currentJSON[key] = that.#json.PermissionSet[key]

            let jsonString = JSON.stringify(currentJSON, null, '\t')
            switch (global.format) {
                case 'json':
                    fs.writeFileSync(fileName, jsonString)
                    break
                case 'yaml':
                    let doc = yaml.dump(JSON.parse(jsonString))
                    fs.writeFileSync(fileName, doc)
            }
        }
    }
}

function getTimeDiff(startTime, endTime = process.hrtime.bigint()) {
    const diff = BigInt(endTime) - BigInt(startTime)
    let executionTime = convertHrtime(diff)
    executionTime.seconds = Math.round(executionTime.seconds)
    executionTime.milliseconds = Math.round(executionTime.milliseconds / 1000)
    if (executionTime.milliseconds == 0 && executionTime.nanoseconds > 0) executionTime.milliseconds = 1
    return executionTime
}

function xml2json(currentValue) {
    if (Array.isArray(currentValue)) {
        if (currentValue.length == 1) {
            currentValue = currentValue[0].toString().trim()
        }
    }
    if (currentValue == 'true') currentValue = true
    if (currentValue == 'false') currentValue = false
    return currentValue
}
