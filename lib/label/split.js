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
import { labelDefinition } from './definition.js'

const spinner = cliSpinners['dots']

export class CustomLabel {
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
        this.#fileName.shortName = fileUtils.fileInfo(value).filename.replace('.labels-meta.xml', '')
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

            // that.targetDir = path.join(that.targetDir, that.#fileName.shortName)
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
                delete result.CustomLabels['$']
                let jsonString = JSON.stringify(result, (name, value) => {
                    if (name == '' || !isNaN(name) || labelDefinition.directories.includes(name)) {
                        return value
                    } else {
                        return xml2json(value)
                    }
                })
                that.#json = JSON.parse(jsonString)

                Object.keys(that.#json.CustomLabels).forEach(key => {
                    const keyOrder = labelDefinition.keyOrder[key]
                    const sortKey = labelDefinition.sortKeys[key]

                    if (Array.isArray(that.#json.CustomLabels[key])) {
                        // sort json to order by sortKey
                        that.#json.CustomLabels[key].sort((a, b) => {
                            if (a[sortKey] < b[sortKey]) {
                                return -1;
                            }
                            if (a[sortKey] > b[sortKey]) {
                                return 1;
                            }
                            return 0;
                        })

                        // sort json keys in specified order
                        that.#json.CustomLabels[key].forEach(function (part, index) {
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
                        }, that.#json.CustomLabels[key])
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
            that.#spinnerMessage = `[%1] of ${global.processed.total} - Custom Labels: [%4]${chalk.yellowBright(that.#fileName.shortName)}[%2][%3]`

            fileUtils.deleteDirectory(that.targetDir, true) // recursive delete existing directory
            fileUtils.createDirectory(that.targetDir) // create directory

            Object.keys(that.#json.CustomLabels).forEach(key => {
                that.sequence = global.processed.current
                logUpdate(that.#spinnerMessage
                    .replace('[%1]', that.sequence.toString().padStart(global.processed.total.toString().length, ' '))
                    .replace('[%2]', `\n${chalk.magentaBright(nextFrame(that))} ${key}`)
                    .replace('[%3]', `${that.#errorMessage}`)
                    .replace('[%4]', `${global.icons.working} `)
                )
                if (labelDefinition.directories.includes(key)) {
                    processDirectory(that, key)
                } else {
                    that.#errorMessage += `\n${global.icons.warn} Not processed: ${key}`
                }
            })

            return true
        }

        function processDirectory(that, key) {
            const myKey = labelDefinition.sortKeys[key]

            // populate objects with data per object
            that.#json.CustomLabels[key].forEach(element => {
                let fileName = path.join(that.targetDir, `${element[myKey]}.${global.format}`)
                const labelJSON = {}
                labelJSON[myKey] = element[myKey]
                delete element[myKey]
                labelJSON[key.slice(0, -1)] = element  //use slice to remove the s

                let jsonString = JSON.stringify(labelJSON, null, '\t')
                switch (global.format) {
                    case 'json':
                        fs.writeFileSync(fileName, jsonString)
                        break
                    case 'yaml':
                        let doc = yaml.dump(JSON.parse(jsonString))
                        fs.writeFileSync(fileName, doc)
                        break
                }
            })
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
