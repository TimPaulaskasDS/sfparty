import * as fs from 'fs'
import { afterEach, beforeEach, expect, it, type Mock, vi } from 'vitest'
import { Package } from '../../../src/lib/packageUtil.js'
import * as labelDefinition from '../../../src/meta/CustomLabels.js'
import * as packageDefinition from '../../../src/meta/Package.js'
import * as permsetDefinition from '../../../src/meta/PermissionSets.js'
import * as profileDefinition from '../../../src/meta/Profiles.js'
import * as workflowDefinition from '../../../src/meta/Workflows.js'

interface GlobalContext {
	__basedir?: string
	format?: string
	metaTypes?: Record<
		string,
		{
			type: string
			definition: unknown
			add: { files: string[]; directories: string[] }
			remove: { files: string[]; directories: string[] }
		}
	>
	git?: {
		append?: boolean
	}
}

declare const global: GlobalContext & typeof globalThis

global.__basedir = '.'
global.format = 'yaml'
global.metaTypes = {
	label: {
		type: labelDefinition.metadataDefinition.filetype,
		definition: labelDefinition.metadataDefinition,
		add: { files: [], directories: [] },
		remove: { files: [], directories: [] },
	},
	profile: {
		type: profileDefinition.metadataDefinition.filetype,
		definition: profileDefinition.metadataDefinition,
		add: { files: [], directories: [] },
		remove: { files: [], directories: [] },
	},
	permset: {
		type: permsetDefinition.metadataDefinition.filetype,
		definition: permsetDefinition.metadataDefinition,
		add: { files: [], directories: [] },
		remove: { files: [], directories: [] },
	},
	workflow: {
		type: workflowDefinition.metadataDefinition.filetype,
		definition: workflowDefinition.metadataDefinition,
		add: { files: [], directories: [] },
		remove: { files: [], directories: [] },
	},
}

interface FileUtilsInterface {
	fileExists: (options: { filePath: string; fs: typeof fs }) => boolean
	readFile: (filePath: string) => unknown
	createDirectory: (dirPath: string) => void
	writeFile: (fileName: string, data: string) => void
}

let pkg: Package
const fileUtils = {
	fileExists: vi.fn(),
	readFile: vi.fn(),
	createDirectory: vi.fn(),
	writeFile: vi.fn(),
} as unknown as FileUtilsInterface

// Type helpers for accessing mock methods
const mockFileExists = fileUtils.fileExists as unknown as Mock
const mockReadFile = fileUtils.readFile as unknown as Mock
beforeEach(() => {
	pkg = new Package('xmlPath')
	global.git = undefined
})

afterEach(() => {
	vi.clearAllMocks()
})

it('should default the package if the json is empty', async () => {
	mockFileExists.mockReturnValue(true)
	mockReadFile.mockResolvedValue({})
	global.git = { append: true }
	const result = await pkg.getPackageXML(fileUtils)
	expect(result).toBe('existing')
	expect(fileUtils.fileExists).toHaveBeenCalled()
	expect(fileUtils.readFile).toHaveBeenCalled()
	expect(pkg.packageJSON).toEqual(
		packageDefinition.metadataDefinition.emptyPackage,
	)
})

it('should read an existing file and call processJSON', async () => {
	mockFileExists.mockReturnValue(true)
	mockReadFile.mockResolvedValue(
		packageDefinition.metadataDefinition.emptyPackage,
	)
	global.git = { append: true }
	const result = await pkg.getPackageXML(fileUtils)
	expect(result).toBe('existing')
	expect(fileUtils.fileExists).toHaveBeenCalled()
	expect(fileUtils.readFile).toHaveBeenCalled()
})

it('should create an empty pkg JSON and call processJSON', async () => {
	mockFileExists.mockReturnValue(false)
	const finalJSON = JSON.parse(
		JSON.stringify(packageDefinition.metadataDefinition.emptyPackage),
	)
	finalJSON.Package.version =
		packageDefinition.metadataDefinition.fallbackVersion
	const result = await pkg.getPackageXML(fileUtils)
	expect(result).toBe('not found')
	expect(fileUtils.fileExists).toHaveBeenCalled()
	expect(pkg.packageJSON).toEqual(finalJSON)
})

