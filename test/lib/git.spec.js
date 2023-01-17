import { expect } from 'chai'
import sinon from 'sinon'
import fs from 'fs'
import child_process from 'child_process'
import os from 'node:os'
import { diff, log, lastCommit } from '../../src/lib/gitUtils.js'
import * as fileUtils from '../../src/lib/fileUtils.js'

describe('git', () => {

    describe('diff function', () => {
        let sandbox
        beforeEach(() => {
            sandbox = sinon.createSandbox()
        })

        afterEach(() => {
            sandbox.restore()
        })

        it('should return files array if dir and gitRef are provided', async () => {
            sandbox.stub(fs, 'existsSync').returns(true)
            sandbox.stub(child_process, 'execSync').returns('A\tfile1\nM\tfile2\nD\tfile3')
    
            const result = await diff('/path/to/dir', 'HEAD', fs.existsSync, child_process.execSync)
            expect(result).to.deep.equal([
                { type: 'add', path: 'file1', action: 'add' },
                { type: 'modify', path: 'file2', action: 'add' },
                { type: 'delete', path: 'file3', action: 'delete' }
            ])
        })

        it('should throw an error if dir is not a git repository', async () => {
            sandbox.stub(fs, 'existsSync').returns(false)
    
            try {
                await diff('/path/to/dir', 'HEAD', fs.existsSync, child_process.execSync)
                throw new Error('Unexpected behavior')
            } catch (error) {
                expect(error.message).to.equal(`The directory "/path/to/dir" is not a git repository`)
            }
        })

        it('should throw an error if gitRef not exist', async () => {
            sandbox.stub(fs, 'existsSync').returns(true)
            sandbox.stub(child_process, 'execSync').throws(new Error('gitRef not exist'))
            try {
                await diff('/path/to/dir', 'HEAD', fs.existsSync, child_process.execSync)
                throw new Error('Unexpected behavior')
            } catch (error) {
                expect(error.message).to.equal(`gitRef not exist`)
            }
        })
    })

    describe('log', () => {
        let sandbox
        beforeEach(() => {
            sandbox = sinon.createSandbox()
        })
    
        afterEach(() => {
            sandbox.restore()
        })
    
        it('should return an array of commits', () => {
            // Stub execSync to return a string of commits
            sandbox.stub(child_process, 'execSync').returns('abc123\ndef456\nghi789')
    
            const commits = log('/path/to/repo', 'master', child_process.execSync)
    
            expect(commits).to.deep.equal(['abc123', 'def456', 'ghi789'])
        })
    
        it('should throw an error if git is not installed', () => {
            // Stub execSync to throw an ENOENT error
            sandbox.stub(child_process, 'execSync').throws(new Error('ENOENT'))
    
            expect(() => log('/path/to/repo', 'master', child_process.execSync)).to.throw('git not installed or no entry found in path')
        })
    })        
})


