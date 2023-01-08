import path from 'path'
import os from 'os'
import { readFileSync, writeFileSync, utimesSync } from 'fs'
import logUpdate from 'log-update'
import chalk from 'chalk'
import convertHrtime from 'convert-hrtime'
import cliSpinners from 'cli-spinners'
import * as fileUtils from '../fileUtils.js'
import { profileDefinition } from '../../meta/Profiles.js'
import * as xml2js from 'xml2js'
import * as yaml from 'js-yaml'

const spinner = cliSpinners['dots']

export class Profile {
    #xml = ''
    #types = []
    #spinnerMessage = ''
    #index = 0
    #startTime = 0
    #fileName = ''
    #errorMessage = ''
    #fileStats
    #root = 'Profile'

    constructor(config) {
        this.sourceDir = config.sourceDir
        this.targetDir = config.targetDir
        this.metaDir = config.metaDir
        this.sequence = config.sequence
    }

    combine() {
        return new Promise((resolve, reject) => {
            const that = this
            if (!fileUtils.directoryExists(path.join(that.sourceDir, that.metaDir))) reject(that.metaDir)

            that.metaDir = fileUtils.getDirectories(that.sourceDir).find(element => element.toLowerCase() == that.metaDir.toLowerCase())

            that.#xml = `<?xml version="1.0" encoding="UTF-8"?>${os.EOL}`
            that.#xml += `<Profile xmlns="https://soap.sforce.com/2006/04/metadata">${os.EOL}`

            profileDefinition.main.forEach(key => { that.#types.push(key) })
            profileDefinition.singleFiles.forEach(key => { that.#types.push(key) })
            profileDefinition.directories.forEach(key => { that.#types.push(key) })
            that.#types.sort()

            setFileName(that)
            processProfile(that)

            saveXML(that)
            resolve(that.metaDir)
        })

        function setFileName(that) {
            const fileName = path.join(that.sourceDir, that.metaDir, `main.${global.format}`)
            if (fileUtils.fileExists(fileName)) {
                const data = readFileSync(fileName, { encoding: 'utf8', flag: 'r' })
                const result = (global.format == 'yaml') ? yaml.load(data) : JSON.parse(data)
                that.#fileStats = fileUtils.fileInfo(fileName).stats
                that.#fileName = path.join(that.targetDir, result.name + '.profile-meta.xml')
            }
        }

        function processProfile(that) {
            that.#startTime = process.hrtime.bigint()
            that.#spinnerMessage = `[%1] of ${global.processed.total} - Profile: [%4]${chalk.yellowBright(that.metaDir)}[%2][%3]`
            logUpdate(that.#spinnerMessage
                .replace('[%1]', that.sequence.toString().padStart(global.processed.total.toString().length, ' '))
                .replace('[%2]', '')
                .replace('[%3]', '')
                .replace('[%4]', '')
            )

            that.#types.forEach(key => {
                let myLocation
                if (profileDefinition.main.includes(key)) {
                    myLocation = 'main'
                } else if (profileDefinition.directories.includes(key)) {
                    myLocation = 'directory'
                } else if (profileDefinition.singleFiles.includes(key)) {
                    myLocation = 'file'
                }
                logUpdate(that.#spinnerMessage
                    .replace('[%1]', that.sequence.toString().padStart(global.processed.total.toString().length, ' '))
                    .replace('[%2]', `\n${chalk.magentaBright(nextFrame(that))} ${key}`)
                    .replace('[%3]', `${that.#errorMessage}`)
                    .replace('[%4]', `${global.icons.working} `)
                )

                switch (myLocation) {
                    case 'main':
                        processMain(that, key)
                        break
                    case 'file':
                        processFile(that, key)
                        break
                    case 'directory':
                        processDirectory(that, key)
                        break
                }
            })
        }

        function processMain(that, key) {
            const fileName = path.join(that.sourceDir, that.metaDir, `main.${global.format}`)
            if (fileUtils.fileExists(fileName)) {
                const data = readFileSync(fileName, { encoding: 'utf8', flag: 'r' })
                const result = (global.format == 'yaml') ? yaml.load(data) : JSON.parse(data)
                if (result[key] !== undefined) that.#xml += `\t<${key}>${result[key]}</${key}>${os.EOL}`
            }
        }

        function processFile(that, key) {
            const fileName = path.join(that.sourceDir, that.metaDir, `${key}.${global.format}`)
            if (fileUtils.fileExists(fileName)) {
                switch (key) {
                    case 'categoryGroupVisibilities':
                        categoryGroupVisibilities(that, key)
                        break
                    // TODO case 'loginHours':
                    default:
                        if (profileDefinition.singleFiles.includes(key)) {
                            genericXML(that, key)
                            break
                        } else {
                            that.#errorMessage += `\n${global.icons.warn} Not processed: ${key}`
                        }
                }
            }
        }

        function processDirectory(that, key) {
            switch (key) {
                case 'objectPermissions':
                    objectPermissions(that, key)
                    break
                default:
                    if (profileDefinition.directories.includes(key)) {
                        genericDirectoryXML(that, key)
                        break
                    } else {
                        that.#errorMessage += `\n${global.icons.warn} Not processed: ${key}`
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

        function saveXML(that) {
            fileUtils.createDirectory(that.targetDir)
            that.#xml += '</Profile>\n'
            writeFileSync(that.#fileName, that.#xml)
            utimesSync(that.#fileName, that.#fileStats.atime, that.#fileStats.mtime)

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

        function nextFrame(that) {
            return spinner.frames[that.#index = ++that.#index % spinner.frames.length]
        }

        function genericXML(that, key) {
            const fileName = path.join(that.sourceDir, that.metaDir, `${key}.${global.format}`)
            const builder = new xml2js.Builder({ cdata: false, headless: true, rootName: that.#root })

            if (fileUtils.fileExists(fileName)) {
                const data = readFileSync(fileName, { encoding: 'utf8', flag: 'r' })
                const result = (global.format == 'yaml') ? yaml.load(data) : JSON.parse(data)
                result[key] = sortJSONKeys(sortJSON(result[key], profileDefinition.sortKeys[key]))
                that.#xml += builder.buildObject(result)
                    .replace(`<${that.#root}>${os.EOL}`, '')
                    .replace(`</${that.#root}>`, '')
            }
        }

        function genericDirectoryXML(that, key) {
            let dirPath = path.join(that.sourceDir, that.metaDir, key)
            if (!fileUtils.directoryExists(dirPath)) return

            let fileList = fileUtils.getFiles(dirPath, `.${global.format}`).sort()
            fileList.forEach(fileName => {
                const builder = new xml2js.Builder({ cdata: false, headless: true, rootName: that.#root })
                const data = readFileSync(path.join(dirPath, fileName), { encoding: 'utf8', flag: 'r' })
                const result = (global.format == 'yaml') ? yaml.load(data) : JSON.parse(data)
                const object = result.object
                result[key] = sortJSONKeys(sortJSON(result[key], profileDefinition.sortKeys[key]))
                result[key].forEach(element => {
                    Object.keys(element).forEach(tag => {
                        if (tag == profileDefinition.sortKeys[key] && object) {
                            [element][tag] = `${object}.${element[tag]}`
                        }
                    })
                    that.#xml += builder.buildObject(result)
                        .replace(`<${that.#root}>${os.EOL}`, '')
                        .replace(`</${that.#root}>`, '')
                })

            })
        }

        function categoryGroupVisibilities(that, key) {
            const fileName = path.join(that.sourceDir, that.metaDir, `${key}.${global.format}`)
            if (fileUtils.fileExists(fileName)) {
                const data = readFileSync(fileName, { encoding: 'utf8', flag: 'r' })
                const result = (global.format == 'yaml') ? yaml.load(data) : JSON.parse(data)
                result[key] = sortJSONKeys(sortJSON(result[key], profileDefinition.sortKeys[key]))
                result[key].forEach(element => {
                    that.#xml += `\t<${key}>${os.EOL}`
                    Object.keys(element).forEach(tag => {
                        // dataCategories is an array of values which must be handled separately
                        if (tag == 'dataCategories') {
                            sortJSON(element.dataCategories).forEach(category => {
                                that.#xml += `\t\t<${tag}>${category}</${tag}>${os.EOL}`
                            })
                        } else {
                            that.#xml += `\t\t<${tag}>${element[tag]}</${tag}>${os.EOL}`
                        }
                    })
                    that.#xml += `\t</${key}>${os.EOL}`
                })
            }
        }

        function objectPermissions(that, key) {
            let dirPath = path.join(that.sourceDir, that.metaDir, key)
            if (!fileUtils.directoryExists(dirPath)) return

            let fileList = fileUtils.getFiles(dirPath, `.${global.format}`).sort((a, b) => a.localeCompare(b))
            fileList.forEach(fileName => {
                const data = readFileSync(path.join(dirPath, fileName), { encoding: 'utf8', flag: 'r' })
                const result = (global.format == 'yaml') ? yaml.load(data) : JSON.parse(data)
                result[key]['object'] = result.object
                result[key] = sortJSONKeys(result[key])
                that.#xml += `\t<${key}>${os.EOL}`
                Object.keys(result[key]).forEach(element => {
                    that.#xml += `\t\t<${element}>${result[key][element]}</${element}>${os.EOL}`
                })
                that.#xml += `\t</${key}>${os.EOL}`
            })
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