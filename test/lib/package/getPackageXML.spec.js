import fs from 'fs'
import * as packageDefinition from '../../../src/meta/Package.js'
import { Package } from '../../../src/lib/packageUtil.js'
import * as labelDefinition from '../../../src/meta/CustomLabels.js'
import * as profileDefinition from '../../../src/meta/Profiles.js'
import * as permsetDefinition from '../../../src/meta/PermissionSets.js'
import * as workflowDefinition from '../../../src/meta/Workflows.js'

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

let pkg
const fileUtils = {
	fileExists: jest.fn(),
	readFile: jest.fn(),
}
beforeEach(() => {
	pkg = new Package('xmlPath')
})

afterEach(() => {
	jest.clearAllMocks()
})

it('should default the package if the json is empty', async () => {
	fileUtils.fileExists.mockReturnValue(true)
	fileUtils.readFile.mockResolvedValue({})
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
	fileUtils.fileExists.mockReturnValue(true)
	fileUtils.readFile.mockResolvedValue(
		packageDefinition.metadataDefinition.emptyPackage,
	)
	global.git = { append: true }
	const result = await pkg.getPackageXML(fileUtils)
	expect(result).toBe('existing')
	expect(fileUtils.fileExists).toHaveBeenCalled()
	expect(fileUtils.readFile).toHaveBeenCalled()
})

it('should create an empty pkg JSON and call processJSON', async () => {
	fileUtils.fileExists.mockReturnValue(false)
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
	pkg.xmlPath = undefined
	await expect(pkg.getPackageXML(fileUtils)).rejects.toThrowError(
		'Package not initialized',
	)
})

it('should throw an error if error occurs during processing', async () => {
	fileUtils.fileExists.mockReturnValue(true)
	fileUtils.readFile.mockRejectedValue(new Error('Error'))
	await expect(pkg.getPackageXML(fileUtils)).rejects.toThrowError('Error')
})

it('should catch errors and reject the promise', async () => {
	fileUtils.fileExists.mockReturnValue(true)
	fileUtils.readFile.mockRejectedValue(new Error('Test Error'))
	global.git = { append: true }
	try {
		await pkg.getPackageXML(fileUtils)
	} catch (error) {
		expect(error.message).toEqual('Test Error')
	}
})

it('should default to an empty package if the read file is empty', async () => {
	fileUtils.fileExists.mockReturnValue(true)
	fileUtils.readFile.mockResolvedValue('')
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
	fileUtils.fileExists.mockReturnValue(true)
	fileUtils.readFile.mockRejectedValue(new Error('Test Error'))
	global.git = { append: true }
	await expect(pkg.getPackageXML(fileUtils)).rejects.toThrowError(
		'Test Error',
	)
	expect(fileUtils.fileExists).toHaveBeenCalled()
	expect(fileUtils.readFile).toHaveBeenCalled()
})

it('should correctly process the json object returned from the XML file', async () => {
	fileUtils.fileExists.mockReturnValue(true)
	fileUtils.readFile.mockResolvedValueOnce({
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
					members: ['Test', 'Test.yaml'],
					name: 'Workflow',
				},
			],
			version: '56.0',
		},
	})
	fileUtils.readFile.mockImplementationOnce(() => {
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
				{
					members: ['Test'],
					name: 'Workflow',
				},
			],
			version: '56.0',
		},
	})
})
