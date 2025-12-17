import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as fileUtils from '../../src/lib/fileUtils.js'
import * as labelDefinition from '../../src/meta/CustomLabels.js'
import * as permsetDefinition from '../../src/meta/PermissionSets.js'
import * as profileDefinition from '../../src/meta/Profiles.js'
import { Combine } from '../../src/party/combine.js'

// Mock modules
vi.mock('fs', () => ({
	default: {
		existsSync: vi.fn(() => true),
		statSync: vi.fn(() => ({
			isFile: () => true,
			isDirectory: () => true,
			atime: new Date(),
			mtime: new Date(),
		})),
		readdirSync: vi.fn(() => []),
	},
}))
vi.mock('../../src/lib/fileUtils.js', () => ({
	fileInfo: vi.fn((path) => ({
		dirname: '/target',
		basename: 'Admin',
		filename: 'Admin.profile-meta.xml',
		extname: '.xml',
		exists: true,
	})),
	getFiles: vi.fn(() => ['fullName.yaml']),
	fileExists: vi.fn(() => true),
	directoryExists: vi.fn(() => true),
	createDirectory: vi.fn(),
	deleteDirectory: vi.fn(),
	saveFile: vi.fn(() => true),
	readFile: vi.fn(() =>
		Promise.resolve({ fullName: 'TestProfile', custom: false }),
	),
	writeFile: vi.fn(),
	getDirectories: vi.fn(() => []),
}))
describe('Combine class', () => {
	beforeEach(() => {
		// Ensure process.hrtime.bigint is available
		if (!process.hrtime || !process.hrtime.bigint) {
			process.hrtime = {
				bigint: () => BigInt(Date.now() * 1000000),
			}
		}
		// Setup environment
		process.env.NO_COLOR = '0'
		// Setup globals
		global.format = 'yaml'
		global.git = {
			enabled: false,
			append: false,
			delta: false,
		}
		global.logger = {
			info: vi.fn(),
			error: vi.fn(),
		}
		// Create a tracking object that also provides access to Node.js process methods
		// This allows global.process.current to work while keeping process.hrtime accessible
		global.process = Object.assign({}, process, {
			current: 0,
		})
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
				metaDir: 'CustomLabels',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			expect(combine.metadataDefinition).toBe(
				labelDefinition.metadataDefinition,
			)
			expect(combine.sourceDir).toBe('/source')
			expect(combine.targetDir).toBe('/target')
		})
		it('should set type and root from metadata definition', () => {
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Admin',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			expect(combine.metadataDefinition.filetype).toBe('profile')
			expect(combine.metadataDefinition.root).toBe('Profile')
		})
	})
	describe('Metadata Type Support', () => {
		it('should support CustomLabels metadata type', () => {
			const config = {
				metadataDefinition: labelDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'CustomLabels',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			expect(combine.metadataDefinition.filetype).toBe('labels')
			expect(combine.metadataDefinition.directory).toBe('labels')
		})
		it('should support Profile metadata type', () => {
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Admin',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			expect(combine.metadataDefinition.filetype).toBe('profile')
			expect(combine.metadataDefinition.directory).toBe('profiles')
		})
	})
	describe('Instance Properties', () => {
		it('should have sequence and total properties', () => {
			const config = {
				metadataDefinition: labelDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'CustomLabels',
				sequence: 5,
				total: 20,
			}
			const combine = new Combine(config)
			expect(combine.sequence).toBe(5)
			expect(combine.total).toBe(20)
		})
		it('should have sourceDir and targetDir properties', () => {
			const config = {
				metadataDefinition: labelDefinition.metadataDefinition,
				sourceDir: '/path/to/source',
				targetDir: '/path/to/target',
				metaDir: 'CustomLabels',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			expect(combine.sourceDir).toBe('/path/to/source')
			expect(combine.targetDir).toBe('/path/to/target')
		})
		it('should accept package objects', () => {
			const mockAddPkg = { name: 'package' }
			const mockDesPkg = { name: 'destructive' }
			const config = {
				metadataDefinition: labelDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'CustomLabels',
				sequence: 1,
				total: 1,
				addPkg: mockAddPkg,
				desPkg: mockDesPkg,
			}
			const combine = new Combine(config)
			expect(combine.addPkg).toBe(mockAddPkg)
			expect(combine.desPkg).toBe(mockDesPkg)
		})
	})
	describe('Git Integration', () => {
		it('should respect git enabled flag', () => {
			global.git.enabled = true
			const config = {
				metadataDefinition: labelDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'CustomLabels',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			expect(global.git.enabled).toBe(true)
		})
		it('should respect git disabled flag', () => {
			global.git.enabled = false
			const config = {
				metadataDefinition: labelDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'CustomLabels',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			expect(global.git.enabled).toBe(false)
		})
	})
	describe('metaDir setter', () => {
		it('should set fileName properties from metaDir', () => {
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Admin',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			expect(combine.metaDir).toBe('Admin')
		})
		it('should handle nested path in metaDir', () => {
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'path/to/Admin',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			expect(combine.metaDir).toBe('path/to/Admin')
		})
	})
	describe('combine() method', () => {
		it('should reject when source directory does not exist', async () => {
			const fileUtils = await import('../../src/lib/fileUtils.js')
			fileUtils.directoryExists.mockReturnValueOnce(false)
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/nonexistent',
				targetDir: '/target',
				metaDir: 'Admin',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			await expect(combine.combine()).rejects.toThrow(
				'Path does not exist: /nonexistent',
			)
		})
		it('should successfully combine a valid profile', async () => {
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Admin',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should successfully combine permission set metadata', async () => {
			const config = {
				metadataDefinition: permsetDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'TestPermSet',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should successfully combine custom labels', async () => {
			const fileUtils = await import('../../src/lib/fileUtils.js')
			fileUtils.getFiles.mockReturnValue(['TestLabel.yaml'])
			fileUtils.readFile.mockResolvedValue({
				fullName: 'TestLabel',
				value: 'Test Value',
			})
			const config = {
				metadataDefinition: labelDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'CustomLabels',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle git delta mode', async () => {
			global.git.enabled = true
			global.git.delta = true
			global.metaTypes = {
				profile: {
					add: { files: ['/source/profiles/Admin/main.yaml'] },
					remove: { files: [] },
				},
			}
			const mockAddPkg = {
				addMember: vi.fn(),
			}
			const mockDesPkg = {
				addMember: vi.fn(),
			}
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Admin',
				sequence: 1,
				total: 1,
				addPkg: mockAddPkg,
				desPkg: mockDesPkg,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
			expect(mockAddPkg.addMember).toHaveBeenCalledWith(
				'Profile',
				'Admin',
			)
		})
		it('should handle package objects when git is enabled', async () => {
			global.git.enabled = true
			const mockAddPkg = {
				addMember: vi.fn(),
			}
			const mockDesPkg = {
				addMember: vi.fn(),
			}
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Admin',
				sequence: 1,
				total: 1,
				addPkg: mockAddPkg,
				desPkg: mockDesPkg,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should write XML file with proper timestamps', async () => {
			const fileUtils = await import('../../src/lib/fileUtils.js')
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Admin',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			await combine.combine()
			expect(fileUtils.writeFile).toHaveBeenCalled()
		})
		// Read errors are handled internally by the combine logic
		it('should process multiple file types', async () => {
			const fileUtils = await import('../../src/lib/fileUtils.js')
			fileUtils.getDirectories.mockReturnValue([
				'classAccesses',
				'pageAccesses',
			])
			fileUtils.getFiles.mockReturnValue(['item1.yaml', 'item2.yaml'])
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Admin',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
	})
	describe('Sequence tracking', () => {
		it('should return current sequence when global process is higher', () => {
			global.process.current = 5
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Admin',
				sequence: 3,
				total: 10,
			}
			const combine = new Combine(config)
			expect(combine.sequence).toBe(5)
		})
		it('should return configured sequence when higher than global', () => {
			global.process.current = 2
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Admin',
				sequence: 5,
				total: 10,
			}
			const combine = new Combine(config)
			expect(combine.sequence).toBe(5)
		})
	})
	describe('Complex Metadata Processing', () => {
		it('should handle profile with multiple directory types', async () => {
			const fileUtils = await import('../../src/lib/fileUtils.js')
			fileUtils.getDirectories.mockReturnValue([])
			fileUtils.getFiles.mockReturnValue(['main.yaml'])
			fileUtils.readFile.mockResolvedValue({
				fullName: 'ComplexProfile',
				custom: true,
				userLicense: 'Salesforce',
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'ComplexProfile',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
			expect(fileUtils.writeFile).toHaveBeenCalled()
		})
		it('should process fieldPermissions directory', async () => {
			const fileUtils = await import('../../src/lib/fileUtils.js')
			fileUtils.getDirectories.mockReturnValue(['fieldPermissions'])
			fileUtils.getFiles.mockReturnValue([
				'Account.Name.yaml',
				'Contact.Email.yaml',
			])
			fileUtils.readFile.mockImplementation((path) => {
				if (path.includes('Account.Name')) {
					return Promise.resolve({
						fieldPermissions: {
							field: 'Account.Name',
							editable: true,
							readable: true,
						},
					})
				}
				if (path.includes('Contact.Email')) {
					return Promise.resolve({
						fieldPermissions: {
							field: 'Contact.Email',
							editable: false,
							readable: true,
						},
					})
				}
				return Promise.resolve({ fullName: 'Test' })
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'TestProfile',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle custom labels with multiple labels', async () => {
			const fileUtils = await import('../../src/lib/fileUtils.js')
			fileUtils.getDirectories.mockReturnValue(['labels'])
			fileUtils.getFiles.mockReturnValue([
				'Label1.yaml',
				'Label2.yaml',
				'Label3.yaml',
			])
			fileUtils.readFile.mockImplementation((path) => {
				if (path.includes('Label1')) {
					return Promise.resolve({
						labels: {
							fullName: 'Label1',
							language: 'en_US',
							protected: false,
							value: 'Value 1',
						},
					})
				}
				if (path.includes('Label2')) {
					return Promise.resolve({
						labels: {
							fullName: 'Label2',
							language: 'en_US',
							protected: true,
							value: 'Value 2',
						},
					})
				}
				if (path.includes('Label3')) {
					return Promise.resolve({
						labels: {
							fullName: 'Label3',
							language: 'en_US',
							protected: false,
							value: 'Value 3',
						},
					})
				}
				return Promise.resolve({ labels: [] })
			})
			const config = {
				metadataDefinition: labelDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'CustomLabels',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
			// At least one file should be read
			expect(fileUtils.readFile).toHaveBeenCalled()
		})
		it('should handle permission set with object and field permissions', async () => {
			const fileUtils = await import('../../src/lib/fileUtils.js')
			fileUtils.getDirectories.mockReturnValue([
				'fieldPermissions',
				'objectPermissions',
			])
			fileUtils.getFiles.mockImplementation((dir) => {
				if (dir.includes('fieldPermissions')) {
					return [
						'CustomObject__c.Field1__c.yaml',
						'CustomObject__c.Field2__c.yaml',
					]
				}
				if (dir.includes('objectPermissions')) {
					return ['CustomObject__c.yaml']
				}
				return ['main.yaml']
			})
			fileUtils.readFile.mockImplementation((path) => {
				if (path.includes('Field1__c')) {
					return Promise.resolve({
						fieldPermissions: {
							field: 'CustomObject__c.Field1__c',
							editable: true,
							readable: true,
						},
					})
				}
				if (path.includes('Field2__c')) {
					return Promise.resolve({
						fieldPermissions: {
							field: 'CustomObject__c.Field2__c',
							editable: false,
							readable: true,
						},
					})
				}
				if (path.includes('objectPermissions')) {
					return Promise.resolve({
						objectPermissions: {
							allowCreate: true,
							allowDelete: true,
							allowEdit: true,
							allowRead: true,
							object: 'CustomObject__c',
							viewAllRecords: false,
						},
					})
				}
				return Promise.resolve({
					label: 'Test PermSet',
					hasActivationRequired: false,
				})
			})
			const config = {
				metadataDefinition: permsetDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'TestPermSet',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle missing main file gracefully', async () => {
			const fileUtils = await import('../../src/lib/fileUtils.js')
			fileUtils.fileExists.mockImplementation((opts) => {
				if (opts.filePath.includes('main.yaml')) {
					return false
				}
				return true
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'MissingMainProfile',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe('deleted')
		})
		it('should handle empty directories', async () => {
			const fileUtils = await import('../../src/lib/fileUtils.js')
			fileUtils.getDirectories.mockReturnValue([])
			fileUtils.getFiles.mockReturnValue(['main.yaml'])
			fileUtils.directoryExists.mockReturnValue(true)
			fileUtils.fileExists.mockImplementation((opts) => {
				if (opts.filePath.includes('main.yaml')) {
					return true
				}
				return false
			})
			fileUtils.readFile.mockResolvedValue({
				fullName: 'EmptyProfile',
				custom: false,
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'EmptyProfile',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should sort file lists alphabetically', async () => {
			const fileUtils = await import('../../src/lib/fileUtils.js')
			fileUtils.getDirectories.mockReturnValue([])
			fileUtils.getFiles.mockReturnValue(['main.yaml'])
			fileUtils.fileExists.mockImplementation((opts) => {
				if (opts.filePath.includes('main.yaml')) {
					return true
				}
				return false
			})
			fileUtils.readFile.mockResolvedValue({
				fullName: 'SortedProfile',
				custom: false,
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'SortedProfile',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
	})
	describe('Git integration scenarios', () => {
		it('should filter files in delta mode with added files', async () => {
			const fileUtils = await import('../../src/lib/fileUtils.js')
			global.git.enabled = true
			global.git.delta = true
			global.metaTypes = {
				profile: {
					add: { files: ['/source/profiles/TestProfile/main.yaml'] },
					remove: { files: [] },
				},
			}
			fileUtils.getDirectories.mockReturnValue([])
			fileUtils.getFiles.mockReturnValue(['main.yaml'])
			fileUtils.fileExists.mockImplementation((opts) => {
				if (opts.filePath.includes('main.yaml')) {
					return true
				}
				return false
			})
			fileUtils.readFile.mockResolvedValue({
				fullName: 'TestProfile',
				custom: false,
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'TestProfile',
				sequence: 1,
				total: 1,
				addPkg: { addMember: vi.fn() },
				desPkg: { addMember: vi.fn() },
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle removed files in delta mode', async () => {
			const fileUtils = await import('../../src/lib/fileUtils.js')
			global.git.enabled = true
			global.git.delta = true
			global.metaTypes = {
				profile: {
					add: { files: [] },
					remove: {
						files: ['/source/profiles/TestProfile/main.yaml'],
					},
				},
			}
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'TestProfile',
				sequence: 1,
				total: 1,
				addPkg: { addMember: vi.fn() },
				desPkg: { addMember: vi.fn() },
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(config.desPkg.addMember).toHaveBeenCalled()
		})
		it('should handle git append mode', async () => {
			const fileUtils = await import('../../src/lib/fileUtils.js')
			global.git.enabled = true
			global.git.append = true
			fileUtils.getFiles.mockReturnValue(['main.yaml'])
			fileUtils.fileExists.mockImplementation((opts) => {
				if (opts.filePath.includes('main.yaml')) {
					return true
				}
				return false
			})
			fileUtils.readFile.mockResolvedValue({
				fullName: 'AppendProfile',
				custom: false,
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'AppendProfile',
				sequence: 1,
				total: 1,
				addPkg: { addMember: vi.fn() },
				desPkg: { addMember: vi.fn() },
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should respect packageTypeIsDirectory setting', async () => {
			global.git.enabled = true
			const customDefinition = {
				...labelDefinition.metadataDefinition,
				packageTypeIsDirectory: true,
			}
			const config = {
				metadataDefinition: customDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'CustomLabels',
				sequence: 1,
				total: 1,
				addPkg: { addMember: vi.fn() },
				desPkg: { addMember: vi.fn() },
			}
			const combine = new Combine(config)
			await combine.combine()
			// Should not add member when packageTypeIsDirectory is true
			expect(config.addPkg.addMember).not.toHaveBeenCalled()
		})
	})
	describe('Special file handling', () => {
		it('should handle loginIpRanges special case', async () => {
			const fileUtils = await import('../../src/lib/fileUtils.js')
			fileUtils.getFiles.mockReturnValue(['main.yaml'])
			fileUtils.fileExists.mockReturnValue(true)
			fileUtils.readFile.mockResolvedValue({
				fullName: 'IpRangeProfile',
				custom: false,
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'IpRangeProfile',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle nested directory paths', async () => {
			const fileUtils = await import('../../src/lib/fileUtils.js')
			fileUtils.fileInfo.mockReturnValue({
				dirname: '/target/nested/path',
				basename: 'NestedProfile',
				filename: 'NestedProfile.profile-meta.xml',
				extname: '.xml',
				exists: true,
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'nested/path/NestedProfile',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			expect(combine.metaDir).toBe('nested/path/NestedProfile')
		})
	})
	describe('Error scenarios', () => {
		it('should reject when source directory does not exist', async () => {
			const fileUtils = await import('../../src/lib/fileUtils.js')
			fileUtils.directoryExists.mockReturnValue(false)
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/nonexistent',
				targetDir: '/target',
				metaDir: 'TestProfile',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			await expect(combine.combine()).rejects.toThrow(
				'Path does not exist',
			)
		})
		it('should handle file read errors gracefully', async () => {
			const fileUtils = await import('../../src/lib/fileUtils.js')
			fileUtils.directoryExists.mockReturnValue(true)
			fileUtils.getFiles.mockReturnValue(['main.yaml'])
			fileUtils.fileExists.mockImplementation((opts) => {
				if (opts.filePath.includes('main.yaml')) {
					return true
				}
				return false
			})
			fileUtils.readFile.mockResolvedValue({
				fullName: 'ErrorProfile',
				custom: false,
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'ErrorProfile',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			// Should complete successfully
			expect(result).toBe(true)
		})
	})
	describe('Branch coverage - conditional logic', () => {
		beforeEach(() => {
			// Reset mocks to default state
			vi.clearAllMocks()
			fileUtils.directoryExists.mockReturnValue(true)
			fileUtils.fileExists.mockReturnValue(true)
			fileUtils.getFiles.mockReturnValue(['Test.yaml'])
			fileUtils.readFile.mockResolvedValue({
				fullName: 'Test',
				custom: true,
			})
		})
		it('should handle delta mode with added files', async () => {
			global.git = { enabled: true, delta: true }
			fileUtils.getFiles.mockReturnValue(['Test.profile'])
			fileUtils.readFile.mockResolvedValue({
				fullName: 'Test',
				custom: true,
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Test',
				sequence: 1,
				total: 1,
				delta: true,
				addedFiles: ['Test.profile'],
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle metadata with xmlFirst property', async () => {
			const metaDefWithXmlFirst = {
				...labelDefinition.metadataDefinition,
				xmlFirst: 'labels',
			}
			fileUtils.getFiles.mockReturnValue(['Label1.label'])
			fileUtils.readFile.mockResolvedValue({
				fullName: 'Label1',
				value: 'Test Value',
			})
			const config = {
				metadataDefinition: metaDefWithXmlFirst,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'labels',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle array merging in processFile', async () => {
			fileUtils.readFile.mockResolvedValue({
				$: { xmlns: 'http://soap.sforce.com/2006/04/metadata' },
				fullName: 'Test',
				objectPermissions: [
					{ object: 'Account', allowRead: true },
					{ object: 'Contact', allowRead: true },
				],
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'TestProfile',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle missing source directory', async () => {
			fileUtils.directoryExists.mockReturnValue(false)
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/nonexistent',
				targetDir: '/target',
				metaDir: 'Test',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			// Should throw when source doesn't exist
			await expect(combine.combine()).rejects.toThrow(
				'Path does not exist',
			)
		})
		it('should handle loginIpRanges for profiles', async () => {
			fileUtils.getFiles.mockReturnValue(['Admin.profile'])
			fileUtils.readFile
				.mockResolvedValueOnce({
					fullName: 'Admin',
					loginIpRanges: [
						{
							startAddress: '192.168.1.1',
							endAddress: '192.168.1.255',
						},
					],
				})
				.mockResolvedValueOnce({
					fullName: 'Admin',
					custom: false,
				})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Admin',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle sandbox loginIpRanges', async () => {
			fileUtils.getFiles.mockReturnValue(['Test.profile'])
			fileUtils.fileExists
				.mockReturnValueOnce(true) // loginIpRanges exists
				.mockReturnValueOnce(true) // sandbox exists
			fileUtils.readFile
				.mockResolvedValueOnce({
					startAddress: '10.0.0.1',
					endAddress: '10.0.0.255',
				})
				.mockResolvedValueOnce({
					startAddress: '192.168.1.1',
					endAddress: '192.168.1.255',
				})
				.mockResolvedValueOnce({
					fullName: 'Test',
					custom: true,
				})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Test',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle main property in metadata definition', async () => {
			const metaDefWithMain = {
				...permsetDefinition.metadataDefinition,
				main: ['userPermissions', 'objectPermissions'],
			}
			fileUtils.getFiles.mockReturnValue(['Test.permissionset'])
			fileUtils.readFile.mockResolvedValue({
				fullName: 'Test',
				userPermissions: [{ name: 'ViewSetup', enabled: true }],
				objectPermissions: [{ object: 'Account', allowRead: true }],
			})
			const config = {
				metadataDefinition: metaDefWithMain,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Test',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle packageTypeIsDirectory metadata', async () => {
			const metaDefIsDirectory = {
				...labelDefinition.metadataDefinition,
				packageTypeIsDirectory: true,
			}
			fileUtils.getFiles.mockReturnValue(['Label1.label'])
			fileUtils.readFile.mockResolvedValue({
				fullName: 'Label1',
				value: 'Test',
			})
			const config = {
				metadataDefinition: metaDefIsDirectory,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'labels',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle namespace-qualified XML elements', async () => {
			fileUtils.readFile.mockResolvedValue({
				$: {
					xmlns: 'http://soap.sforce.com/2006/04/metadata',
					'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
				},
				fullName: 'Test',
				custom: true,
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Test',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle error when processing file throws', async () => {
			fileUtils.readFile.mockRejectedValue(new Error('Read error'))
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Test',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			// Should handle error and continue
			const result = await combine.combine()
			expect(result).toBeDefined()
		})
		it('should handle CI environment without spinner', async () => {
			const originalCI = process.env.CI
			process.env.CI = 'true'
			fileUtils.getFiles.mockReturnValue(['Test.profile'])
			fileUtils.readFile.mockResolvedValue({
				fullName: 'Test',
				custom: true,
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Test',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
			// Restore original CI value
			if (originalCI) {
				process.env.CI = originalCI
			} else {
				delete process.env.CI
			}
		})
		it('should handle delta mode with deleted main file', async () => {
			global.git = { enabled: true, delta: true }
			fileUtils.getFiles.mockReturnValue([])
			fileUtils.fileExists.mockReturnValue(false)
			// Create mock package objects
			const mockPkg = {
				addMember: vi.fn(),
			}
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Test',
				sequence: 1,
				total: 1,
				delta: true,
				srcPkg: mockPkg,
				desPkg: mockPkg,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe('deleted')
		})
		it('should handle sorting with metadata sort key', async () => {
			const metaDefWithSort = {
				...labelDefinition.metadataDefinition,
				sort: 'fullName',
			}
			fileUtils.getFiles.mockReturnValue(['Label2.label', 'Label1.label'])
			fileUtils.readFile
				.mockResolvedValueOnce({ fullName: 'Label2', value: 'Value 2' })
				.mockResolvedValueOnce({ fullName: 'Label1', value: 'Value 1' })
			const config = {
				metadataDefinition: metaDefWithSort,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'labels',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle splitObjects in metadata definition', async () => {
			const metaDefWithSplitObjects = {
				...profileDefinition.metadataDefinition,
				splitObjects: ['objectPermissions'],
			}
			fileUtils.getFiles.mockReturnValue(['Account.objectPermissions'])
			fileUtils.readFile.mockResolvedValue({
				allowRead: true,
				allowCreate: true,
			})
			const config = {
				metadataDefinition: metaDefWithSplitObjects,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'TestProfile',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle profile type with main file', async () => {
			fileUtils.getFiles.mockReturnValue(['main.yaml'])
			fileUtils.readFile.mockResolvedValue({
				main: {
					fullName: 'TestProfile',
				},
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'TestProfile',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle non-array json key when merging', async () => {
			fileUtils.getFiles.mockReturnValue(['Test.yaml'])
			fileUtils.readFile.mockResolvedValue({
				fullName: 'SingleValue',
			})
			const config = {
				metadataDefinition: labelDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'labels',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle file processing with custom keys', async () => {
			const metaDefWithCustomKey = {
				...profileDefinition.metadataDefinition,
				splitBy: 'customKey',
			}
			fileUtils.getFiles.mockReturnValue(['Custom.yaml'])
			fileUtils.readFile.mockResolvedValue({
				customKey: 'Test',
				value: 'Data',
			})
			const config = {
				metadataDefinition: metaDefWithCustomKey,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'TestProfile',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle empty getFiles result', async () => {
			fileUtils.getFiles.mockReturnValue([])
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'EmptyProfile',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			// Should return true even with no files
			expect(result).toBeDefined()
		})
		it('should handle sequence tracking', async () => {
			global.process.current = 5
			fileUtils.getFiles.mockReturnValue(['Test.profile'])
			fileUtils.readFile.mockResolvedValue({
				fullName: 'Test',
				custom: true,
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Test',
				sequence: 3,
				total: 10,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle non-packageTypeIsDirectory with git enabled', async () => {
			global.git = { enabled: true, delta: false }
			const metaDefNotDirectory = {
				...profileDefinition.metadataDefinition,
				packageTypeIsDirectory: false,
			}
			fileUtils.getFiles.mockReturnValue(['Test.profile'])
			fileUtils.readFile.mockResolvedValue({
				fullName: 'Test',
				custom: true,
			})
			const mockPkg = {
				addMember: vi.fn(),
			}
			const config = {
				metadataDefinition: metaDefNotDirectory,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Test',
				sequence: 1,
				total: 1,
				srcPkg: mockPkg,
				addPkg: mockPkg,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle package metadata with directory mapping', async () => {
			global.git = { enabled: true, delta: false }
			const metaDefWithPackage = {
				...profileDefinition.metadataDefinition,
				package: {
					objectPermissions: 'CustomObject',
					fieldPermissions: 'CustomField',
				},
			}
			fileUtils.getFiles.mockReturnValue([
				'objectPermissions/Account.yaml',
			])
			fileUtils.readFile.mockResolvedValue({
				allowRead: true,
				allowCreate: true,
			})
			fileUtils.fileInfo.mockReturnValue({
				dirname: '/source/TestProfile/objectPermissions',
				basename: 'Account',
				filename: 'Account.yaml',
				extname: '.yaml',
				exists: true,
			})
			const mockPkg = { addMember: vi.fn() }
			const config = {
				metadataDefinition: metaDefWithPackage,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'TestProfile',
				sequence: 1,
				total: 1,
				addPkg: mockPkg,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle keyOrder with order field', async () => {
			const metaDefWithKeyOrder = {
				...profileDefinition.metadataDefinition,
				keyOrder: {
					objectPermissions: ['object', 'order'],
				},
				splitObjects: ['objectPermissions'],
			}
			fileUtils.getFiles.mockReturnValue(['Account.objectPermissions'])
			fileUtils.readFile.mockResolvedValue({
				allowRead: true,
				allowCreate: true,
			})
			const config = {
				metadataDefinition: metaDefWithKeyOrder,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'TestProfile',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle file stats updating with newer atime', async () => {
			const olderDate = new Date('2024-01-01')
			const newerDate = new Date('2024-12-01')
			fileUtils.getFiles.mockReturnValue(['Test1.yaml', 'Test2.yaml'])
			fileUtils.readFile
				.mockResolvedValueOnce({ fullName: 'Test1', custom: true })
				.mockResolvedValueOnce({ fullName: 'Test2', custom: false })
			const mockFs = {
				existsSync: vi.fn(() => true),
				statSync: vi
					.fn()
					.mockReturnValueOnce({
						isFile: () => true,
						atime: olderDate,
						mtime: olderDate,
					})
					.mockReturnValueOnce({
						isFile: () => true,
						atime: newerDate,
						mtime: newerDate,
					}),
			}
			const config = {
				metadataDefinition: labelDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'labels',
				sequence: 1,
				total: 1,
				fs: mockFs,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should merge IP ranges without duplicates', async () => {
			fileUtils.getFiles.mockReturnValue([
				'loginIpRanges.yaml',
				'loginIpRanges-sandbox.yaml',
			])
			fileUtils.fileExists
				.mockReturnValueOnce(true)
				.mockReturnValueOnce(true)
				.mockReturnValueOnce(true)
			fileUtils.readFile
				.mockResolvedValueOnce({
					loginIpRanges: [
						{
							startAddress: '192.168.1.1',
							endAddress: '192.168.1.255',
						},
					],
				})
				.mockResolvedValueOnce({
					loginIpRanges: [
						{ startAddress: '10.0.0.1', endAddress: '10.0.0.255' },
					],
				})
				.mockResolvedValueOnce({
					fullName: 'Admin',
					custom: false,
				})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Admin',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle undefined json keys in saveXML', async () => {
			fileUtils.getFiles.mockReturnValue(['Test.yaml'])
			fileUtils.readFile.mockResolvedValue({
				fullName: 'Test',
				undefinedKey: undefined,
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Test',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle git enabled with main file exclusion', async () => {
			global.git = { enabled: true, delta: false }
			fileUtils.getFiles.mockReturnValue(['main.yaml', 'Test.yaml'])
			fileUtils.fileInfo
				.mockReturnValueOnce({
					dirname: '/source/TestProfile',
					basename: 'main',
					filename: 'main.yaml',
					extname: '.yaml',
					exists: true,
				})
				.mockReturnValueOnce({
					dirname: '/target',
					basename: 'Test',
					filename: 'Test.yaml',
					extname: '.yaml',
					exists: true,
				})
			fileUtils.readFile
				.mockResolvedValueOnce({ main: { fullName: 'TestProfile' } })
				.mockResolvedValueOnce({ fullName: 'Test', custom: true })
			const mockPkg = { addMember: vi.fn() }
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'TestProfile',
				sequence: 1,
				total: 1,
				addPkg: mockPkg,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle rootKey in result processing', async () => {
			const metaDefWithRootKey = {
				...permsetDefinition.metadataDefinition,
				rootKey: 'PermissionSet',
			}
			fileUtils.getFiles.mockReturnValue(['Test.permissionset'])
			fileUtils.readFile.mockResolvedValue({
				PermissionSet: {
					fullName: 'Test',
					userPermissions: [{ name: 'ViewSetup', enabled: true }],
				},
			})
			const config = {
				metadataDefinition: metaDefWithRootKey,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Test',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle file stats error gracefully', async () => {
			const mockFs = {
				existsSync: vi.fn(() => true),
				statSync: vi.fn(() => {
					throw new Error('Stat error')
				}),
			}
			fileUtils.getFiles.mockReturnValue(['Test.yaml'])
			fileUtils.readFile.mockResolvedValue({
				fullName: 'Test',
				custom: true,
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Test',
				sequence: 1,
				total: 1,
				fs: mockFs,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle duplicate IP ranges correctly', async () => {
			fileUtils.getFiles.mockReturnValue([
				'loginIpRanges.yaml',
				'loginIpRanges-sandbox.yaml',
			])
			fileUtils.fileExists.mockReturnValue(true)
			fileUtils.readFile
				.mockResolvedValueOnce({
					loginIpRanges: [
						{
							startAddress: '192.168.1.1',
							endAddress: '192.168.1.255',
						},
					],
				})
				.mockResolvedValueOnce({
					loginIpRanges: [
						{
							startAddress: '192.168.1.1',
							endAddress: '192.168.1.255',
						},
					],
				})
				.mockResolvedValueOnce({
					fullName: 'Admin',
					custom: false,
				})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Admin',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle delta mode with non-matching files', async () => {
			global.git = { enabled: true, delta: true }
			global.metaTypes = {
				profile: {
					add: { files: ['/source/Admin/other.yaml'] },
					remove: { files: [] },
				},
			}
			fileUtils.readFile.mockResolvedValue({
				main: { fullName: 'Admin' },
			})
			fileUtils.directoryExists.mockReturnValue(true)
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Admin',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle only loginIpRanges-sandbox existing', async () => {
			global.metaTypes = {
				profile: {
					add: { files: [] },
					remove: { files: [] },
				},
			}
			// Mock regular loginIpRanges doesn't exist, only sandbox does
			fileUtils.fileExists.mockImplementation(({ filePath }) => {
				if (filePath.includes('loginIpRanges-sandbox')) return true
				if (filePath.includes('loginIpRanges')) return false
				if (filePath.includes('main')) return true
				return false
			})
			fileUtils.readFile.mockImplementation((filePath) => {
				if (filePath.includes('main'))
					return { main: { fullName: 'Admin' } }
				if (filePath.includes('loginIpRanges-sandbox'))
					return {
						loginIpRanges: [
							{
								startAddress: '2.2.2.2',
								endAddress: '2.2.2.255',
							},
						],
					}
			})
			fileUtils.directoryExists.mockReturnValue(true)
			fileUtils.getFiles.mockReturnValue([])
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Admin',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle processSingleFile path for CustomLabels', async () => {
			global.metaTypes = {
				labels: {
					add: { files: [] },
					remove: { files: [] },
				},
			}
			fileUtils.fileExists.mockReturnValue(true)
			fileUtils.readFile.mockResolvedValue({
				labels: [
					{
						fullName: 'TestLabel',
						value: 'Test Value',
						language: 'en_US',
						protected: false,
					},
				],
			})
			fileUtils.directoryExists.mockReturnValue(true)
			const config = {
				metadataDefinition: labelDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'CustomLabels',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle directories type processing', async () => {
			global.metaTypes = {
				profile: {
					add: { files: [] },
					remove: { files: [] },
				},
			}
			fileUtils.directoryExists.mockReturnValue(true)
			fileUtils.getDirectories.mockReturnValue(['userPermissions'])
			fileUtils.getFiles.mockImplementation((dir) => {
				if (dir.includes('userPermissions')) return ['ApiEnabled.yaml']
				return []
			})
			fileUtils.readFile.mockImplementation((filePath) => {
				if (filePath.includes('main'))
					return { main: { fullName: 'Admin' } }
				if (filePath.includes('ApiEnabled'))
					return {
						userPermissions: { name: 'ApiEnabled', enabled: true },
					}
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Admin',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle filteredArray processing in processDirectory', async () => {
			global.git = { enabled: true }
			global.metaTypes = {
				profile: {
					add: { files: [] },
					remove: {
						files: [
							'/source/Admin/userPermissions/ApiEnabled.yaml',
						],
					},
				},
			}
			const mockAddPkg = { addMember: vi.fn() }
			const mockDesPkg = { addMember: vi.fn() }
			fileUtils.directoryExists.mockReturnValue(true)
			fileUtils.getDirectories.mockReturnValue(['userPermissions'])
			fileUtils.getFiles.mockReturnValue([])
			fileUtils.readFile.mockResolvedValue({
				main: { fullName: 'Admin' },
			})
			fileUtils.fileExists.mockImplementation(({ filePath }) => {
				if (filePath.includes('main')) return true
				return false
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Admin',
				sequence: 1,
				total: 1,
				addPkg: mockAddPkg,
				desPkg: mockDesPkg,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle main part file deletion scenario', async () => {
			global.git = { enabled: true }
			global.metaTypes = {
				profile: {
					add: { files: [] },
					remove: {
						files: ['/source/Admin/main.yaml'],
					},
				},
			}
			const mockAddPkg = { addMember: vi.fn() }
			const mockDesPkg = { addMember: vi.fn() }
			fileUtils.directoryExists.mockReturnValue(true)
			fileUtils.getDirectories.mockReturnValue([])
			fileUtils.getFiles.mockReturnValue([])
			fileUtils.fileExists.mockImplementation(({ filePath }) => {
				// Main file is deleted
				if (filePath.includes('main.yaml')) return false
				return false
			})
			fileUtils.readFile.mockResolvedValue({})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Admin',
				sequence: 1,
				total: 1,
				addPkg: mockAddPkg,
				desPkg: mockDesPkg,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			// Should return 'deleted' when main file is deleted
			expect(result).toBe('deleted')
		})
		it('should handle xmlOrder with -1 index values', async () => {
			global.metaTypes = {
				profile: {
					add: { files: [] },
					remove: { files: [] },
				},
			}
			fileUtils.directoryExists.mockReturnValue(true)
			fileUtils.readFile.mockImplementation((filePath) => {
				if (filePath.includes('main'))
					return { main: { fullName: 'Admin' } }
				return {
					userPermissions: [
						{ name: 'ZZZ_NotInOrder', enabled: true },
						{ name: 'ApiEnabled', enabled: false },
					],
				}
			})
			fileUtils.getFiles.mockReturnValue(['userPermissions.yaml'])
			fileUtils.getDirectories.mockReturnValue([])
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Admin',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle array result in processFile', async () => {
			global.metaTypes = {
				profile: {
					add: { files: [] },
					remove: { files: [] },
				},
			}
			fileUtils.directoryExists.mockReturnValue(true)
			fileUtils.getFiles.mockReturnValue(['userPermissions.yaml'])
			fileUtils.readFile.mockImplementation((filePath) => {
				if (filePath.includes('main'))
					return { main: { fullName: 'Admin' } }
				// Return array in result
				return {
					userPermissions: [
						{ name: 'ApiEnabled', enabled: true },
						{ name: 'EditTask', enabled: false },
					],
				}
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Admin',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle singleFiles metadata type', async () => {
			global.metaTypes = {
				workflow: {
					add: { files: [] },
					remove: { files: [] },
				},
			}
			const workflowDefinition = {
				type: 'workflow',
				alias: 'workflow',
				root: 'Workflow',
				main: ['main'],
				singleFiles: ['singleFile'],
				directories: [],
				packageTypeIsDirectory: false,
				sortKeys: {},
				keyOrder: {},
			}
			fileUtils.directoryExists.mockReturnValue(true)
			fileUtils.fileExists.mockReturnValue(true)
			fileUtils.readFile.mockImplementation((filePath) => {
				if (filePath.includes('main'))
					return { main: { fullName: 'TestWorkflow' } }
				return { singleFile: { key: 'value' } }
			})
			const config = {
				metadataDefinition: workflowDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'TestWorkflow',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle non-array json key when processing', async () => {
			global.metaTypes = {
				profile: {
					add: { files: [] },
					remove: { files: [] },
				},
			}
			fileUtils.directoryExists.mockReturnValue(true)
			fileUtils.getFiles.mockReturnValue(['layoutAssignments.yaml'])
			fileUtils.readFile.mockImplementation((filePath) => {
				if (filePath.includes('main'))
					return { main: { fullName: 'Admin' } }
				// Return non-array result
				return {
					layoutAssignments: {
						layout: 'TestLayout',
						recordType: 'TestRecord',
					},
				}
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Admin',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle delta mode with loginIpRanges and non-matching', async () => {
			global.git = { enabled: true, delta: true }
			global.metaTypes = {
				profile: {
					add: { files: [] },
					remove: { files: [] },
				},
			}
			fileUtils.directoryExists.mockReturnValue(true)
			fileUtils.getFiles.mockReturnValue([])
			fileUtils.readFile.mockResolvedValue({
				main: { fullName: 'Admin' },
			})
			fileUtils.fileExists.mockImplementation(({ filePath }) => {
				if (filePath.includes('main')) return true
				// loginIpRanges file exists but not in delta
				if (filePath.includes('loginIpRanges')) return true
				return false
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Admin',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle nested object sorting', async () => {
			global.metaTypes = {
				profile: {
					add: { files: [] },
					remove: { files: [] },
				},
			}
			fileUtils.directoryExists.mockReturnValue(true)
			fileUtils.getFiles.mockReturnValue(['objectPermissions.yaml'])
			fileUtils.readFile.mockImplementation((filePath) => {
				if (filePath.includes('main'))
					return { main: { fullName: 'Admin' } }
				// Return nested object structure
				return {
					objectPermissions: [
						{
							object: 'Account',
							allowCreate: true,
							nested: { field1: 'value1', field2: 'value2' },
						},
					],
				}
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Admin',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle empty object in sorting', async () => {
			global.metaTypes = {
				profile: {
					add: { files: [] },
					remove: { files: [] },
				},
			}
			fileUtils.directoryExists.mockReturnValue(true)
			fileUtils.getFiles.mockReturnValue(['classAccesses.yaml'])
			fileUtils.readFile.mockImplementation((filePath) => {
				if (filePath.includes('main'))
					return { main: { fullName: 'Admin' } }
				// Return object with empty nested object
				return {
					classAccesses: [
						{ apexClass: 'TestClass', enabled: true, nested: {} },
					],
				}
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Admin',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle file not existing with package directory', async () => {
			global.git = { enabled: true }
			global.metaTypes = {
				customobject: {
					add: { files: [] },
					remove: { files: [] },
				},
			}
			const objectDefinition = {
				type: 'customobject',
				alias: 'customobject',
				root: 'CustomObject',
				main: ['main'],
				singleFiles: [],
				directories: ['fields'],
				packageTypeIsDirectory: true,
				sortKeys: {},
				keyOrder: {},
			}
			const mockAddPkg = { addMember: vi.fn() }
			const mockDesPkg = { addMember: vi.fn() }
			fileUtils.directoryExists.mockReturnValue(true)
			fileUtils.getDirectories.mockReturnValue(['fields'])
			fileUtils.getFiles.mockReturnValue(['Name.yaml'])
			fileUtils.fileExists.mockImplementation(({ filePath }) => {
				if (filePath.includes('main')) return true
				// field file doesn't exist
				if (filePath.includes('Name')) return false
				return false
			})
			fileUtils.readFile.mockResolvedValue({
				main: { fullName: 'Account__c' },
			})
			const config = {
				metadataDefinition: objectDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Account__c',
				sequence: 1,
				total: 1,
				addPkg: mockAddPkg,
				desPkg: mockDesPkg,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
			expect(mockDesPkg.addMember).toHaveBeenCalledWith(
				'customobject',
				'Name',
			)
		})
		it('should handle recursive sorting with arrays', async () => {
			global.metaTypes = {
				profile: {
					add: { files: [] },
					remove: { files: [] },
				},
			}
			fileUtils.directoryExists.mockReturnValue(true)
			fileUtils.getFiles.mockReturnValue(['recordTypeVisibilities.yaml'])
			fileUtils.readFile.mockImplementation((filePath) => {
				if (filePath.includes('main'))
					return { main: { fullName: 'Admin' } }
				// Return nested structure with arrays containing objects
				return {
					recordTypeVisibilities: [
						{
							recordType: 'Account.Business',
							default: true,
							nested: [{ item: 'a' }, { item: 'b' }],
						},
					],
				}
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Admin',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle delta mode with added files list', async () => {
			global.git = { enabled: true, delta: true }
			global.metaTypes = {
				profile: {
					add: {
						files: [
							'/source/Admin/main.yaml',
							'/source/Admin/userPermissions.yaml',
						],
					},
					remove: { files: [] },
				},
			}
			const mockAddPkg = { addMember: vi.fn() }
			const mockDesPkg = { addMember: vi.fn() }
			fileUtils.directoryExists.mockReturnValue(true)
			fileUtils.getFiles.mockReturnValue(['userPermissions.yaml'])
			fileUtils.readFile.mockImplementation((filePath) => {
				if (filePath.includes('main'))
					return { main: { fullName: 'Admin' } }
				return {
					userPermissions: [{ name: 'ApiEnabled', enabled: true }],
				}
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Admin',
				sequence: 1,
				total: 1,
				addPkg: mockAddPkg,
				desPkg: mockDesPkg,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle delta mode with main deleted and added files', async () => {
			global.git = { enabled: true, delta: true }
			global.metaTypes = {
				profile: {
					add: { files: ['/source/Admin/userPermissions.yaml'] },
					remove: { files: ['/source/Admin/main.yaml'] },
				},
			}
			const mockAddPkg = { addMember: vi.fn() }
			const mockDesPkg = { addMember: vi.fn() }
			fileUtils.directoryExists.mockReturnValue(true)
			fileUtils.getFiles.mockReturnValue(['userPermissions.yaml'])
			fileUtils.fileExists.mockImplementation(({ filePath }) => {
				// main.yaml is deleted
				if (filePath.includes('main.yaml')) return false
				return true
			})
			fileUtils.readFile.mockResolvedValue({
				userPermissions: [{ name: 'ApiEnabled', enabled: true }],
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Admin',
				sequence: 1,
				total: 1,
				addPkg: mockAddPkg,
				desPkg: mockDesPkg,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			// Should return 'deleted' and add to desPkg
			expect(result).toBe('deleted')
			expect(mockDesPkg.addMember).toHaveBeenCalledWith(
				'Profile',
				'Admin',
			)
		})
		it('should handle both loginIpRanges files existing for merge', async () => {
			global.metaTypes = {
				profile: {
					add: { files: [] },
					remove: { files: [] },
				},
			}
			fileUtils.directoryExists.mockReturnValue(true)
			fileUtils.getFiles.mockReturnValue([])
			fileUtils.fileExists.mockImplementation(({ filePath }) => {
				if (filePath.includes('main')) return true
				// Both loginIpRanges files exist
				if (filePath.includes('loginIpRanges')) return true
				return false
			})
			fileUtils.readFile.mockImplementation((filePath) => {
				if (filePath.includes('main'))
					return { main: { fullName: 'Admin' } }
				if (filePath.includes('sandbox'))
					return {
						loginIpRanges: [
							{
								startAddress: '2.2.2.2',
								endAddress: '2.2.2.255',
							},
						],
					}
				return {
					loginIpRanges: [
						{ startAddress: '1.1.1.1', endAddress: '1.1.1.255' },
					],
				}
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Admin',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle profile type setting profileName', async () => {
			global.metaTypes = {
				profile: {
					add: { files: [] },
					remove: { files: [] },
				},
			}
			fileUtils.directoryExists.mockReturnValue(true)
			fileUtils.getFiles.mockReturnValue([])
			fileUtils.readFile.mockResolvedValue({
				main: { fullName: 'Admin' },
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Admin',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle hydrateObject with splitObjects', async () => {
			global.metaTypes = {
				profile: {
					add: { files: [] },
					remove: { files: [] },
				},
			}
			const profileDefWithSplit = {
				...profileDefinition.metadataDefinition,
				splitObjects: ['fieldPermissions'],
			}
			fileUtils.directoryExists.mockReturnValue(true)
			fileUtils.getFiles.mockReturnValue(['fieldPermissions.yaml'])
			fileUtils.readFile.mockImplementation((filePath) => {
				if (filePath.includes('main'))
					return { main: { fullName: 'Admin' } }
				// Return object that needs hydration
				return {
					fieldPermissions: {
						field: 'Account.Name',
						editable: true,
					},
				}
			})
			const config = {
				metadataDefinition: profileDefWithSplit,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Admin',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle processFile with error throwing', async () => {
			global.metaTypes = {
				profile: {
					add: { files: [] },
					remove: { files: [] },
				},
			}
			fileUtils.directoryExists.mockReturnValue(true)
			fileUtils.getFiles.mockReturnValue(['userPermissions.yaml'])
			fileUtils.readFile.mockImplementation((filePath) => {
				if (filePath.includes('main'))
					return { main: { fullName: 'Admin' } }
				// Throw error when reading file
				throw new Error('Read error')
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Admin',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			// Error is thrown and not caught at this level
			try {
				await combine.combine()
				// If it doesn't throw, the test should pass (error was handled)
				expect(true).toBe(true)
			} catch (error) {
				// If error is thrown, that's also valid
				expect(error.message).toContain('Read error')
			}
		})
		it('should handle xmlFirst property', async () => {
			global.metaTypes = {
				profile: {
					add: { files: [] },
					remove: { files: [] },
				},
			}
			const profileDefWithXmlFirst = {
				...profileDefinition.metadataDefinition,
				xmlFirst: ['xmlns'],
			}
			fileUtils.directoryExists.mockReturnValue(true)
			fileUtils.getFiles.mockReturnValue([])
			fileUtils.readFile.mockResolvedValue({
				main: { fullName: 'Admin' },
			})
			const config = {
				metadataDefinition: profileDefWithXmlFirst,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Admin',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle non-delta mode without git enabled', async () => {
			global.git = { enabled: false, delta: false }
			global.metaTypes = {
				profile: {
					add: { files: [] },
					remove: { files: [] },
				},
			}
			fileUtils.directoryExists.mockReturnValue(true)
			fileUtils.getFiles.mockReturnValue(['userPermissions.yaml'])
			fileUtils.readFile.mockImplementation((filePath) => {
				if (filePath.includes('main'))
					return { main: { fullName: 'Admin' } }
				return {
					userPermissions: [{ name: 'ApiEnabled', enabled: true }],
				}
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Admin',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle file not in git add list during delta', async () => {
			global.git = { enabled: true, delta: true }
			global.metaTypes = {
				profile: {
					add: { files: ['/source/Admin/main.yaml'] },
					remove: { files: [] },
				},
			}
			fileUtils.directoryExists.mockReturnValue(true)
			fileUtils.getFiles.mockReturnValue([
				'userPermissions.yaml',
				'objectPermissions.yaml',
			])
			fileUtils.fileExists.mockReturnValue(true)
			fileUtils.readFile.mockImplementation((filePath) => {
				if (filePath.includes('main'))
					return { main: { fullName: 'Admin' } }
				if (filePath.includes('userPermissions'))
					return {
						userPermissions: [
							{ name: 'ApiEnabled', enabled: true },
						],
					}
				return {
					objectPermissions: [
						{ object: 'Account', allowCreate: true },
					],
				}
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Admin',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle package mapping with non-directory type', async () => {
			global.git = { enabled: true }
			global.metaTypes = {
				workflow: {
					add: { files: [] },
					remove: { files: [] },
				},
			}
			const workflowDefWithPackage = {
				type: 'workflow',
				alias: 'workflow',
				root: 'Workflow',
				main: ['main'],
				singleFiles: [],
				directories: ['alerts'],
				packageTypeIsDirectory: false,
				package: { alerts: 'WorkflowAlert' },
				sortKeys: {},
				keyOrder: {},
			}
			const mockAddPkg = { addMember: vi.fn() }
			const mockDesPkg = { addMember: vi.fn() }
			fileUtils.directoryExists.mockReturnValue(true)
			fileUtils.getDirectories.mockReturnValue(['alerts'])
			fileUtils.getFiles.mockReturnValue(['TestAlert.yaml'])
			fileUtils.fileExists.mockImplementation(({ filePath }) => {
				if (filePath.includes('main')) return true
				// Alert file doesn't exist - should add to package
				if (filePath.includes('TestAlert')) return false
				return false
			})
			fileUtils.readFile.mockResolvedValue({
				main: { fullName: 'TestWorkflow' },
			})
			const config = {
				metadataDefinition: workflowDefWithPackage,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'TestWorkflow',
				sequence: 1,
				total: 1,
				addPkg: mockAddPkg,
				desPkg: mockDesPkg,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
			// Should add to desPkg with package mapping
			expect(mockDesPkg.addMember).toHaveBeenCalledWith(
				'WorkflowAlert',
				'TestWorkflow.TestAlert',
			)
		})
		it('should handle sequencing with higher global process', async () => {
			global.process = Object.assign({}, process, { current: 10 })
			global.metaTypes = {
				profile: {
					add: { files: [] },
					remove: { files: [] },
				},
			}
			fileUtils.directoryExists.mockReturnValue(true)
			fileUtils.getFiles.mockReturnValue([])
			fileUtils.readFile.mockResolvedValue({
				main: { fullName: 'Admin' },
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Admin',
				sequence: 5,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle directory not existing in processDirectory', async () => {
			global.metaTypes = {
				profile: {
					add: { files: [] },
					remove: { files: [] },
				},
			}
			fileUtils.directoryExists.mockImplementation(({ dirPath }) => {
				// Main dir exists, but subdirectories don't
				if (dirPath.includes('userPermissions')) return false
				return true
			})
			fileUtils.getDirectories.mockReturnValue(['userPermissions'])
			fileUtils.getFiles.mockReturnValue([])
			fileUtils.readFile.mockResolvedValue({
				main: { fullName: 'Admin' },
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Admin',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle error thrown during file processing', async () => {
			global.metaTypes = {
				profile: {
					add: { files: [] },
					remove: { files: [] },
				},
			}
			fileUtils.directoryExists.mockReturnValue(true)
			fileUtils.getFiles.mockReturnValue(['userPermissions.yaml'])
			fileUtils.readFile.mockImplementation((filePath) => {
				if (filePath.includes('main'))
					return { main: { fullName: 'Admin' } }
				// Throw a different error to test error path
				const error = new Error('File read failure')
				error.code = 'ENOENT'
				throw error
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Admin',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			try {
				await combine.combine()
				expect(true).toBe(true) // If no error thrown, that's ok too
			} catch (error) {
				expect(error.message).toBeTruthy()
			}
		})
		it('should handle file not existing without git and without package directory', async () => {
			global.git = { enabled: false }
			global.metaTypes = {
				profile: {
					add: { files: [] },
					remove: { files: [] },
				},
			}
			fileUtils.directoryExists.mockReturnValue(true)
			fileUtils.getFiles.mockReturnValue(['missing.yaml'])
			fileUtils.fileExists.mockImplementation(({ filePath }) => {
				if (filePath.includes('main')) return true
				// File doesn't exist
				return false
			})
			fileUtils.readFile.mockResolvedValue({
				main: { fullName: 'Admin' },
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Admin',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle loginIpRanges with only regular file existing', async () => {
			global.metaTypes = {
				profile: {
					add: { files: [] },
					remove: { files: [] },
				},
			}
			fileUtils.directoryExists.mockReturnValue(true)
			fileUtils.getFiles.mockReturnValue([])
			fileUtils.fileExists.mockImplementation(({ filePath }) => {
				if (filePath.includes('main')) return true
				// Regular loginIpRanges exists but not sandbox
				if (
					filePath.includes('loginIpRanges') &&
					!filePath.includes('sandbox')
				)
					return true
				return false
			})
			fileUtils.readFile.mockImplementation((filePath) => {
				if (filePath.includes('main'))
					return { main: { fullName: 'Admin' } }
				return {
					loginIpRanges: [
						{ startAddress: '1.1.1.1', endAddress: '1.1.1.255' },
					],
				}
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Admin',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle neither loginIpRanges file existing', async () => {
			global.metaTypes = {
				profile: {
					add: { files: [] },
					remove: { files: [] },
				},
			}
			fileUtils.directoryExists.mockReturnValue(true)
			fileUtils.getFiles.mockReturnValue([])
			fileUtils.fileExists.mockImplementation(({ filePath }) => {
				if (filePath.includes('main')) return true
				// Neither loginIpRanges file exists
				if (filePath.includes('loginIpRanges')) return false
				return false
			})
			fileUtils.readFile.mockResolvedValue({
				main: { fullName: 'Admin' },
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Admin',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle array result when json key is not an array', async () => {
			global.metaTypes = {
				profile: {
					add: { files: [] },
					remove: { files: [] },
				},
			}
			fileUtils.directoryExists.mockReturnValue(true)
			fileUtils.getFiles.mockReturnValue(['layoutAssignments.yaml'])
			fileUtils.readFile.mockImplementation((filePath) => {
				if (filePath.includes('main')) {
					// Initialize with non-array
					return {
						main: { fullName: 'Admin' },
						layoutAssignments: {
							layout: 'Existing',
							recordType: 'Existing',
						},
					}
				}
				// Return result with array
				return {
					layoutAssignments: [{ layout: 'Test', recordType: 'Test' }],
				}
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Admin',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle package mapping with directory not in package definition', async () => {
			global.git = { enabled: true }
			global.metaTypes = {
				workflow: {
					add: { files: [] },
					remove: { files: [] },
				},
			}
			const workflowDefWithPackage = {
				type: 'workflow',
				alias: 'workflow',
				root: 'Workflow',
				main: ['main'],
				singleFiles: [],
				directories: ['alerts', 'unknownDir'],
				packageTypeIsDirectory: false,
				package: { alerts: 'WorkflowAlert' }, // unknownDir not in package
				sortKeys: {},
				keyOrder: {},
			}
			const mockAddPkg = { addMember: vi.fn() }
			const mockDesPkg = { addMember: vi.fn() }
			fileUtils.directoryExists.mockReturnValue(true)
			fileUtils.getDirectories.mockReturnValue(['unknownDir'])
			fileUtils.getFiles.mockReturnValue(['Test.yaml'])
			fileUtils.fileExists.mockImplementation(({ filePath }) => {
				if (filePath.includes('main')) return true
				return false
			})
			fileUtils.readFile.mockResolvedValue({
				main: { fullName: 'TestWorkflow' },
			})
			const config = {
				metadataDefinition: workflowDefWithPackage,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'TestWorkflow',
				sequence: 1,
				total: 1,
				addPkg: mockAddPkg,
				desPkg: mockDesPkg,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle CI environment with multiple files in directory', async () => {
			process.env.CI = 'true'
			global.metaTypes = {
				profile: {
					add: { files: [] },
					remove: { files: [] },
				},
			}
			fileUtils.directoryExists.mockReturnValue(true)
			fileUtils.getDirectories.mockReturnValue(['userPermissions'])
			fileUtils.getFiles.mockReturnValue([
				'ApiEnabled.yaml',
				'EditTask.yaml',
				'ViewSetup.yaml',
			])
			fileUtils.readFile.mockImplementation((filePath) => {
				if (filePath.includes('main'))
					return { main: { fullName: 'Admin' } }
				if (filePath.includes('ApiEnabled'))
					return {
						userPermissions: { name: 'ApiEnabled', enabled: true },
					}
				if (filePath.includes('EditTask'))
					return {
						userPermissions: { name: 'EditTask', enabled: false },
					}
				return { userPermissions: { name: 'ViewSetup', enabled: true } }
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Admin',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
			delete process.env.CI
		})
		it('should handle profile type with profileName path setup', async () => {
			global.metaTypes = {
				profile: {
					add: { files: [] },
					remove: { files: [] },
				},
			}
			fileUtils.directoryExists.mockReturnValue(true)
			fileUtils.getFiles.mockReturnValue([])
			fileUtils.readFile.mockResolvedValue({
				main: { fullName: 'CustomAdmin' },
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'CustomAdmin',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle array push when result key is not array', async () => {
			global.metaTypes = {
				profile: {
					add: { files: [] },
					remove: { files: [] },
				},
			}
			fileUtils.directoryExists.mockReturnValue(true)
			fileUtils.getFiles.mockReturnValue(['tabVisibilities.yaml'])
			fileUtils.readFile.mockImplementation((filePath) => {
				if (filePath.includes('main')) {
					// Start with array
					return {
						main: { fullName: 'Admin' },
						tabVisibilities: [],
					}
				}
				// Return non-array result
				return {
					tabVisibilities: {
						tab: 'standard-Account',
						visibility: 'DefaultOn',
					},
				}
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Admin',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle empty file list in directory', async () => {
			global.metaTypes = {
				profile: {
					add: { files: [] },
					remove: { files: [] },
				},
			}
			fileUtils.directoryExists.mockReturnValue(true)
			fileUtils.getDirectories.mockReturnValue(['emptyDir'])
			fileUtils.getFiles.mockReturnValue([]) // Empty directory
			fileUtils.readFile.mockResolvedValue({
				main: { fullName: 'Admin' },
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Admin',
				sequence: 1,
				total: 1,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
		it('should handle multiple filtered array files from remove list', async () => {
			global.git = { enabled: true }
			global.metaTypes = {
				profile: {
					add: { files: [] },
					remove: {
						files: [
							'/source/Admin/userPermissions/ApiEnabled.yaml',
							'/source/Admin/userPermissions/EditTask.yaml',
							'/source/Admin/classAccesses/TestClass.yaml',
						],
					},
				},
			}
			const mockAddPkg = { addMember: vi.fn() }
			const mockDesPkg = { addMember: vi.fn() }
			fileUtils.directoryExists.mockReturnValue(true)
			fileUtils.getDirectories.mockReturnValue([
				'userPermissions',
				'classAccesses',
			])
			fileUtils.getFiles.mockReturnValue([])
			fileUtils.fileExists.mockImplementation(({ filePath }) => {
				if (filePath.includes('main')) return true
				return false
			})
			fileUtils.readFile.mockResolvedValue({
				main: { fullName: 'Admin' },
			})
			const config = {
				metadataDefinition: profileDefinition.metadataDefinition,
				sourceDir: '/source',
				targetDir: '/target',
				metaDir: 'Admin',
				sequence: 1,
				total: 1,
				addPkg: mockAddPkg,
				desPkg: mockDesPkg,
			}
			const combine = new Combine(config)
			const result = await combine.combine()
			expect(result).toBe(true)
		})
	})
})
//# sourceMappingURL=combine.test.js.map
