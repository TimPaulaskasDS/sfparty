import path from 'path'
import * as os from 'node:os'
import { execSync } from 'child_process'

const defaultDefinition = {
	git: {
		lastCommit: undefined,
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

export function lastCommit({
	dir,
	fileName = 'index.yaml',
	existsSync,
	execSync,
	fileUtils,
}) {
	return new Promise((resolve, reject) => {
		try {
			const folder = path.resolve(dir, '.sfdx', 'sfparty')
			const filePath = path.resolve(folder, fileName)
			let branchSpecificLastCommit

			// Ensure the folder exists
			fileUtils.createDirectory(folder)

			if (existsSync(filePath)) {
				const data = fileUtils.readFile(filePath)

				// Determine the current branch name
				const currentBranch = execSync(
					`git rev-parse --abbrev-ref HEAD`,
					{
						cwd: dir,
						encoding: 'utf-8',
					},
				).trim()

				// Check if branch-specific last commit exists
				if (
					data.git.branches &&
					data.git.branches[currentBranch] !== undefined
				) {
					branchSpecificLastCommit = data.git.branches[currentBranch]
				} else {
					// Fallback to top-level lastCommit if branch-specific commit doesn't exist
					branchSpecificLastCommit = data.git.lastCommit
				}
			}

			const latestCommit = execSync(`git log --format=format:%H -1`, {
				cwd: dir,
				encoding: 'utf-8',
			})

			resolve({
				lastCommit: branchSpecificLastCommit,
				latestCommit: latestCommit,
			})
		} catch (error) {
			reject(error)
		}
	})
}

export function updateLastCommit({ dir, latest, fileUtils, fs }) {
	if (typeof latest !== 'string' && typeof latest !== 'undefined')
		throw new Error(
			`updateLastCommit received a ${typeof latest} instead of string`,
		)

	if (latest !== undefined) {
		const folder = path.join(dir, '.sfdx', 'sfparty')
		const fileName = path.join(folder, 'index.yaml')
		let data = undefined

		if (fileUtils.fileExists({ filePath: fileName, fs })) {
			data = fileUtils.readFile(fileName)
		}

		if (data === undefined) {
			data = defaultDefinition
		}

		// Determine the current branch name
		const currentBranch = execSync(`git rev-parse --abbrev-ref HEAD`, {
			cwd: dir,
			encoding: 'utf-8',
		}).trim()

		// Initialize branches object if not exist
		if (!data.git.branches) {
			data.git.branches = {}
		}

		// Update the last commit for the current branch
		data.git.branches[currentBranch] = latest

		fileUtils.saveFile(data, fileName)
	}
}
