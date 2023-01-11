import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

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

export function diff(commitFrom = undefined, commitTo = undefined) {

    const dir = "/Users/tim.paulaskas/git-repos/SalesforceCI"
    if (commitFrom === undefined) commitFrom = "HEAD~1"
    if (commitTo === undefined) commitTo = "HEAD"

    let log = logCommits(dir)
    log.then((data, error) => {
        console.log(data)
    })
    let files =  getFileStateChanges(commitFrom, commitTo, dir)
    files.then((data, error) => {
        console.log(data)
    })
}

function getFileStateChanges(commitFrom, commitTo, dir) {
    return new Promise((resolve, reject) => {
        const files = []
        const gitDiff = spawn('git', ['diff', '--name-status', '--oneline', '--relative', `${commitFrom}..${commitTo}`], { cwd: dir })
        gitDiff.stdout.on("data", data => {
            const gitData = data.toString().split('\n')
            gitData.forEach(gitRow => {
                const file = gitRow.split('\t')
                try {
                    if (file.slice(-1) !== '') {
                        files.push({
                            type: status[(file[0] === file.slice(-1)) ? 'A' : Array.from(file[0])[0]],
                            path: file.slice(-1)[0],
                        })                               
                    }
                } catch (error) {
                    throw error
                }
            })
        })
    
        gitDiff.stderr.on("data", data => {
            const errorMessage = data.toString().split('\n')[0]
            global.logger.error(`git diff: ${errorMessage}`)
            reject(errorMessage)
        })
    
        gitDiff.on('error', (error) => {
            console.log(`error: ${error.message}`)
        })
    
        gitDiff.on("close", code => {
            resolve(files)
        })    
    })
}

function logCommits(dir, commitFrom = 'HEAD^', commitTo = 'HEAD') {
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
            console.log(`error: ${error.message}`)
        })
    
        gitLog.on("close", code => {
            resolve(commits)
        })    
    })
}