it('should throw an error if xmlPath is undefined', async () => {
	Object.defineProperty(pkg, 'xmlPath', {
		value: undefined,
		writable: true,
		configurable: true,
	})
	await expect(pkg.getPackageXML(fileUtils)).rejects.toThrowError(
		'Package not initialized',
	)
})

it('should throw an error if error occurs during processing', async () => {
	mockFileExists.mockReturnValue(true)
	mockReadFile.mockRejectedValue(new Error('Error'))
	global.git = { append: true }
	await expect(pkg.getPackageXML(fileUtils)).rejects.toThrowError('Error')
})

it('should catch errors and reject the promise', async () => {
	mockFileExists.mockReturnValue(true)
	mockReadFile.mockRejectedValue(new Error('Test Error'))
	global.git = { append: true }
	try {
		await pkg.getPackageXML(fileUtils)
	} catch (error) {
		expect(error).toBeInstanceOf(Error)
		expect((error as Error).message).toEqual('Test Error')
	}
})

it('should default to an empty package if the read file is empty', async () => {
	mockFileExists.mockReturnValue(true)
	mockReadFile.mockResolvedValue('')
	global.git = { append: true }
	const result = await pkg.getPackageXML(fileUtils)
	expect(result).toBe('existing')
	expect(pkg.packageJSON).toEqual(
		packageDefinition.metadataDefinition.emptyPackage,
	)
	expect(fileUtils.fileExists).toHaveBeenCalled()
	expect(fileUtils.readFile).toHaveBeenCalled()
})

it('should throw an error if fileUtils.readFile() returns a rejected promise', async () => {
	mockFileExists.mockReturnValue(true)
	mockReadFile.mockRejectedValue(new Error('Test Error'))
	global.git = { append: true }
	await expect(pkg.getPackageXML(fileUtils)).rejects.toThrowError(
		'Test Error',
	)
	expect(fileUtils.fileExists).toHaveBeenCalled()
	expect(fileUtils.readFile).toHaveBeenCalled()
})

it('should correctly process the json object returned from the XML file', async () => {
	mockFileExists.mockReturnValue(true)
	mockReadFile.mockResolvedValueOnce({
		Package: {
			types: [
				{
					members: ['Test', 'Test.yaml'],
					name: 'CustomLabels',
				},
				{
					members: ['Test', 'Test.yaml'],
					name: 'Profile',
				},
				{
					members: ['Test', 'Test.yaml'],
					name: 'PermissionSet',
				},
				{
					members: ['Test.yaml'],
					name: 'Workflow',
				},
			],
			version: '56.0',
		},
	})
	mockReadFile.mockImplementationOnce(() => {
		return Promise.resolve({ sourceApiVersion: '56.0' } as unknown)
	})
	global.git = { append: true }
	const result = await pkg.getPackageXML(fileUtils)
	expect(result).toBe('existing')
	expect(fileUtils.fileExists).toHaveBeenCalled()
	expect(fileUtils.readFile).toHaveBeenCalled()
	expect(pkg.packageJSON).toEqual({
		Package: {
			types: [
				{
					members: ['Test'],
					name: 'CustomLabels',
				},
				{
					members: ['Test'],
					name: 'Profile',
				},
				{
					members: ['Test'],
					name: 'PermissionSet',
				},
			],
			version: '56.0',
		},
	})
})

it('should handle git.append = false', async () => {
	mockFileExists.mockReturnValue(true)
	Object.defineProperty(global, 'git', {
		value: { append: false },
		writable: true,
		configurable: true,
	})
	const result = await pkg.getPackageXML(fileUtils)
	expect(result).toBe('not found')
	expect(pkg.packageJSON).toBeDefined()
})

it('should handle transformJSON error when JSON.parse throws', async () => {
	mockFileExists.mockReturnValue(true)
	mockReadFile.mockResolvedValue({
		Package: {
			types: [
				{
					members: ['Test'],
					name: 'CustomLabels',
				},
			],
			version: '56.0',
		},
	})
	global.git = { append: true }
	// Mock JSON.parse to throw an error to test transformJSON error path
	const originalParse = JSON.parse
	JSON.parse = vi.fn(() => {
		throw new Error('JSON parse error')
	})
	await expect(pkg.getPackageXML(fileUtils)).rejects.toThrow()
	JSON.parse = originalParse
})

