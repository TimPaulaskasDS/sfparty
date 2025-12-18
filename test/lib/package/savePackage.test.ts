import * as fs from 'fs'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as xml2js from 'xml2js'
import { Package } from '../../../src/lib/packageUtil.js'

interface FileUtilsInterface {
	fileExists: (options: { filePath: string; fs: typeof fs }) => boolean
	readFile: (filePath: string) => unknown
	createDirectory: (dirPath: string) => void
	writeFile: (fileName: string, data: string) => void
}

const fileUtils = {
	createDirectory: vi.fn(),
	writeFile: vi.fn(),
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

	it('should replace http with https in xmlns property', () => {
		pkg.savePackage(xml2js, fileUtils as unknown as FileUtilsInterface)
		if (pkg.packageJSON) {
			expect(pkg.packageJSON.Package.$.xmlns).toBe(
				'https://www.example.com',
			)
		}
	})

	it('should save version property to variable, delete it from json and set it again', () => {
		if (pkg.packageJSON) {
			const version = pkg.packageJSON.Package.version
			pkg.savePackage(xml2js, fileUtils as unknown as FileUtilsInterface)
			expect(version).toBe('1.0')
			if (pkg.packageJSON) {
				expect(pkg.packageJSON.Package.version).toBe(version)
			}
		}
	})

	it('should build xml object from json and write it to a file', () => {
		pkg.addMember('type', 'member')
		expect(pkg.packageJSON?.Package.types?.[0]?.name).toBe('type')
		expect(pkg.packageJSON?.Package.types?.[0]?.members).toEqual(['member'])
		pkg.savePackage(xml2js, fileUtils as unknown as FileUtilsInterface)
		const xml =
			'<?xml version="1.0" encoding="UTF-8"?>\n<Package xmlns="https://www.example.com">\n  <types>\n    <members>member</members>\n    <name>type</name>\n  </types>\n  <version>1.0</version>\n</Package>'
		expect(fileUtils.createDirectory).toHaveBeenCalledWith(
			path.dirname('path/to/file.xml'),
		)
		expect(fileUtils.writeFile).toHaveBeenCalledWith(
			'path/to/file.xml',
			xml,
		)
	})

	it('should throw an error if it occurs', () => {
		vi.mocked(fileUtils.createDirectory).mockImplementation(() => {
			throw new Error('createDirectory error')
		})
		expect(() => {
			pkg.savePackage(xml2js, fileUtils as unknown as FileUtilsInterface)
		}).toThrowError('createDirectory error')
	})

	it('should throw an error if packageJSON is undefined', () => {
		pkg.packageJSON = undefined
		expect(() => {
			pkg.savePackage(xml2js, fileUtils as unknown as FileUtilsInterface)
		}).toThrowError('Package JSON is undefined')
	})
})
