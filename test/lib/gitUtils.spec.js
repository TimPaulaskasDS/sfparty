import * as git from '../../src/lib/gitUtils.js'
import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import fs from 'fs'
import path from 'path'
import * as yaml from 'js-yaml'


chai.use(chaiAsPromised)
const expect = chai.expect

describe('git Util', () => {
    describe('lastCommit function', () => {
        it('should return an error if the file is not in the repository', async () => {
            try {
                await git.lastCommit(process.cwd(), 'invalid-index.yaml')
            } catch (err) {
                expect(err.message).to.equal('file not found in repository')
            }
        })
    
        it('should return an error if git is not installed or not in PATH', async () => {
            try {
                await git.lastCommit(process.cwd())
            } catch (err) {
                expect(err.message).to.equal('git not installed or no entry found in path')
            }
        })
        
        it('should return the last commit hash for a given file', async () => {
            const commitHash = await git.lastCommit(process.cwd())
            expect(commitHash).to.be.an('object')
            expect(commitHash).to.have.all.keys('lastCommit', 'latestCommit')
            expect(commitHash.lastCommit).to.satisfy(val => val === undefined || (val.length === 40 && /^[a-f0-9]+$/.test(val)))
            expect(commitHash.latestCommit).to.satisfy(val =>val === undefined || (val.length === 40 && /^[a-f0-9]+$/.test(val)))
        })
    })

    describe('updateLastCommit function', () => {
        it('should update the last commit hash for a file', async () => {
            const dir = process.cwd()
            const commitHash = await git.lastCommit(dir)
            const lastCommitHash = '16d69f0cf3d902a900a0609177fe5cf0fda9a965'
            git.updateLastCommit(dir, lastCommitHash)
            const folder = path.join(dir, '.sfdx', 'sfparty')
            const fileName = path.join(folder, 'index.yaml')
            const fileData1 = yaml.load(fs.readFileSync(fileName))
            expect(fileData1.git.lastCommit).to.equal(lastCommitHash)
            git.updateLastCommit(dir, commitHash.lastCommit)
            const fileData2 = yaml.load(fs.readFileSync(fileName))
            expect(fileData2.git.lastCommit).to.satisfy((val) => val === commitHash.lastCommit)
        })
    })
})
