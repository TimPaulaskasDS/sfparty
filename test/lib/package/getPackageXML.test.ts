import * as fs from 'fs'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
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
beforeEach(() => {
	pkg = new Package('xmlPath')
	global.git = undefined
})

afterEach(() => {
	vi.clearAllMocks()
})

it('should default the package if the json is empty', async () => {
	vi.mocked(fileUtils.fileExists).mockReturnValue(true)
	vi.mocked(fileUtils.readFile).mockResolvedValue({})
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
	vi.mocked(fileUtils.fileExists).mockReturnValue(true)
	vi.mocked(fileUtils.readFile).mockResolvedValue(
		packageDefinition.metadataDefinition.emptyPackage,
	)
	global.git = { append: true }
	const result = await pkg.getPackageXML(fileUtils)
	expect(result).toBe('existing')
	expect(fileUtils.fileExists).toHaveBeenCalled()
	expect(fileUtils.readFile).toHaveBeenCalled()
})

it('should create an empty pkg JSON and call processJSON', async () => {
	vi.mocked(fileUtils.fileExists).mockReturnValue(false)
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
	vi.mocked(fileUtils.fileExists).mockReturnValue(true)
	vi.mocked(fileUtils.readFile).mockRejectedValue(new Error('Error'))
	global.git = { append: true }
	await expect(pkg.getPackageXML(fileUtils)).rejects.toThrowError('Error')
})

it('should catch errors and reject the promise', async () => {
	vi.mocked(fileUtils.fileExists).mockReturnValue(true)
	vi.mocked(fileUtils.readFile).mockRejectedValue(new Error('Test Error'))
	global.git = { append: true }
	try {
		await pkg.getPackageXML(fileUtils)
	} catch (error) {
		expect(error).toBeInstanceOf(Error)
		expect((error as Error).message).toEqual('Test Error')
	}
})

it('should default to an empty package if the read file is empty', async () => {
	vi.mocked(fileUtils.fileExists).mockReturnValue(true)
	vi.mocked(fileUtils.readFile).mockResolvedValue('')
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
	vi.mocked(fileUtils.fileExists).mockReturnValue(true)
	vi.mocked(fileUtils.readFile).mockRejectedValue(new Error('Test Error'))
	global.git = { append: true }
	await expect(pkg.getPackageXML(fileUtils)).rejects.toThrowError(
		'Test Error',
	)
	expect(fileUtils.fileExists).toHaveBeenCalled()
	expect(fileUtils.readFile).toHaveBeenCalled()
})

it('should correctly process the json object returned from the XML file', async () => {
	vi.mocked(fileUtils.fileExists).mockReturnValue(true)
	vi.mocked(fileUtils.readFile).mockResolvedValueOnce({
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
	vi.mocked(fileUtils.readFile).mockImplementationOnce(() => {
		return { sourceApiVersion: '56.0' }
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
	vi.mocked(fileUtils.fileExists).mockReturnValue(true)
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
	vi.mocked(fileUtils.fileExists).mockReturnValue(true)
	vi.mocked(fileUtils.readFile).mockResolvedValue({
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
	vi.mocked(fileUtils.fileExists).mockReturnValue(true)
	// Create a value that will cause toString to throw when xml2json processes it
	// We need to create an array with one element that has a toString that throws
	const problematicValue = {
		toString: () => {
			throw new Error('toString error')
		},
	}
	vi.mocked(fileUtils.readFile).mockResolvedValue({
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
	vi.mocked(fileUtils.fileExists).mockReturnValue(true)
	vi.mocked(fileUtils.readFile).mockResolvedValue({
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
	vi.mocked(fileUtils.fileExists).mockReturnValue(true)
	vi.mocked(fileUtils.readFile).mockResolvedValue(undefined)
	global.git = { append: true }
	const result = await pkg.getPackageXML(fileUtils)
	expect(result).toBe('existing')
	expect(pkg.packageJSON).toEqual(
		packageDefinition.metadataDefinition.emptyPackage,
	)
})

it('should handle array members with single string value', async () => {
	vi.mocked(fileUtils.fileExists).mockReturnValue(true)
	vi.mocked(fileUtils.readFile).mockResolvedValue({
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
	vi.mocked(fileUtils.fileExists).mockReturnValue(true)
	vi.mocked(fileUtils.readFile).mockReturnValue({
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
	vi.mocked(fileUtils.fileExists).mockReturnValue(true)
	vi.mocked(fileUtils.readFile).mockReturnValue({})
	global.git = { append: true }
	const result = await pkg.getPackageXML(fileUtils)
	expect(result).toBe('existing')
	expect(pkg.packageJSON).toEqual(
		packageDefinition.metadataDefinition.emptyPackage,
	)
})

it('should handle processJSON with fileUtils when readFile throws', async () => {
	vi.mocked(fileUtils.fileExists).mockReturnValue(true)
	vi.mocked(fileUtils.readFile).mockImplementation((filePath: string) => {
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
	vi.mocked(fileUtils.fileExists).mockReturnValue(true)
	vi.mocked(fileUtils.readFile).mockImplementation((filePath: string) => {
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
	vi.mocked(fileUtils.fileExists).mockReturnValue(true)
	vi.mocked(fileUtils.readFile).mockImplementation(() => {
		throw new Error('Read error')
	})
	global.git = { append: true }
	await expect(pkg.getPackageXML(fileUtils)).rejects.toThrow('Read error')
})

it('should handle cleanPackage when types is undefined', async () => {
	vi.mocked(fileUtils.fileExists).mockReturnValue(false)
	const result = await pkg.getPackageXML(fileUtils)
	expect(result).toBe('not found')
	if (pkg.packageJSON) {
		expect(pkg.packageJSON.Package.types).toBeUndefined()
	}
})

it('should reject when readFile promise rejects in catch block', async () => {
	// Test line 115: reject(error) in catch block
	vi.mocked(fileUtils.fileExists).mockReturnValue(true)
	vi.mocked(fileUtils.readFile).mockImplementation(() => {
		return Promise.reject(new Error('Read failed'))
	})
	global.git = { append: true }
	await expect(pkg.getPackageXML(fileUtils)).rejects.toThrow('Read failed')
})

it('should reject when creating new package fails', async () => {
	// Test line 129: reject(error) in catch block when creating new package
	vi.mocked(fileUtils.fileExists).mockReturnValue(false)
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
	vi.mocked(fileUtils.fileExists).mockReturnValue(false)

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
	vi.mocked(fileUtils.fileExists).mockReturnValue(false)

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
					return (target as Record<string, unknown>)[prop]
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
