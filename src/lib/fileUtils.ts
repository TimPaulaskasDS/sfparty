import { XMLParser } from 'fast-xml-parser'
import * as fs from 'fs'
import yaml from 'js-yaml'
import * as path from 'path'
import { serializeData, WriteBatcher } from './writeBatcher.js'

// Global write batcher instance
let globalWriteBatcher: WriteBatcher | null = null

/**
 * Initialize the global write batcher
 */
export function initWriteBatcher(batchSize = 10, batchDelay = 10): void {
	globalWriteBatcher = new WriteBatcher(batchSize, batchDelay)
}

/**
 * Get the global write batcher
 */
export function getWriteBatcher(): WriteBatcher | null {
	return globalWriteBatcher
}

/**
 * Get the number of pending writes in the batcher
 */
export function getWriteBatcherQueueLength(): number {
	return globalWriteBatcher?.getQueueLength() ?? 0
}

/**
 * Get write batcher queue statistics for visualization
 */
export function getWriteBatcherQueueStats(): {
	queueLength: number
	batchSize: number
	isFlushing: boolean
} | null {
	return globalWriteBatcher?.getQueueStats() ?? null
}

/**
 * Wait for all batched writes to complete
 */
export async function flushWriteBatcher(): Promise<void> {
	if (globalWriteBatcher) {
		await globalWriteBatcher.waitForCompletion()
	}
}

/**
 * Reset the global write batcher (primarily for testing)
 */
export function resetWriteBatcher(): void {
	globalWriteBatcher = null
}

export interface FileInfo {
	dirname: string
	basename: string
	filename: string
	extname: string
	exists: boolean
	stats: fs.Stats | undefined
}

interface GlobalContext {
	__basedir?: string
	logger?: {
		error: (error: Error | unknown) => void
	}
}

declare const global: GlobalContext & typeof globalThis

// SEC-003: Maximum file size limit (100MB) to prevent memory exhaustion
const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB in bytes

// Security: Safe JSON parser that prevents prototype pollution
export function safeJSONParse(jsonString: string): unknown {
	const parsed = JSON.parse(jsonString)

	// SEC-002: Prevent prototype pollution by rejecting dangerous keys
	function sanitizeObject(obj: unknown): unknown {
		if (obj === null || typeof obj !== 'object') {
			return obj
		}

		if (Array.isArray(obj)) {
			return obj.map(sanitizeObject)
		}

		const sanitized: Record<string, unknown> = {}
		for (const key in obj) {
			// Reject __proto__ and constructor.prototype keys
			if (key === '__proto__' || key === 'constructor') {
				throw new Error(
					'Prototype pollution detected: dangerous key "' +
						key +
						'" is not allowed',
				)
			}
			// Recursively sanitize nested objects
			sanitized[key] = sanitizeObject(
				(obj as Record<string, unknown>)[key],
			)
		}
		return sanitized
	}

	return sanitizeObject(parsed)
}

