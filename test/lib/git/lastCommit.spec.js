import path from 'path'
import { execSync } from 'child_process'
import * as fileUtils from '../../../src/lib/fileUtils.js'
import { lastCommit } from '../../../src/lib/gitUtils.js'

jest.mock('../../../src/lib/fileUtils.js', () => {
    return {
        createDirectory: jest.fn(),
        readFile: jest.fn()
    }
})

jest.mock('child_process', () => {
    return {
        execSync: jest.fn()
    }
})

beforeEach(() => {
    jest.resetAllMocks()
})

it('should return the last commit and latest commit', () => {
    const dir = '.'
    const fileName = 'index.yaml'
    const folder = path.resolve(dir, '.sfdx', 'sfparty')
    const filePath = path.resolve(folder, fileName)
    const lastCommitHash = '16d69f0cf3d902a900a0609177fe5cf0fda9a961'
    const latestCommitHash = '16d69f0cf3d902a900a0609177fe5cf0fda9a961'
    fileUtils.createDirectory.mockReturnValue(undefined)
    fileUtils.readFile.mockReturnValue({ git: { lastCommit: lastCommitHash } })
    execSync.mockReturnValue(latestCommitHash)
    const result = lastCommit(dir, fileName, execSync, fileUtils)
    expect(fileUtils.createDirectory).toHaveBeenCalledWith(folder)
    expect(fileUtils.readFile).toHaveBeenCalledWith(filePath)
    expect(execSync).toHaveBeenCalledWith(`git log --format=format:%H -1`, { cwd: dir, encoding: 'utf-8' })
    expect(result).toEqual({lastCommit: lastCommitHash, latestCommit: latestCommitHash })
})

it('should return the latest commit if no lastCommit is found', () => {
    const dir = '.'
    const fileName = 'index.yaml'
    const folder = path.resolve(dir, '.sfdx', 'sfparty')
    const filePath = path.resolve(folder, fileName)
    const latestCommit = '16d69f0cf3d902a900a0609177fe5cf0fda9a961'
    fileUtils.createDirectory.mockReturnValue(undefined)
    fileUtils.readFile.mockReturnValue({ git: {} })
    execSync.mockReturnValue(latestCommit)
    const result = lastCommit(dir, fileName, execSync, fileUtils)
    expect(fileUtils.createDirectory).toHaveBeenCalledWith(folder)
    expect(fileUtils.readFile).toHaveBeenCalledWith(filePath)
    expect(execSync).toHaveBeenCalledWith(`git log --format=format:%H -1`, { cwd: dir, encoding: 'utf-8' })
    expect(result).toEqual({ lastCommit: undefined, latestCommit })
})

it('should throw an error when fileUtils.readFile is called', () => {
    const dir = '.'
    const fileName = 'index.yaml'
    const folder = path.resolve(dir, '.sfdx', 'sfparty')
    const filePath = path.resolve(folder, fileName)
    const errorMessage = 'Error reading file'
    fileUtils.createDirectory.mockReturnValue(undefined)
    fileUtils.readFile.mockImplementation(() => { throw new Error(errorMessage) })
    expect(() => lastCommit(dir, fileName, execSync, fileUtils)).toThrowError(errorMessage)
    expect(fileUtils.createDirectory).toHaveBeenCalledWith(folder)
    expect(fileUtils.readFile).toHaveBeenCalledWith(filePath)
})
