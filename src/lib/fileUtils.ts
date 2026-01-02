import { XMLParser } from 'fast-xml-parser'
import * as fs from 'fs'
import yaml from 'js-yaml'
import * as path from 'path'
import * as auditLogger from './auditLogger.js'
import { handleFileError } from './errorUtils.js'
import { replaceSpecialChars } from './pathUtils.js'
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

// SEC-006: Maximum parsing depth to prevent XML bomb and YAML anchor attacks
const MAX_PARSING_DEPTH = 100 // Maximum nesting depth for XML/YAML structures

// SEC-006: Maximum parsed content size (10MB) to prevent memory exhaustion from parsed data
const MAX_PARSED_CONTENT_SIZE = 10 * 1024 * 1024 // 10MB in bytes

// SEC-006: Check object depth to prevent deep nesting attacks
export function checkDepth(
	obj: unknown,
	maxDepth: number,
	currentDepth = 0,
): void {
	if (currentDepth > maxDepth) {
		throw new Error(
			`Parsing depth (${currentDepth}) exceeds maximum allowed depth (${maxDepth})`,
		)
	}

	if (obj === null || typeof obj !== 'object') {
		return
	}

	if (Array.isArray(obj)) {
		for (const item of obj) {
			checkDepth(item, maxDepth, currentDepth + 1)
		}
	} else {
		for (const key in obj) {
			checkDepth(
				(obj as Record<string, unknown>)[key],
				maxDepth,
				currentDepth + 1,
			)
		}
	}
}

// SEC-006: Estimate size of parsed object (rough approximation)
export function estimateObjectSize(obj: unknown): number {
	if (obj === null || typeof obj === 'undefined') {
		return 8 // null/undefined overhead
	}

	if (typeof obj === 'string') {
		return obj.length * 2 // UTF-16 encoding
	}

	if (typeof obj === 'number' || typeof obj === 'boolean') {
		return 8 // number/boolean size
	}

	if (Array.isArray(obj)) {
		let size = 8 // array overhead
		for (const item of obj) {
			size += estimateObjectSize(item)
		}
		return size
	}

	if (typeof obj === 'object') {
		let size = 8 // object overhead
		for (const key in obj) {
			size += key.length * 2 // key size (UTF-16)
			size += estimateObjectSize((obj as Record<string, unknown>)[key])
		}
		return size
	}

	return 8 // fallback
}

// Security: Safe JSON parser that prevents prototype pollution
export function safeJSONParse(jsonString: string): unknown {
	const parsed = JSON.parse(jsonString)

	// SEC-002: Prevent prototype pollution by rejecting dangerous keys
	// SEC-006: Check depth to prevent deep nesting attacks
	function sanitizeObject(obj: unknown, depth = 0): unknown {
		// SEC-006: Check depth before processing
		if (depth > MAX_PARSING_DEPTH) {
			throw new Error(
				`JSON parsing depth (${depth}) exceeds maximum allowed depth (${MAX_PARSING_DEPTH})`,
			)
		}

		if (obj === null || typeof obj !== 'object') {
			return obj
		}

		if (Array.isArray(obj)) {
			return obj.map((item) => sanitizeObject(item, depth + 1))
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
				depth + 1,
			)
		}
		return sanitized
	}

	const sanitized = sanitizeObject(parsed)

	// SEC-006: Check parsed content size
	const estimatedSize = estimateObjectSize(sanitized)
	if (estimatedSize > MAX_PARSED_CONTENT_SIZE) {
		throw new Error(
			`Parsed content size (${(estimatedSize / 1024 / 1024).toFixed(2)}MB) exceeds maximum limit of ${MAX_PARSED_CONTENT_SIZE / 1024 / 1024}MB`,
		)
	}

	// SEC-012: Validate runtime type for JSON metadata (synchronous)
	// Note: Using dynamic import would require making this async, which breaks compatibility
	// For now, basic structure validation is handled by sanitizeObject
	// Full Zod validation can be added in async contexts (readFile, etc.)

	return sanitized
}