// Security: Utility function instead of prototype pollution
export function replaceSpecialChars(str: string): string {
	if (typeof str !== 'string') return str
	return str
		.replace(/\*/g, '\u002a')
		.replace(/\?/g, '\u003f')
		.replace(/</g, '\u003c')
		.replace(/>/g, '\u003e')
		.replace(/"/g, '\u0022')
		.replace(/\|/g, '\u007c')
		.replace(/\\/g, '\u005c')
		.replace(/:/g, '\u003a')
}

// Security: Validate paths to prevent traversal attacks
export function validatePath(userPath: string, workspaceRoot?: string): string {
	if (!userPath || typeof userPath !== 'string') {
		throw new Error('Invalid path: path must be a non-empty string')
	}

	const normalized = path.normalize(userPath)

	// Check for .. sequences (path traversal)
	if (normalized.includes('..')) {
		throw new Error('Path traversal detected: .. sequence not allowed')
	}

	// If workspace root is provided, ensure path stays within it
	if (workspaceRoot) {
		const resolved = path.resolve(workspaceRoot, normalized)
		const resolvedRoot = path.resolve(workspaceRoot)

		if (!resolved.startsWith(resolvedRoot)) {
			throw new Error('Path traversal detected: path outside workspace')
		}

		return resolved
	}

	return normalized
}

// Security: Sanitize file paths in error messages
export function sanitizeErrorPath(filePath: string): string {
	if (!filePath || typeof filePath !== 'string') {
		return 'unknown'
	}

	// If global basedir is set, replace it with <workspace>
	if (global.__basedir && filePath.includes(global.__basedir)) {
		return filePath.replace(global.__basedir, '<workspace>')
	}

	// Otherwise just return the basename
	return path.basename(filePath)
}

export async function directoryExists({
	dirPath,
	fs: fsTmp,
}: {
	dirPath: string
	fs: typeof fs
}): Promise<boolean> {
	const sanitizedPath = replaceSpecialChars(dirPath)
	try {
		const stats = await fsTmp.promises.stat(sanitizedPath)
		return stats.isDirectory()
	} catch {
		return false
	}
}

export async function fileExists({
	filePath,
	fs: fsTmp,
}: {
	filePath: string
	fs: typeof fs
}): Promise<boolean> {
	const sanitizedPath = replaceSpecialChars(filePath)
	try {
		const stats = await fsTmp.promises.stat(sanitizedPath)
		return stats.isFile()
	} catch {
		return false
	}
}

// Cache for verified existing directories to avoid redundant operations
// Only cache after we've successfully created or verified the directory exists
const verifiedDirectories = new Set<string>()

/**
 * Clear the verified directories cache (primarily for testing)
 */
export function clearVerifiedDirectoriesCache(): void {
	verifiedDirectories.clear()
}

export async function createDirectory(
	dirPath: string,
	fsTmp: typeof fs = fs,
): Promise<void> {
	const sanitizedPath = replaceSpecialChars(dirPath)

	// Check cache first - if we've verified it exists, skip
	if (verifiedDirectories.has(sanitizedPath)) {
		// Trust cache - only verify if mkdir fails
		return
	}

	try {
		await fsTmp.promises.mkdir(sanitizedPath, { recursive: true })
		// Cache successful creation
		verifiedDirectories.add(sanitizedPath)
	} catch (error) {
		// Check if directory exists (might have been created by another process)
		const exists = await directoryExists({
			dirPath: sanitizedPath,
			fs: fsTmp,
		})
		if (exists) {
			// Cache if it exists to avoid future checks
			verifiedDirectories.add(sanitizedPath)
		} else {
			// Directory doesn't exist and creation failed
			throw error
		}
	}
}

export async function deleteDirectory(
	dirPath: string,
	recursive = false,
	fsTmp: typeof fs = fs,
): Promise<boolean | void> {
	const sanitizedPath = replaceSpecialChars(dirPath)
	const exists = await directoryExists({ dirPath: sanitizedPath, fs: fsTmp })
	if (!exists) {
		return false
	}

	try {
		if (recursive) {
			await fsTmp.promises.rm(sanitizedPath, {
				recursive: true,
				force: true,
			})
		} else {
			await fsTmp.promises.rmdir(sanitizedPath)
		}
		return true
	} catch (error) {
		// If directory doesn't exist, return false
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			return false
		}
		throw error
	}
}

export async function getFiles(
	dirPath: string,
	filter?: string,
	fsTmp: typeof fs = fs,
): Promise<string[]> {
	const sanitizedPath = replaceSpecialChars(dirPath)
	const exists = await directoryExists({ dirPath: sanitizedPath, fs: fsTmp })
	if (!exists) {
		return []
	}

	try {
		const files = await fsTmp.promises.readdir(sanitizedPath)
		const filesList: string[] = []

		for (const file of files) {
			if (!filter) {
				filesList.push(file)
			} else {
				if (
					file
						.toLocaleLowerCase()
						.endsWith(filter.toLocaleLowerCase())
				) {
					filesList.push(file)
				}
			}
		}

		filesList.sort()
		return filesList
	} catch {
		return []
	}
}