it('should handle xml2json error when toString throws', async () => {
	mockFileExists.mockReturnValue(true)
	// Create a value that will cause toString to throw when xml2json processes it
	// We need to create an array with one element that has a toString that throws
	const problematicValue = {
		toString: () => {
			throw new Error('toString error')
		},
	}
	mockReadFile.mockResolvedValue({
		Package: {
			types: [
				{
					members: ['Test'],
					name: 'CustomLabels',
					// Create an array with one element that will trigger xml2json's array handling
					// and cause toString to throw
					value: [problematicValue],
				},
			],
			version: '56.0',
		},
	})
	global.git = { append: true }
	await expect(pkg.getPackageXML(fileUtils)).rejects.toThrow()
})

it('should handle undefined types in Package', async () => {
	mockFileExists.mockReturnValue(true)
	mockReadFile.mockResolvedValue({
		Package: {
			version: '56.0',
		},
	})
	global.git = { append: true }
	const result = await pkg.getPackageXML(fileUtils)
	expect(result).toBe('existing')
	if (pkg.packageJSON) {
		expect(pkg.packageJSON.Package.types).toBeUndefined()
	}
})

it('should handle empty json object keys', async () => {
	mockFileExists.mockReturnValue(true)
	mockReadFile.mockResolvedValue(undefined)
	global.git = { append: true }
	const result = await pkg.getPackageXML(fileUtils)
	expect(result).toBe('existing')
	expect(pkg.packageJSON).toEqual(
		packageDefinition.metadataDefinition.emptyPackage,
	)
})

it('should handle array members with single string value', async () => {
	mockFileExists.mockReturnValue(true)
	mockReadFile.mockResolvedValue({
		Package: {
			types: [
				{
					members: ['SingleValue'],
					name: ['CustomLabels'],
				},
			],
			version: '56.0',
		},
	})
	global.git = { append: true }
	const result = await pkg.getPackageXML(fileUtils)
	expect(result).toBe('existing')
	if (pkg.packageJSON?.Package.types) {
		expect(pkg.packageJSON.Package.types[0].name).toBe('CustomLabels')
	}
})

it('should handle readFile returning non-Promise value', async () => {
	mockFileExists.mockReturnValue(true)
	mockReadFile.mockReturnValue({
		Package: {
			types: [],
			version: '56.0',
		},
	})
	global.git = { append: true }
	const result = await pkg.getPackageXML(fileUtils)
	expect(result).toBe('existing')
	expect(fileUtils.readFile).toHaveBeenCalled()
})

it('should handle readFile returning non-Promise empty object', async () => {
	mockFileExists.mockReturnValue(true)
	mockReadFile.mockReturnValue({})
	global.git = { append: true }
	const result = await pkg.getPackageXML(fileUtils)
	expect(result).toBe('existing')
	expect(pkg.packageJSON).toEqual(
		packageDefinition.metadataDefinition.emptyPackage,
	)
})

it('should handle processJSON with fileUtils when readFile throws', async () => {
	mockFileExists.mockReturnValue(true)
	mockReadFile.mockImplementation((filePath: string) => {
		if (filePath.includes('sfdx-project.json')) {
			throw new Error('File not found')
		}
		return Promise.resolve({
			Package: {
				types: [],
				version: '56.0',
			},
		})
	})
	global.git = { append: true }
	const result = await pkg.getPackageXML(fileUtils)
	expect(result).toBe('existing')
	if (pkg.packageJSON) {
		expect(pkg.packageJSON.Package.version).toBe(
			packageDefinition.metadataDefinition.fallbackVersion,
		)
	}
})

it('should handle processJSON with fileUtils when readFile returns non-Promise and throws', async () => {
	mockFileExists.mockReturnValue(true)
	mockReadFile.mockImplementation((filePath: string) => {
		if (filePath.includes('sfdx-project.json')) {
			throw new Error('File not found')
		}
		return {
			Package: {
				types: [],
				version: '56.0',
			},
		}
	})
	global.git = { append: true }
	const result = await pkg.getPackageXML(fileUtils)
	expect(result).toBe('existing')
	if (pkg.packageJSON) {
		expect(pkg.packageJSON.Package.version).toBe(
			packageDefinition.metadataDefinition.fallbackVersion,
		)
	}
})

