
import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { diff } from '../../../src/lib/gitUtils'

jest.mock('fs', () => ({
    existsSync: jest.fn()
}))
jest.mock('child_process', () => ({
    execSync: jest.fn()
}))
const gitRef = "HEAD~1..HEAD"

beforeEach(() => {
    jest.clearAllMocks()
})

test('rejects if directory does not exist', async () => {
    existsSync.mockReturnValueOnce(false)
    try {
        await diff('/path/to/dir')
        fail('Expected function to throw an error', gitRef, existsSync)
    } catch (error) {
        expect(error.message).toEqual('The directory "/path/to/dir" does not exist')
    }
})

test('rejects if .git directory does not exist', async () => {
    existsSync.mockReturnValueOnce(true).mockReturnValueOnce(false)

    try {
        await diff('/path/to/dir', gitRef, existsSync, execSync)
        fail('Expected function to throw an error')
    } catch (error) {
        expect(error.message).toEqual(`The directory "/path/to/dir" is not a git repository`)
    }
})

test('rejects when git is not installed', async () => {
    existsSync.mockReturnValueOnce(true).mockReturnValueOnce(true)
    execSync.mockImplementationOnce(() => { throw new Error('Command failed') })

    try {
        await diff('/path/to/dir', gitRef, existsSync, execSync)
        fail('Expected function to throw an error')
    } catch (error) {
        expect(error.message).toEqual("Git is not installed on this machine")
    }
})

test('resolves with files when git diff command is successful', async () => {
    existsSync.mockReturnValueOnce(true).mockReturnValueOnce(true)
    execSync.mockReturnValueOnce(true).mockReturnValueOnce(
        `A\tfile1.txt
M\tfile2.txt
D\tfile3.txt`)

    const files = await diff('/path/to/dir', gitRef, existsSync, execSync)
    expect(files).toEqual([
        { type: 'add', path: 'file1.txt', action: 'add' },
        { type: 'modify', path: 'file2.txt', action: 'add' },
        { type: 'delete', path: 'file3.txt', action: 'delete' }
    ])
})

test('rejects when git diff command fails', async () => {
    existsSync.mockReturnValueOnce(true).mockReturnValueOnce(true)
    execSync.mockReturnValueOnce(true).mockImplementation(() => { throw new Error('Command failed') })

    try {
        await diff('/path/to/dir', gitRef, existsSync, execSync)
        fail('Expected function to throw an error')
    } catch (error) {
        expect(error.message).toEqual('Command failed')
    }
})

test('ignores files when git diff output does not have a tab character', async () => {
    existsSync.mockReturnValueOnce(true).mockReturnValueOnce(true)
    execSync.mockReturnValueOnce(true).mockReturnValueOnce('file1.txt file2.txt\nM\tfile3.txt')

    const files = await diff('/path/to/dir', gitRef, existsSync, execSync)
    expect(files).toEqual([
        { type: 'modify', path: 'file3.txt', action: 'add' }
    ])
})

test('ignores files when git diff output does not have file name', async () => {
    existsSync.mockReturnValueOnce(true).mockReturnValueOnce(true)
    execSync.mockReturnValueOnce(true).mockReturnValueOnce('\t\t\nM\tfile1.txt\nM\tfile2.txt')

    const files = await diff('/path/to/dir', gitRef, existsSync, execSync)
    expect(files).toEqual([
        { type: 'modify', path: 'file1.txt', action: 'add' },
        { type: 'modify', path: 'file2.txt', action: 'add' }
    ])
})