export { sanitizeErrorPath } from './errorUtils.js'
// Re-export for backward compatibility
export { clearPathSanitizationCache, replaceSpecialChars } from './pathUtils.js'

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

/**
 * SEC-011: Validate symlink and ensure it doesn't point outside workspace
 * @param filePath - Path to check
 * @param workspaceRoot - Workspace root directory
 * @param fsTmp - File system module (for testing)
 * @returns Resolved path if symlink is safe, throws error if unsafe
 */
export async function validateSymlink(
	filePath: string,
	workspaceRoot: string | undefined,
	fsTmp: typeof fs = fs,
): Promise<string> {
	try {
		// Use lstat() to detect symlinks (doesn't follow them)
		const linkStats = await fsTmp.promises.lstat(filePath)

		if (linkStats.isSymbolicLink()) {
			// Resolve the symlink target
			const targetPath = await fsTmp.promises.readlink(filePath)
			const resolvedTarget = path.resolve(
				path.dirname(filePath),
				targetPath,
			)

			// Validate the resolved target is within workspace
			if (workspaceRoot) {
				const resolvedRoot = path.resolve(workspaceRoot)
				if (!resolvedTarget.startsWith(resolvedRoot)) {
					throw new Error(
						`Symlink points outside workspace: ${filePath} -> ${targetPath}`,
					)
				}
			} else {
				// If no workspace root, validate against current working directory
				const cwd = process.cwd()
				if (!resolvedTarget.startsWith(cwd)) {
					throw new Error(
						`Symlink points outside current directory: ${filePath} -> ${targetPath}`,
					)
				}
			}

			return resolvedTarget
		}

		// Not a symlink, return original path
		return filePath
	} catch (error) {
		// If lstat fails (file doesn't exist), re-throw
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			throw error
		}
		// For other errors (like symlink validation failure), re-throw
		throw error
	}
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
		// SEC-011: Use lstat() to detect symlinks, then validate
		const linkStats = await fsTmp.promises.lstat(sanitizedPath)
		if (linkStats.isSymbolicLink()) {
			// Validate symlink is safe
			await validateSymlink(sanitizedPath, global.__basedir, fsTmp)
		}
		// Use stat() to check if it's a directory (follows symlinks after validation)
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
		// SEC-011: Use lstat() to detect symlinks, then validate
		const linkStats = await fsTmp.promises.lstat(sanitizedPath)
		if (linkStats.isSymbolicLink()) {
			// Validate symlink is safe
			await validateSymlink(sanitizedPath, global.__basedir, fsTmp)
		}
		// Use stat() to check if it's a file (follows symlinks after validation)
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

	// Check cache first - if we've verified it exists, skip entirely
	if (verifiedDirectories.has(sanitizedPath)) {
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
		// SEC-011: Use lstat() to detect symlinks, then validate
		const linkStats = await fsTmp.promises.lstat(sanitizedPath)
		if (linkStats.isSymbolicLink()) {
			// Validate symlink is safe
			await validateSymlink(sanitizedPath, global.__basedir, fsTmp)
		}
		// Use stat() to get file info (follows symlinks after validation)
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
	let errorMessage: string | undefined
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

		// SEC-007: Log file write operation (non-blocking, git mode only)
		auditLogger.logFileWrite(sanitizedFileName, true).catch(() => {
			// Ignore audit logging errors - they shouldn't break the application
		})

		return true
	} catch (error) {
		errorMessage = error instanceof Error ? error.message : String(error)
		global.logger?.error(error)

		// SEC-007: Log failed file write operation (non-blocking, git mode only)
		auditLogger.logFileWrite(fileName, false, errorMessage).catch(() => {
			// Ignore audit logging errors
		})

		throw error
	}
}