export async function getDirectories(
	dirPath: string,
	fsTmp: typeof fs = fs,
): Promise<string[]> {
	const sanitizedPath = replaceSpecialChars(dirPath)
	const exists = await directoryExists({ dirPath: sanitizedPath, fs: fsTmp })
	if (!exists) {
		return []
	}

	try {
		const entries = await fsTmp.promises.readdir(sanitizedPath, {
			withFileTypes: true,
		})
		return entries
			.filter((dirent) => dirent.isDirectory())
			.map((dirent) => dirent.name)
	} catch {
		return []
	}
}

export async function deleteFile(
	filePath: string,
	fsTmp: typeof fs = fs,
): Promise<boolean | void> {
	const sanitizedPath = replaceSpecialChars(filePath)
	const exists = await fileExists({ filePath: sanitizedPath, fs: fsTmp })
	if (!exists) {
		return false
	}

	try {
		await fsTmp.promises.unlink(sanitizedPath)
		return true
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			return false
		}
		throw error
	}
}

export async function fileInfo(
	filePath: string,
	fsTmp: typeof fs = fs,
): Promise<FileInfo> {
	const sanitizedPath = replaceSpecialChars(filePath)
	let exists = false
	let stats: fs.Stats | undefined = undefined

	try {
		stats = await fsTmp.promises.stat(sanitizedPath)
		exists = true
	} catch {
		exists = false
	}

	return {
		dirname: path.dirname(sanitizedPath), //something/folder/example
		basename: path.basename(sanitizedPath, path.extname(sanitizedPath)), //example
		filename: path.basename(sanitizedPath), //example.txt
		extname: path.extname(sanitizedPath), //txt
		exists, //true if exists or false if not exists
		stats, //stats object if exists or undefined if not exists
	}
}

export async function saveFile(
	json: unknown,
	fileName: string,
	format: string = path.extname(fileName).replace('.', ''),
	fsTmp: typeof fs = fs,
	useBatching = true,
): Promise<boolean> {
	try {
		const sanitizedFileName = replaceSpecialChars(fileName)

		// Serialize data (this can be done in parallel with other operations)
		const data = serializeData(json, format)

		// Use write batcher if available and enabled, otherwise write directly
		// When memory is critical, direct writes are faster than batching
		if (useBatching && globalWriteBatcher) {
			await globalWriteBatcher.addWrite(sanitizedFileName, data)
		} else {
			// Direct write (fallback or when batching disabled)
			await fsTmp.promises.writeFile(sanitizedFileName, data, 'utf8')
		}
		return true
	} catch (error) {
		global.logger?.error(error)
		throw error
	}
}

