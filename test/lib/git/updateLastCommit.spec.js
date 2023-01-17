import path from 'path'
import * as fileUtils from '../../../src/lib/fileUtils.js'
import { updateLastCommit } from '../../../src/lib/gitUtils.js'

jest.mock('../../../src/lib/fileUtils.js', () => {
    return {
        fileExists: jest.fn(),
        readFile: jest.fn(),
        saveFile: jest.fn()
    }
})

beforeEach(() => {
    jest.resetModules()
})

afterEach(() => {
    jest.clearAllMocks()
})

it('throws error when latest is not a string or undefined', () => {
    expect(() => updateLastCommit('dir', {})).toThrowError(/string/)
})

it('saves file with updated last commit', () => {
    const dir = 'dir'
    const latest = 'latest'
    const folder = path.join(dir, '.sfdx', 'sfparty')
    const fileName = path.join(folder, 'index.yaml')
    const data = { git: { lastCommit: 'old' } }

    fileUtils.fileExists.mockReturnValue(true)
    fileUtils.readFile.mockReturnValue(data)

    updateLastCommit(dir, latest, fileUtils)

    expect(fileUtils.fileExists).toHaveBeenCalledWith(fileName)
    expect(fileUtils.readFile).toHaveBeenCalledWith(fileName)
    expect(fileUtils.saveFile).toHaveBeenCalledWith({ git: { lastCommit: latest } }, fileName)
})

it('creates file with default definition if it does not exist', () => {
    const dir = 'dir'
    const latest = 'latest'
    const folder = path.join(dir, '.sfdx', 'sfparty')
    const fileName = path.join(folder, 'index.yaml')
    const defaultDefinition = {
        git: {
            lastCommit: latest,
            latestCommit: undefined,
        },
        local: {
            lastDate: undefined,
        }
    }

    fileUtils.fileExists.mockReturnValue(false)
    expect(fileUtils.readFile).not.toHaveBeenCalled()

    updateLastCommit(dir, latest, fileUtils)

    expect(fileUtils.fileExists).toHaveBeenCalledWith(fileName)
    expect(fileUtils.readFile).not.toHaveBeenCalled()
    expect(fileUtils.saveFile).toHaveBeenCalledWith(defaultDefinition, fileName)
})
