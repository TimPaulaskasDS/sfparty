import path from 'path'
import logUpdate from 'log-update'
import chalk from 'chalk'
import convertHrtime from 'convert-hrtime'
import cliSpinners from 'cli-spinners'
import * as xml2js from 'xml2js'
import * as fileUtils from '../fileUtils.js'

const spinner = cliSpinners['dots']

export class Combine {
    #type = undefined
    #root = undefined
    #spinnerMessage = ''
    #startTime = 0
    #fileName = {
        fullName: undefined,
        shortName: undefined,
    }
    #errorMessage = ''
    #frameIndex = 0
    #types = []
    #fileStats = {
        atime: undefined,
        mtime: undefined
    }
    #json = {}

    constructor(config) {
        this.metadataDefinition = config.metadataDefinition
        this.sourceDir = config.sourceDir
        this.targetDir = config.targetDir
        this.metaDir = config.metaDir
        this.sequence = config.sequence
    }

    get metadataDefinition() {
        return this._metadataDefinition
    }

    set metadataDefinition(definition) {
        this._metadataDefinition = definition
        this.#type = definition.filetype
        this.#root = definition.root
    }

    get metaDir() {
        return this._metaDir
    }

    set metaDir(metaDir) {
        this._metaDir = metaDir
        this.#fileName.fullName = path.join(
            this.targetDir,
            metaDir.split(path.sep).pop() + `.${this.#type}-meta.xml`
        )
        this.#fileName.shortName = metaDir.split(path.sep).pop()
    }

    get sequence() {
        if (global.process.current > this._sequence) {
            return global.process.current
        } else {
            return this._sequence
        }
    }

    set sequence(sequence) {
        this._sequence = sequence
    }

    combine() {
        return new Promise((resolve, reject) => {
            const that = this
            if (!fileUtils.directoryExists(that.sourceDir)) reject(`Path does not exist: ${that.sourceDir}`)

            if (that.metadataDefinition.directories !== undefined) {
                that.#types = that.#types.concat(that.metadataDefinition.directories)
            }
            if (that.metadataDefinition.singleFiles !== undefined) {
                that.#types = that.#types.concat(that.metadataDefinition.singleFiles)
            }
            if (that.metadataDefinition.main !== undefined) {
                that.#types = that.#types.concat(that.metadataDefinition.main)
            }
            that.#types.sort((a, b) => {
                if (a == '$') return -1
                if (a < b) return -1
                if (a > b) return 1
                return 0
            })

            that.#types.forEach(key => {
                that.#json[key] = undefined
            })

            getXML(that)

            saveXML(that)
            resolve(true)
        })

        function getXML(that) {
            that.#startTime = process.hrtime.bigint()
            that.#spinnerMessage = `[%1] of ${global.processed.total} - ${that.#root}: [%4]${chalk.yellowBright('[%5]')}[%2][%3]`

            that.#types.forEach(key => {
                // display message
                logUpdate(that.#spinnerMessage
                    .replace('[%1]', that.sequence.toString().padStart(global.processed.total.toString().length, ' '))
                    .replace('[%2]', `\n${chalk.magentaBright(nextFrame(that))} ${key}`)
                    .replace('[%3]', `${that.#errorMessage}`)
                    .replace('[%4]', `${global.icons.working} `)
                    .replace('[%5]', `${that.#fileName.shortName} `)
                )


                if (that.metadataDefinition.main.includes(key)) {
                    // TODO process main
                    const fileObj = {
                        shortName: 'Main',
                        fullName: path.join(that.sourceDir, that.metaDir, `main.${global.format}`),
                    }
                    processFile(that, key, fileObj)
                } else if (that.metadataDefinition.singleFiles.includes(key)) {
                    // TODO process single file
                } else if (that.metadataDefinition.directories.includes(key)) {
                    processDirectory(that, key)
                } else {
                    global.logger.warn(`Unexpected metadata type: ${chalk.redBright(key)}`)
                }
            })
        }

        function processDirectory(that, key) {
            // Process the directory sourceDir/metaDir/key
            const currentDir = path.join(that.sourceDir, that.metaDir, key)
            // ensure the directory exists
            if (fileUtils.directoryExists(currentDir)) {
                const fileList = fileUtils.getFiles(currentDir, global.format)
                fileList.sort() // process files alphabetically
                that.#json[key] = []

                // iterate over fileList
                fileList.forEach((file, index) => {
                    logUpdate(that.#spinnerMessage
                        .replace('[%1]', that.sequence.toString().padStart(global.processed.total.toString().length, ' '))
                        .replace('[%2]', `\n${chalk.magentaBright(nextFrame(that))} ${key} - ${index + 1} of ${fileList.length} - ${chalk.magentaBright(file)}`)
                        .replace('[%3]', `${that.#errorMessage}`)
                        .replace('[%4]', `${global.icons.working} `)
                        .replace('[%5]', `${that.#fileName.shortName} `)
                    )

                    const fileObj = {
                        shortName: file,
                        fullName: path.join(that.sourceDir, that.metaDir, key, file),
                    }
                    processFile(that, key, fileObj)
                })

            }
            return true
        }

        function processFile(that, key, fileObj = undefined) {
            if (
                fileObj === undefined ||
                typeof fileObj != 'object' ||
                fileObj.shortName === undefined ||
                fileObj.fullName === undefined
            ) {
                that.#errorMessage += `\n${global.icons.warn} Invalid file information passed ${chalk.redBright(fileObj)}`
                return false
            }

            if (fileUtils.fileExists(fileObj.fullName)) {
                let result = fileUtils.readPartFile(fileObj.fullName)
                result = sortAndArrange(that, result, key)
                if (Array.isArray(that.#json[key])) {
                    that.#json[key].push(result[key])
                } else {
                    that.#json[key] = result[key][key][key]
                }
            }

            updateFileStats(that, fileUtils.fileInfo(fileObj.fullName).stats)
            // genericXML(that, key, fileObj.fullName)
        }

        function updateFileStats(that, stats) {
            if (that.#fileStats.atime === undefined || stats.atime > that.#fileStats.atime) {
                that.#fileStats.atime = stats.atime
            }

            if (that.#fileStats.mtime === undefined || stats.mtime > that.#fileStats.mtime) {
                that.#fileStats.mtime = stats.mtime
            }
        }

        function saveXML(that) {
            const builder = new xml2js.Builder(
                {
                    cdata: false,
                    rootName: that.#root,
                    xmldec: { 'version': '1.0', 'encoding': 'UTF-8' }
                }
            )
            fileUtils.createDirectory(that.targetDir)

            Object.keys(that.#json).forEach(key => {
                if (that.#json[key] === undefined) delete that.#json[key]
            })
            const xml = builder.buildObject(that.#json)

            fileUtils.writeFile(
                that.#fileName.fullName,
                xml,
                that.#fileStats.atime,
                that.#fileStats.mtime
            )

            // display the finish message
            finishMessage(that)
        }

        function finishMessage(that) {
            let executionTime = getTimeDiff(BigInt(that.#startTime))
            let durationMessage = `${executionTime.seconds}.${executionTime.milliseconds}s`
            let stateIcon = (that.#errorMessage == '') ? global.icons.success : global.icons.fail

            logUpdate(that.#spinnerMessage
                .replace('[%1]', that.sequence.toString().padStart(global.processed.total.toString().length, ' '))
                .replace('[%2]', `. Processed in ${durationMessage}.`)
                .replace('[%3]', `${that.#errorMessage}`)
                .replace('[%4]', `${stateIcon} `)
                .replace('[%5]', that.#fileName.shortName)
            )
            logUpdate.done()
        }

        function nextFrame(that) {
            return spinner.frames[that.#frameIndex = ++that.#frameIndex % spinner.frames.length]
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

function sortAndArrange(that, json, key = undefined, topLevel = true) {
    // sort and order keys
    const sortKey = that.metadataDefinition.sortKeys[key]
    let jsonResult = {}
    json = arrangeKeys(that, json, key)
    json = sortJSON(json, sortKey)

    Object.keys(json).forEach((subKey, index, thisObj) => {
        if (typeof json[subKey] == 'object') {
            if (!Array.isArray(json[subKey])) {
                // call recursively on object
                json[subKey] = sortAndArrange(that, json[subKey], subKey)
            } else {
                // iterate array for objects
                json[subKey].forEach((arrItem, index) => {
                    if (typeof arrItem == 'object') {
                        json[subKey][index] = sortAndArrange(that, json[subKey][index], subKey, false)
                    }
                })

            }
        }
    })

    // we need to include the key into the json for the top-level only
    if (topLevel) {
        jsonResult[key] = json
    } else {
        jsonResult = json
    }

    return jsonResult
}

function arrangeKeys(that, json, key = undefined) {
    json = Object.keys(json)
        .sort((a, b) => {
            if (that.metadataDefinition.xmlOrder !== undefined) {
                if (that.metadataDefinition.xmlOrder[key] !== undefined) {
                    let aIndex = that.metadataDefinition.xmlOrder[key].indexOf(a)
                    let bIndex = that.metadataDefinition.xmlOrder[key].indexOf(b)
                    if (aIndex == -1) aIndex = 99
                    if (bIndex == -1) bIndex = 99

                    if (aIndex < bIndex && aIndex != 99) return -1
                    if (aIndex > bIndex && bIndex != 99) return 1
                }
            }
            if (a < b) return -1
            if (a > b) return 1
            return 0
        })
        .reduce((accumulator, key) => {
            accumulator[key] = json[key]

            return accumulator
        }, {})
    return json
}

function getTimeDiff(startTime, endTime = process.hrtime.bigint()) {
    const diff = BigInt(endTime) - BigInt(startTime)
    let executionTime = convertHrtime(diff)
    executionTime.seconds = Math.round(executionTime.seconds)
    executionTime.milliseconds = Math.round(executionTime.milliseconds / 1000)
    if (executionTime.milliseconds == 0 && executionTime.nanoseconds > 0) executionTime.milliseconds = 1
    return executionTime
}
