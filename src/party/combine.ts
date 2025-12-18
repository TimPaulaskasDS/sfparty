import ci from 'ci-info'
import clc from 'cli-color'
import cliSpinners from 'cli-spinners'
import convertHrtime from 'convert-hrtime'
import fs from 'fs'
import logUpdate from 'log-update'
import path from 'path'
import * as xml2js from 'xml2js'
import * as fileUtils from '../lib/fileUtils.js'
import type { Package } from '../lib/packageUtil.js'
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
	profileName: string | undefined
}

interface FileStats {
	atime: Date | undefined
	mtime: Date | undefined
}

interface FileObj {
	shortName: string
	fullName: string
}

interface CombineConfig {
	metadataDefinition: MetadataDefinition
	sourceDir: string
	targetDir: string
	metaDir: string
	sequence: number
	total: number
	addPkg: Package
	desPkg: Package
}

interface GlobalContext {
	logger?: {
		error: (message: string) => void
		warn: (message: string) => void
	}
	displayError?: (message: string, done: boolean) => void
	format?: string
	icons?: {
		working?: string
		success?: string
		fail?: string
		delete?: string
		warn?: string
	}
	process?: {
		current: number
	}
	git?: {
		enabled?: boolean
		append?: boolean
		delta?: boolean
	}
	metaTypes?: Record<
		string,
		{
			definition: MetadataDefinition
			add: { files: string[] }
			remove: { files: string[] }
		}
	>
	__basedir?: string
}

declare const global: GlobalContext & typeof globalThis

