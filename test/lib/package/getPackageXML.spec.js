import * as packageDefinition from '../../../src/meta/Package.js'
import { Package } from '../../../src/lib/packageUtil.js'

let pkg;
const fileUtils = {
    fileExists: jest.fn(),
    readFile: jest.fn(),
}
beforeEach(() => {
    pkg = new Package('xmlPath');
});
global.__basedir = '.'
afterEach(() => {
    jest.clearAllMocks();
});

it('should default the package if the json is empty', async () => {
    fileUtils.fileExists.mockReturnValue(true);
    fileUtils.readFile.mockResolvedValue({});
    global.git = { append: true }
    const result = await pkg.getPackageXML(fileUtils);
    expect(result).toBe('existing');
    expect(fileUtils.fileExists).toHaveBeenCalled();
    expect(fileUtils.readFile).toHaveBeenCalled();
    expect(pkg.packageJSON).toEqual(packageDefinition.metadataDefinition.emptyPackage);
});

it('should read an existing file and call processJSON', async () => {
    fileUtils.fileExists.mockReturnValue(true);
    fileUtils.readFile.mockResolvedValue(packageDefinition.metadataDefinition.emptyPackage);
    global.git = { append: true }
    const result = await pkg.getPackageXML(fileUtils);
    expect(result).toBe('existing');
    expect(fileUtils.fileExists).toHaveBeenCalled();
    expect(fileUtils.readFile).toHaveBeenCalled();
});

it('should create an empty pkg JSON and call processJSON', async () => {
    fileUtils.fileExists.mockReturnValue(false);
    const finalJSON = JSON.parse(JSON.stringify(packageDefinition.metadataDefinition.emptyPackage))
    finalJSON.Package.version = packageDefinition.metadataDefinition.fallbackVersion
    const result = await pkg.getPackageXML(fileUtils);
    expect(result).toBe('not found');
    expect(fileUtils.fileExists).toHaveBeenCalled();
    expect(pkg.packageJSON).toEqual(finalJSON);
});

it('should throw an error if xmlPath is undefined', async () => {
    pkg.xmlPath = undefined;
    await expect(pkg.getPackageXML(fileUtils)).rejects.toThrowError('Package not initialized');
});

it('should throw an error if error occurs during processing', async () => {
    fileUtils.fileExists.mockReturnValue(true);
    fileUtils.readFile.mockRejectedValue(new Error('Error'));
    await expect(pkg.getPackageXML(fileUtils)).rejects.toThrowError('Error');
});
