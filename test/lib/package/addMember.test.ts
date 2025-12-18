import * as fs from 'fs'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { Package } from '../../../src/lib/packageUtil.js'
import * as packageDefinition from '../../../src/meta/Package.js'

interface GlobalContext {
	format?: string
}

declare const global: GlobalContext & typeof globalThis

interface GlobalContext {
	format?: string
}

declare const global: GlobalContext & typeof globalThis

let pkg: Package
beforeEach(() => {
	pkg = new Package('xmlPath')
	pkg.packageJSON = JSON.parse(
		JSON.stringify(packageDefinition.metadataDefinition.emptyPackage),
	)
})

afterEach(() => {
	vi.clearAllMocks()
})

it('should add a member to the pkg JSON', () => {
	pkg.addMember('type', 'member')
	expect(pkg.packageJSON?.Package.types?.[0]?.name).toBe('type')
	expect(pkg.packageJSON?.Package.types?.[0]?.members).toEqual(['member'])
})

it('should throw an error if packageJSON is undefined', () => {
	// Use type assertion to test undefined packageJSON
	const pkgWithUndefined = pkg as Package & { packageJSON: undefined }
	pkgWithUndefined.packageJSON = undefined
	expect(() => pkgWithUndefined.addMember('type', 'member')).toThrowError(
		'getPackageXML must be called before adding members',
	)
})

it('should throw an error if type is undefined', () => {
	expect(() =>
		pkg.addMember(undefined as unknown as string, 'member'),
	).toThrowError(
		'An undefined type was received when attempting to add a member',
	)
})

it('should throw an error if member is undefined', () => {
	expect(() =>
		pkg.addMember('type', undefined as unknown as string),
	).toThrowError(
		'An undefined member was received when attempting to add a member',
	)
})

it('should throw an error if member is a part file', () => {
	global.format = 'part'
	expect(() => pkg.addMember('type', 'member.part')).toThrowError(
		'Part file received as member is not allowed',
	)
})

it('should not add the member if it already exists', () => {
	if (pkg.packageJSON) {
		pkg.packageJSON.Package.types = [{ name: 'type', members: ['member'] }]
	}
	pkg.addMember('type', 'member')
	if (pkg.packageJSON?.Package.types) {
		expect(pkg.packageJSON?.Package.types[0]?.members).toEqual(['member'])
	}
})

it('should not add the member if type already has an asterisk', () => {
	if (pkg.packageJSON) {
		pkg.packageJSON.Package.types = [{ name: 'type', members: ['*'] }]
	}
	pkg.addMember('type', 'member')
	if (pkg.packageJSON?.Package.types) {
		expect(pkg.packageJSON?.Package.types[0]?.members).toEqual(['*'])
	}
})

it('should handle empty type string', () => {
	expect(() => pkg.addMember('   \t  ', 'member')).toThrowError(
		'An undefined type was received',
	)
})

it('should handle empty member string', () => {
	expect(() => pkg.addMember('type', '   \t  ')).toThrowError(
		'An undefined member was received',
	)
})

it('should add member to existing type', () => {
	if (pkg.packageJSON) {
		pkg.packageJSON.Package.types = [
			{ name: 'existingType', members: ['existingMember'] },
		]
	}
	pkg.addMember('existingType', 'newMember')
	if (pkg.packageJSON?.Package.types) {
		expect(pkg.packageJSON?.Package.types[0]?.members).toEqual([
			'existingMember',
			'newMember',
		])
	}
})

it('should initialize members array if undefined', () => {
	if (pkg.packageJSON) {
		pkg.packageJSON.Package.types = [{ name: 'type', members: [] }]
	}
	pkg.addMember('type', 'member')
	if (pkg.packageJSON?.Package.types) {
		expect(pkg.packageJSON?.Package.types[0]?.members).toEqual(['member'])
	}
})

it('should handle case-insensitive type matching', () => {
	if (pkg.packageJSON) {
		pkg.packageJSON.Package.types = [
			{ name: 'ApexClass', members: ['Test'] },
		]
	}
	pkg.addMember('apexclass', 'NewTest')
	if (pkg.packageJSON?.Package.types) {
		expect(pkg.packageJSON?.Package.types[0]?.members).toContain('Test')
		expect(pkg.packageJSON?.Package.types[0]?.members).toContain('NewTest')
		expect(pkg.packageJSON?.Package.types[0]?.members.length).toBe(2)
	}
})

it('should handle case-insensitive member matching', () => {
	if (pkg.packageJSON) {
		pkg.packageJSON.Package.types = [
			{ name: 'ApexClass', members: ['TestClass'] },
		]
	}
	pkg.addMember('ApexClass', 'testclass')
	if (pkg.packageJSON?.Package.types) {
		expect(pkg.packageJSON.Package.types[0].members).toEqual(['TestClass'])
	}
})

