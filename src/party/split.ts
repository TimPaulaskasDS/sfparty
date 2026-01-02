import { XMLParser } from 'fast-xml-parser'
import fs from 'fs'
import path from 'path'
import { sanitizeErrorPath } from '../lib/errorUtils.js'
import * as fileUtils from '../lib/fileUtils.js'
import { getPerformanceLogger } from '../lib/performanceLogger.js'
import { getGlobalProgressTracker } from '../lib/tuiProgressTracker.js'
import type { MetadataDefinition } from '../types/metadata.js'

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
	keepFalseValues?: boolean
}

interface GlobalContext {
	__basedir?: string
	logger?: {
		error: (message: string) => void
		warn: (message: string) => void
	}
	consoleTransport?: {
		silent?: boolean
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
	#keepFalseValues: boolean = false
	#xmlParser: XMLParser | undefined = undefined

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
		this.#keepFalseValues = config.keepFalseValues || false
	}

	get metadataDefinition(): MetadataDefinition {
		return this._metadataDefinition
	}

	set metadataDefinition(definition: MetadataDefinition) {
		this._metadataDefinition = definition
		this.#type = definition.filetype
		this.#root = definition.root
	}

	get keepFalseValues(): boolean {
		return this.#keepFalseValues
	}

	private getXmlParser(): XMLParser {
		if (!this.#xmlParser) {
			// SEC-006: XML parser configuration with depth limits
			// Note: fast-xml-parser doesn't have explicit depth limit option,
			// but we validate depth after parsing in fileUtils.convertXML()
			this.#xmlParser = new XMLParser({
				ignoreAttributes: false,
				attributesGroupName: '$',
				attributeNamePrefix: '',
				ignoreDeclaration: false,
				ignorePiTags: true,
				trimValues: true,
				parseAttributeValue: false,
				parseTagValue: false,
				alwaysCreateTextNode: false,
				isArray: () => false,
			})
		}
		return this.#xmlParser
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
		// File name extraction will be done asynchronously in split() if needed
		// For now, extract from path synchronously
		const fileName = path.basename(trimmedValue)
		this.#fileName.shortName = fileName.replace(
			`.${this.#type}-meta.xml`,
			'',
		)
		this.#fileName.fullName = fileName
	}

	async initializeFileName(): Promise<void> {
		// Use actual file name if found so it matches case sensitivity
		const fileInfoResult = await fileUtils.fileInfo(this._metaFilePath)
		let fileName = fileInfoResult.filename

		const foundFile = await fileUtils.getFiles(
			path.dirname(this._metaFilePath),
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

	async split(): Promise<boolean> {
		const that = this
		if (
			!that.#fileName ||
			!that.sourceDir ||
			!that.targetDir ||
			!that.metaFilePath
		) {
			const message = 'Invalid information passed to split'
			const progressTracker = getGlobalProgressTracker()
			if (progressTracker) {
				progressTracker.logError(message)
			} else {
				if (
					!global.consoleTransport ||
					!global.consoleTransport.silent
				) {
					global.logger?.error(message)
				}
			}
			return false
		}

		// Initialize file name with case-sensitive matching
		await that.initializeFileName()

		that.targetDir = path.join(
			that.targetDir,
			that.#fileName.shortName || '',
		)

		// SEC-003: Check file size before reading to prevent memory exhaustion
		// SEC-011: Validate symlink before reading
		let finalPath = that.metaFilePath
		try {
			const linkStats = await fs.promises.lstat(that.metaFilePath)
			if (linkStats.isSymbolicLink()) {
				// Validate symlink is safe
				const targetPath = await fs.promises.readlink(that.metaFilePath)
				const resolvedTarget = path.resolve(
					path.dirname(that.metaFilePath),
					targetPath,
				)
				if (global.__basedir) {
					const resolvedRoot = path.resolve(global.__basedir)
					if (!resolvedTarget.startsWith(resolvedRoot)) {
						throw new Error(
							`Symlink points outside workspace: ${that.metaFilePath} -> ${targetPath}`,
						)
					}
				}
				finalPath = resolvedTarget
			}
		} catch (error) {
			// If lstat fails or symlink validation fails, handle error
			if (error instanceof Error && error.message.includes('Symlink')) {
				throw error
			}
			// Otherwise continue to stat() check below
		}

		// Combine file existence check and stat call into single operation for better performance
		let stats: fs.Stats
		try {
			stats = await fs.promises.stat(finalPath)
		} catch (error) {
			// File doesn't exist
			const message = `file not found: ${that.metaFilePath}`
			const progressTracker = getGlobalProgressTracker()
			if (progressTracker) {
				progressTracker.logError(message)
			} else {
				if (
					!global.consoleTransport ||
					!global.consoleTransport.silent
				) {
					global.logger?.error(message)
				}
			}
			const perfLogger = getPerformanceLogger()
			perfLogger.completeFile(that.metaFilePath, false, 'File not found')
			return false
		}

		const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB
		if (stats.size > MAX_FILE_SIZE) {
			throw new Error(
				`File size (${(stats.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
			)
		}

		const perfLogger = getPerformanceLogger()
		perfLogger.setFileSize(that.metaFilePath, stats.size)

		// Track file read time
		const readStart = process.hrtime.bigint()
		// Read and parse XML asynchronously
		// Direct read - read queue was adding overhead
		// SEC-011: Use finalPath (validated symlink target) instead of metaFilePath
		const data = await fs.promises.readFile(finalPath, 'utf8')
		const readEnd = process.hrtime.bigint()
		const readDuration = Number(readEnd - readStart) / 1_000_000 // Convert to milliseconds
		perfLogger.recordRead(that.metaFilePath, readDuration)

		// Track XML parse time
		const parseStart = process.hrtime.bigint()
		// Security: Configure parser with safe options
		// SEC-001: fast-xml-parser doesn't parse DOCTYPE/entities by default, providing built-in XXE protection
		// Reuse parser instance for better performance
		const parser = this.getXmlParser()

		let jsonData: Record<string, unknown>
		try {
			jsonData = parser.parse(data) as Record<string, unknown>

			// SEC-006: Check parsing depth to prevent XML bomb attacks
			fileUtils.checkDepth(jsonData, 100) // MAX_PARSING_DEPTH

			// SEC-006: Check parsed content size
			const estimatedSize = fileUtils.estimateObjectSize(jsonData)
			const MAX_PARSED_CONTENT_SIZE = 10 * 1024 * 1024 // 10MB
			if (estimatedSize > MAX_PARSED_CONTENT_SIZE) {
				throw new Error(
					`XML parsed content size (${(estimatedSize / 1024 / 1024).toFixed(2)}MB) exceeds maximum limit of ${MAX_PARSED_CONTENT_SIZE / 1024 / 1024}MB`,
				)
			}
		} catch (err) {
			// SEC-008: Sanitize file path in error message (before sanitizeErrorPath is applied)
			const message = `error converting xml to json: ${sanitizeErrorPath(that.metaFilePath)}`
			const progressTracker = getGlobalProgressTracker()
			if (progressTracker) {
				progressTracker.logError(message)
			} else {
				if (
					!global.consoleTransport ||
					!global.consoleTransport.silent
				) {
					global.logger?.error(message)
				}
			}
			const errorMessage =
				err instanceof Error ? err.message : String(err)
			throw new Error(
				`error converting xml to json: ${sanitizeErrorPath(that.metaFilePath)}: ${errorMessage}`,
			)
		}
		const parseEnd = process.hrtime.bigint()
		const parseDuration = Number(parseEnd - parseStart) / 1_000_000 // Convert to milliseconds
		perfLogger.recordParse(that.metaFilePath, parseDuration)

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
			const message = `${that.#fileName.fullName} has an invalid XML root`
			const progressTracker = getGlobalProgressTracker()
			if (progressTracker) {
				progressTracker.logError(message)
			} else {
				if (
					!global.consoleTransport ||
					!global.consoleTransport.silent
				) {
					global.logger?.error(message)
				}
			}
			const perfLogger = getPerformanceLogger()
			perfLogger.completeFile(
				that.metaFilePath,
				false,
				'Invalid XML root',
			)
			return false
		}

		// modify the json to remove unwanted arrays
		try {
			that.#json = transformJSON(that, jsonData, that.#root!)
		} catch (error) {
			const message = `${that.#fileName.fullName} has an invalid XML root`
			const progressTracker = getGlobalProgressTracker()
			if (progressTracker) {
				progressTracker.logError(message)
			} else {
				if (
					!global.consoleTransport ||
					!global.consoleTransport.silent
				) {
					global.logger?.error(message)
				}
			}
			throw error
		}

		await handleSandboxLoginIpRanges(that.targetDir, fileUtils)

		// Track write operations time
		const writeStart = process.hrtime.bigint()
		try {
			await processJSON(
				that,
				that.#json[that.#root!] as Record<string, unknown>,
				that.targetDir,
			)
			const writeEnd = process.hrtime.bigint()
			const writeDuration = Number(writeEnd - writeStart) / 1_000_000 // Convert to milliseconds
			perfLogger.recordWrite(that.metaFilePath, writeDuration)
			perfLogger.completeFile(that.metaFilePath, true)
			completeFile(that)
			return true
		} catch (error) {
			const writeEnd = process.hrtime.bigint()
			const writeDuration = Number(writeEnd - writeStart) / 1_000_000 // Convert to milliseconds
			perfLogger.recordWrite(that.metaFilePath, writeDuration)
			perfLogger.completeFile(
				that.metaFilePath,
				false,
				error instanceof Error ? error.message : String(error),
			)
			console.log(that.#fileName.shortName)
			global.logger?.error(error as string)
			throw error
		}

		async function processJSON(
			that: Split,
			json: Record<string, unknown>,
			baseDir: string,
		): Promise<void> {
			let targetDir = baseDir
			if (processed.type !== that.#root) {
				processed.current = 0
				processed.type = that.#root
			}
			processed.current++
			for (const key of Object.keys(json)) {
				that.sequence = processed.current
				// Progress is handled by ProgressTracker

				if (
					that.metadataDefinition.directories !== undefined &&
					that.metadataDefinition.directories.includes(key)
				) {
					targetDir = path.join(baseDir, key)
					await fileUtils.createDirectory(targetDir) // create directory
					if (Array.isArray(json[key])) {
						await processDirectory(that, json[key], key, targetDir)
					} else if (json[key] && typeof json[key] === 'object') {
						// Handle single element case - convert to array
						await processDirectory(
							that,
							[json[key]],
							key,
							targetDir,
						)
					}
				} else if (
					that.metadataDefinition.singleFiles !== undefined &&
					that.metadataDefinition.singleFiles.includes(key)
				) {
					// For singleFiles, json[key] can be an array or a single object
					// Convert single object to array for consistent processing
					const value = json[key]
					let arrayValue: unknown[]
					if (Array.isArray(value)) {
						arrayValue = value
					} else if (value && typeof value === 'object') {
						// Single element case - convert to array
						arrayValue = [value]
					} else {
						// Invalid structure, skip
						continue
					}

					// Apply keySort to sort entries and order keys within each entry
					const sorted = keySort(that, key, arrayValue)
					await processFile(
						that,
						sorted as Record<string, unknown>,
						key,
						baseDir,
					)
				} else if (
					that.metadataDefinition.main !== undefined &&
					that.metadataDefinition.main.includes(key)
				) {
					// Main will get processed in it's own call
				} else {
					// Log unknown key via TUI if active, otherwise via global.logger
					const message = `Unknown key: ${key}`
					const progressTracker = getGlobalProgressTracker()
					if (progressTracker) {
						progressTracker.logWarning(message)
					} else {
						// Only log to console if console transport is not silenced (TUI not active)
						if (
							!global.consoleTransport ||
							!global.consoleTransport.silent
						) {
							global.logger?.warn(message)
						}
					}
				}
			}

			if (that.metadataDefinition.main !== undefined) {
				await Main(that)
			}
		}

		async function Main(that: Split): Promise<void> {
			const fileName = path.join(that.targetDir, `main.${global.format}`)
			const mainInfo: { main: Record<string, unknown> } = {
				main: {},
			}
			mainInfo.main.name = that.#fileName.shortName
			for (const key of that.metadataDefinition.main || []) {
				that.sequence = processed.current
				// Progress is handled by ProgressTracker

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
			}

			await fileUtils.saveFile(mainInfo, fileName, global.format)
		}

		function completeFile(that: Split): void {
			// Progress is handled by ProgressTracker
			// Errors are logged via global.logger
			if (that.#errorMessage !== '') {
				global.logger?.error(
					`Error processing ${that.#fileName.shortName}: ${that.#errorMessage}`,
				)
			}
		}
	}
}

async function processDirectory(
	that: Split,
	json: unknown[],
	key: string,
	baseDir: string,
): Promise<void> {
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

		// Process objects in parallel to improve write performance
		const objectPromises = Object.keys(objects)
			.filter((object) => {
				const objData = objects[object]
				return objData && typeof objData === 'object'
			})
			.map((object) => {
				const objData = objects[object]
				return processFile(
					that,
					objData as Record<string, unknown>,
					key,
					baseDir,
					object,
				)
			})
		await Promise.all(objectPromises)
	} else {
		// Process files in parallel to improve write performance
		const filePromises = json
			.filter((arrItem) => arrItem && typeof arrItem === 'object')
			.map((arrItem) =>
				processFile(
					that,
					arrItem as Record<string, unknown>,
					key,
					baseDir,
				),
			)
		await Promise.all(filePromises)
	}
}

/**
 * Check if a value is considered false (boolean false or string 'false')
 */
function isFalseValue(val: unknown): boolean {
	return val === false || val === 'false'
}

/**
 * Check if a fieldPermissions entry should be removed (both editable and readable are false)
 * Matches the cleanup script logic: removes entries where BOTH editable AND readable are false
 */
function isFieldPermissionEmpty(entry: unknown): boolean {
	if (!entry || typeof entry !== 'object') {
		return false
	}
	const fieldPerm = entry as Record<string, unknown>
	return isFalseValue(fieldPerm.editable) && isFalseValue(fieldPerm.readable)
}

/**
 * Check if an objectPermissions entry should be removed (all 6 boolean permissions are false)
 * Matches the cleanup script logic
 */
function isObjectPermissionEmpty(entry: unknown): boolean {
	if (!entry || typeof entry !== 'object') {
		return false
	}
	const objPerm = entry as Record<string, unknown>
	return (
		isFalseValue(objPerm.allowCreate) &&
		isFalseValue(objPerm.allowRead) &&
		isFalseValue(objPerm.allowEdit) &&
		isFalseValue(objPerm.allowDelete) &&
		isFalseValue(objPerm.viewAllRecords) &&
		isFalseValue(objPerm.modifyAllRecords)
	)
}

/**
 * Filter out entries based on the key type (fieldPermissions, objectPermissions, etc.)
 * Matches the cleanup script behavior:
 * - fieldPermissions: Remove entries where both editable AND readable are false
 * - objectPermissions: Remove entries where all 6 permissions are false
 * - Other types: Don't filter (the cleanup script doesn't handle them)
 */
function filterFalseEntries(arr: unknown[], key: string): unknown[] {
	if (key === 'fieldPermissions') {
		// Remove entries where both editable and readable are false
		return arr.filter((item) => !isFieldPermissionEmpty(item))
	} else if (key === 'objectPermissions') {
		// Remove entries where all 6 permissions are false
		return arr.filter((item) => !isObjectPermissionEmpty(item))
	}
	// For all other types, don't filter (return as-is)
	// The cleanup script only handles fieldPermissions and objectPermissions
	return arr
}

async function processFile(
	that: Split,
	json: Record<string, unknown>,
	key: string,
	baseDir: string,
	fileNameOverride?: string,
): Promise<void> {
	// Apply cleanup for profiles and permission sets only
	const metadataType = that.metadataDefinition.filetype
	const shouldCleanup =
		!that.keepFalseValues &&
		(metadataType === 'profile' || metadataType === 'permset')

	// Handle cleanup - json can be an array (for singleFiles) or an object (for directories)
	let cleanedJson = json
	let cleanedArray: unknown[] | null = null

	if (shouldCleanup) {
		// For singleFiles, json is actually an array (despite the type)
		if (Array.isArray(json)) {
			// Filter the array directly
			const filtered = filterFalseEntries(json, key)
			if (filtered.length === 0) {
				// All entries were false, don't write the file
				return
			}
			cleanedArray = filtered
		} else {
			// For directories, json is an object with arrays inside
			cleanedJson = { ...json }
			for (const jsonKey of Object.keys(cleanedJson)) {
				const value = cleanedJson[jsonKey]
				if (Array.isArray(value)) {
					// Filter based on the key type (fieldPermissions, objectPermissions, etc.)
					const filtered = filterFalseEntries(value, jsonKey)
					if (filtered.length === 0) {
						// All entries were false, remove the key entirely
						delete cleanedJson[jsonKey]
					} else {
						cleanedJson[jsonKey] = filtered
					}
				}
			}

			// If the entire object has no meaningful data (only object/field keys), skip writing
			const meaningfulKeys = Object.keys(cleanedJson).filter(
				(k) => k !== 'object' && k !== 'field',
			)
			if (meaningfulKeys.length === 0) {
				// File would be empty, don't write it
				return
			}
		}
	}

	let newJSON: Record<string, unknown>
	let fileName: string
	if (fileNameOverride !== undefined) {
		// For files split by object (e.g., fieldPermissions/Account.yaml)
		fileName = path.join(baseDir, `${fileNameOverride}.${global.format}`)
		// cleanedJson is already the object structure (e.g., {object: 'Account', fieldPermissions: [...]})
		newJSON = cleanedJson

		// Check if file should be skipped after cleanup
		if (shouldCleanup) {
			const meaningfulKeys = Object.keys(newJSON).filter(
				(k) => k !== 'object' && k !== 'field',
			)
			if (meaningfulKeys.length === 0) {
				// File would be empty, don't write it
				return
			}
		}
	} else {
		// For singleFiles (e.g., classAccesses.yaml)
		fileName = path.join(baseDir, `${key}.${global.format}`)

		// Use cleanedArray if cleanup was applied, otherwise use cleanedJson
		newJSON = {}
		newJSON[key] = cleanedArray !== null ? cleanedArray : cleanedJson
	}

	await fileUtils.saveFile(newJSON, fileName, global.format)
}

/**
 * Recursively transform JSON values in-place, applying xml2json to non-sortKey fields
 * This avoids the expensive JSON.stringify/parse round-trip
 * Optimized to mutate in-place where possible to reduce object creation overhead
 */
function transformJSONInPlace(obj: unknown, sortKeys: string[]): unknown {
	if (obj === null || typeof obj !== 'object') {
		return obj
	}

	if (Array.isArray(obj)) {
		// Transform array items in-place
		for (let i = 0; i < obj.length; i++) {
			obj[i] = transformJSONInPlace(obj[i], sortKeys)
		}
		return obj
	}

	// For objects, we need to create a new object to avoid mutating during iteration
	// but we can optimize by only transforming what needs transformation
	const objRecord = obj as Record<string, unknown>
	const result: Record<string, unknown> = {}

	for (const key in objRecord) {
		if (Object.prototype.hasOwnProperty.call(objRecord, key)) {
			const value = objRecord[key]
			if (sortKeys.includes(key)) {
				// For sortKey fields, still need to recursively transform array items
				// to convert boolean strings to booleans in nested objects
				if (Array.isArray(value)) {
					// Transform array items in-place
					const transformedArray = transformJSONInPlace(
						value,
						sortKeys,
					)
					result[key] = transformedArray
				} else if (
					value &&
					typeof value === 'object' &&
					!Array.isArray(value)
				) {
					// For objects, recursively transform nested properties
					const transformed = transformJSONInPlace(value, sortKeys)
					result[key] = transformed
				} else {
					// For primitives, copy as-is
					result[key] = value
				}
			} else {
				// Transform non-sortKey fields recursively, then apply xml2json
				const transformed = transformJSONInPlace(value, sortKeys)
				result[key] = xml2json(transformed)
			}
		}
	}

	return result
}

function transformJSON(
	that: Split,
	result: Record<string, unknown>,
	rootTag: string,
): Record<string, unknown> {
	// Check if result has the expected rootTag
	if (!result[rootTag]) {
		throw new Error(
			`Invalid XML structure: Expected root tag "${rootTag}" not found`,
		)
	}

	// Transform in-place without expensive stringify/parse round-trip
	const sortKeys = Object.keys(that.metadataDefinition.sortKeys)
	const transformed = transformJSONInPlace(result, sortKeys) as Record<
		string,
		unknown
	>

	const rootTagData = transformed[rootTag] as Record<string, unknown>
	Object.keys(rootTagData).forEach((key) => {
		try {
			rootTagData[key] = keySort(that, key, rootTagData[key])
		} catch (error) {
			throw error
		}
	})

	return transformed
}

/**
 * Compares two keys for sorting based on keyOrder
 * @param a First key
 * @param b Second key
 * @param keyOrder Array defining the order of keys
 * @returns Comparison result: -1 if a < b, 1 if a > b, 0 if equal
 */
export function compareKeysForKeyOrder(
	a: string,
	b: string,
	keyOrder: string[],
): number {
	if (keyOrder.indexOf(a) === -1) return 1
	if (keyOrder.indexOf(a) < keyOrder.indexOf(b)) return -1
	if (keyOrder.indexOf(a) > keyOrder.indexOf(b)) return 1
	return 0
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
						.sort((a, b) => compareKeysForKeyOrder(a, b, keyOrder))
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

/**
 * Internal function to perform boolean comparison - extracted for testability
 * Can be mocked in tests to trigger error paths
 * @internal
 */
export function compareBooleanValue(value: unknown, target: string): boolean {
	// This comparison can theoretically throw if value has custom behavior
	// that interferes with === comparison
	return value === target
}

// Store the comparison function in a way that can be mocked
let _compareBooleanValue = compareBooleanValue

/**
 * Converts a boolean string value to a boolean, with error handling
 * @param value Value to convert
 * @param onError Optional error callback
 * @returns Converted value or original value if conversion fails
 */
export function convertBooleanValue(
	value: unknown,
	onError?: (error: Error) => void,
): unknown {
	try {
		if (_compareBooleanValue(value, 'true')) return true
		if (_compareBooleanValue(value, 'false')) return false
		return value
	} catch (error) {
		if (
			error instanceof Error &&
			error.message !== 'Cannot convert object to primitive value'
		) {
			if (onError) {
				onError(error)
			} else {
				console.error(error)
			}
		}
		return value
	}
}

/**
 * Internal function to set the comparison function - for testing only
 * @internal
 */
export function _setCompareBooleanValue(fn: typeof compareBooleanValue): void {
	_compareBooleanValue = fn
}

/**
 * Internal function to reset the comparison function - for testing only
 * @internal
 */
export function _resetCompareBooleanValue(): void {
	_compareBooleanValue = compareBooleanValue
}

function xml2json(currentValue: unknown): unknown {
	let value = currentValue
	if (Array.isArray(value)) {
		if (value.length === 1) {
			value = value[0].toString().trim()
		}
	}

	value = convertBooleanValue(value)

	return value
}

/**
 * Handles sandbox login IP ranges during profile split
 * Reads loginIpRanges-sandbox.yaml from targetDir and saves it back after directory operations
 * @param targetDir Target directory path
 * @param fileUtils File utilities interface
 */
export async function handleSandboxLoginIpRanges(
	targetDir: string,
	fileUtils: typeof import('../lib/fileUtils.js'),
): Promise<void> {
	const sandboxLoginIpRange = await fileUtils.readFile(
		path.join(targetDir, 'loginIpRanges-sandbox.yaml'),
	)

	await fileUtils.deleteDirectory(targetDir, true) // recursive delete existing directory
	await fileUtils.createDirectory(targetDir) // create directory

	if (sandboxLoginIpRange) {
		await fileUtils.saveFile(
			sandboxLoginIpRange,
			path.join(targetDir, 'loginIpRanges-sandbox.yaml'),
			'yaml',
		)
	}
}
