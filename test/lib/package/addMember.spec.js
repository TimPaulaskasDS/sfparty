import * as packageDefinition from '../../../src/meta/Package.js'
import { Package } from '../../../src/lib/packageUtil.js'

let pkg;
beforeEach(() => {
    pkg = new Package('xmlPath');
    pkg.packageJSON = JSON.parse(JSON.stringify(packageDefinition.metadataDefinition.emptyPackage));
});

afterEach(() => {
    jest.clearAllMocks();
});


it('should add a member to the pkg JSON', () => {
    pkg.addMember('type', 'member');
    expect(pkg.packageJSON.Package.types[0].name).toBe('type');
    expect(pkg.packageJSON.Package.types[0].members).toEqual(['member']);
});

it('should throw an error if packageJSON is undefined', () => {
    pkg.packageJSON = undefined;
    expect(() => pkg.addMember('type', 'member')).toThrowError('getPackageXML must be called before adding members');
});

it('should throw an error if type is undefined', () => {
    expect(() => pkg.addMember(undefined, 'member')).toThrowError('An undefined type was received when attempting to add a member');
});

it('should throw an error if member is undefined', () => {
    expect(() => pkg.addMember('type', undefined)).toThrowError('An undefined member was received when attempting to add a member');
});

it('should throw an error if member is a part file', () => {
    global.format = "part"
    expect(() => pkg.addMember('type', 'member.part')).toThrowError('Part file received as member is not allowed');
});

it('should not add the member if it already exists', () => {
    pkg.packageJSON.Package.types = [{ name: "type", members: ["member"] }];
    pkg.addMember('type', 'member');
    expect(pkg.packageJSON.Package.types[0].members).toEqual(["member"]);
});

it('should not add the member if type already has an asterisk', () => {
    pkg.packageJSON.Package.types = [{ name: "type", members: ["*"] }];
    pkg.addMember('type', 'member');
    expect(pkg.packageJSON.Package.types[0].members).toEqual(["*"]);
});
