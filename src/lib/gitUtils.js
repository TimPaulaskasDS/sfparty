import path from 'path'
import { spawn } from 'node:child_process'
import * as os from 'node:os'
import * as fileUtils from './fileUtils.js'

const defaultDefinition = {
    git: {
        lastCommit: undefined,
    },
    local: {
        lastDate: undefined,
    }
}

const status = {
    A: 'add',
    C: 'copy',
    D: 'delete',
    M: 'modify',
    R: 'rename',
    T: 'type change',
    U: 'unmerged',
    X: 'unknown',
}

export const action = {
    add: 'add',
    copy: 'add',
    delete: 'delete',
    modify: 'add',
    rename: 'ignore',
    change: 'ignore',
    unmerged: 'ignore',
    unknown: 'ignore',
}

export function diff(dir, gitRef) {
    return new Promise((resolve, reject) => {
        let data = ''
        const files = []
        const gitDiff = spawn('git', ['diff', '--name-status', '--oneline', '--relative', `${gitRef}`], { cwd: dir })
        gitDiff.stdout.on("data", result => {
            const gitString = result.toString()
            const lastIndex = gitString.lastIndexOf(os.EOL)
            let count = (gitString.match(/\n/g) || []).length;
            data += gitString
            const gitData = gitString.split(os.EOL)
            let leftOver = ''
            gitData.forEach((gitRow, index) => {
                if (gitRow.indexOf('\t') !== -1 &&(index < count || lastIndex + 1 == gitString)) {
                    const file = gitRow.split('\t')
                    if (file.slice(-1)[0] == 'uthorizationFormConsent.yaml') {
                        let test = true
                    }
                    if (file.slice(-1) !== '') {
                        files.push({
                            type: status[(file[0] === file.slice(-1)) ? 'A' : Array.from(file[0])[0]],
                            path: file.slice(-1)[0],
                        })
                    }
                } else {
                    leftOver = gitRow
                }
                if (leftOver !== '') {
                    data = leftOver
                } else {
                    data = ''
                }
            })
        })
        gitDiff.stderr.on("data", data => {
            const errorMessage = 'git diff: ' + data.toString().split(os.EOL)[0]
            reject(errorMessage)
        })
        gitDiff.on('error', (error) => {
            if (error.message.indexOf('ENOENT')) {
                error.message = 'git not installed or no entry found in path'
            }
            reject(error)
        })
        gitDiff.on("close", code => {
            if (data !== '') {
                const gitData = data.toString().split(os.EOL)
                gitData.forEach(gitRow => {
                    const file = gitRow.split('\t')
                    if (file.slice(-1) !== '') {
                        files.push({
                            type: status[(file[0] === file.slice(-1)) ? 'A' : Array.from(file[0])[0]],
                            path: file.slice(-1)[0],
                        })
                    }
                })    
            }

            resolve(files)
        })
    })
}

export function log(dir, gitRef) {
    return new Promise((resolve, reject) => {
        const commits = []
        const gitLog = spawn('git', ['log', '--format=format:%H', `${gitRef}`], { cwd: dir })
        gitLog.stdout.on("data", data => {
            commits.push(data.toString().split(os.EOL)[0])
        })
        gitLog.stderr.on("data", data => {
            const errorMessage = data.toString().split(os.EOL)[0]
            global.logger.error(`git log: ${errorMessage}`)
            reject(errorMessage)
        })
        gitLog.on('error', (error) => {
            if (error.message.indexOf('ENOENT')) {
                error.message = 'git not installed or no entry found in path'
            }
            reject(error)
        })
        gitLog.on("close", code => {
            resolve(commits)
        })
    })
}

export function latestCommit(dir) {
    return new Promise((resolve, reject) => {
        const commit = log(dir, '-1')
        commit
            .then((data, error) => {
                resolve(data[0])
            })
            .catch((error) => {
                reject(error)
            })
    })
}

export function lastCommit(dir) {
    return new Promise((resolve, reject) => {
        const folder = path.join(dir, '.sfdx', 'sfparty')
        const fileName = path.join(folder, 'index.yaml')
        let last = undefined
        let latest = undefined
        fileUtils.createDirectory(folder)
        if (fileUtils.fileExists(fileName)) {
            const data = fileUtils.readFile(fileName)
            if (data.git.lastCommit !== undefined) {
                last = data.git.lastCommit
            }
        }
        const commit = latestCommit(dir)
        commit
            .then((data, error) => {
                latest = data
                resolve({
                    last: last,
                    latest: latest,
                })
            })
            .catch((error) => {
                reject(error)
            })

    })
}

export function updateLastCommit(dir, latest) {
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