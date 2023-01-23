import path from 'path'
import fs from 'fs'
import { spawn, execSync } from 'node:child_process'
import * as os from 'node:os'
import * as fileUtils from './fileUtils.js'

const defaultDefinition = {
	git: {
		lastCommit: undefined,
		latestCommit: undefined,
	},
	local: {
		lastDate: undefined,
	},
}

const status = {
	A: {
		type: 'add',
		action: 'add',
	},
	C: {
		type: 'copy',
		action: 'add',
	},
	D: {
		type: 'delete',
		action: 'delete',
	},
	M: {
		type: 'modify',
		action: 'add',
	},
	R: {
		type: 'rename',
		action: 'add',
	},
	T: {
		type: 'type change',
		action: 'add',
	},
	U: {
		type: 'unmerged',
		action: 'ignore',
	},
	X: {
		type: 'unknown',
		action: 'ignore',
	},
}

export function diff({ dir, gitRef = 'HEAD', existsSync, spawn }) {
	return new Promise((resolve, reject) => {
		try {
			if (!existsSync(dir)) {
				throw new Error(`The directory "${dir}" does not exist`)
			}
			if (!existsSync(path.join(dir, '.git'))) {
				throw new Error(
					`The directory "${dir}" is not a git repository`,
				)
			}

			const git = spawn('git', ['--version'])
			git.on('error', (err) => {
				throw new Error('Git is not installed on this machine')
			})
			git.on('close', (code) => {
				if (code !== 0) {
					reject(
						new Error(
							`git --version command failed with code ${code}`,
						),
					)
				}

				const gitDiff = spawn(
					'git',
					[
						'diff',
						'--name-status',
						'--oneline',
						'--no-renames',
						'--relative',
						gitRef,
						'--',
						'*-party/*',
					],
					{ cwd: dir },
				)
				let data = ''
				gitDiff.stdout.setEncoding('utf8')
				gitDiff.stderr.on('data', (data) => {
					if (data !== '')
						reject(
							new Error(
								`git diff command failed with error: ${data}`,
							),
						)
				})
				gitDiff.stdout.on('data', (chunk) => {
					data += chunk
				})
				gitDiff.stdout.on('close', (code) => {
					if (code !== 0 && code !== false) {
						reject(
							new Error(
								`git diff command failed with code ${code}`,
							),
						)
					}
					const gitData = data.toString().split(os.EOL)
					const files = gitData.reduce((acc, gitRow) => {
						if (gitRow.lastIndexOf('\t') > 0) {
							const file = gitRow.split('\t')
							if (file.slice(-1)[0] !== '') {
								const statusType = status[file[0]]
								acc.push({
									type:
										statusType !== undefined
											? statusType.type
											: 'A',
									path: file.slice(-1)[0],
									action: statusType.action,
								})
							}
						}
						return acc
					}, [])
					resolve(files)
				})
			})
		} catch (error) {
			reject(error)
		}
	})
}

export function log(dir, gitRef, execSyncStub = execSync) {
	try {
		const gitLog = execSyncStub(`git log --format=format:%H ${gitRef}`, {
			cwd: dir,
			encoding: 'utf-8',
		})
		const commits = gitLog.split(os.EOL).filter((commit) => commit)
		return commits
	} catch (error) {
		if (error.message.indexOf('ENOENT') > -1) {
			error.message = 'git not installed or no entry found in path'
		}
		throw error
	}
}

export function lastCommit(
	dir,
	fileName = 'index.yaml',
	existsSyncStub = fs.existsSync,
	execSyncStub = execSync,
	fileUtilsStub = fileUtils,
) {
	return new Promise((resolve, reject) => {
		try {
			const folder = path.resolve(dir, '.sfdx', 'sfparty')
			const filePath = path.resolve(folder, fileName)
			let lastCommit = undefined

			fileUtilsStub.createDirectory(folder)
			if (existsSyncStub(filePath)) {
				const data = fileUtilsStub.readFile(filePath)
				if (data.git.lastCommit !== undefined) {
					lastCommit = data.git.lastCommit
				}
			}
			const latestCommit = execSyncStub(`git log --format=format:%H -1`, {
				cwd: dir,
				encoding: 'utf-8',
			})
			resolve({
				lastCommit: lastCommit,
				latestCommit: latestCommit,
			})
		} catch (error) {
			reject(error)
		}
	})
}

export function updateLastCommit(dir, latest, fileUtilsStub = fileUtils) {
	if (typeof latest !== 'string' && typeof latest !== 'undefined')
		throw new Error(
			`updateLastCommit received a ${typeof latest} instead of string`,
		)
	if (latest !== undefined) {
		const folder = path.join(dir, '.sfdx', 'sfparty')
		const fileName = path.join(folder, 'index.yaml')
		let data = undefined
		if (fileUtilsStub.fileExists({ filePath: fileName, fs })) {
			data = fileUtilsStub.readFile(fileName)
		}

		if (data === undefined) {
			data = defaultDefinition
		}

		data.git.lastCommit = latest
		fileUtilsStub.saveFile(data, fileName)
	}
}
