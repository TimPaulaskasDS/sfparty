import * as os from 'node:os'
import { type ChildProcess, execFileSync } from 'child_process'
import type * as fs from 'fs'
import path from 'path'
import type * as fileUtils from './fileUtils.js'

// Security: Validate git references to prevent command injection
function validateGitRef(gitRef: string): string {
	if (!gitRef || typeof gitRef !== 'string') {
		throw new Error('Invalid git reference')
	}

	const trimmed = gitRef.trim()

	// Allow: commit hashes, branch names, ranges, HEAD, tags
	// Deny: shell metacharacters that could enable command injection
	if (!/^[a-zA-Z0-9._\-\/^~]+(\.{2,3}[a-zA-Z0-9._\-\/^~]+)?$/.test(trimmed)) {
		throw new Error('Git reference contains invalid characters')
	}

	return trimmed
}

interface GitDefinition {
	git: {
		lastCommit: string | undefined
		branches?: Record<string, string>
	}
	local: {
		lastDate: Date | undefined
	}
}

const defaultDefinition: GitDefinition = {
	git: {
		lastCommit: undefined,
	},
	local: {
		lastDate: undefined,
	},
}

interface StatusInfo {
	type: string
	action: 'add' | 'delete' | 'ignore'
}

const status: Record<string, StatusInfo> = {
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

export interface GitFileInfo {
	type: string
	path: string
	action: 'add' | 'delete' | 'ignore'
}

interface DiffOptions {
	dir: string
	gitRef?: string
	existsSync: (path: string) => boolean
	spawn: (
		command: string,
		args: string[],
		options?: { cwd: string },
	) => ChildProcess
}

export function diff({
	dir,
	gitRef = 'HEAD',
	existsSync,
	spawn,
}: DiffOptions): Promise<GitFileInfo[]> {
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
			git.on('error', () => {
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
				gitDiff.stdout?.setEncoding('utf8')
				gitDiff.stderr?.on('data', (data: string) => {
					if (data !== '')
						reject(
							new Error(
								`git diff command failed with error: ${data}`,
							),
						)
				})
				gitDiff.stdout?.on('data', (chunk: string) => {
					data += chunk
				})
				gitDiff.stdout?.on('close', (code: number | null) => {
					if (code !== 0 && code !== null) {
						reject(
							new Error(
								`git diff command failed with code ${code}`,
							),
						)
					}
					const gitData = data.toString().split(os.EOL)
					const files = gitData.reduce(
						(acc: GitFileInfo[], gitRow) => {
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
										action: statusType
											? statusType.action
											: 'add',
									})
								}
							}
							return acc
						},
						[],
					)
					resolve(files)
				})
			})
		} catch (error) {
			reject(error)
		}
	})
}

export function log(
	dir: string,
	gitRef: string,
	execFileSyncStub: typeof execFileSync = execFileSync,
): string[] {
	try {
		// Security: Validate git reference before use
		const validatedRef = validateGitRef(gitRef)

		// Security: Use execFileSync with array arguments to prevent command injection
		const gitLog = execFileSyncStub(
			'git',
			['log', '--format=format:%H', validatedRef],
			{
				cwd: dir,
				encoding: 'utf-8',
			},
		)
		const commits = gitLog.split(os.EOL).filter((commit) => commit)
		return commits
	} catch (error) {
		if (error instanceof Error && error.message.indexOf('ENOENT') > -1) {
			error.message = 'git not installed or no entry found in path'
		}
		throw error
	}
}

interface LastCommitOptions {
	dir: string
	fileName?: string
	existsSync: (path: string) => boolean
	execFileSync?: typeof execFileSync
	fileUtils: typeof fileUtils
}

interface LastCommitResult {
	lastCommit: string | undefined
	latestCommit: string
}

export function lastCommit({
	dir,
	fileName = 'index.yaml',
	existsSync,
	execFileSync: execFileSyncStub = execFileSync,
	fileUtils,
}: LastCommitOptions): Promise<LastCommitResult> {
	return new Promise((resolve, reject) => {
		try {
			const folder = path.resolve(dir, '.sfdx', 'sfparty')
			const filePath = path.resolve(folder, fileName)
			let branchSpecificLastCommit: string | undefined

			// Ensure the folder exists
			fileUtils.createDirectory(folder)

			if (existsSync(filePath)) {
				const data = fileUtils.readFile(filePath) as GitDefinition

				// Determine the current branch name
				// Security: Use execFileSync with array arguments
				const currentBranch = execFileSyncStub(
					'git',
					['rev-parse', '--abbrev-ref', 'HEAD'],
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

			// Security: Use execFileSync with array arguments
			const latestCommit = execFileSyncStub(
				'git',
				['log', '--format=format:%H', '-1'],
				{
					cwd: dir,
					encoding: 'utf-8',
				},
			)

			resolve({
				lastCommit: branchSpecificLastCommit,
				latestCommit: latestCommit,
			})
		} catch (error) {
			reject(error)
		}
	})
}

interface UpdateLastCommitOptions {
	dir: string
	latest: string | undefined
	fileUtils: typeof fileUtils
	fs: typeof fs
}

export function updateLastCommit({
	dir,
	latest,
	fileUtils,
	fs,
}: UpdateLastCommitOptions): void {
	if (typeof latest !== 'string' && typeof latest !== 'undefined')
		throw new Error(
			`updateLastCommit received a ${typeof latest} instead of string`,
		)

	if (latest !== undefined) {
		const folder = path.join(dir, '.sfdx', 'sfparty')
		const fileName = path.join(folder, 'index.yaml')
		let data: GitDefinition | undefined = undefined

		if (fileUtils.fileExists({ filePath: fileName, fs })) {
			data = fileUtils.readFile(fileName) as GitDefinition
		}

		if (data === undefined) {
			data = defaultDefinition
		}

		// Determine the current branch name
		// Security: Use execFileSync with array arguments
		const currentBranch = execFileSync(
			'git',
			['rev-parse', '--abbrev-ref', 'HEAD'],
			{
				cwd: dir,
				encoding: 'utf-8',
			},
		).trim()

		// Initialize branches object if not exist
		if (!data.git.branches) {
			data.git.branches = {}
		}

		// Update the last commit for the current branch
		data.git.branches[currentBranch] = latest

		fileUtils.saveFile(data, fileName)
	}
}
