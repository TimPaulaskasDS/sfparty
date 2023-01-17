import fs from 'fs'
import path from 'path'
import * as yaml from 'js-yaml'
import { Parser } from 'xml2js'
import { expect } from 'chai'
import sinon from 'sinon'
import {
    directoryExists,
    fileExists,
    createDirectory,
    deleteDirectory,
    getFiles,
    getDirectories,
    deleteFile,
    fileInfo,
    saveFile,
    readFile
} from '../../src/lib/fileUtils.js'

describe('fileUtils', () => {
    describe('directoryExists', () => {
        let sandbox;
        beforeEach(() => {
            sandbox = sinon.createSandbox();
        });
        afterEach(() => {
            sandbox.restore();
        });

        it('should return true if directory exists', () => {
            sandbox.stub(fs, 'existsSync').returns(true)
            sandbox.stub(fs, 'statSync').returns({ isDirectory: () => true })
            expect(directoryExists('/path/to/directory', fs)).to.be.true
        })
        it('should return false if directory does not exist', () => {
            sandbox.stub(fs, 'existsSync').returns(false)
            expect(directoryExists('/path/to/directory', fs)).to.be.false
        })
        it('should return false if directory exists but is not a directory', () => {
            sandbox.stub(fs, 'existsSync').returns(true)
            sandbox.stub(fs, 'statSync').returns({ isDirectory: () => false })
            expect(directoryExists('/path/to/directory', fs)).to.be.false
        })
    })

    describe('fileExists', () => {
        let sandbox;
        beforeEach(() => {
            sandbox = sinon.createSandbox();
        });
        afterEach(() => {
            sandbox.restore();
        });

        it('should return true if file exists', () => {
            sandbox.stub(fs, 'existsSync').returns(true)
            sandbox.stub(fs, 'statSync').returns({ isFile: () => true })
            expect(fileExists('/path/to/file', fs)).to.be.true
        })
        it('should return false if file does not exist', () => {
            sandbox.stub(fs, 'existsSync').returns(false)
            expect(fileExists('/path/to/file', fs)).to.be.false
        })
        it('should return false if file exists but is not a file', () => {
            sandbox.stub(fs, 'existsSync').returns(true)
            sandbox.stub(fs, 'statSync').returns({ isFile: () => false })
            expect(fileExists('/path/to/file', fs)).to.be.false
        })
    })

    describe('createDirectory', () => {
        let sandbox;
        beforeEach(() => {
            sandbox = sinon.createSandbox();
        });
        afterEach(() => {
            sandbox.restore();
        });
        it('should create directory if it does not exist', () => {
            sandbox.stub(fs, 'existsSync').returns(false)
            sandbox.stub(fs, 'mkdirSync')
            createDirectory('/path/to/directory', fs)
            sinon.assert.calledOnce(fs.mkdirSync)
        })
        it('should not create directory if it already exists', () => {
            sandbox.stub(fs, 'existsSync').returns(true)
            sandbox.stub(fs, 'mkdirSync')
            createDirectory('/path/to/directory', fs)
            sinon.assert.notCalled(fs.mkdirSync)
        })
    })

    describe('deleteDirectory', () => {
        let sandbox;
        beforeEach(() => {
            sandbox = sinon.createSandbox();
        });
        afterEach(() => {
            sandbox.restore();
        });

        it('should delete directory if it exists', () => {
            sandbox.stub(fs, 'existsSync').returns(true)
            sandbox.stub(fs, 'readdirSync').returns([])
            sandbox.stub(fs, 'statSync').returns({ isDirectory: () => true })
            sandbox.stub(fs, 'rmdirSync')
            deleteDirectory('/path/to/directory', false, fs)
            sinon.assert.calledOnce(fs.rmdirSync)
        })
        it('should not delete directory if it does not exist', () => {
            sandbox.stub(fs, 'existsSync').returns(false)
            sandbox.stub(fs, 'statSync').returns({ isDirectory: () => false })
            sandbox.stub(fs, 'rmdirSync')
            deleteDirectory('/path/to/directory', false, fs)
            sinon.assert.notCalled(fs.rmdirSync)
        })
        it('should delete directory and files', () => {
            sandbox.stub(fs, 'existsSync').returns(true)
            sandbox.stub(fs, 'readdirSync').returns(['file1.txt', 'file2.txt'])
            sandbox.stub(fs, 'statSync').returns({ isDirectory: () => true })
            sandbox.stub(fs, 'lstatSync').returns({ isDirectory: () => false })
            sandbox.stub(fs, 'unlinkSync')
            sandbox.stub(fs, 'rmdirSync')
            deleteDirectory('/path/to/directory', false, fs)
            sinon.assert.calledTwice(fs.unlinkSync)
            sinon.assert.calledOnce(fs.rmdirSync)
        })
    })

    describe('getFiles', () => {
        let sandbox;
        beforeEach(() => {
            sandbox = sinon.createSandbox();
        });
        afterEach(() => {
            sandbox.restore();
        });

        it('should return all files in the directory if filter is undefined', () => {
            sandbox.stub(fs, 'existsSync').returns(true)
            sandbox.stub(fs, 'statSync').returns({ isDirectory: () => true })
            sandbox.stub(fs, 'readdirSync').returns(['file1.txt', 'file2.txt', 'file3.jpg'])
            let files = getFiles('/path/to/directory', undefined, fs)
            expect(files).to.deep.equal(['file1.txt', 'file2.txt', 'file3.jpg'])
        })

        it('should return filtered files in the directory if filter is provided', () => {
            sandbox.stub(fs, 'existsSync').returns(true)
            sandbox.stub(fs, 'statSync').returns({ isDirectory: () => true })
            sandbox.stub(fs, 'readdirSync').returns(['file1.txt', 'file2.txt', 'file3.jpg', 'file4.yaml'])
            let files = getFiles('/path/to/directory', '.yaml', fs)
            expect(files).to.deep.equal(['file4.yaml'])
        })

        it('should return empty array if directory does not exist', () => {
            sandbox.stub(fs, 'existsSync').returns(false)
            sandbox.stub(fs, 'statSync').returns({ isDirectory: () => true })
            sandbox.stub(fs, 'readdirSync').returns(['file1.txt', 'file2.txt'])
            let files = getFiles('/path/to/directory', '.yaml', fs)
            expect(files).to.deep.equal([])
        })
    })

    describe('getDirectories', () => {
        let sandbox;
        beforeEach(() => {
            sandbox = sinon.createSandbox();
        });
        afterEach(() => {
            sandbox.restore();
        });
    
        it('should return all directories in the directory', () => {
            sandbox.stub(fs, 'existsSync').returns(true)
            sandbox.stub(fs, 'statSync').returns({ isDirectory: () => true })
            sandbox.stub(fs, 'readdirSync').returns([
                { name: 'dir1', isDirectory: () => true },
                { name: 'file1.txt', isDirectory: () => false },
                { name: 'dir2', isDirectory: () => true },
                { name: 'file2.txt', isDirectory: () => false }
            ])
            let dirs = getDirectories('/path/to/directory', fs)
            expect(dirs).to.deep.equal(['dir1', 'dir2'])
        })
    
        it('should return empty array if directory does not exist', () => {
            sandbox.stub(fs, 'existsSync').returns(false)
            let dirs = getDirectories('/path/to/directory', fs)
            expect(dirs).to.deep.equal([])
        })
    })
    
    describe('deleteFile', () => {
        let sandbox;
        beforeEach(() => {
            sandbox = sinon.createSandbox();
        });
        afterEach(() => {
            sandbox.restore();
        });
    
        it('should delete the file if it exists', () => {
            sandbox.stub(fs, 'existsSync').returns(true)
            sandbox.stub(fs, 'statSync').returns({ isFile: () => true })
            sandbox.stub(fs, 'unlinkSync')
            deleteFile('path/to/file.txt', fs)
            sinon.assert.calledOnce(fs.unlinkSync)
        })
    
    
        it('should not delete the file if it does not exist', () => {
            sandbox.stub(fs, 'existsSync').returns(false)
            sandbox.stub(fs, 'unlinkSync')
            deleteFile('/path/to/file.txt', fs)
            sinon.assert.notCalled(fs.unlinkSync)
        })   
    })
    
    describe('fileInfo', () => {
        let sandbox;
        beforeEach(() => {
            sandbox = sinon.createSandbox();
        });
        afterEach(() => {
            sandbox.restore();
        });
    
        it('should return file information if file exists', () => {
            sandbox.stub(path, 'parse').returns({
                dir: 'path/to',
                base: 'existingfile.txt',
                ext: '.txt',
                name: 'existingfile'
            })
            sandbox.stub(fs, 'existsSync').returns(true)
            sandbox.stub(fs, 'statSync').returns({
                size: 12345,
                birthtime: new Date()
            })
            let fileResult = fileInfo('path/to/existingfile.txt', fs)
            expect(fileResult).to.have.property('dirname', 'path/to')
            expect(fileResult).to.have.property('basename', 'existingfile')
            expect(fileResult).to.have.property('filename', 'existingfile.txt')
            expect(fileResult).to.have.property('extname', '.txt')
            expect(fileResult).to.have.property('exists', true)
            expect(fileResult).to.have.property('stats')
            expect(fileResult.stats).to.have.property('size', 12345)
            expect(fileResult.stats.birthtime).to.be.a('date')
        })
    })
    
    describe('saveFile', () => {
        let sandbox;
        beforeEach(() => {
            sandbox = sinon.createSandbox();
        });
    
        afterEach(() => {
            sandbox.restore();
        });
    
        it('should write json file correctly', () => {
            const json = { key: 'value' };
            const fileName = 'test.json';
            const format = 'json';
            const fs = { writeFileSync: sandbox.stub() };
    
            expect(saveFile(json, fileName, format, fs)).to.be.true;
            sinon.assert.calledWith(fs.writeFileSync, fileName, JSON.stringify(json, null, '\t'));
        });
    
        it('should write yaml file correctly', () => {
            const json = { key: 'value' };
            const fileName = 'test.yaml';
            const format = 'yaml';
            const fs = { writeFileSync: sandbox.stub() };
    
            expect(saveFile(json, fileName, format, fs)).to.be.true;
            sinon.assert.calledWith(fs.writeFileSync, fileName, yaml.dump(json));
        });
    
        it('should return true if format is not json or yaml', () => {
            const json = { key: 'value' };
            const fileName = 'test.yaml';
            const format = 'txt';
            const fs = { writeFileSync: sandbox.stub() };
    
            expect(saveFile(json, fileName, format, fs)).to.be.true;
            sinon.assert.notCalled(fs.writeFileSync);
        });
    });

describe('readFile', () => {
    let sandbox;
    beforeEach(() => {
        sandbox = sinon.createSandbox();
        sandbox.stub(fs, 'existsSync').returns(true)
        sandbox.stub(fs, 'statSync').returns({ isFile: () => true })
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('should read json file correctly with convert as true', () => {
        const fileName = 'test.json';
        const json = { key: 'value' };
        const fs = { readFileSync: sandbox.stub().returns(JSON.stringify(json)) };

        expect(readFile(fileName, true, fs)).to.deep.equal(json);
        sinon.assert.calledWith(fs.readFileSync, fileName);
    });

    it('should read yaml file correctly with convert as true', () => {
        const fileName = 'test.yaml';
        const json = { key: 'value' };
        const fs = { readFileSync: sandbox.stub().returns(yaml.dump(json)) };

        expect(readFile(fileName, true, fs)).to.deep.equal(json);
        sinon.assert.calledWith(fs.readFileSync, fileName);
    });

    it('should read xml file correctly with convert as true', () => {
        const fileName = 'test.xml';
        const json = { key: 'value' };
        const fs = { readFileSync: sandbox.stub().returns('<xml>value</xml>') };
        const parseString = sandbox.stub(Parser.prototype, 'parseString').callsFake((xml, callback) => callback(null, json));

        expect(readFile(fileName, true, fs)).to.deep.equal(json);
        sinon.assert.calledWith(fs.readFileSync, fileName);
        sinon.assert.calledOnce(parseString);
    });

    it('should return string content of file with convert as false', () => {
        const fileName = 'test.txt';
        const content = 'test content';
        const fs = { readFileSync: sandbox.stub().returns(content) };

        expect(readFile(fileName, false, fs)).to.equal(content);
        sinon.assert.calledWith(fs.readFileSync, fileName);
    });

    it('should return string content of file if file extension is not json, yaml, or xml', () => {
        const fileName = 'test.txt';
        const json = { key: 'value' };
        const fs = { readFileSync: sandbox.stub().returns(JSON.stringify(json)) };

        expect(readFile(fileName, true, fs)).to.equal(JSON.stringify(json));
        sinon.assert.calledWith(fs.readFileSync, fileName);
    });
});

})