it('should create new type node and sort types alphabetically', () => {
	if (pkg.packageJSON) {
		pkg.packageJSON.Package.types = [
			{ name: 'ZZZ_LastType', members: ['Test1'] },
		]
	}
	pkg.addMember('ApexClass', 'TestClass')

	if (pkg.packageJSON?.Package.types) {
		expect(pkg.packageJSON.Package.types).toHaveLength(2)
		expect(pkg.packageJSON.Package.types[0].name).toBe('ApexClass')
		expect(pkg.packageJSON.Package.types[1].name).toBe('ZZZ_LastType')
	}
})

it('should sort members within type', () => {
	if (pkg.packageJSON) {
		pkg.packageJSON.Package.types = [
			{
				name: 'ApexClass',
				members: ['ZZZ_Last', 'AAA_First', 'MMM_Middle'],
			},
		]
	}
	pkg.addMember('ApexClass', 'BBB_Second')

	if (pkg.packageJSON?.Package.types?.[0]?.members) {
		const members = pkg.packageJSON.Package.types[0].members
		expect(members[0]).toBe('AAA_First')
		expect(members[1]).toBe('BBB_Second')
		expect(members[2]).toBe('MMM_Middle')
		expect(members[3]).toBe('ZZZ_Last')
	}
})

it('should handle adding to empty types array', () => {
	if (pkg.packageJSON) {
		pkg.packageJSON.Package.types = []
	}
	pkg.addMember('CustomObject', 'Account__c')

	if (pkg.packageJSON?.Package.types) {
		expect(pkg.packageJSON.Package.types).toHaveLength(1)
		expect(pkg.packageJSON.Package.types[0].name).toBe('CustomObject')
		expect(pkg.packageJSON.Package.types[0].members).toEqual(['Account__c'])
	}
})

it('should handle error in addMember catch block', () => {
	// Test line 239: throw error in catch block
	if (pkg.packageJSON) {
		pkg.packageJSON.Package.types = [{ name: 'type', members: [] }]
		// Create a typeItem that will throw during forEach iteration
		const problematicType = {
			get name() {
				throw new Error('Name access error')
			},
			members: [],
		}
		pkg.packageJSON.Package.types.push(
			problematicType as { name: string; members: string[] },
		)
	}
	expect(() => pkg.addMember('type', 'member')).toThrow('Name access error')
})

it('should handle sort comparison when names are equal', () => {
	// Test lines 267-271: sort comparison edge cases
	if (pkg.packageJSON) {
		pkg.packageJSON.Package.types = [
			{ name: 'TypeA', members: ['member1'] },
			{ name: 'TypeA', members: ['member2'] },
			{ name: 'TypeB', members: ['member3'] },
		]
	}
	pkg.addMember('TypeC', 'member4')
	if (pkg.packageJSON?.Package.types) {
		// Should be sorted: TypeA, TypeA, TypeB, TypeC
		expect(pkg.packageJSON.Package.types[0].name).toBe('TypeA')
		expect(pkg.packageJSON.Package.types[3].name).toBe('TypeC')
		// Test line 269: return 0 when names are equal (maintains order)
	}
})

it('should handle sort comparison when a.name is less than b.name', () => {
	// Test line 267: a.name < b.name returns -1
	if (pkg.packageJSON) {
		pkg.packageJSON.Package.types = [
			{ name: 'TypeZ', members: ['member1'] },
		]
	}
	pkg.addMember('TypeA', 'member2')
	if (pkg.packageJSON?.Package.types) {
		expect(pkg.packageJSON.Package.types[0].name).toBe('TypeA')
		expect(pkg.packageJSON.Package.types[1].name).toBe('TypeZ')
	}
})

it('should handle sort comparison when a.name is greater than b.name', () => {
	// Test line 268: a.name > b.name returns 1
	if (pkg.packageJSON) {
		pkg.packageJSON.Package.types = [
			{ name: 'TypeA', members: ['member1'] },
		]
	}
	pkg.addMember('TypeZ', 'member2')
	if (pkg.packageJSON?.Package.types) {
		expect(pkg.packageJSON.Package.types[0].name).toBe('TypeA')
		expect(pkg.packageJSON.Package.types[1].name).toBe('TypeZ')
	}
})

it('should handle error in addMember sort catch block', () => {
	// Test line 271: throw error in catch block during sort
	if (pkg.packageJSON) {
		pkg.packageJSON.Package.types = [
			{ name: 'TypeA', members: ['member1'] },
		]
		// Create a type that will throw during sort comparison
		const problematicType = {
			get name() {
				throw new Error('Sort error')
			},
			members: ['member2'],
		}
		pkg.packageJSON.Package.types.push(
			problematicType as { name: string; members: string[] },
		)
	}
	expect(() => pkg.addMember('TypeB', 'member3')).toThrow('Sort error')
})