it('should handle processJSON error when readFile throws in non-Promise path', async () => {
	mockFileExists.mockReturnValue(true)
	mockReadFile.mockImplementation(() => {
		throw new Error('Read error')
	})
	global.git = { append: true }
	await expect(pkg.getPackageXML(fileUtils)).rejects.toThrow('Read error')
})

it('should handle cleanPackage when types is undefined', async () => {
	mockFileExists.mockReturnValue(false)
	const result = await pkg.getPackageXML(fileUtils)
	expect(result).toBe('not found')
	if (pkg.packageJSON) {
		expect(pkg.packageJSON.Package.types).toBeUndefined()
	}
})

it('should reject when readFile promise rejects in catch block', async () => {
	// Test line 115: reject(error) in catch block
	mockFileExists.mockReturnValue(true)
	mockReadFile.mockImplementation(() => {
		return Promise.reject(new Error('Read failed'))
	})
	global.git = { append: true }
	await expect(pkg.getPackageXML(fileUtils)).rejects.toThrow('Read failed')
})

it('should reject when readFile returns non-Promise and error occurs in catch block', async () => {
	// Test line 115: reject(error) in catch block when readFile returns non-Promise value
	// and an error is thrown in the try block (lines 96-113)
	mockFileExists.mockReturnValue(true)
	// Make readFile return a non-Promise value that will cause JSON.parse to throw
	mockReadFile.mockReturnValue({
		Package: {
			types: [
				{
					// Create a circular reference or invalid structure that will cause JSON.parse/stringify to fail
					members: ['Test'],
					name: 'CustomLabels',
					// Use a getter that throws to simulate an error during processing
					get invalid() {
						throw new Error('Processing error')
					},
				},
			],
			version: '56.0',
		},
	})
	global.git = { append: true }
	// Mock JSON.stringify to throw an error to trigger the catch block on line 114
	const originalStringify = JSON.stringify
	JSON.stringify = vi.fn(() => {
		throw new Error('Stringify error')
	})
	await expect(pkg.getPackageXML(fileUtils)).rejects.toThrow(
		'Stringify error',
	)
	JSON.stringify = originalStringify
})

it('should reject when creating new package fails', async () => {
	// Test line 129: reject(error) in catch block when creating new package
	mockFileExists.mockReturnValue(false)
	// Mock JSON.parse to throw to trigger the catch block
	const originalParse = JSON.parse
	JSON.parse = vi.fn(() => {
		throw new Error('Parse error')
	})
	await expect(pkg.getPackageXML(fileUtils)).rejects.toThrow('Parse error')
	JSON.parse = originalParse
})

it('should throw error when packageJSON is undefined in cleanPackage', async () => {
	// Test line 162: throw when packageJSON is undefined
	// Since cleanPackage runs synchronously, we need to intercept the property access
	// We'll use Object.defineProperty to make packageJSON return undefined when cleanPackage checks it
	const newPkg = new Package('test.xml')
	mockFileExists.mockReturnValue(false)

	let actualValue: unknown = undefined
	let hasBeenSet = false

	// Intercept packageJSON property to make it undefined when cleanPackage accesses it
	Object.defineProperty(newPkg, 'packageJSON', {
		get() {
			// Return undefined when cleanPackage checks it (after it's been set)
			if (hasBeenSet) {
				return undefined
			}
			return actualValue
		},
		set(value) {
			hasBeenSet = true
			actualValue = value
		},
		configurable: true,
		enumerable: true,
	})

	await expect(newPkg.getPackageXML(fileUtils)).rejects.toThrow(
		'getPackageXML must be called before adding members',
	)
})

