import { spawn } from 'node:child_process'

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

export function test(commitFrom, commitTo) {

    const dir = "/Users/tim.paulaskas/git-repos/SalesforceCI"

    let commit = lastCommit(dir)
    commit
        .then((data, error) => {
            console.log(data)
        })
        .catch((error) => {
            global.displayError(error, true)
        })
    let files = getFileStateChanges(dir, commitFrom, commitTo)
    files
        .then((data, error) => {
            console.log(data)
        })
        .catch((error) => {
            global.displayError(error, true)
        })
}

function getFileStateChanges(dir, commitFrom = 'HEAD~1', commitTo = 'HEAD') {
    return new Promise((resolve, reject) => {
        const files = []
        const gitDiff = spawn('git', ['diff', '--name-status', '--oneline', '--relative', `${commitFrom}..${commitTo}`], { cwd: dir })
        gitDiff.stdout.on("data", data => {
            try {
                const gitData = data.toString().split('\n')
                gitData.forEach(gitRow => {
                    const file = gitRow.split('\t')
                    if (file.slice(-1) !== '') {
                        files.push({
                            type: status[(file[0] === file.slice(-1)) ? 'A' : Array.from(file[0])[0]],
                            path: file.slice(-1)[0],
                        })
                    }
                })                   
            } catch (error) {
                reject(error)
            }
        })
        gitDiff.stderr.on("data", data => {
            const errorMessage = 'git diff: ' + data.toString().split('\n')[0]
            reject(errorMessage)
        })
        gitDiff.on('error', (error) => {
            if (error.message.indexOf('ENOENT')) {
                error.message = 'git not installed or no entry found in path'
            }
            reject(error)
        })
        gitDiff.on("close", code => {
            resolve(files)
        })
    })
}

function log(dir, commitFrom = 'HEAD^', commitTo = 'HEAD') {
    return new Promise((resolve, reject) => {
        const commits = []
        const gitLog = spawn('git', ['log', '--format=format:%H', `${commitFrom}..${commitTo}`], { cwd: dir })
        gitLog.stdout.on("data", data => {
            commits.push(data.toString().split('\n')[0])
        })
        gitLog.stderr.on("data", data => {
            const errorMessage = data.toString().split('\n')[0]
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

function lastCommit(dir) {
    return new Promise((resolve, reject) => {
        const commits = []
        const gitLog = spawn('git', ['log', '--format=format:%H', '-1'], { cwd: dir })
        gitLog.stdout.on("data", data => {
            commits.push(data.toString().split('\n')[0])
        })
        gitLog.stderr.on("data", data => {
            const errorMessage = data.toString().split('\n')[0]
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
            resolve((commits.length > 0) ? commits[0] : undefined)
        })
    })
}