export async function readFile(
	filePath: string,
	convert = true,
	fsTmp: typeof fs = fs,
): Promise<unknown> {
	try {
		// Security: Validate path before processing
		let validatedPath: string
		if (global.__basedir) {
			validatedPath = validatePath(filePath, global.__basedir)
		} else {
			validatedPath = validatePath(filePath)
		}
		const sanitizedPath = replaceSpecialChars(validatedPath)
		const exists = await fileExists({ filePath: sanitizedPath, fs: fsTmp })
		if (!exists) {
			return undefined
		}

		// SEC-003: Check file size before reading to prevent memory exhaustion
		const stats = await fsTmp.promises.stat(sanitizedPath)
		if (stats.size > MAX_FILE_SIZE) {
			throw new Error(
				`File size (${(stats.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
			)
		}

		// Direct read - read queue was adding overhead
		const data = await fsTmp.promises.readFile(sanitizedPath, 'utf8')

		if (convert && filePath.indexOf('.yaml') !== -1) {
			// Security: Use JSON schema to prevent prototype pollution
			return yaml.load(data, {
				schema: yaml.JSON_SCHEMA,
				onWarning: (warning) => {
					throw new Error(`YAML parsing ${filePath}: ${warning}`)
				},
			})
		} else if (convert && filePath.indexOf('.json') !== -1) {
			// SEC-002: Use safe JSON parser to prevent prototype pollution
			return safeJSONParse(data)
		} else if (convert && filePath.indexOf('.xml') !== -1) {
			// returns a promise
			return await convertXML(data)
		} else {
			return data
		}
	} catch (error) {
		// Security: Sanitize paths in error messages
		if (
			error instanceof Error &&
			error.message &&
			error.message.includes('/')
		) {
			const sanitized = new Error(
				error.message.replace(/\/[^\s]+/g, (match) =>
					sanitizeErrorPath(match),
				),
			)
			sanitized.stack = error.stack
			global.logger?.error(sanitized)
			throw sanitized
		}
		global.logger?.error(error)
		throw error
	}
}

async function convertXML(data: string): Promise<unknown> {
	try {
		// Security: Configure parser with safe options
		// SEC-001: fast-xml-parser doesn't parse DOCTYPE/entities by default, providing built-in XXE protection
		// Configure to match xml2js output format for compatibility
		const parser = new XMLParser({
			ignoreAttributes: false, // Keep attributes (needed for xmlns)
			attributesGroupName: '$', // Group attributes in $ object (matches xml2js format)
			attributeNamePrefix: '', // No prefix needed when using attributesGroupName
			ignoreDeclaration: false, // Keep XML declaration
			ignorePiTags: true, // Ignore processing instructions
			trimValues: true, // Trim whitespace from values
			parseAttributeValue: false, // Don't parse attribute values as numbers/booleans
			parseTagValue: false, // Don't parse tag values as numbers/booleans
			alwaysCreateTextNode: false,
			isArray: () => false, // Don't force arrays (single elements stay as objects, like xml2js explicitArray: false)
		})
		return parser.parse(data)
	} catch (error) {
		throw error
	}
}

export async function writeFile(
	fileName: string,
	data: string,
	atime: Date = new Date(),
	mtime: Date = new Date(),
	fsTmp: typeof fs = fs,
): Promise<void> {
	try {
		// Security: Validate path before writing
		let validatedFileName: string
		if (global.__basedir) {
			validatedFileName = validatePath(fileName, global.__basedir)
		} else {
			validatedFileName = validatePath(fileName)
		}
		const sanitizedFileName = replaceSpecialChars(validatedFileName)
		// Security: write data with restricted permissions (owner read/write, group/others read)
		await fsTmp.promises.writeFile(sanitizedFileName, data, { mode: 0o644 })

		// if atime or mtime are undefined, use current date/time
		const finalAtime = atime === undefined ? new Date() : atime
		const finalMtime = mtime === undefined ? new Date() : mtime

		// update XML file to match the latest atime and mtime of the files processed
		await fsTmp.promises.utimes(sanitizedFileName, finalAtime, finalMtime)
	} catch (error) {
		// Security: Sanitize paths in error messages
		if (
			error instanceof Error &&
			error.message &&
			error.message.includes('/')
		) {
			const sanitized = new Error(
				error.message.replace(/\/[^\s]+/g, (match) =>
					sanitizeErrorPath(match),
				),
			)
			sanitized.stack = error.stack
			global.logger?.error(sanitized)
			throw sanitized
		}
		global.logger?.error(error)
		throw error
	}
}

export async function find(
	filename: string,
	root?: string,
	fsTmp: typeof fs = fs,
): Promise<string | null> {
	// code Copyright (c) 2014, Ben Gourley
	// https://github.com/bengourley/find-nearest-file
	const actualRoot = root || process.cwd()

	if (!filename) throw new Error('filename is required')

	if (
		filename.indexOf('/') !== -1 ||
		filename === '..' ||
		filename.includes('..')
	) {
		throw new Error('filename must be just a filename and not a path')
	}

	const sanitizedFilename = replaceSpecialChars(filename)

	async function findFile(
		directory: string,
		filename: string,
	): Promise<string | null> {
		const file = path.join(directory, filename)

		try {
			const stats = await fsTmp.promises.stat(file)
			if (stats.isFile()) return file
			// stat existed, but isFile() returned false
			return nextLevelUp()
		} catch (e) {
			// stat did not exist
			return nextLevelUp()
		}

		async function nextLevelUp(): Promise<string | null> {
			// Don't proceed to the next directory when already at the fs root
			if (directory === path.resolve('/')) return null
			return findFile(path.dirname(directory), filename)
		}
	}

	return findFile(actualRoot, sanitizedFilename)
}