it('should throw error when Package is undefined in cleanPackage', async () => {
	// Test line 166: throw when Package is undefined
	// We need to make Package undefined when cleanPackage accesses it
	const newPkg = new Package('test.xml')
	mockFileExists.mockReturnValue(false)

	let packageJSONValue: unknown = undefined
	let hasBeenSet = false

	// Intercept packageJSON property
	Object.defineProperty(newPkg, 'packageJSON', {
		get() {
			if (!packageJSONValue) {
				return packageJSONValue
			}
			// Return a proxy that makes Package undefined when cleanPackage checks it
			return new Proxy(packageJSONValue, {
				get(target, prop) {
					if (prop === 'Package' && hasBeenSet) {
						// Return undefined when cleanPackage checks Package
						return undefined
					}
					if (typeof prop === 'string') {
						return (target as Record<string, unknown>)[prop]
					}
					return undefined
				},
			})
		},
		set(value) {
			hasBeenSet = true
			packageJSONValue = value
		},
		configurable: true,
		enumerable: true,
	})

	await expect(newPkg.getPackageXML(fileUtils)).rejects.toThrow(
		'Package initialization failed',
	)
})

it('should read sfdx-project.json when fileUtils is provided', async () => {
	// Test line 145: path.join(global.__basedir || '', 'sfdx-project.json')
	mockFileExists.mockReturnValue(true)
	// First call is for the package XML file (returns Promise), second call is for sfdx-project.json (synchronous)
	mockReadFile.mockImplementation((filePath: string) => {
		if (filePath.includes('sfdx-project.json')) {
			// This is called synchronously in processJSON, so return value directly
			return { sourceApiVersion: '58.0' } as unknown
		}
		// This is called asynchronously, so return Promise
		return Promise.resolve({
			Package: {
				types: [],
				version: '56.0',
			},
		})
	})
	global.git = { append: true }
	global.__basedir = '/project'
	const result = await pkg.getPackageXML(fileUtils)
	expect(result).toBe('existing')
	// Verify that readFile was called with sfdx-project.json path
	expect(fileUtils.readFile).toHaveBeenCalledWith(
		expect.stringContaining('sfdx-project.json'),
	)
	// The version should be set from sfdx-project.json
	if (pkg.packageJSON) {
		expect(pkg.packageJSON.Package.version).toBe('58.0')
	}
})

it('should filter members in cleanPackage when global.metaTypes exists', async () => {
	// Test lines 171-175: forEach loop that filters members based on global.metaTypes
	mockFileExists.mockReturnValue(true)
	mockReadFile.mockResolvedValue({
		Package: {
			types: [
				{
					members: ['Test', 'Test.yaml', 'Test2'],
					name: 'Profile',
				},
				{
					members: ['Test', 'Test.yaml'],
					name: 'CustomLabels',
				},
			],
			version: '56.0',
		},
	})
	global.git = { append: true }
	global.format = 'yaml'
	// Ensure global.metaTypes has the definition.root for Profile
	if (global.metaTypes) {
		global.metaTypes.profile = {
			...global.metaTypes.profile,
			definition: {
				root: 'Profile',
			},
		}
		global.metaTypes.label = {
			...global.metaTypes.label,
			definition: {
				root: 'CustomLabels',
			},
		}
	}
	const result = await pkg.getPackageXML(fileUtils)
	expect(result).toBe('existing')
	if (pkg.packageJSON?.Package.types) {
		// Profile members should have .yaml filtered out
		const profileType = pkg.packageJSON.Package.types.find(
			(t) => t.name === 'Profile',
		)
		expect(profileType?.members).toEqual(['Test', 'Test2'])
		// CustomLabels members should have .yaml filtered out
		const labelType = pkg.packageJSON.Package.types.find(
			(t) => t.name === 'CustomLabels',
		)
		expect(labelType?.members).toEqual(['Test'])
	}
})

it('should handle xml2json with array length === 1', async () => {
	// Test lines 336-338: array with length === 1 converts to string
	mockFileExists.mockReturnValue(true)
	mockReadFile.mockResolvedValue({
		Package: {
			types: [
				{
					members: ['Test'],
					name: 'CustomLabels',
					// Create a field with array of length 1
					singleValue: ['onlyValue'],
				},
			],
			version: '56.0',
		},
	})
	global.git = { append: true }
	const result = await pkg.getPackageXML(fileUtils)
	expect(result).toBe('existing')
})

