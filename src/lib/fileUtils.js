'use strict'
import * as fs from 'fs'
import * as yaml from 'js-yaml'
import * as path from 'path'
import { Parser } from 'xml2js'

// Security: Utility function instead of prototype pollution
export function replaceSpecialChars(str) {
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
export function validatePath(userPath, workspaceRoot) {
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
export function sanitizeErrorPath(filePath) {
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

export function directoryExists({ dirPath, fs }) {
	dirPath = replaceSpecialChars(dirPath)
	return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()
}

export function fileExists({ filePath, fs }) {
	filePath = replaceSpecialChars(filePath)
	return fs.existsSync(filePath) && fs.statSync(filePath).isFile()
}

export function createDirectory(dirPath, fsTmp = fs) {
	dirPath = replaceSpecialChars(dirPath)
	if (!fsTmp.existsSync(dirPath)) {
		fsTmp.mkdirSync(dirPath, { recursive: true })
	}
}

export function deleteDirectory(dirPath, recursive = false, fsTmp = fs) {
	dirPath = replaceSpecialChars(dirPath)
	if (!directoryExists({ dirPath, fs: fsTmp })) {
		return false
	} else {
		if (fsTmp.existsSync(dirPath)) {
			fsTmp.readdirSync(dirPath).forEach(function (file) {
				var curPath = path.join(dirPath, file)
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
			return fsTmp.rmdirSync(dirPath)
		}
	}
}

export function getFiles(dirPath, filter = undefined, fsTmp = fs) {
	dirPath = replaceSpecialChars(dirPath)
	const filesList = []
	if (directoryExists({ dirPath, fs: fsTmp })) {
		fsTmp.readdirSync(dirPath).forEach((file) => {
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

export function getDirectories(dirPath, fsTmp = fs) {
	dirPath = replaceSpecialChars(dirPath)
	if (directoryExists({ dirPath, fs: fsTmp })) {
		return fsTmp
			.readdirSync(dirPath, { withFileTypes: true })
			.filter((dirent) => dirent.isDirectory())
			.map((dirent) => dirent.name)
	} else {
		return []
	}
}

export function deleteFile(filePath, fsTmp = fs) {
	filePath = replaceSpecialChars(filePath)
	if (!fileExists({ filePath, fs: fsTmp })) {
		return false
	} else {
		return fsTmp.unlinkSync(filePath, { recursive: false, force: true })
	}
}

export function fileInfo(filePath, fsTmp = fs) {
	filePath = replaceSpecialChars(filePath)
	return {
		dirname: path.join(path.dirname(filePath)), //something/folder/example
		basename: path.basename(filePath, path.extname(filePath)), //example
		filename: path.basename(filePath), //example.txt
		extname: path.extname(filePath), //txt
		exists: fsTmp.existsSync(filePath), //true if exists or false if not exists
		stats: fsTmp.existsSync(filePath)
			? fsTmp.statSync(filePath)
			: undefined, //stats object if exists or undefined if not exists
	}
}

export function saveFile(
	json,
	fileName,
	format = path.extname(fileName).replace('.', ''),
	fsTmp = fs,
) {
	try {
		fileName = replaceSpecialChars(fileName)
		switch (format) {
			case 'json':
				const jsonString = JSON.stringify(json, null, '\t')
				fsTmp.writeFileSync(fileName, jsonString)
				break
			case 'yaml':
				const doc = yaml.dump(json)
				fsTmp.writeFileSync(fileName, doc)
				break
		}
		return true
	} catch (error) {
		global.logger.error(error)
		throw error
	}
}

export function readFile(filePath, convert = true, fsTmp = fs) {
	try {
		// Security: Validate path before processing
		if (global.__basedir) {
			filePath = validatePath(filePath, global.__basedir)
		} else {
			filePath = validatePath(filePath)
		}
		filePath = replaceSpecialChars(filePath)
		let result = undefined
		if (fileExists({ filePath, fs: fsTmp })) {
			const data = fsTmp.readFileSync(filePath, {
				encoding: 'utf8',
				flag: 'r',
			})
			if (convert && filePath.indexOf('.yaml') != -1) {
				// Security: Use JSON schema to prevent prototype pollution
				result = yaml.load(data, {
					schema: yaml.JSON_SCHEMA,
					onWarning: (warning, filePath) => {
						throw new Error(`YAML parsing ${filePath}: ${warning}`)
					},
				})
			} else if (convert && filePath.indexOf('.json') != -1) {
				result = JSON.parse(data)
			} else if (convert && filePath.indexOf('.xml') != -1) {
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
		if (error.message && error.message.includes('/')) {
			const sanitized = new Error(
				error.message.replace(/\/[^\s]+/g, (match) =>
					sanitizeErrorPath(match),
				),
			)
			sanitized.stack = error.stack
			global.logger.error(sanitized)
			throw sanitized
		}
		global.logger.error(error)
		throw error
	}
}

async function convertXML(data) {
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
	fileName,
	data,
	atime = new Date(),
	mtime = new Date(),
	fsTmp = fs,
) {
	try {
		// Security: Validate path before writing
		if (global.__basedir) {
			fileName = validatePath(fileName, global.__basedir)
		} else {
			fileName = validatePath(fileName)
		}
		fileName = replaceSpecialChars(fileName)
		// Security: write data with restricted permissions (owner read/write, group/others read)
		fsTmp.writeFileSync(fileName, data, { mode: 0o644 })

		// if atime or mtime are undefined, use current date/time
		if (atime === undefined) atime = new Date()
		if (mtime === undefined) mtime = new Date()

		// update XML file to match the latest atime and mtime of the files processed
		fsTmp.utimesSync(fileName, atime, mtime)
	} catch (error) {
		// Security: Sanitize paths in error messages
		if (error.message && error.message.includes('/')) {
			const sanitized = new Error(
				error.message.replace(/\/[^\s]+/g, (match) =>
					sanitizeErrorPath(match),
				),
			)
			sanitized.stack = error.stack
			global.logger.error(sanitized)
			throw sanitized
		}
		global.logger.error(error)
		throw error
	}
}

export function find(filename, root, fsTmp = fs) {
	// code Copyright (c) 2014, Ben Gourley
	// https://github.com/bengourley/find-nearest-file
	root = root || process.cwd()

	if (!filename) throw new Error('filename is required')

	if (
		filename.indexOf('/') !== -1 ||
		filename === '..' ||
		filename.includes('..')
	) {
		throw new Error('filename must be just a filename and not a path')
	}

	filename = replaceSpecialChars(filename)

	function findFile(directory, filename) {
		var file = path.join(directory, filename)

		try {
			if (fsTmp.statSync(file).isFile()) return file
			// stat existed, but isFile() returned false
			return nextLevelUp()
		} catch (e) {
			// stat did not exist
			return nextLevelUp()
		}

		function nextLevelUp() {
			// Don't proceed to the next directory when already at the fs root
			if (directory === path.resolve('/')) return null
			return findFile(path.dirname(directory), filename)
		}
	}

	return findFile(root, filename)
}
