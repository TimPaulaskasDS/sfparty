'use strict'

import path from 'path'
import fs from 'fs'
import { Parser } from 'xml2js'
import logUpdate from 'log-update'
import clc from 'cli-color'
import convertHrtime from 'convert-hrtime'
import cliSpinners from 'cli-spinners'
import * as fileUtils from '../lib/fileUtils.js'

const spinner = cliSpinners['dots']
const processed = {
	total: 0,
	errors: 0,
	current: 0,
	type: undefined,
}

export class Split {
	#type = undefined
	#root = undefined
	#xmlns = undefined
	#fileName = {
		fullName: undefined,
		shortName: undefined,
	}
	#json = undefined
	#errorMessage = ''
	#index = 0
	#startTime = 0
	#spinnerMessage = ''

	constructor(config) {
		this.metadataDefinition = config.metadataDefinition
		this.sourceDir = config.sourceDir
		this.targetDir = config.targetDir
		this.metaFilePath = config.metaFilePath
		this.sequence = config.sequence
		this.total = config.total
	}

	get metadataDefinition() {
		return this._metadataDefinition
	}

	set metadataDefinition(definition) {
		this._metadataDefinition = definition
		this.#type = definition.filetype
		this.#root = definition.root
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
		let fileName = fileUtils.fileInfo(value).filename

		// Use actual file name if found so it matches case sensitivity
		const foundFile = fileUtils.getFiles(path.dirname(value), fileName)
		if (foundFile.length > 0) fileName = path.basename(foundFile[0])

		this.#fileName.shortName = fileName.replace(
			`.${this.#type}-meta.xml`,
			'',
		)
		this.#fileName.fullName = fileName
	}

	split() {
		const that = this
		return new Promise((resolve, reject) => {
			if (
				!that.#fileName ||
				!that.sourceDir ||
				!that.targetDir ||
				!that.metaFilePath
			) {
				global.logger.error('Invalid information passed to split')
				resolve(false)
			} else if (
				!fileUtils.fileExists({ filePath: that.metaFilePath, fs })
			) {
				global.logger.error(`file not found: ${that.metaFilePath}`)
				resolve(false)
			} else {
				that.targetDir = path.join(
					that.targetDir,
					that.#fileName.shortName,
				)
				const parser = new Parser()
				const getJSON = new Promise((resolve, reject) => {
					fs.readFile(that.metaFilePath, function (err, data) {
						parser.parseString(data, function (err, result) {
							if (result) {
								resolve({
									data: result,
									startTime: process.hrtime.bigint(),
								})
							} else {
								global.logger.error(
									`error converting xml to json: ${that.metaFilePath}`,
								)
								reject(
									`error converting xml to json: ${that.metaFilePath}`,
								)
							}
						})
					})
				})
				getJSON.catch((error) => {
					throw error
				})
				getJSON.then((result) => {
					that.#startTime = result.startTime
					result = result.data
					try {
						result[that.#root]['$'].xmlns = result[that.#root][
							'$'
						].xmlns.replace('http:', 'https:')
					} catch (error) {
						global.logger.error(
							`${that.#fileName.fullName} has an invalid XML root`,
						)
						resolve(false)
						return
					}

					// modify the json to remove unwanted arrays
					that.#json = transformJSON(that, result, that.#root)
					const sandboxLoginIpRange = fileUtils.readFile(
						path.join(that.targetDir, 'loginIpRanges-sandbox.yaml'),
					)

					fileUtils.deleteDirectory(that.targetDir, true) // recursive delete existing directory
					fileUtils.createDirectory(that.targetDir) // create directory

					if (sandboxLoginIpRange) {
						fileUtils.saveFile(
							sandboxLoginIpRange,
							path.join(
								that.targetDir,
								'loginIpRanges-sandbox.yaml',
							),
							'yaml',
						)
					}

					try {
						processJSON(
							that,
							that.#json[that.#root],
							that.targetDir,
						)
						completeFile(that)
					} catch (error) {
						console.log(that.#fileName.shortName)
						global.logger.error(error)
						throw error
					}

					resolve(true)
				})
			}
		})

		function processJSON(that, json, baseDir) {
			that.#spinnerMessage = `[%1] of ${that.total} - ${
				that.#root
			}: [%4]${clc.yellowBright(that.#fileName.shortName)}[%2][%3]`

			let targetDir = baseDir
			if (processed.type != that.#root) {
				processed.current = 0
				processed.type = that.#root
			}
			processed.current++
			Object.keys(json).forEach((key) => {
				that.sequence = processed.current
				logUpdate(
					that.#spinnerMessage
						.replace(
							'[%1]',
							that.sequence
								.toString()
								.padStart(that.total.toString().length, ' '),
						)
						.replace(
							'[%2]',
							`\n${clc.magentaBright(nextFrame(that))} ${key}`,
						)
						.replace('[%3]', `${that.#errorMessage}`)
						.replace('[%4]', `${global.icons.working} `),
				)

				if (
					that.metadataDefinition.directories !== undefined &&
					that.metadataDefinition.directories.includes(key)
				) {
					targetDir = path.join(baseDir, key)
					fileUtils.createDirectory(targetDir) // create directory
					if (Array.isArray(json[key])) {
						processDirectory(that, json[key], key, targetDir)
					}
				} else if (
					that.metadataDefinition.singleFiles !== undefined &&
					that.metadataDefinition.singleFiles.includes(key)
				) {
					processFile(that, json[key], key, baseDir)
				} else if (
					that.metadataDefinition.main !== undefined &&
					that.metadataDefinition.main.includes(key)
				) {
					// Main will get processed in it's own call
				} else {
					logUpdate(key, 'unknown')
					logUpdate.done()
				}
			})

			if (that.metadataDefinition.main !== undefined) {
				Main(that)
			}
		}

		function Main(that) {
			const fileName = path.join(that.targetDir, `main.${global.format}`)
			const mainInfo = {
				main: {},
			}
			mainInfo.main.name = that.#fileName.shortName
			that.metadataDefinition.main.forEach((key) => {
				that.sequence = processed.current
				logUpdate(
					that.#spinnerMessage
						.replace(
							'[%1]',
							that.sequence
								.toString()
								.padStart(that.total.toString().length, ' '),
						)
						.replace(
							'[%2]',
							`\n${clc.magentaBright(nextFrame(that))} ${key}`,
						)
						.replace('[%3]', `${that.#errorMessage}`)
						.replace('[%4]', `${global.icons.working} `),
				)

				if (that.#json[that.#root][key] !== undefined) {
					mainInfo.main[key] = that.#json[that.#root][key]
				}
			})

			fileUtils.saveFile(mainInfo, fileName, global.format)
		}

		function nextFrame(that) {
			return spinner.frames[
				(that.#index = ++that.#index % spinner.frames.length)
			]
		}

		function completeFile(that) {
			const executionTime = getTimeDiff(BigInt(that.#startTime))
			const durationMessage = `${executionTime.seconds}.${executionTime.milliseconds}s`
			const stateIcon =
				that.#errorMessage == ''
					? global.icons.success
					: global.icons.fail
			logUpdate(
				that.#spinnerMessage
					.replace(
						'[%1]',
						that.sequence
							.toString()
							.padStart(that.total.toString().length, ' '),
					)
					.replace('[%2]', `. Processed in ${durationMessage}.`)
					.replace('[%3]', `${that.#errorMessage}`)
					.replace('[%4]', `${stateIcon} `),
			)
			logUpdate.done()
		}
	}
}

function processDirectory(that, json, key, baseDir) {
	if (
		that.metadataDefinition.splitObjects !== undefined &&
		that.metadataDefinition.splitObjects.includes(key)
	) {
		const sortKey = that.metadataDefinition.sortKeys[key]
		const objects = {}

		if (sortKey === undefined) {
			throw new Error(`No sort key specified for: ${key}`)
		}
		json.forEach((arrItem) => {
			const object = arrItem[sortKey].split('.')[0]
			arrItem[sortKey] = arrItem[sortKey].split('.').pop()
			if (objects[object] === undefined) {
				objects[object] = {
					object: object,
				}
				objects[object][key] = []
			}
			delete arrItem['object']
			objects[object][key].push(arrItem)
		})

		Object.keys(objects).forEach((object) => {
			processFile(that, objects[object], key, baseDir, object)
		})
	} else {
		json.forEach((arrItem) => {
			processFile(that, arrItem, key, baseDir)
		})
	}
}

function processFile(that, json, key, baseDir, fileNameOverride) {
	let newJSON
	let fileName
	if (fileNameOverride !== undefined) {
		fileName = path.join(baseDir, `${fileNameOverride}.${global.format}`)
		newJSON = json
	} else {
		const sortKey = that.metadataDefinition.sortKeys[key]
		fileName = path.join(
			baseDir,
			`${json[sortKey] !== undefined ? json[sortKey] : key}.${
				global.format
			}`,
		)
		newJSON = {}
		newJSON[key] = json
	}
	fileUtils.saveFile(newJSON, fileName, global.format)
}

function transformJSON(that, result, rootTag) {
	const jsonString = JSON.stringify(result, (name, value) => {
		if (Object.keys(that.metadataDefinition.sortKeys).includes(name)) {
			return value
		} else {
			return xml2json(value)
		}
	})
	result = JSON.parse(jsonString)

	Object.keys(result[rootTag]).forEach((key) => {
		try {
			result[rootTag][key] = keySort(that, key, result[rootTag][key])
		} catch (error) {
			throw error
		}
	})

	return result
}

function keySort(that, key, json) {
	const keyOrder = that.metadataDefinition.keyOrder[key]
	const sortKey = that.metadataDefinition.sortKeys[key]

	if (Array.isArray(json) && sortKey !== undefined) {
		// sort json using sortKey
		json.sort((a, b) => {
			if (a[sortKey] < b[sortKey]) {
				return -1
			}
			if (a[sortKey] > b[sortKey]) {
				return 1
			}
			return 0
		})

		// arrange json keys in specified order using keyOrder
		json.forEach(function (part, index) {
			try {
				this[index] = Object.keys(this[index])
					.sort((a, b) => {
						if (keyOrder.indexOf(a) == -1) return 1
						if (keyOrder.indexOf(a) < keyOrder.indexOf(b)) return -1
						if (keyOrder.indexOf(a) > keyOrder.indexOf(b)) return 1
						return 0
					})
					.reduce((accumulator, key) => {
						accumulator[key] = this[index][key]
						return accumulator
					}, {})
			} catch (error) {
				throw error
			}
		}, json)

		// recursive objects
		json.forEach((arrayItem) => {
			Object.keys(arrayItem).forEach((jsonKey) => {
				if (typeof arrayItem[jsonKey] == 'object') {
					arrayItem[jsonKey] = keySort(
						that,
						jsonKey,
						arrayItem[jsonKey],
					)
				}
			})
		})
	}

	return json
}

function xml2json(currentValue) {
	if (Array.isArray(currentValue)) {
		if (currentValue.length == 1) {
			currentValue = currentValue[0].toString().trim()
		}
	}

	try {
		if (currentValue == 'true') currentValue = true
		if (currentValue == 'false') currentValue = false
	} catch (error) {
		if (error.message !== 'Cannot convert object to primitive value') {
			console.error(error)
		}
	}

	return currentValue
}

function getTimeDiff(startTime, endTime = process.hrtime.bigint()) {
	const diff = BigInt(endTime) - BigInt(startTime)
	const executionTime = convertHrtime(diff)
	executionTime.seconds = Math.round(executionTime.seconds)
	executionTime.milliseconds = Math.round(executionTime.milliseconds / 1000)
	if (executionTime.milliseconds == 0 && executionTime.nanoseconds > 0)
		executionTime.milliseconds = 1
	return executionTime
}
