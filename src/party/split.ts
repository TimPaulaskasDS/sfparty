import clc from 'cli-color'
import cliSpinners from 'cli-spinners'
import convertHrtime from 'convert-hrtime'
import fs from 'fs'
import logUpdate from 'log-update'
import path from 'path'
import { Parser } from 'xml2js'
import * as fileUtils from '../lib/fileUtils.js'
import type { MetadataDefinition } from '../types/metadata.js'

const spinner = cliSpinners['dots']
const processed = {
	total: 0,
	errors: 0,
	current: 0,
	type: undefined as string | undefined,
}

interface FileNameInfo {
	fullName: string | undefined
	shortName: string | undefined
}

interface SplitConfig {
	metadataDefinition: MetadataDefinition
	sourceDir: string
	targetDir: string
	metaFilePath: string
	sequence: number
	total: number
}

interface GlobalContext {
	logger?: {
		error: (message: string) => void
	}
	format?: string
	icons?: {
		working?: string
		success?: string
		fail?: string
		delete?: string
	}
}

declare const global: GlobalContext & typeof globalThis

export class Split {
	#type: string | undefined = undefined
	#root: string | undefined = undefined
	#fileName: FileNameInfo = {
		fullName: undefined,
		shortName: undefined,
	}
	#json: Record<string, unknown> | undefined = undefined
	#errorMessage = ''
	#index = 0
	#startTime: bigint = BigInt(0)
	#spinnerMessage = ''

	private _metadataDefinition!: MetadataDefinition
	sourceDir!: string
	targetDir!: string
	private _metaFilePath!: string
	private _sequence!: number
	total!: number

	constructor(config: SplitConfig) {
		this.metadataDefinition = config.metadataDefinition
		this.sourceDir = config.sourceDir
		this.targetDir = config.targetDir
		this.metaFilePath = config.metaFilePath
		this.sequence = config.sequence
		this.total = config.total
	}

	get metadataDefinition(): MetadataDefinition {
		return this._metadataDefinition
	}

	set metadataDefinition(definition: MetadataDefinition) {
		this._metadataDefinition = definition
		this.#type = definition.filetype
		this.#root = definition.root
	}

	get metaFilePath(): string {
		return this._metaFilePath
	}

	set metaFilePath(value: string) {
		const trimmedValue = value.trim()
		if (trimmedValue === '') {
			throw new Error('The file path cannot be empty')
		}
		this._metaFilePath = trimmedValue
		let fileName = fileUtils.fileInfo(trimmedValue).filename

		// Use actual file name if found so it matches case sensitivity
		const foundFile = fileUtils.getFiles(
			path.dirname(trimmedValue),
			fileName,
		)
		if (foundFile.length > 0) fileName = path.basename(foundFile[0])

		this.#fileName.shortName = fileName.replace(
			`.${this.#type}-meta.xml`,
			'',
		)
		this.#fileName.fullName = fileName
	}

	get sequence(): number {
		return this._sequence
	}

	set sequence(value: number) {
		this._sequence = value
	}

	split(): Promise<boolean> {
		const that = this
		return new Promise((resolve, reject) => {
			if (
				!that.#fileName ||
				!that.sourceDir ||
				!that.targetDir ||
				!that.metaFilePath
			) {
				global.logger?.error('Invalid information passed to split')
				resolve(false)
			} else if (
				!fileUtils.fileExists({ filePath: that.metaFilePath, fs })
			) {
				global.logger?.error(`file not found: ${that.metaFilePath}`)
				resolve(false)
			} else {
				that.targetDir = path.join(
					that.targetDir,
					that.#fileName.shortName || '',
				)
				// Security: Configure parser with safe options
				const parser = new Parser({
					explicitRoot: true,
					explicitArray: false,
					strict: true,
					async: false,
					normalize: true,
					trim: true,
				})
				const getJSON = new Promise<{
					data: Record<string, unknown>
					startTime: bigint
				}>((resolve, reject) => {
					fs.readFile(that.metaFilePath, function (_err, data) {
						parser.parseString(data, function (_err, result) {
							if (result) {
								resolve({
									data: result,
									startTime: process.hrtime.bigint(),
								})
							} else {
								global.logger?.error(
									`error converting xml to json: ${that.metaFilePath}`,
								)
								reject(
									new Error(
										`error converting xml to json: ${that.metaFilePath}`,
									),
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
					const jsonData = result.data
					try {
						if (
							that.#root &&
							jsonData[that.#root] &&
							typeof jsonData[that.#root] === 'object' &&
							jsonData[that.#root] !== null
						) {
							const rootData = jsonData[that.#root] as Record<
								string,
								Record<string, string>
							>
							if (
								'$' in rootData &&
								typeof rootData.$ === 'object' &&
								rootData.$ !== null &&
								'xmlns' in rootData.$ &&
								typeof rootData.$.xmlns === 'string'
							) {
								rootData.$.xmlns = rootData.$.xmlns.replace(
									'http:',
									'https:',
								)
							}
						}
					} catch (error) {
						global.logger?.error(
							`${that.#fileName.fullName} has an invalid XML root`,
						)
						resolve(false)
						return
					}

					// modify the json to remove unwanted arrays
					try {
						that.#json = transformJSON(that, jsonData, that.#root!)
					} catch (error) {
						global.logger?.error(
							`${that.#fileName.fullName} has an invalid XML root`,
						)
						reject(error)
						return
					}
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
							that.#json[that.#root!] as Record<string, unknown>,
							that.targetDir,
						)
						completeFile(that)
						resolve(true)
					} catch (error) {
						console.log(that.#fileName.shortName)
						global.logger?.error(error as string)
						reject(error)
					}
				})
			}
		})

		function processJSON(
			that: Split,
			json: Record<string, unknown>,
			baseDir: string,
		): void {
			that.#spinnerMessage = `[%1] of ${that.total} - ${
				that.#root
			}: [%4]${clc.yellowBright(that.#fileName.shortName || '')}[%2][%3]`

			let targetDir = baseDir
			if (processed.type !== that.#root) {
				processed.current = 0
				processed.type = that.#root
			}
			processed.current++
			for (const key of Object.keys(json)) {
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
						.replace('[%4]', `${global.icons?.working || ''} `),
				)

				if (
					that.metadataDefinition.directories !== undefined &&
					that.metadataDefinition.directories.includes(key)
				) {
					targetDir = path.join(baseDir, key)
					fileUtils.createDirectory(targetDir) // create directory
					if (Array.isArray(json[key])) {
						processDirectory(that, json[key], key, targetDir)
					} else if (json[key] && typeof json[key] === 'object') {
						// Handle single element case - convert to array
						processDirectory(that, [json[key]], key, targetDir)
					}
				} else if (
					that.metadataDefinition.singleFiles !== undefined &&
					that.metadataDefinition.singleFiles.includes(key)
				) {
					processFile(
						that,
						json[key] as Record<string, unknown>,
						key,
						baseDir,
					)
				} else if (
					that.metadataDefinition.main !== undefined &&
					that.metadataDefinition.main.includes(key)
				) {
					// Main will get processed in it's own call
				} else {
					logUpdate(key, 'unknown')
					logUpdate.done()
				}
			}

			if (that.metadataDefinition.main !== undefined) {
				Main(that)
			}
		}

		function Main(that: Split): void {
			const fileName = path.join(that.targetDir, `main.${global.format}`)
			const mainInfo: { main: Record<string, unknown> } = {
				main: {},
			}
			mainInfo.main.name = that.#fileName.shortName
			that.metadataDefinition.main?.forEach((key) => {
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
						.replace('[%4]', `${global.icons?.working || ''} `),
				)

				const rootKey = that.#root
				if (rootKey && that.#json && rootKey in that.#json) {
					const rootJson = that.#json[rootKey]
					if (
						rootJson &&
						typeof rootJson === 'object' &&
						rootJson !== null &&
						key in rootJson
					) {
						mainInfo.main[key] = (
							rootJson as Record<string, unknown>
						)[key] as unknown
					}
				}
			})

			fileUtils.saveFile(mainInfo, fileName, global.format)
		}

		function nextFrame(that: Split): string {
			return spinner.frames[
				(that.#index = ++that.#index % spinner.frames.length)
			]
		}

		function completeFile(that: Split): void {
			const executionTime = getTimeDiff(that.#startTime)
			const durationMessage = `${executionTime.seconds}.${executionTime.milliseconds}s`
			const stateIcon =
				that.#errorMessage === ''
					? global.icons?.success
					: global.icons?.fail
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
					.replace('[%4]', `${stateIcon || ''} `),
			)
			logUpdate.done()
		}
	}
}

function processDirectory(
	that: Split,
	json: unknown[],
	key: string,
	baseDir: string,
): void {
	if (
		that.metadataDefinition.splitObjects !== undefined &&
		that.metadataDefinition.splitObjects.includes(key)
	) {
		const sortKey = that.metadataDefinition.sortKeys[key]
		const objects: Record<string, unknown> = {}

		if (sortKey === undefined) {
			throw new Error(`No sort key specified for: ${key}`)
		}
		json.forEach((arrItem) => {
			const typedItem = arrItem as Record<string, unknown>
			const sortKeyValue = typedItem[sortKey]
			if (typeof sortKeyValue === 'string') {
				const object = sortKeyValue.split('.')[0]
				typedItem[sortKey] = sortKeyValue.split('.').pop()
				if (objects[object] === undefined) {
					objects[object] = {
						object: object,
					}
					;(objects[object] as Record<string, unknown>)[key] = []
				}
				delete typedItem['object']
				;(
					(objects[object] as Record<string, unknown>)[
						key
					] as unknown[]
				).push(typedItem)
			}
		})

		Object.keys(objects).forEach((object) => {
			const objData = objects[object]
			if (objData && typeof objData === 'object') {
				processFile(
					that,
					objData as Record<string, unknown>,
					key,
					baseDir,
					object,
				)
			}
		})
	} else {
		json.forEach((arrItem) => {
			if (arrItem && typeof arrItem === 'object') {
				processFile(
					that,
					arrItem as Record<string, unknown>,
					key,
					baseDir,
				)
			}
		})
	}
}

function processFile(
	that: Split,
	json: Record<string, unknown>,
	key: string,
	baseDir: string,
	fileNameOverride?: string,
): void {
	let newJSON: Record<string, unknown>
	let fileName: string
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

function transformJSON(
	that: Split,
	result: Record<string, unknown>,
	rootTag: string,
): Record<string, unknown> {
	const jsonString = JSON.stringify(result, (_name, value) => {
		if (Object.keys(that.metadataDefinition.sortKeys).includes(_name)) {
			return value
		} else {
			return xml2json(value)
		}
	})
	result = JSON.parse(jsonString)

	// Check if result has the expected rootTag
	if (!result[rootTag]) {
		throw new Error(
			`Invalid XML structure: Expected root tag "${rootTag}" not found`,
		)
	}

	const rootTagData = result[rootTag] as Record<string, unknown>
	Object.keys(rootTagData).forEach((key) => {
		try {
			rootTagData[key] = keySort(that, key, rootTagData[key])
		} catch (error) {
			throw error
		}
	})

	return result
}

function keySort(that: Split, key: string, json: unknown): unknown {
	const keyOrder = that.metadataDefinition.keyOrder?.[key]
	const sortKey = that.metadataDefinition.sortKeys[key]

	if (Array.isArray(json) && sortKey !== undefined) {
		// sort json using sortKey
		;(json as Record<string, unknown>[]).sort((a, b) => {
			const aVal = a[sortKey]
			const bVal = b[sortKey]
			if (typeof aVal === 'string' && typeof bVal === 'string') {
				if (aVal < bVal) {
					return -1
				}
				if (aVal > bVal) {
					return 1
				}
			}
			return 0
		})

		// arrange json keys in specified order using keyOrder
		if (keyOrder && Array.isArray(json)) {
			json.forEach(function (
				this: Record<string, unknown>[],
				_part,
				index,
			) {
				try {
					const item = this[index] as Record<string, unknown>
					this[index] = Object.keys(item)
						.sort((a, b) => {
							if (keyOrder.indexOf(a) === -1) return 1
							if (keyOrder.indexOf(a) < keyOrder.indexOf(b))
								return -1
							if (keyOrder.indexOf(a) > keyOrder.indexOf(b))
								return 1
							return 0
						})
						.reduce((accumulator: Record<string, unknown>, key) => {
							accumulator[key] = item[key]
							return accumulator
						}, {})
				} catch (error) {
					throw error
				}
			}, json)
		}

		// recursive objects
		if (Array.isArray(json)) {
			json.forEach((arrayItem: unknown) => {
				if (
					arrayItem &&
					typeof arrayItem === 'object' &&
					!Array.isArray(arrayItem)
				) {
					const item = arrayItem as Record<string, unknown>
					Object.keys(item).forEach((jsonKey) => {
						if (
							typeof item[jsonKey] === 'object' &&
							item[jsonKey] !== null
						) {
							item[jsonKey] = keySort(
								that,
								jsonKey,
								item[jsonKey],
							)
						}
					})
				}
			})
		}
	}

	return json
}

function xml2json(currentValue: unknown): unknown {
	let value = currentValue
	if (Array.isArray(value)) {
		if (value.length === 1) {
			value = value[0].toString().trim()
		}
	}

	try {
		if (value === 'true') value = true
		if (value === 'false') value = false
	} catch (error) {
		if (
			error instanceof Error &&
			error.message !== 'Cannot convert object to primitive value'
		) {
			console.error(error)
		}
	}

	return value
}

function getTimeDiff(
	startTime: bigint,
	endTime: bigint = process.hrtime.bigint(),
): ReturnType<typeof convertHrtime> {
	const diff = endTime - startTime
	const executionTime = convertHrtime(diff)
	executionTime.seconds = Math.round(executionTime.seconds)
	executionTime.milliseconds = Math.round(executionTime.milliseconds / 1000)
	if (executionTime.milliseconds === 0 && executionTime.nanoseconds > 0)
		executionTime.milliseconds = 1
	return executionTime
}
