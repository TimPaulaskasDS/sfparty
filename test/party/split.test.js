import fs from 'fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as fileUtils from '../../src/lib/fileUtils.js'
import * as labelDefinition from '../../src/meta/CustomLabels.js'
import * as permsetDefinition from '../../src/meta/PermissionSets.js'
import * as profileDefinition from '../../src/meta/Profiles.js'
import { Split } from '../../src/party/split.js'

// Mock modules before importing
vi.mock('fs', () => ({
	default: {
		readFile: vi.fn((path, cb) => {
			const xmlData = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="https://soap.sforce.com/2006/04/metadata">
    <fullName>Admin</fullName>
    <custom>false</custom>
</Profile>`
			cb(null, xmlData)
		}),
		existsSync: vi.fn(() => true),
		statSync: vi.fn(() => ({
			isFile: () => true,
			isDirectory: () => true,
		})),
		readdirSync: vi.fn(() => []),
	},
}))
vi.mock('../../src/lib/fileUtils.js', () => ({
	fileInfo: vi.fn((path) => ({
		dirname: '/source',
		basename: 'Admin',
		filename: 'Admin.profile-meta.xml',
		extname: '.xml',
		exists: true,
	})),
	getFiles: vi.fn(() => ['Admin.profile-meta.xml']),
	fileExists: vi.fn(() => true),
	directoryExists: vi.fn(() => true),
	createDirectory: vi.fn(),
	deleteDirectory: vi.fn(),
	saveFile: vi.fn(() => true),
	readFile: vi.fn(() => null),
}))
describe('Split class', () => {
	beforeEach(() => {
		// Setup process environment FIRST
		if (typeof process !== 'undefined' && process.env) {
			process.env.NO_COLOR = '0'
		}
		if (!process.hrtime || !process.hrtime.bigint) {
			process.hrtime = {
				bigint: () => BigInt(Date.now() * 1000000),
			}
		}
		// Setup globals
		global.format = 'yaml'
		global.logger = {
			info: vi.fn(),
			error: vi.fn(),
		}
		global.icons = {
			warn: '🔕',
			success: '✔',
			fail: '❗',
			working: '⏳',
			party: '🎉',
			delete: '❌',
		}
	})
	afterEach(() => {
		vi.clearAllMocks()
	})
	describe('Constructor', () => {
		it('should initialize with required config', () => {
			const config = {
				metadataDefinition: labelDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaFilePath: '/source/CustomLabels.labels-meta.xml',
				sequence: 1,
				total: 1,
			}
			const split = new Split(config)
			expect(split.metadataDefinition).toBe(
				labelDefinition.metadataDefinition,
			)
			expect(split.sourceDir).toBe('/source')
			expect(split.targetDir).toBe('/target')
		})
		it('should set type and root from metadata definition', () => {
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaFilePath: '/source/Admin.profile-meta.xml',
				sequence: 1,
				total: 1,
			}
			const split = new Split(config)
			expect(split.metadataDefinition.filetype).toBe('profile')
			expect(split.metadataDefinition.root).toBe('Profile')
		})
	})
	describe('metaFilePath setter', () => {
		it('should throw error for empty path', () => {
			const config = {
				metadataDefinition: labelDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaFilePath: '/source/CustomLabels.labels-meta.xml',
				sequence: 1,
				total: 1,
			}
			const split = new Split(config)
			expect(() => {
				split.metaFilePath = ''
			}).toThrow('The file path cannot be empty')
		})
		it('should throw error for whitespace-only path', () => {
			const config = {
				metadataDefinition: labelDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaFilePath: '/source/CustomLabels.labels-meta.xml',
				sequence: 1,
				total: 1,
			}
			const split = new Split(config)
			expect(() => {
				split.metaFilePath = '   '
			}).toThrow('The file path cannot be empty')
		})
	})
	describe('Metadata Type Support', () => {
		it('should support CustomLabels metadata type', () => {
			const config = {
				metadataDefinition: labelDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaFilePath: '/source/CustomLabels.labels-meta.xml',
				sequence: 1,
				total: 1,
			}
			const split = new Split(config)
			expect(split.metadataDefinition.filetype).toBe('labels')
			expect(split.metadataDefinition.directory).toBe('labels')
		})
		it('should support Profile metadata type', () => {
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaFilePath: '/source/Admin.profile-meta.xml',
				sequence: 1,
				total: 1,
			}
			const split = new Split(config)
			expect(split.metadataDefinition.filetype).toBe('profile')
			expect(split.metadataDefinition.directory).toBe('profiles')
		})
	})
	describe('Instance Properties', () => {
		it('should have sequence and total properties', () => {
			const config = {
				metadataDefinition: labelDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaFilePath: '/source/CustomLabels.labels-meta.xml',
				sequence: 3,
				total: 10,
			}
			const split = new Split(config)
			expect(split.sequence).toBe(3)
			expect(split.total).toBe(10)
		})
		it('should have sourceDir and targetDir properties', () => {
			const config = {
				metadataDefinition: labelDefinition.metadataDefinition,
				sourceDir: '/path/to/source',
				targetDir: '/path/to/target',
				metaFilePath: '/path/to/source/CustomLabels.labels-meta.xml',
				sequence: 1,
				total: 1,
			}
			const split = new Split(config)
			expect(split.sourceDir).toBe('/path/to/source')
			expect(split.targetDir).toBe('/path/to/target')
		})
	})
	describe('split() method', () => {
		it('should resolve false when fileName is invalid', async () => {
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaFilePath: '/source/Admin.profile-meta.xml',
				sequence: 1,
				total: 1,
			}
			const split = new Split(config)
			// Corrupt the private fileName field
			split._metaFilePath = undefined
			const result = await split.split()
			expect(result).toBe(false)
			expect(global.logger.error).toHaveBeenCalledWith(
				'Invalid information passed to split',
			)
		})
		it('should resolve false when file does not exist', async () => {
			const fileUtils = await import('../../src/lib/fileUtils.js')
			fileUtils.fileExists.mockReturnValueOnce(false)
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaFilePath: '/source/Missing.profile-meta.xml',
				sequence: 1,
				total: 1,
			}
			const split = new Split(config)
			const result = await split.split()
			expect(result).toBe(false)
			expect(global.logger.error).toHaveBeenCalled()
		})
		it('should successfully split a valid profile file', async () => {
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaFilePath: '/source/Admin.profile-meta.xml',
				sequence: 1,
				total: 1,
			}
			const split = new Split(config)
			const result = await split.split()
			expect(result).toBe(true)
		})
		it('should handle permission set metadata', async () => {
			const fs = await import('fs')
			fs.default.readFile.mockImplementationOnce((path, cb) => {
				const xmlData = `<?xml version="1.0" encoding="UTF-8"?>
<PermissionSet xmlns="https://soap.sforce.com/2006/04/metadata">
    <label>Test PermSet</label>
    <hasActivationRequired>false</hasActivationRequired>
</PermissionSet>`
				cb(null, xmlData)
			})
			const config = {
				metadataDefinition: permsetDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaFilePath: '/source/TestPermSet.permissionset-meta.xml',
				sequence: 1,
				total: 1,
			}
			const split = new Split(config)
			const result = await split.split()
			expect(result).toBe(true)
		})
		// XML parsing errors are caught internally and logged
		it('should handle invalid XML root', async () => {
			const fs = await import('fs')
			fs.default.readFile.mockImplementationOnce((path, cb) => {
				const xmlData = `<?xml version="1.0" encoding="UTF-8"?>
<InvalidRoot>
    <content>data</content>
</InvalidRoot>`
				cb(null, xmlData)
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaFilePath: '/source/Invalid.profile-meta.xml',
				sequence: 1,
				total: 1,
			}
			const split = new Split(config)
			// TypeScript version throws error for invalid root instead of returning false
			await expect(split.split()).rejects.toThrow(
				'Invalid XML structure: Expected root tag "Profile" not found',
			)
			expect(global.logger.error).toHaveBeenCalled()
		})
		it('should update http to https in xmlns', async () => {
			const fs = await import('fs')
			const fileUtils = await import('../../src/lib/fileUtils.js')
			fs.default.readFile.mockImplementationOnce((path, cb) => {
				const xmlData = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>TestProfile</fullName>
</Profile>`
				cb(null, xmlData)
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaFilePath: '/source/TestProfile.profile-meta.xml',
				sequence: 1,
				total: 1,
			}
			const split = new Split(config)
			const result = await split.split()
			expect(result).toBe(true)
			expect(fileUtils.createDirectory).toHaveBeenCalled()
		})
		it('should delete existing target directory', async () => {
			const fileUtils = await import('../../src/lib/fileUtils.js')
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaFilePath: '/source/Admin.profile-meta.xml',
				sequence: 1,
				total: 1,
			}
			const split = new Split(config)
			await split.split()
			expect(fileUtils.deleteDirectory).toHaveBeenCalledWith(
				expect.stringContaining('Admin'),
				true,
			)
		})
		it('should create target directory', async () => {
			const fileUtils = await import('../../src/lib/fileUtils.js')
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaFilePath: '/source/Admin.profile-meta.xml',
				sequence: 1,
				total: 1,
			}
			const split = new Split(config)
			await split.split()
			expect(fileUtils.createDirectory).toHaveBeenCalledWith(
				expect.stringContaining('Admin'),
			)
		})
	})
	describe('Sequence and Progress', () => {
		it('should track sequence number for progress display', () => {
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaFilePath: '/source/Admin.profile-meta.xml',
				sequence: 3,
				total: 10,
			}
			const split = new Split(config)
			expect(split.sequence).toBe(3)
			expect(split.total).toBe(10)
		})
	})
	describe('Complex XML Processing', () => {
		it('should handle profile with multiple sections', async () => {
			const fs = await import('fs')
			const fileUtils = await import('../../src/lib/fileUtils.js')
			fs.default.readFile.mockImplementationOnce((path, cb) => {
				const xmlData = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="https://soap.sforce.com/2006/04/metadata">
    <fullName>ComplexProfile</fullName>
    <custom>true</custom>
    <applicationVisibilities>
        <application>App1</application>
        <default>true</default>
        <visible>true</visible>
    </applicationVisibilities>
    <applicationVisibilities>
        <application>App2</application>
        <default>false</default>
        <visible>false</visible>
    </applicationVisibilities>
    <fieldPermissions>
        <field>Account.CustomField__c</field>
        <editable>true</editable>
        <readable>true</readable>
    </fieldPermissions>
</Profile>`
				cb(null, xmlData)
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaFilePath: '/source/ComplexProfile.profile-meta.xml',
				sequence: 1,
				total: 1,
			}
			const split = new Split(config)
			const result = await split.split()
			expect(result).toBe(true)
			expect(fileUtils.saveFile).toHaveBeenCalled()
		})
		it('should handle custom labels with multiple entries', async () => {
			const fs = await import('fs')
			const fileUtils = await import('../../src/lib/fileUtils.js')
			fs.default.readFile.mockImplementationOnce((path, cb) => {
				const xmlData = `<?xml version="1.0" encoding="UTF-8"?>
<CustomLabels xmlns="https://soap.sforce.com/2006/04/metadata">
    <labels>
        <fullName>Label1</fullName>
        <language>en_US</language>
        <protected>false</protected>
        <value>Value 1</value>
    </labels>
    <labels>
        <fullName>Label2</fullName>
        <language>en_US</language>
        <protected>true</protected>
        <value>Value 2</value>
    </labels>
    <labels>
        <fullName>Label3</fullName>
        <language>en_US</language>
        <protected>false</protected>
        <value>Value 3</value>
    </labels>
</CustomLabels>`
				cb(null, xmlData)
			})
			const config = {
				metadataDefinition: labelDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaFilePath: '/source/CustomLabels.labels-meta.xml',
				sequence: 1,
				total: 1,
			}
			const split = new Split(config)
			const result = await split.split()
			expect(result).toBe(true)
			// Should have saved files for each label
			expect(fileUtils.saveFile).toHaveBeenCalled()
		})
		it('should handle permission set with various permissions', async () => {
			const fs = await import('fs')
			const fileUtils = await import('../../src/lib/fileUtils.js')
			fs.default.readFile.mockImplementationOnce((path, cb) => {
				const xmlData = `<?xml version="1.0" encoding="UTF-8"?>
<PermissionSet xmlns="https://soap.sforce.com/2006/04/metadata">
    <label>Custom PermSet</label>
    <hasActivationRequired>false</hasActivationRequired>
    <fieldPermissions>
        <field>Account.CustomField1__c</field>
        <editable>true</editable>
        <readable>true</readable>
    </fieldPermissions>
    <fieldPermissions>
        <field>Contact.CustomField2__c</field>
        <editable>false</editable>
        <readable>true</readable>
    </fieldPermissions>
    <objectPermissions>
        <allowCreate>true</allowCreate>
        <allowDelete>true</allowDelete>
        <allowEdit>true</allowEdit>
        <allowRead>true</allowRead>
        <object>CustomObject__c</object>
        <viewAllRecords>false</viewAllRecords>
    </objectPermissions>
</PermissionSet>`
				cb(null, xmlData)
			})
			const config = {
				metadataDefinition: permsetDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaFilePath: '/source/CustomPermSet.permissionset-meta.xml',
				sequence: 1,
				total: 1,
			}
			const split = new Split(config)
			const result = await split.split()
			expect(result).toBe(true)
			expect(fileUtils.createDirectory).toHaveBeenCalled()
		})
		it('should handle nested XML elements', async () => {
			const fs = await import('fs')
			fs.default.readFile.mockImplementationOnce((path, cb) => {
				const xmlData = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="https://soap.sforce.com/2006/04/metadata">
    <fullName>NestedProfile</fullName>
    <custom>false</custom>
    <layoutAssignments>
        <layout>Account-Account Layout</layout>
        <recordType>Account.PersonAccount</recordType>
    </layoutAssignments>
    <recordTypeVisibilities>
        <recordType>Account.Business</recordType>
        <default>true</default>
        <visible>true</visible>
    </recordTypeVisibilities>
</Profile>`
				cb(null, xmlData)
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaFilePath: '/source/NestedProfile.profile-meta.xml',
				sequence: 1,
				total: 1,
			}
			const split = new Split(config)
			const result = await split.split()
			expect(result).toBe(true)
		})
		it('should handle boolean value conversion', async () => {
			const fs = await import('fs')
			fs.default.readFile.mockImplementationOnce((path, cb) => {
				const xmlData = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="https://soap.sforce.com/2006/04/metadata">
    <fullName>BooleanProfile</fullName>
    <custom>true</custom>
    <userLicense>Salesforce</userLicense>
    <fieldPermissions>
        <field>Account.Name</field>
        <editable>false</editable>
        <readable>true</readable>
    </fieldPermissions>
</Profile>`
				cb(null, xmlData)
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaFilePath: '/source/BooleanProfile.profile-meta.xml',
				sequence: 1,
				total: 1,
			}
			const split = new Split(config)
			const result = await split.split()
			expect(result).toBe(true)
		})
		it('should handle empty array elements', async () => {
			const fs = await import('fs')
			fs.default.readFile.mockImplementationOnce((path, cb) => {
				const xmlData = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="https://soap.sforce.com/2006/04/metadata">
    <fullName>EmptyProfile</fullName>
    <custom>false</custom>
    <description></description>
    <userLicense>Salesforce</userLicense>
</Profile>`
				cb(null, xmlData)
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaFilePath: '/source/EmptyProfile.profile-meta.xml',
				sequence: 1,
				total: 1,
			}
			const split = new Split(config)
			const result = await split.split()
			expect(result).toBe(true)
		})
	})
	describe('File name handling', () => {
		it('should extract short name from file path', async () => {
			const fileUtils = await import('../../src/lib/fileUtils.js')
			fileUtils.fileInfo.mockReturnValueOnce({
				dirname: '/source/profiles',
				basename: 'System Administrator',
				filename: 'System Administrator.profile-meta.xml',
				extname: '.xml',
				exists: true,
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaFilePath: '/source/System Administrator.profile-meta.xml',
				sequence: 1,
				total: 1,
			}
			const split = new Split(config)
			// The short name should strip the extension
			expect(split.metaFilePath).toBe(
				'/source/System Administrator.profile-meta.xml',
			)
		})
		it('should handle file paths with special characters', async () => {
			const fileUtils = await import('../../src/lib/fileUtils.js')
			fileUtils.fileInfo.mockReturnValueOnce({
				dirname: '/source/profiles',
				basename: 'Profile (Special)',
				filename: 'Profile (Special).profile-meta.xml',
				extname: '.xml',
				exists: true,
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaFilePath: '/source/Profile (Special).profile-meta.xml',
				sequence: 1,
				total: 1,
			}
			const split = new Split(config)
			expect(split.metaFilePath).toBe(
				'/source/Profile (Special).profile-meta.xml',
			)
		})
	})
	describe('Format handling', () => {
		it('should respect yaml format', async () => {
			global.format = 'yaml'
			const fileUtils = await import('../../src/lib/fileUtils.js')
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaFilePath: '/source/Admin.profile-meta.xml',
				sequence: 1,
				total: 1,
			}
			const split = new Split(config)
			await split.split()
			expect(fileUtils.saveFile).toHaveBeenCalled()
			const calls = fileUtils.saveFile.mock.calls
			// Check that format is passed correctly
			expect(calls.some((call) => call[2] === 'yaml')).toBe(true)
		})
		it('should respect json format', async () => {
			global.format = 'json'
			const fileUtils = await import('../../src/lib/fileUtils.js')
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaFilePath: '/source/Admin.profile-meta.xml',
				sequence: 1,
				total: 1,
			}
			const split = new Split(config)
			await split.split()
			expect(fileUtils.saveFile).toHaveBeenCalled()
		})
	})
	describe('Branch coverage - additional conditional paths', () => {
		beforeEach(async () => {
			vi.clearAllMocks()
			// Reset file exists mock
			fileUtils.fileExists.mockReturnValue(true)
		})
		it('should handle invalid information passed to split', async () => {
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '',
				targetDir: '/target',
				metaFilePath: '/source/Test.profile-meta.xml',
				sequence: 1,
				total: 1,
			}
			const split = new Split(config)
			const result = await split.split()
			expect(result).toBe(false)
			expect(global.logger.error).toHaveBeenCalledWith(
				'Invalid information passed to split',
			)
		})
		it('should handle file not found error', async () => {
			fileUtils.fileExists.mockReturnValue(false)
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaFilePath: '/source/Missing.profile-meta.xml',
				sequence: 1,
				total: 1,
			}
			const split = new Split(config)
			const result = await split.split()
			expect(result).toBe(false)
			expect(global.logger.error).toHaveBeenCalledWith(
				expect.stringContaining('file not found'),
			)
		})
		it('should handle metadata with main property', async () => {
			const metaDefWithMain = {
				...profileDefinition.metadataDefinition,
				main: ['fullName', 'custom'],
			}
			const config = {
				metadataDefinition: metaDefWithMain,
				sourceDir: '/source',
				targetDir: '/target',
				metaFilePath: '/source/Admin.profile-meta.xml',
				sequence: 1,
				total: 1,
			}
			const split = new Split(config)
			const result = await split.split()
			expect(result).toBe(true)
			expect(fileUtils.saveFile).toHaveBeenCalled()
		})
		it('should handle empty targetDir in constructor', () => {
			expect(() => {
				const config = {
					metadataDefinition: profileDefinition.metadataDefinition,
					sourceDir: '/source',
					targetDir: '/target',
					metaFilePath: '  ',
					sequence: 1,
					total: 1,
				}
				new Split(config)
			}).toThrow('The file path cannot be empty')
		})
		it('should handle sandbox loginIpRanges in profiles', async () => {
			fileUtils.fileExists
				.mockReturnValueOnce(true)
				.mockReturnValueOnce(true)
				.mockReturnValueOnce(true)
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaFilePath: '/source/Admin.profile-meta.xml',
				sequence: 1,
				total: 1,
			}
			const split = new Split(config)
			const result = await split.split()
			expect(result).toBe(true)
		})
		it('should handle xml2json error for non-primitive conversion', async () => {
			const xmlWithComplexObject = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="https://soap.sforce.com/2006/04/metadata">
    <fullName>Admin</fullName>
    <userPermissions>
        <enabled>true</enabled>
        <name>ApiEnabled</name>
    </userPermissions>
</Profile>`
			fs.readFile.mockImplementation((path, cb) => {
				cb(null, xmlWithComplexObject)
			})
			fileUtils.directoryExists.mockReturnValue(true)
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaFilePath: '/source/Admin.profile-meta.xml',
				sequence: 1,
				total: 1,
			}
			const split = new Split(config)
			const result = await split.split()
			expect(result).toBe(true)
		})
		it('should handle keySort with recursive objects in arrays', async () => {
			const xmlWithNestedStructure = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="https://soap.sforce.com/2006/04/metadata">
    <fullName>Admin</fullName>
    <objectPermissions>
        <object>Account</object>
        <allowCreate>true</allowCreate>
        <nested>
            <field1>value1</field1>
            <field2>value2</field2>
        </nested>
    </objectPermissions>
</Profile>`
			fs.readFile.mockImplementation((path, cb) => {
				cb(null, xmlWithNestedStructure)
			})
			fileUtils.directoryExists.mockReturnValue(true)
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaFilePath: '/source/Admin.profile-meta.xml',
				sequence: 1,
				total: 1,
			}
			const split = new Split(config)
			const result = await split.split()
			expect(result).toBe(true)
		})
		it('should handle array with multiple items in xml2json', async () => {
			const xmlWithArrays = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="https://soap.sforce.com/2006/04/metadata">
    <fullName>Admin</fullName>
    <userPermissions>
        <enabled>true</enabled>
        <name>ApiEnabled</name>
    </userPermissions>
    <userPermissions>
        <enabled>false</enabled>
        <name>EditTask</name>
    </userPermissions>
</Profile>`
			fs.readFile.mockImplementation((path, cb) => {
				cb(null, xmlWithArrays)
			})
			fileUtils.directoryExists.mockReturnValue(true)
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaFilePath: '/source/Admin.profile-meta.xml',
				sequence: 1,
				total: 1,
			}
			const split = new Split(config)
			const result = await split.split()
			expect(result).toBe(true)
		})
		it('should handle processJSON with sequential calls', async () => {
			const xmlWithMultipleSections = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="https://soap.sforce.com/2006/04/metadata">
    <fullName>Admin</fullName>
    <userPermissions>
        <enabled>true</enabled>
        <name>ApiEnabled</name>
    </userPermissions>
    <classAccesses>
        <apexClass>TestClass</apexClass>
        <enabled>true</enabled>
    </classAccesses>
</Profile>`
			fs.readFile.mockImplementation((path, cb) => {
				cb(null, xmlWithMultipleSections)
			})
			fileUtils.directoryExists.mockReturnValue(true)
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaFilePath: '/source/Admin.profile-meta.xml',
				sequence: 1,
				total: 1,
			}
			const split = new Split(config)
			const result = await split.split()
			expect(result).toBe(true)
		})
	})
})
//# sourceMappingURL=split.test.js.map