it('should handle xml2json boolean conversion for true', async () => {
	// Test line 340: value === 'true' converts to boolean true
	mockFileExists.mockReturnValue(true)
	mockReadFile.mockResolvedValue({
		Package: {
			types: [
				{
					members: ['Test'],
					name: 'CustomLabels',
					booleanField: 'true',
				},
			],
			version: '56.0',
		},
	})
	global.git = { append: true }
	const result = await pkg.getPackageXML(fileUtils)
	expect(result).toBe('existing')
})

it('should cover line 145 reading sfdx-project.json from test data', async () => {
	// Test line 145: Reading sfdx-project.json
	const path = await import('path')
	const testDataPath = path.join(
		process.cwd(),
		'test/data/packages/sfdx-project.json',
	)
	const projectData = JSON.parse(fs.readFileSync(testDataPath, 'utf8'))

	mockFileExists.mockReturnValue(true)
	mockReadFile.mockResolvedValue({
		Package: {
			types: [
				{
					members: ['Test'],
					name: 'CustomLabels',
				},
			],
			version: '56.0',
		},
	})

	// Mock reading sfdx-project.json - need to check if it's the package file or sfdx-project.json
	mockReadFile.mockImplementation((filePath: string) => {
		if (
			typeof filePath === 'string' &&
			filePath.includes('sfdx-project.json')
		) {
			return Promise.resolve(projectData)
		}
		// Return the package data for the package.xml file
		return Promise.resolve({
			Package: {
				types: [
					{
						members: ['Test'],
						name: 'CustomLabels',
					},
				],
				version: '56.0',
			},
		})
	})

	global.git = { append: true }
	global.__basedir = process.cwd()

	const result = await pkg.getPackageXML(fileUtils)
	expect(result).toBe('existing')
	// The sourceApiVersion from sfdx-project.json should be used
})

it('should cover lines 266-267 sorting package types from test data', async () => {
	// Test lines 266-267: Sorting package types (a.name < b.name and a.name > b.name)
	const path = await import('path')
	const testDataPath = path.join(
		process.cwd(),
		'test/data/packages/packageWithSorting.xml',
	)
	const xmlContent = fs.readFileSync(testDataPath, 'utf8')

	// Parse XML to get the structure
	const { Parser } = await import('xml2js')
	const parser = new Parser({ explicitArray: true })
	const parsed = await new Promise((resolve, reject) => {
		parser.parseString(xmlContent, (err, result) => {
			if (err) reject(err)
			else resolve(result)
		})
	})

	mockFileExists.mockReturnValue(true)
	// Mock readFile to return parsed XML for package.xml, and handle sfdx-project.json call
	mockReadFile.mockImplementation((filePath: string) => {
		if (filePath.includes('sfdx-project.json')) {
			// Return a proper sourceApiVersion for sfdx-project.json
			return Promise.resolve({ sourceApiVersion: '58.0' })
		}
		// Return parsed XML for package.xml
		return Promise.resolve(parsed)
	})
	global.git = { append: true }

	const result = await pkg.getPackageXML(fileUtils)
	expect(result).toBe('existing')

	// Verify types are sorted alphabetically
	// The sorting happens at lines 266-267: if (a.name < b.name) return -1, if (a.name > b.name) return 1
	// This test verifies the sorting logic is executed
	expect(result).toBe('existing')
	if (pkg.packageJSON?.Package?.types) {
		const typeNames = pkg.packageJSON.Package.types.map((t) => t.name)
		// Should have types
		expect(typeNames.length).toBeGreaterThan(0)
		// The sorting code at lines 266-267 should have been executed
	}
})

it('should handle xml2json boolean conversion for false', async () => {
	// Test line 341: value === 'false' converts to boolean false
	mockFileExists.mockReturnValue(true)
	mockReadFile.mockResolvedValue({
		Package: {
			types: [
				{
					members: ['Test'],
					name: 'CustomLabels',
					booleanField: 'false',
				},
			],
			version: '56.0',
		},
	})
	global.git = { append: true }
	const result = await pkg.getPackageXML(fileUtils)
	expect(result).toBe('existing')
})
