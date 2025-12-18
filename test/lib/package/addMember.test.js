import { Package } from '../../../src/lib/packageUtil.js'
import * as packageDefinition from '../../../src/meta/Package.js'

let pkg
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
	expect(pkg.packageJSON.Package.types[0].name).toBe('type')
	expect(pkg.packageJSON.Package.types[0].members).toEqual(['member'])
})
it('should throw an error if packageJSON is undefined', () => {
	pkg.packageJSON = undefined
	expect(() => pkg.addMember('type', 'member')).toThrowError(
		'getPackageXML must be called before adding members',
	)
})
it('should throw an error if type is undefined', () => {
	expect(() => pkg.addMember(undefined, 'member')).toThrowError(
		'An undefined type was received when attempting to add a member',
	)
})
it('should throw an error if member is undefined', () => {
	expect(() => pkg.addMember('type', undefined)).toThrowError(
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
	pkg.packageJSON.Package.types = [{ name: 'type', members: ['member'] }]
	pkg.addMember('type', 'member')
	expect(pkg.packageJSON.Package.types[0].members).toEqual(['member'])
})
it('should not add the member if type already has an asterisk', () => {
	pkg.packageJSON.Package.types = [{ name: 'type', members: ['*'] }]
	pkg.addMember('type', 'member')
	expect(pkg.packageJSON.Package.types[0].members).toEqual(['*'])
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
	pkg.packageJSON.Package.types = [
		{ name: 'existingType', members: ['existingMember'] },
	]
	pkg.addMember('existingType', 'newMember')
	expect(pkg.packageJSON.Package.types[0].members).toEqual([
		'existingMember',
		'newMember',
	])
})
it('should initialize members array if undefined', () => {
	pkg.packageJSON.Package.types = [{ name: 'type' }]
	pkg.addMember('type', 'member')
	expect(pkg.packageJSON.Package.types[0].members).toEqual(['member'])
})
it('should handle case-insensitive type matching', () => {
	pkg.packageJSON.Package.types = [{ name: 'ApexClass', members: ['Test'] }]
	pkg.addMember('apexclass', 'NewTest')
	expect(pkg.packageJSON.Package.types[0].members).toContain('Test')
	expect(pkg.packageJSON.Package.types[0].members).toContain('NewTest')
	expect(pkg.packageJSON.Package.types[0].members.length).toBe(2)
})
it('should handle case-insensitive member matching', () => {
	pkg.packageJSON.Package.types = [
		{ name: 'ApexClass', members: ['TestClass'] },
	]
	pkg.addMember('ApexClass', 'testclass')
	expect(pkg.packageJSON.Package.types[0].members).toEqual(['TestClass'])
})
it('should create new type node and sort types alphabetically', () => {
	pkg.packageJSON.Package.types = [
		{ name: 'ZZZ_LastType', members: ['Test1'] },
	]
	pkg.addMember('ApexClass', 'TestClass')
	expect(pkg.packageJSON.Package.types).toHaveLength(2)
	expect(pkg.packageJSON.Package.types[0].name).toBe('ApexClass')
	expect(pkg.packageJSON.Package.types[1].name).toBe('ZZZ_LastType')
})
it('should sort members within type', () => {
	pkg.packageJSON.Package.types = [
		{ name: 'ApexClass', members: ['ZZZ_Last', 'AAA_First', 'MMM_Middle'] },
	]
	pkg.addMember('ApexClass', 'BBB_Second')
	const members = pkg.packageJSON.Package.types[0].members
	expect(members[0]).toBe('AAA_First')
	expect(members[1]).toBe('BBB_Second')
	expect(members[2]).toBe('MMM_Middle')
	expect(members[3]).toBe('ZZZ_Last')
})
it('should handle adding to empty types array', () => {
	pkg.packageJSON.Package.types = []
	pkg.addMember('CustomObject', 'Account__c')
	expect(pkg.packageJSON.Package.types).toHaveLength(1)
	expect(pkg.packageJSON.Package.types[0].name).toBe('CustomObject')
	expect(pkg.packageJSON.Package.types[0].members).toEqual(['Account__c'])
})
//# sourceMappingURL=addMember.test.js.map
