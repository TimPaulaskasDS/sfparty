import * as fs from 'fs'
import * as yaml from 'js-yaml'
import * as path from 'path'
import { Parser } from 'xml2js'

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

export function directoryExists({
	dirPath,
	fs: fsTmp,
}: {
	dirPath: string
	fs: typeof fs
}): boolean {
	const sanitizedPath = replaceSpecialChars(dirPath)
	return (
		fsTmp.existsSync(sanitizedPath) &&
		fsTmp.statSync(sanitizedPath).isDirectory()
	)
}

export function fileExists({
	filePath,
	fs: fsTmp,
}: {
	filePath: string
	fs: typeof fs
}): boolean {
	const sanitizedPath = replaceSpecialChars(filePath)
	return (
		fsTmp.existsSync(sanitizedPath) &&
		fsTmp.statSync(sanitizedPath).isFile()
	)
}

export function createDirectory(dirPath: string, fsTmp: typeof fs = fs): void {
	const sanitizedPath = replaceSpecialChars(dirPath)
	if (!fsTmp.existsSync(sanitizedPath)) {
		fsTmp.mkdirSync(sanitizedPath, { recursive: true })
	}
}

export function deleteDirectory(
	dirPath: string,
	recursive = false,
	fsTmp: typeof fs = fs,
): boolean | void {
	const sanitizedPath = replaceSpecialChars(dirPath)
	if (!directoryExists({ dirPath: sanitizedPath, fs: fsTmp })) {
		return false
	} else {
		if (fsTmp.existsSync(sanitizedPath)) {
			fsTmp.readdirSync(sanitizedPath).forEach(function (file) {
				const curPath = path.join(sanitizedPath, file)
				if (fsTmp.lstatSync(curPath).isDirectory() && recursive) {
					// recurse
					deleteDirectory(curPath, recursive, fsTmp)
				} else {
					try {
						// delete file
						fsTmp.unlinkSync(curPath)
					} catch (error) {
						fsTmp.rmdirSync(curPath)
					}
				}
			})
			return fsTmp.rmdirSync(sanitizedPath)
		}
	}
}

export function getFiles(
	dirPath: string,
	filter?: string,
	fsTmp: typeof fs = fs,
): string[] {
	const sanitizedPath = replaceSpecialChars(dirPath)
	const filesList: string[] = []
	if (directoryExists({ dirPath: sanitizedPath, fs: fsTmp })) {
		fsTmp.readdirSync(sanitizedPath).forEach((file) => {
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
		})
		filesList.sort()
		return filesList
	} else {
		return []
	}
}

export function getDirectories(
	dirPath: string,
	fsTmp: typeof fs = fs,
): string[] {
	const sanitizedPath = replaceSpecialChars(dirPath)
	if (directoryExists({ dirPath: sanitizedPath, fs: fsTmp })) {
		return fsTmp
			.readdirSync(sanitizedPath, { withFileTypes: true })
			.filter((dirent) => dirent.isDirectory())
			.map((dirent) => dirent.name)
	} else {
		return []
	}
}

export function deleteFile(
	filePath: string,
	fsTmp: typeof fs = fs,
): boolean | void {
	const sanitizedPath = replaceSpecialChars(filePath)
	if (!fileExists({ filePath: sanitizedPath, fs: fsTmp })) {
		return false
	} else {
		fsTmp.unlinkSync(sanitizedPath)
		return
	}
}

export function fileInfo(filePath: string, fsTmp: typeof fs = fs): FileInfo {
	const sanitizedPath = replaceSpecialChars(filePath)
	return {
		dirname: path.join(path.dirname(sanitizedPath)), //something/folder/example
		basename: path.basename(sanitizedPath, path.extname(sanitizedPath)), //example
		filename: path.basename(sanitizedPath), //example.txt
		extname: path.extname(sanitizedPath), //txt
		exists: fsTmp.existsSync(sanitizedPath), //true if exists or false if not exists
		stats: fsTmp.existsSync(sanitizedPath)
			? fsTmp.statSync(sanitizedPath)
			: undefined, //stats object if exists or undefined if not exists
	}
}

export function saveFile(
	json: unknown,
	fileName: string,
	format: string = path.extname(fileName).replace('.', ''),
	fsTmp: typeof fs = fs,
): boolean {
	try {
		const sanitizedFileName = replaceSpecialChars(fileName)
		switch (format) {
			case 'json':
				const jsonString = JSON.stringify(json, null, '\t')
				fsTmp.writeFileSync(sanitizedFileName, jsonString)
				break
			case 'yaml':
				const doc = yaml.dump(json)
				fsTmp.writeFileSync(sanitizedFileName, doc)
				break
		}
		return true
	} catch (error) {
		global.logger?.error(error)
		throw error
	}
}

export function readFile(
	filePath: string,
	convert = true,
	fsTmp: typeof fs = fs,
): unknown {
	try {
		// Security: Validate path before processing
		let validatedPath: string
		if (global.__basedir) {
			validatedPath = validatePath(filePath, global.__basedir)
		} else {
			validatedPath = validatePath(filePath)
		}
		const sanitizedPath = replaceSpecialChars(validatedPath)
		let result: unknown = undefined
		if (fileExists({ filePath: sanitizedPath, fs: fsTmp })) {
			const data = fsTmp.readFileSync(sanitizedPath, {
				encoding: 'utf8',
				flag: 'r',
			})
			if (convert && filePath.indexOf('.yaml') !== -1) {
				// Security: Use JSON schema to prevent prototype pollution
				result = yaml.load(data, {
					schema: yaml.JSON_SCHEMA,
					onWarning: (warning) => {
						throw new Error(`YAML parsing ${filePath}: ${warning}`)
					},
				})
			} else if (convert && filePath.indexOf('.json') !== -1) {
				result = JSON.parse(data)
			} else if (convert && filePath.indexOf('.xml') !== -1) {
				// returns a promise
				result = convertXML(data)
			} else {
				result = data
			}
			return result
		} else {
			return undefined
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
	return new Promise((resolve, reject) => {
		try {
			// Security: Configure parser with safe options
			const parser = new Parser({
				explicitRoot: true,
				explicitArray: false,
				strict: true,
				async: false,
				normalize: true,
				trim: true,
			})
			parser.parseString(data, function (err, result) {
				if (err) throw err
				resolve(result)
			})
		} catch (error) {
			reject(error)
		}
	})
}

export function writeFile(
	fileName: string,
	data: string,
	atime: Date = new Date(),
	mtime: Date = new Date(),
	fsTmp: typeof fs = fs,
): void {
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
		fsTmp.writeFileSync(sanitizedFileName, data, { mode: 0o644 })

		// if atime or mtime are undefined, use current date/time
		const finalAtime = atime === undefined ? new Date() : atime
		const finalMtime = mtime === undefined ? new Date() : mtime

		// update XML file to match the latest atime and mtime of the files processed
		fsTmp.utimesSync(sanitizedFileName, finalAtime, finalMtime)
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

export function find(
	filename: string,
	root?: string,
	fsTmp: typeof fs = fs,
): string | null {
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

	function findFile(directory: string, filename: string): string | null {
		const file = path.join(directory, filename)

		try {
			if (fsTmp.statSync(file).isFile()) return file
			// stat existed, but isFile() returned false
			return nextLevelUp()
		} catch (e) {
			// stat did not exist
			return nextLevelUp()
		}

		function nextLevelUp(): string | null {
			// Don't proceed to the next directory when already at the fs root
			if (directory === path.resolve('/')) return null
			return findFile(path.dirname(directory), filename)
		}
	}

	return findFile(actualRoot, sanitizedFilename)
}
