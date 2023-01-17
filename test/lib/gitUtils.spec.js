import * as git from '../../src/lib/gitUtils.js'
import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import fs from 'fs'
import path from 'path'
import * as yaml from 'js-yaml'


chai.use(chaiAsPromised)
const expect = chai.expect

describe('git Util', () => {
    describe('diff function', () => {
        it('should return an array of diff objects', async () => {
            const diffs = await git.diff(process.cwd(), 'HEAD~1..HEAD')
            expect(diffs).to.be.an('array')
            expect(diffs[0]).to.satisfy(diff => {
                if (Object.keys(diff).length === 0) return true
                if (diff.hasOwnProperty('type') && diff.hasOwnProperty('path')) return true
                return false
            })
        })

        it('should map the status to one of add, delete, or ignore', async () => {
            const diffs = await git.diff(process.cwd(), 'HEAD~1..HEAD')
            expect(diffs).to.be.an('array')
            if (diffs[0].hasOwnProperty('type')) {
                expect(diffs[0].type).to.be.oneOf([
                    'add',
                    'copy',
                    'delete',
                    'modify',
                    'rename',
                    'type change',
                    'unmerged',
                    'unknown',
                ])
            }
        })

        it('should reject on stderr data', async () => {
            try {
                await git.diff(process.cwd(), 'invalid-commit1 invalid-commit2')
            } catch (err) {
                expect(err).to.be.an('error')
            }
        })

        it('should return an error if the directory does not exist', function() {
            git.diff('non-existent-dir', 'HEAD').catch(err => {
                expect(err.message).to.equal(`The directory "non-existent-dir" does not exist`)
            })
        })
    
        it('should return an error if the directory is not a git repository', function() {
            git.diff('~/.', 'HEAD').catch(err => {
                expect(err.message).to.equal(`The directory "~/." is not a git repository`)
            })
        })

    })

    describe('log function', () => {
        it('should return an array of commit hashes', async () => {
            const commits = await git.log(process.cwd(), 'HEAD')
            expect(commits).to.be.an('array')
            expect(commits[0]).to.be.a('string')
            expect(commits[0]).to.have.lengthOf(40)
        })

        it('should return an error if git is not installed or not in PATH', async () => {
            try {
                await git.log('path/to/repo', 'HEAD')
            } catch (err) {
                expect(err.message).to.equal('git not installed or no entry found in path')
            }
        })
    })

    describe('latestCommit function', () => {
        it('should return the latest commit hash', async () => {
            const commitHash = await git.latestCommit(process.cwd())
            expect(commitHash).to.be.a('string')
            expect(commitHash).to.have.lengthOf(40)
        })

        it('should return an error if git is not installed or not in PATH', async () => {
            try {
                await git.latestCommit(process.cwd())
            } catch (err) {
                expect(err.message).to.equal('git not installed or no entry found in path')
            }
        })
    })

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
