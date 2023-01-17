import path from 'path'
import { execSync } from 'node:child_process'
import * as os from 'node:os'
import { existsSync } from 'fs'
import * as fileUtils from './fileUtils.js'

const defaultDefinition = {
    git: {
        lastCommit: undefined,
        latestCommit: undefined,
    },
    local: {
        lastDate: undefined,
    }
}

const status = {
    A: {
        type: 'add',
        action: 'add'
    },
    C: {
        type: 'copy',
        action: 'add',
    },
    D: {
        type: 'delete',
        action: 'delete'
    },
    M: {
        type: 'modify',
        action: 'add'
    },
    R: {
        type: 'rename',
        action: 'add'
    },
    T: {
        type: 'type change',
        action: 'add'
    },
    U: {
        type: 'unmerged',
        action: 'ignore'
    },
    X: {
        type: 'unknown',
        action: 'ignore'
    },
}

export function diff(dir, gitRef = 'HEAD', tmpExistsSync = existsSync, tmpExecSync = execSync) {
    return new Promise((resolve, reject) => {
        if (!tmpExistsSync(dir) || !tmpExistsSync(path.join(dir, '.git'))) {
            reject(new Error(`The directory "${dir}" is not a git repository`))
        }

        let data = ''
        try {
            data = tmpExecSync(`git diff --name-status --oneline --relative ${gitRef}`, { cwd: dir }).toString()
        } catch (error) {
            reject(error)
        }

        const gitData = data.toString().split(os.EOL)
        const files = gitData.reduce((acc, gitRow) => {
            if (gitRow.indexOf('\t') > 0) {
                const file = gitRow.split('\t')
                if (file.slice(-1) !== '') {
                    const statusType = status[(file[0] === file.slice(-1)) ? 'A' : Array.from(file[0])[0]];
                    acc.push({
                        type: statusType.type,
                        path: file.slice(-1)[0],
                        action: statusType.action
                    });
                }
            }
            return acc;   
        }, []);
        resolve(files);
    })
}

export function log(dir, gitRef, tmpExecSync = execSync) {
    try {
        const gitLog = tmpExecSync(`git log --format=format:%H ${gitRef}`, { cwd: dir, encoding: 'utf-8' });
        const commits = gitLog.split(os.EOL).filter(commit => commit)
        return commits
    } catch (error) {
        if (error.message.indexOf('ENOENT') > -1) {
            error.message = 'git not installed or no entry found in path'
        }
        throw error
    }
}

export function lastCommit(dir, fileName = 'index.yaml') {
    try {
        const folder = path.resolve(dir, '.sfdx', 'sfparty')
        const filePath = path.resolve(folder, fileName)
        let lastCommit = undefined

        fileUtils.createDirectory(folder)
        if (existsSync(filePath)) {
            const data = fileUtils.readFile(filePath)
            if (data.git.lastCommit !== undefined) {
                lastCommit = data.git.lastCommit
            }
        }
        const latestCommit = execSync(`git log --format=format:%H -1`, { cwd: dir, encoding: 'utf-8' }).toString().trim()
        return {
            lastCommit: lastCommit,
            latestCommit: latestCommit,
        }
    } catch (error) {
        throw new Error(error)
    }
}

export function updateLastCommit(dir, latest) {
    if (typeof latest !== 'string' && typeof latest !== 'undefined') throw new Error(`updateLastCommit received a ${typeof latest} instead of string`)
    if (latest !== undefined) {
        const folder = path.join(dir, '.sfdx', 'sfparty')
        const fileName = path.join(folder, 'index.yaml')
        let data = undefined
        if (fileUtils.fileExists(fileName)) {
            data = fileUtils.readFile(fileName)
        }

        if (data === undefined) {
            data = defaultDefinition
        }

        data.git.lastCommit = latest
        fileUtils.saveFile(data, fileName)
    }
}