export class Combine {
	#type: string | undefined = undefined
	#root: string | undefined = undefined
	#spinnerMessage = ''
	#startTime: bigint = BigInt(0)
	#fileName: FileNameInfo = {
		fullName: undefined,
		shortName: undefined,
		profileName: undefined,
	}
	#errorMessage = ''
	#frameIndex = 0
	#types: string[] = []
	#fileStats: FileStats = {
		atime: undefined,
		mtime: undefined,
	}
	#json: Record<string, unknown> = {}
	#delta = false
	#addedFiles: string[] = []
	#deletedFiles: string[] = []
	#mainDeleted = false

	private _metadataDefinition!: MetadataDefinition
	sourceDir!: string
	targetDir!: string
	private _metaDir!: string
	private _sequence!: number
	total!: number
	addPkg!: Package
	desPkg!: Package

	constructor(config: CombineConfig) {
		this.metadataDefinition = config.metadataDefinition
		this.sourceDir = config.sourceDir
		this.targetDir = config.targetDir
		this.metaDir = config.metaDir
		this.sequence = config.sequence
		this.total = config.total
		this.addPkg = config.addPkg
		this.desPkg = config.desPkg
	}

	get metadataDefinition(): MetadataDefinition {
		return this._metadataDefinition
	}

	set metadataDefinition(definition: MetadataDefinition) {
		this._metadataDefinition = definition
		this.#type = definition.filetype
		this.#root = definition.root
	}

	get metaDir(): string {
		return this._metaDir
	}

	set metaDir(metaDir: string) {
		this._metaDir = metaDir
		this.#fileName.fullName = path.join(
			this.targetDir,
			metaDir.split(path.sep).pop() + `.${this.#type}-meta.xml`,
		)
		this.#fileName.shortName = metaDir.split(path.sep).pop()
	}

	get sequence(): number {
		if (global.process && global.process.current > this._sequence) {
			return global.process.current
		} else {
			return this._sequence
		}
	}

	set sequence(sequence: number) {
		this._sequence = sequence
	}

	combine(): Promise<boolean | string> {
		return new Promise((resolve, reject) => {
			const that = this

			if (!fileUtils.directoryExists({ dirPath: that.sourceDir, fs }))
				reject(new Error(`Path does not exist: ${that.sourceDir}`))
			const types = ['directories', 'singleFiles', 'main']
			types.forEach((type) => {
				const metaType = type as keyof MetadataDefinition
				if (that.metadataDefinition[metaType] !== undefined) {
					const values = that.metadataDefinition[metaType]
					if (Array.isArray(values)) {
						that.#types = that.#types.concat(values)
					}
				}
			})

			that.#types.sort((a, b) => {
				if (a === '$') return -1
				if (that.metadataDefinition.xmlFirst !== undefined) {
					if (a === that.metadataDefinition.xmlFirst) return -1
				}
				if (a < b) return -1
				if (a > b) return 1
				return 0
			})

			that.#types.forEach((key) => {
				that.#json[key] = undefined
			})

			resolve(processStart(that))
		})

		function processStart(that: Combine): boolean | string {
			// set delta based on metadata definition if git delta enabled
			that.#delta =
				that.metadataDefinition.delta === true &&
				global.git?.delta === true

			if (that.#delta) {
				const pathMatch = `/${that.metadataDefinition.directory}/${that.#fileName.shortName}/`

				// get a list of all the added files
				that.#addedFiles = (
					global.metaTypes?.[that.metadataDefinition.alias]?.add
						.files || []
				).filter((i) =>
					i.toLowerCase().includes(pathMatch.toLowerCase()),
				)

				// get a list of all the removed files
				that.#deletedFiles = (
					global.metaTypes?.[that.metadataDefinition.alias]?.remove
						.files || []
				).filter((i) =>
					i.toLowerCase().includes(pathMatch.toLowerCase()),
				)

				// check if main part file deleted
				that.#mainDeleted = (
					global.metaTypes?.[that.metadataDefinition.alias]?.remove
						.files || []
				).some(
					(i) =>
						i.includes(pathMatch) &&
						i.toLowerCase().includes(`/main.${global.format}`),
				)
			}

			const success = processParts(that)
			// Ensure we only match existing metadata type directory and item

			if (success === true) {
				if (
					!that.metadataDefinition.packageTypeIsDirectory &&
					global.git?.enabled
				) {
					if (!that.#delta || that.#addedFiles.length > 0) {
						that.addPkg.addMember(
							that.metadataDefinition.type,
							that.#fileName.shortName || '',
						)
					}

					// only include the workflow node if main part file is delete
					if (that.#delta && that.#mainDeleted) {
						that.desPkg.addMember(
							that.metadataDefinition.type,
							that.#fileName.shortName || '',
						)
					}
				}
				saveXML(that)
				return true
			} else if (
				success &&
				typeof success === 'object' &&
				success &&
				typeof success === 'object' &&
				'name' in success &&
				success.name === 'YAMLException'
			) {
				throw success
			} else {
				// Handle special cases where we should return true instead of 'deleted'
				if (
					that.#delta &&
					that.#mainDeleted &&
					!that.metadataDefinition.packageTypeIsDirectory &&
					global.git?.enabled
				) {
					// Delta mode with mainDeleted: add to desPkg and return true
					that.desPkg.addMember(
						that.metadataDefinition.type,
						that.#fileName.shortName || '',
					)
					return true
				}

				if (
					that.metadataDefinition.packageTypeIsDirectory &&
					global.git?.enabled
				) {
					// packageTypeIsDirectory with git enabled: return true even if files don't exist
					return true
				}

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
							`. ${clc.redBright(
								'source not found - removing XML file',
							)}`,
						)
						.replace('[%3]', ``)
						.replace('[%4]', `${global.icons?.delete || ''} `)
						.replace('[%5]', that.#fileName.shortName || ''),
				)
				logUpdate.done()
				if (
					!that.metadataDefinition.packageTypeIsDirectory &&
					global.git?.enabled
				) {
					that.desPkg.addMember(
						that.metadataDefinition.type,
						that.#fileName.shortName || '',
					)
				}
				try {
					deleteFile(that, that.#fileName.fullName || '')
				} catch (error) {}
				return 'deleted'
			}
		}

		function processParts(that: Combine): boolean | string | Error {
			if (processed.type !== that.#root) {
				processed.current = 0
				processed.type = that.#root
			}
			processed.current++

			that.#startTime = process.hrtime.bigint()
			that.#spinnerMessage = `[%1] of ${that.total} - ${
				that.#root
			}: [%4]${clc.yellowBright('[%5]')}[%2][%3]`

			try {
				that.#types.forEach((key) => {
					// display message
					logUpdate(
						that.#spinnerMessage
							.replace(
								'[%1]',
								that.sequence
									.toString()
									.padStart(
										that.total.toString().length,
										' ',
									),
							)
							.replace(
								'[%2]',
								`\n${clc.magentaBright(
									nextFrame(that),
								)} ${key}`,
							)
							.replace('[%3]', `${that.#errorMessage}`)
							.replace('[%4]', `${global.icons?.working || ''} `)
							.replace(
								'[%5]',
								`${that.#fileName.shortName || ''} `,
							),
					)

					if (that.metadataDefinition.main?.includes(key)) {
						const fileObj: FileObj = {
							shortName: 'Main',
							fullName: path.join(
								that.sourceDir,
								that.metaDir,
								`main.${global.format}`,
							),
						}
						const success = processFile(that, key, fileObj, 'main')
						if (!success) {
							throw new Error('delete XML')
						}

						if (that.#json.$ === undefined) {
							that.#json.$ = {
								xmlns: 'https://soap.sforce.com/2006/04/metadata',
							}
						}
					} else if (
						that.metadataDefinition.singleFiles?.includes(key)
					) {
						processSingleFile(that, key)
					} else if (
						that.metadataDefinition.directories?.includes(key)
					) {
						processDirectory(that, key)
					} else {
						global.logger?.warn(
							`Unexpected metadata type: ${clc.redBright(key)}`,
						)
					}
				})
				return true
			} catch (error) {
				if (error instanceof Error && error.message === 'delete XML') {
					return false
				} else if (
					error &&
					typeof error === 'object' &&
					error &&
					typeof error === 'object' &&
					'name' in error &&
					error.name === 'YAMLException'
				) {
					throw error
				} else {
					return true
				}
			}
		}

		function processSingleFile(that: Combine, key: string): void {
			const fileObj: FileObj = {
				shortName: key,
				fullName: path.join(
					that.sourceDir,
					that.metaDir,
					key + `.${global.format}`,
				),
			}
			processFile(that, key, fileObj)
		}

		function processDirectory(that: Combine, key: string): boolean {
			// Process the directory sourceDir/metaDir/key
			const currentDir = path.join(that.sourceDir, that.metaDir, key)
			// ensure the directory exists
			if (fileUtils.directoryExists({ dirPath: currentDir, fs })) {
				const fileList = fileUtils.getFiles(currentDir, global.format)
				fileList.sort() // process files alphabetically
				that.#json[key] = []

				// iterate over fileList
				fileList.forEach((file, index) => {
					if (!ci.isCI) {
						logUpdate(
							that.#spinnerMessage
								.replace(
									'[%1]',
									that.sequence
										.toString()
										.padStart(
											that.total.toString().length,
											' ',
										),
								)
								.replace(
									'[%2]',
									`\n${clc.magentaBright(
										nextFrame(that),
									)} ${key} - ${index + 1} of ${
										fileList.length
									} - ${clc.magentaBright(file)}`,
								)
								.replace('[%3]', `${that.#errorMessage}`)
								.replace(
									'[%4]',
									`${global.icons?.working || ''} `,
								)
								.replace(
									'[%5]',
									`${that.#fileName.shortName} `,
								),
						)
					}

					const fileObj: FileObj = {
						shortName: file,
						fullName: path.join(
							that.sourceDir,
							that.metaDir,
							key,
							file,
						),
					}
					processFile(that, key, fileObj)
				})
			}

			const filteredArray = (
				global.metaTypes?.[that.metadataDefinition.alias]?.remove
					.files || []
			).filter((filePath) =>
				filePath.startsWith(
					path.join(that.sourceDir, that.metaDir, key),
				),
			)
			filteredArray.forEach((file) => {
				const fileObj: FileObj = {
					shortName: path.basename(file),
					fullName: file,
				}
				processFile(that, key, fileObj)
			})

			return true
		}

		function deleteFile(that: Combine, fileName: string): void {
			fileUtils.deleteFile(fileName)
			fileUtils.deleteDirectory(path.join(that.sourceDir, that.metaDir))
		}

		function processFile(
			that: Combine,
			key: string,
			fileObj: FileObj,
			rootKey?: string,
		): boolean {
			if (
				fileObj === undefined ||
				typeof fileObj !== 'object' ||
				fileObj.shortName === undefined ||
				fileObj.fullName === undefined
			) {
				global.displayError?.(
					`${
						global.icons?.warn || ''
					} Invalid file information passed ${clc.redBright(
						JSON.stringify(fileObj),
					)}`,
					true,
				)
			}

			if (that.#delta) {
				if (
					!that.#addedFiles
						.concat(that.#deletedFiles)
						.includes(fileObj.fullName) &&
					!fileObj.fullName
						.toLowerCase()
						.includes(`/main.${global.format}`)
				)
					return true
			}

			const loginIpRanges =
				fileObj.shortName.toLowerCase() ===
				'loginIpRanges'.toLocaleLowerCase()
			let loginIpRangesSandboxFile: string | undefined
			let loginIpRangesSandbox = false
			if (loginIpRanges) {
				loginIpRangesSandboxFile = fileObj.fullName.replace(
					`.${global.format}`,
					`-sandbox.${global.format}`,
				)
				loginIpRangesSandbox = fileUtils.fileExists({
					filePath: loginIpRangesSandboxFile,
					fs,
				})
			}
			const fileExists = fileUtils.fileExists({
				filePath: fileObj.fullName,
				fs,
			})

			if (
				(!fileExists && !loginIpRanges) ||
				(loginIpRanges && !fileExists && !loginIpRangesSandbox)
			) {
				// File does not exist
				// If file is main part file, then return false to indicate that the XML file should be deleted
				if (
					fileObj.fullName ===
					path.join(
						that.sourceDir,
						that.metaDir,
						`main.${global.format}`,
					)
				) {
					return false
				}

				if (
					// git enabled and (package directory OR package mapping)
					global.git?.enabled &&
					(that.metadataDefinition.packageTypeIsDirectory ||
						(that.metadataDefinition.package !== undefined &&
							path.dirname(fileObj.fullName).split('/').pop()! in
								that.metadataDefinition.package))
				) {
					if (
						// package mapping
						that.metadataDefinition.package !== undefined &&
						path.dirname(fileObj.fullName).split('/').pop()! in
							that.metadataDefinition.package
					) {
						that.desPkg.addMember(
							that.metadataDefinition.package[
								path.dirname(fileObj.fullName).split('/').pop()!
							],
							that.#fileName.shortName +
								'.' +
								fileObj.shortName.replace(
									`.${global.format}`,
									'',
								),
						)
					} else if (
						// package directory
						that.metadataDefinition.packageTypeIsDirectory
					) {
						that.desPkg.addMember(
							that.metadataDefinition.type,
							fileObj.shortName.replace(`.${global.format}`, ''),
						)
					}
				}
				return true
			}

			// abort function if doing a delta deploy and file is not in git list
			if (
				that.#delta &&
				!(
					global.metaTypes?.[that.metadataDefinition.alias]?.add
						.files || []
				).includes(fileObj.fullName) &&
				!loginIpRangesSandbox &&
				fileObj.fullName !==
					path.join(
						that.sourceDir,
						that.metaDir,
						`main.${global.format}`,
					)
			) {
				return true
			}
			let result: unknown
			try {
				if (loginIpRanges) {
					let loginIpRangesResult: unknown
					let loginIpRangesSandboxResult: unknown
					if (fileExists)
						loginIpRangesResult = fileUtils.readFile(
							fileObj.fullName,
						)
					if (loginIpRangesSandbox && loginIpRangesSandboxFile)
						loginIpRangesSandboxResult = fileUtils.readFile(
							loginIpRangesSandboxFile,
						)
					if (fileExists && loginIpRangesSandbox) {
						result = mergeIpRanges(
							loginIpRangesResult as { loginIpRanges: unknown[] },
							loginIpRangesSandboxResult as {
								loginIpRanges: unknown[]
							},
						)
					} else if (fileExists) {
						result = loginIpRangesResult
					} else if (loginIpRangesSandbox) {
						result = loginIpRangesSandboxResult
					}
				} else {
					result = fileUtils.readFile(fileObj.fullName)
				}
			} catch (error) {
				logUpdate(fileObj.fullName)
				logUpdate.done()
				throw error
			}
			const resultTyped = result as Record<string, unknown>
			if (
				fileObj.fullName ===
					path.join(
						that.sourceDir,
						that.metaDir,
						`main.${global.format}`,
					) &&
				that.#type === 'profile' &&
				resultTyped.main &&
				typeof resultTyped.main === 'object' &&
				resultTyped.main !== null &&
				'main' in resultTyped &&
				'fullName' in (resultTyped.main as Record<string, unknown>)
			) {
				that.#fileName.profileName = path.join(
					that.targetDir,
					(resultTyped.main as { fullName: string }).fullName +
						`.${that.#type}-meta.xml`,
				)
			}

			// if split by object we need to add object back to values
			if (
				that.metadataDefinition.splitObjects !== undefined &&
				that.metadataDefinition.splitObjects.includes(key)
			) {
				result = hydrateObject(that, resultTyped, key, fileObj)
			}
			const sortedResult = sortAndArrange(that, resultTyped, key)
			result = sortedResult

			const finalResult = result as Record<string, unknown>
			if (Array.isArray(that.#json[key])) {
				try {
					if (Array.isArray(finalResult[key])) {
						;(finalResult[key] as unknown[]).forEach(
							(arrItem: unknown) => {
								;(that.#json[key] as unknown[]).push(arrItem)
							},
						)
					} else {
						;(that.#json[key] as unknown[]).push(finalResult[key])
					}
				} catch (error) {
					throw error
				}
			} else {
				try {
					that.#json[key] =
						rootKey !== undefined
							? (finalResult[rootKey] as Record<string, unknown>)[
									key
								]
							: finalResult[key]
				} catch (error) {
					throw error
				}
			}

			if (
				global.git?.enabled &&
				fileObj.fullName !==
					path.join(
						that.sourceDir,
						that.metaDir,
						`main.${global.format}`,
					)
			) {
				if (
					that.metadataDefinition.package !== undefined &&
					path.dirname(fileObj.fullName).split('/').pop()! in
						that.metadataDefinition.package
				) {
					that.addPkg.addMember(
						that.metadataDefinition.package[
							path.dirname(fileObj.fullName).split('/').pop()!
						],
						that.#fileName.shortName +
							'.' +
							fileObj.shortName.replace(`.${global.format}`, ''),
					)
				} else if (that.metadataDefinition.packageTypeIsDirectory) {
					that.addPkg.addMember(
						that.metadataDefinition.type,
						fileObj.shortName.replace(`.${global.format}`, ''),
					)
				}
			}

			// Function to merge arrays without duplicates
			function mergeIpRanges(
				array1: { loginIpRanges: unknown[] },
				array2: { loginIpRanges: unknown[] },
			): { loginIpRanges: unknown[] } {
				const combined = array1

				array2.loginIpRanges.forEach((item2: unknown) => {
					if (
						!combined.loginIpRanges.some(
							(item1: unknown) =>
								JSON.stringify(item1) === JSON.stringify(item2),
						)
					) {
						combined.loginIpRanges.push(item2)
					}
				})

				return combined
			}

			updateFileStats(
				that,
				fileObj.fullName,
				fileUtils.fileInfo(fileObj.fullName).stats,
			)
			return true
		}

		function hydrateObject(
			that: Combine,
			json: Record<string, unknown>,
			key: string,
			_fileObj: FileObj,
		): Record<string, unknown> {
			const sortKey = that.metadataDefinition.sortKeys[key]
			const object = json.object as string

			try {
				;(json[key] as unknown[]).forEach((arrItem: unknown) => {
					const typedItem = arrItem as Record<string, unknown>
					typedItem[sortKey] =
						`${object}.${typedItem[sortKey]}`.replace(
							'.undefined',
							'',
						)

					// add object key if previously existed
					if (
						that.metadataDefinition.keyOrder?.[key] !== undefined &&
						that.metadataDefinition.keyOrder[key].includes('order')
					) {
						typedItem.object = object
					}
				})

				// delete object key that we added to the part file
				delete json.object
			} catch (error) {
				throw error
			}

			return json
		}

		function updateFileStats(
			that: Combine,
			_fileName: string,
			stats: fs.Stats | undefined,
		): void {
			try {
				if (!stats) return

				if (
					that.#fileStats.atime === undefined ||
					stats.atime > that.#fileStats.atime
				) {
					that.#fileStats.atime = stats.atime
				}

				if (
					that.#fileStats.mtime === undefined ||
					stats.mtime > that.#fileStats.mtime
				) {
					that.#fileStats.mtime = stats.mtime
				}
			} catch (error) {}
		}

		function saveXML(that: Combine): void {
			const builder = new xml2js.Builder({
				cdata: false,
				rootName: that.#root,
				xmldec: { version: '1.0', encoding: 'UTF-8' },
			})
			fileUtils.createDirectory(that.targetDir)

			Object.keys(that.#json).forEach((key) => {
				if (that.#json[key] === undefined) delete that.#json[key]
			})
			const xml = builder.buildObject(that.#json)

			fileUtils.writeFile(
				that.#fileName.fullName || '',
				xml,
				that.#fileStats.atime,
				that.#fileStats.mtime,
			)

			// display the finish message
			finishMessage(that)
		}

		function finishMessage(that: Combine): void {
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
					.replace('[%4]', `${stateIcon || ''} `)
					.replace('[%5]', that.#fileName.shortName || ''),
			)
			logUpdate.done()
		}

		function nextFrame(that: Combine): string {
			return spinner.frames[
				(that.#frameIndex = ++that.#frameIndex % spinner.frames.length)
			]
		}

		// end of functions
		// end of combine
	}

	// end of class
}

function sortJSON(json: unknown, key: string | undefined): unknown {
	if (Array.isArray(json) && key !== undefined) {
		json.sort((a, b) => {
			if (a[key] < b[key]) return -1
			if (a[key] > b[key]) return 1
			return 0
		})
	}
	return json
}

function sortAndArrange(
	that: Combine,
	json: unknown,
	key?: string,
	_topLevel = true,
): unknown {
	// sort and order keys
	const sortKey = that.metadataDefinition.sortKeys[key || '']

	json = arrangeKeys(that, json, key)
	json = sortJSON(json, sortKey)

	if (json && typeof json === 'object' && !Array.isArray(json)) {
		Object.keys(json).forEach((subKey) => {
			const jsonObj = json as Record<string, unknown>
			if (
				typeof jsonObj[subKey] === 'object' &&
				jsonObj[subKey] !== null
			) {
				if (!Array.isArray(jsonObj[subKey])) {
					if (
						Object.keys(jsonObj[subKey] as Record<string, unknown>)
							.length > 1
					) {
						// call recursively on object
						jsonObj[subKey] = sortAndArrange(
							that,
							jsonObj[subKey],
							subKey,
							false,
						)
					}
				} else {
					// iterate array for objects
					;(jsonObj[subKey] as unknown[]).forEach(
						(arrItem: unknown, index: number) => {
							if (
								typeof arrItem === 'object' &&
								arrItem !== null
							) {
								;(jsonObj[subKey] as unknown[])[index] =
									sortAndArrange(that, arrItem, subKey, false)
							}
						},
					)
				}
			}
		})
	}

	return json
}

function arrangeKeys(
	that: Combine,
	json: unknown,
	key?: string,
): Record<string, unknown> {
	if (!json || typeof json !== 'object' || Array.isArray(json)) {
		return json as Record<string, unknown>
	}
	const jsonObj = json as Record<string, unknown>
	const sortedKeys = Object.keys(jsonObj)
		.sort((a, b) => {
			if (that.metadataDefinition.xmlOrder !== undefined) {
				if (that.metadataDefinition.xmlOrder[key || ''] !== undefined) {
					let aIndex =
						that.metadataDefinition.xmlOrder[key || ''].indexOf(a)
					let bIndex =
						that.metadataDefinition.xmlOrder[key || ''].indexOf(b)
					if (aIndex === -1) aIndex = 99
					if (bIndex === -1) bIndex = 99

					if (aIndex < bIndex && aIndex !== 99) return -1
					if (aIndex > bIndex && bIndex !== 99) return 1
				}
			}
			if (a < b) return -1
			if (a > b) return 1
			return 0
		})
		.reduce((accumulator: Record<string, unknown>, keyName) => {
			accumulator[keyName] = jsonObj[keyName]
			return accumulator
		}, {})
	return sortedKeys
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