/**
 * Read and parse a file (YAML, JSON, or XML)
 *
 * @param filePath - Path to the file
 * @param convert - Whether to parse the file (default: true)
 * @param fsTmp - File system module (for testing)
 * @returns Parsed file content or undefined if file doesn't exist
 *
 * @security Uses yaml.JSON_SCHEMA to prevent prototype pollution attacks.
 * This schema only allows JSON-compatible types and rejects dangerous
 * keys like __proto__ and constructor. See SECURITY.md for details.
 */
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

		// SEC-011: Validate symlink before reading
		let finalPath = sanitizedPath
		try {
			const linkStats = await fsTmp.promises.lstat(sanitizedPath)
			if (linkStats.isSymbolicLink()) {
				// Validate symlink is safe and get resolved path
				finalPath = await validateSymlink(
					sanitizedPath,
					global.__basedir,
					fsTmp,
				)
			}
		} catch {
			// File doesn't exist or symlink validation failed
			return undefined
		}

		// Combine existence check and size check into single stat() call
		let stats: fs.Stats
		try {
			stats = await fsTmp.promises.stat(finalPath)
		} catch {
			// File doesn't exist
			return undefined
		}

		// SEC-003: Check file size before reading to prevent memory exhaustion
		// stats already obtained above
		if (stats.size > MAX_FILE_SIZE) {
			throw new Error(
				`File size (${(stats.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
			)
		}

		// Direct read - read queue was adding overhead
		// SEC-011: Use finalPath (validated symlink target) instead of sanitizedPath
		const data = await fsTmp.promises.readFile(finalPath, 'utf8')

		if (convert && filePath.indexOf('.yaml') !== -1) {
			// Security: Use JSON_SCHEMA to prevent prototype pollution
			// This prevents attackers from injecting __proto__ or constructor
			// keys that could modify object prototypes. See SECURITY.md.
			//
			// CRITICAL: The try-catch wrapper below is REQUIRED and must NOT be removed.
			// This has been fixed multiple times - see git history for context.
			//
			// WHY THIS IS NEEDED:
			// js-yaml has two error paths:
			// 1. Warnings: Calls onWarning callback (line 437) - these get "YAML parsing" prefix
			// 2. Errors: Throws directly (e.g., duplicate keys, invalid syntax) - these DON'T call onWarning
			//
			// PROBLEM: When js-yaml encounters duplicate keys or other fatal errors, it throws
			// an error directly WITHOUT calling onWarning. This means:
			// - onWarning callback (line 437) never executes
			// - Error message lacks "YAML parsing" prefix
			// - Tests fail expecting "YAML parsing" in error message
			//
			// SOLUTION: Wrap yaml.load in try-catch to catch ALL YAML errors (both from onWarning
			// and direct throws) and ensure they all have consistent "YAML parsing" prefix.
			//
			// IMPORTANT: We check if error.message already includes "YAML parsing" to avoid
			// double-wrapping errors that already came from onWarning callback.
			//
			// DO NOT REMOVE THIS TRY-CATCH - it ensures consistent error messages for all
			// YAML parsing failures, regardless of whether they come from warnings or errors.
			try {
				const parsed = yaml.load(data, {
					schema: yaml.JSON_SCHEMA,
					onWarning: (warning) => {
						// This callback handles YAML warnings (non-fatal issues)
						// However, js-yaml throws errors directly for fatal issues like duplicate keys,
						// so this callback may not always be called. That's why we need the try-catch above.
						const warningMessage =
							typeof warning === 'string'
								? warning
								: warning?.message || String(warning)
						throw new Error(
							`YAML parsing ${filePath}: ${warningMessage}`,
						)
					},
				})

				// SEC-006: Check parsing depth to prevent YAML anchor attacks
				checkDepth(parsed, MAX_PARSING_DEPTH)

				// SEC-006: Check parsed content size
				const estimatedSize = estimateObjectSize(parsed)
				if (estimatedSize > MAX_PARSED_CONTENT_SIZE) {
					throw new Error(
						`YAML parsed content size (${(estimatedSize / 1024 / 1024).toFixed(2)}MB) exceeds maximum limit of ${MAX_PARSED_CONTENT_SIZE / 1024 / 1024}MB`,
					)
				}

				// SEC-012: Validate runtime type for YAML metadata
				const { safeValidateData, MetadataSchema } = await import(
					'./validation.js'
				)
				const validated = safeValidateData(parsed, MetadataSchema)
				return validated ?? parsed // Return original if validation fails (non-blocking)
			} catch (error) {
				// Catch ALL YAML parsing errors (both from onWarning callback and direct throws from js-yaml)
				// Wrap them with "YAML parsing" prefix for consistent error messages.
				// This ensures test/lib/file/fileIO.test.ts "should handle YAML parsing warnings" passes.
				if (error instanceof Error) {
					// Only wrap if not already wrapped (onWarning errors already have the prefix)
					if (!error.message.includes('YAML parsing')) {
						throw new Error(
							`YAML parsing ${filePath}: ${error.message}`,
						)
					}
				}
				throw error
			}
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
		handleFileError(error, global.logger)
	}
}

// Reuse XML parser instance for better performance
let xmlParserInstance: XMLParser | null = null

function getXmlParser(): XMLParser {
	if (!xmlParserInstance) {
		// SEC-006: XML parser configuration
		// Note: fast-xml-parser doesn't have explicit depth limit option,
		// but we validate depth after parsing in convertXML()
		xmlParserInstance = new XMLParser({
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
	}
	return xmlParserInstance
}

async function convertXML(data: string): Promise<unknown> {
	try {
		// Security: Configure parser with safe options
		// SEC-001: fast-xml-parser doesn't parse DOCTYPE/entities by default, providing built-in XXE protection
		// Reuse parser instance for better performance
		const parser = getXmlParser()
		const parsed = parser.parse(data)

		// SEC-006: Check parsing depth to prevent XML bomb attacks
		checkDepth(parsed, MAX_PARSING_DEPTH)

		// SEC-006: Check parsed content size
		const estimatedSize = estimateObjectSize(parsed)
		if (estimatedSize > MAX_PARSED_CONTENT_SIZE) {
			throw new Error(
				`XML parsed content size (${(estimatedSize / 1024 / 1024).toFixed(2)}MB) exceeds maximum limit of ${MAX_PARSED_CONTENT_SIZE / 1024 / 1024}MB`,
			)
		}

		// SEC-012: Validate runtime type for XML metadata
		// Use dynamic import to avoid circular dependencies and keep validation optional
		try {
			const { safeValidateData, MetadataSchema } = await import(
				'./validation.js'
			)
			const validated = safeValidateData(parsed, MetadataSchema)
			return validated ?? parsed // Return original if validation fails (non-blocking)
		} catch {
			// If validation module fails to load, return original (non-blocking)
			return parsed
		}
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
	let errorMessage: string | undefined
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

		// SEC-007: Log file write operation (non-blocking, git mode only)
		auditLogger.logFileWrite(sanitizedFileName, true).catch(() => {
			// Ignore audit logging errors - they shouldn't break the application
		})
	} catch (error) {
		errorMessage = error instanceof Error ? error.message : String(error)
		handleFileError(error, global.logger)

		// SEC-007: Log failed file write operation (non-blocking, git mode only)
		auditLogger.logFileWrite(fileName, false, errorMessage).catch(() => {
			// Ignore audit logging errors
		})
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
			// SEC-011: Use lstat() to detect symlinks, then validate
			const linkStats = await fsTmp.promises.lstat(file)
			if (linkStats.isSymbolicLink()) {
				// Validate symlink is safe (use actualRoot as workspace root)
				await validateSymlink(file, actualRoot, fsTmp)
			}
			// Use stat() to check if it's a file (follows symlinks after validation)
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
