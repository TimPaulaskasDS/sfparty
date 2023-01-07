import path from 'path'
import os from 'os'
import { readFileSync, writeFileSync, utimesSync } from 'fs'
import logUpdate from 'log-update'
import chalk from 'chalk'
import convertHrtime from 'convert-hrtime'
import cliSpinners from 'cli-spinners'
import * as fileUtils from '../fileUtils.js'
import { labelDefinition } from './definition.js'
import * as xml2js from 'xml2js'
import * as yaml from 'js-yaml'

const spinner = cliSpinners['dots']

export class CustomLabel {
    #xml = ''
    #types = []
    #spinnerMessage = ''
    #index = 0
    #startTime = 0
    #fileName = ''
    #errorMessage = ''
    #fileStats

    constructor(config) {
        this.sourceDir = config.sourceDir
        this.targetDir = config.targetDir
        this.metaDir = config.metaDir
        this.processList = config.processList
    }

    combine() {
        return new Promise((resolve, reject) => {
            const that = this
            if (!fileUtils.directoryExists(that.sourceDir)) reject(`Path does not exist: ${that.sourceDir}`)

            that.#xml = `<?xml version="1.0" encoding="UTF-8"?>${os.EOL}`
            that.#xml += `<CustomLabels xmlns="https://soap.sforce.com/2006/04/metadata">${os.EOL}`

            labelDefinition.directories.forEach(key => { that.#types.push(key) })
            that.#types.sort()

            setFileName(that)
            processLabel(that)

            saveXML(that)
            resolve(true)
        })

        function setFileName(that) {
            that.#fileName = path.join(that.targetDir, 'CustomLabels.labels-meta.xml')
        }

        function processLabel(that) {
            that.#startTime = process.hrtime.bigint()
            that.#spinnerMessage = `[%1] of ${global.processed.total} - Custom Label: [%4]${chalk.yellowBright('[%5]')}[%2][%3]`
            that.processList.sort()
            that.#types.forEach(key => {
                processDirectory(that, key)
            })
        }

        function processFile(that, key) {
            const fileName = path.join(that.sourceDir, that.metaDir, `${key}.${global.format}`)
            if (fileUtils.fileExists(fileName)) {
                if (labelDefinition.singleFiles.includes(key)) {
                    genericXML(that, key)
                } else {
                    that.#errorMessage += `\n${global.statusLevel.warn} Not processed: ${key}`
                }
            }
        }

        function processDirectory(that, key) {
            that.sequence = 0
            let startTime
            that.#errorMessage = ''
            that.processList.forEach(fileName => {
                startTime = process.hrtime.bigint()
                that.sequence++
                logUpdate(that.#spinnerMessage
                    .replace('[%1]', that.sequence.toString().padStart(global.processed.total.toString().length, ' '))
                    .replace('[%2]', `\n${chalk.magentaBright(nextFrame(that))} ${key}`)
                    .replace('[%3]', `${that.#errorMessage}`)
                    .replace('[%4]', `${global.statusLevel.working} `)
                    .replace('[%5]', `${fileName} `)
                )
                try {
                    genericXML(that, key, fileName)                   
                } catch (error) {
                    that.#errorMessage = error.message
                }
                let executionTime = getTimeDiff(BigInt(startTime))
                let durationMessage = `${executionTime.seconds}.${executionTime.milliseconds}s`
                let stateIcon = (that.#errorMessage == '') ? global.statusLevel.success : global.statusLevel.fail
                logUpdate(that.#spinnerMessage
                    .replace('[%1]', that.sequence.toString().padStart(global.processed.total.toString().length, ' '))
                    .replace('[%2]', `. Processed in ${durationMessage}.`)
                    .replace('[%3]', `${that.#errorMessage}`)
                    .replace('[%4]', `${stateIcon} `)
                    .replace('[%5', fileName)
                )
                logUpdate.done()
            })
            // TODO                that.#fileStats = fileUtils.fileInfo(fileName).stats

            // genericDirectoryXML(that, key)
            // that.#errorMessage += `\n${global.statusLevel.warn} Not processed: ${key}`
            return true
        }

        function getTimeDiff(startTime, endTime = process.hrtime.bigint()) {
            const diff = BigInt(endTime) - BigInt(startTime)
            let executionTime = convertHrtime(diff)
            executionTime.seconds = Math.round(executionTime.seconds)
            executionTime.milliseconds = Math.round(executionTime.milliseconds / 1000)
            if (executionTime.milliseconds == 0 && executionTime.nanoseconds > 0) executionTime.milliseconds = 1
            return executionTime
        }

        function saveXML(that) {
            fileUtils.createDirectory(that.targetDir)
            that.#xml += '</CustomLabels>\n'
            writeFileSync(that.#fileName, that.#xml)
            // utimesSync(that.#fileName, that.#fileStats.atime, that.#fileStats.mtime)

        }

        function nextFrame(that) {
            return spinner.frames[that.#index = ++that.#index % spinner.frames.length]
        }

        function genericXML(that, key, fileName) {
            fileName = path.join(that.sourceDir, fileName)
            const builder = new xml2js.Builder({ cdata: false, headless: true, rootName: key })
            if (fileUtils.fileExists(fileName)) {
                const data = readFileSync(fileName, { encoding: 'utf8', flag: 'r' })
                const result = (global.format == 'yaml') ? yaml.load(data) : JSON.parse(data)
                result[key.slice(0, -1)][labelDefinition.sortKeys[key]] = result[labelDefinition.sortKeys[key]]
                result[key.slice(0, -1)] = sortJSONKeys(sortJSON(result[key.slice(0, -1)], labelDefinition.sortKeys[key]))
                that.#xml += `\t<${key}>${os.EOL}`
                Object.keys(result[key.slice(0, -1)]).forEach(tag => {
                    let xml
                    try {
                        xml = builder.buildObject(result[key.slice(0, -1)][tag]).replace(`<${key}>`, '').replace(`</${key}>`, '')
                        that.#xml += `\t\t<${tag}>${xml}</${tag}>${os.EOL}`                           
                    } catch (error) {
                        global.logger.error(error)
                    }
                })
                that.#xml += `\t</${key}>${os.EOL}`
            }
        }
        // end of functions
        // end of combine
    }

    // end of class
}

function sortJSON(json, key) {
    if (Array.isArray(json)) {
        json.sort((a, b) => {
            if (a[key] < b[key]) return -1
            if (a[key] > b[key]) return 1
            return 0
        })
    }
    return json
}

function sortJSONKeys(json) {
    // sort json keys alphabetically
    if (Array.isArray(json)) {
        json.forEach(function (part, index) {
            this[index] = Object.keys(this[index])
                .sort((a, b) => {
                    if (a < b) return -1
                    if (a > b) return 1
                    return 0
                })
                .reduce((accumulator, key) => {
                    accumulator[key] = this[index][key]

                    return accumulator
                }, {})
        }, json)

    } else {
        json = Object.keys(json)
            .sort((a, b) => {
                if (a < b) return -1
                if (a > b) return 1
                return 0
            })
            .reduce((accumulator, key) => {
                accumulator[key] = json[key]

                return accumulator
            }, {})
    }
    return json
}