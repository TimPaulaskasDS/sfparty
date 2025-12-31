import * as fs from 'fs'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Package } from '../../../src/lib/packageUtil.js'

interface FileUtilsInterface {
	fileExists: (options: {
		filePath: string
		fs: typeof fs
	}) => Promise<boolean>
	readFile: (filePath: string) => Promise<unknown>
	createDirectory: (dirPath: string) => Promise<void>
	writeFile: (fileName: string, data: string) => Promise<void>
}

const fileUtils = {
	createDirectory: vi.fn().mockResolvedValue(undefined),
	writeFile: vi.fn().mockResolvedValue(undefined),
}

// Mock XMLBuilder as a class constructor
class MockXMLBuilder {
	build(data: unknown): string {
		// Simple XML serialization for testing
		const packageData = data as { Package: Record<string, unknown> }
		const json = packageData.Package
		let xml = '<Package'
		if (json.$ && typeof json.$ === 'object') {
			const attrs = json.$ as Record<string, string>
			for (const [key, value] of Object.entries(attrs)) {
				xml += ` ${key}="${value}"`
			}
		}
		xml += '>'
		if (json.types && Array.isArray(json.types)) {
			for (const type of json.types) {
				xml += '<types>'
				if (type.members && Array.isArray(type.members)) {
					for (const member of type.members) {
						xml += `<members>${member}</members>`
					}
				}
				if (type.name) {
					xml += `<name>${type.name}</name>`
				}
				xml += '</types>'
			}
		}
		if (json.version) {
			xml += `<version>${json.version}</version>`
		}
		xml += '</Package>'
		return xml
	}
}

const xml2js = {
	XMLBuilder: MockXMLBuilder,
}

describe('savePackage', () => {
	let pkg: Package
	beforeEach(() => {
		pkg = new Package('path/to/file.xml')
		pkg.packageJSON = {
			Package: {
				$: { xmlns: 'http://www.example.com' },
				version: '1.0',
			},
		}
	})

	afterEach(() => {
		vi.resetAllMocks()
	})

	it('should replace http with https in xmlns property', async () => {
		await pkg.savePackage(
			xml2js,
			fileUtils as unknown as FileUtilsInterface,
		)
		if (pkg.packageJSON) {
			expect(pkg.packageJSON.Package.$.xmlns).toBe(
				'https://www.example.com',
			)
		}
	})

	it('should save version property to variable, delete it from json and set it again', async () => {
		if (pkg.packageJSON) {
			const version = pkg.packageJSON.Package.version
			await pkg.savePackage(
				xml2js,
				fileUtils as unknown as FileUtilsInterface,
			)
			expect(version).toBe('1.0')
			if (pkg.packageJSON) {
				expect(pkg.packageJSON.Package.version).toBe(version)
			}
		}
	})

	it('should build xml object from json and write it to a file', async () => {
		pkg.addMember('type', 'member')
		expect(pkg.packageJSON?.Package.types?.[0]?.name).toBe('type')
		expect(pkg.packageJSON?.Package.types?.[0]?.members).toEqual(['member'])
		await pkg.savePackage(
			xml2js,
			fileUtils as unknown as FileUtilsInterface,
		)
		expect(fileUtils.createDirectory).toHaveBeenCalledWith(
			path.dirname('path/to/file.xml'),
		)
		expect(fileUtils.writeFile).toHaveBeenCalledWith(
			'path/to/file.xml',
			expect.stringContaining('<?xml version="1.0" encoding="UTF-8"?>'),
		)
		expect(fileUtils.writeFile).toHaveBeenCalledWith(
			'path/to/file.xml',
			expect.stringContaining('xmlns="https://www.example.com"'),
		)
		expect(fileUtils.writeFile).toHaveBeenCalledWith(
			'path/to/file.xml',
			expect.stringContaining('<members>member</members>'),
		)
		expect(fileUtils.writeFile).toHaveBeenCalledWith(
			'path/to/file.xml',
			expect.stringContaining('<name>type</name>'),
		)
		expect(fileUtils.writeFile).toHaveBeenCalledWith(
			'path/to/file.xml',
			expect.stringContaining('<version>1.0</version>'),
		)
	})

	it('should throw an error if it occurs', async () => {
		fileUtils.createDirectory.mockRejectedValueOnce(
			new Error('createDirectory error'),
		)
		await expect(
			pkg.savePackage(xml2js, fileUtils as unknown as FileUtilsInterface),
		).rejects.toThrow('createDirectory error')
	})

	it('should throw an error if packageJSON is undefined', async () => {
		pkg.packageJSON = undefined
		await expect(
			pkg.savePackage(xml2js, fileUtils as unknown as FileUtilsInterface),
		).rejects.toThrow('Package JSON is undefined')
	})
})
