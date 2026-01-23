import * as os from 'node:os'
import {
	type ChildProcess,
	execFileSync,
	spawn as nodeSpawn,
} from 'child_process'
import type * as fs from 'fs'
import path from 'path'
import type { AppContext } from '../types/context.js'
import { sanitizeErrorPath } from './errorUtils.js'
import type * as fileUtils from './fileUtils.js'

// SEC-004: Default timeout for git operations (30 seconds)
const DEFAULT_GIT_TIMEOUT = 30000 // 30 seconds in milliseconds

// SEC-004: Get git timeout from environment variable or use default
function getGitTimeout(): number {
	const timeoutEnv = process.env.SFPARTY_GIT_TIMEOUT
	if (timeoutEnv) {
		const timeout = parseInt(timeoutEnv, 10)
		if (!isNaN(timeout) && timeout > 0 && timeout <= 300000) {
			// Max 5 minutes, min 1 second
			return Math.max(1000, Math.min(timeout, 300000))
		}
	}
	return DEFAULT_GIT_TIMEOUT
}

// SEC-004: Create timeout wrapper for spawn operations
function createTimeoutPromise(timeoutMs: number): Promise<never> {
	return new Promise((_, reject) => {
		setTimeout(() => {
			reject(
				new Error(
					`Git operation timed out after ${timeoutMs / 1000} seconds`,
				),
			)
		}, timeoutMs)
	})
}

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
	// SEC-004: Get timeout from environment or use default
	const timeoutMs = getGitTimeout()

	return new Promise((resolve, reject) => {
		// SEC-004: Set up timeout
		const timeoutPromise = createTimeoutPromise(timeoutMs)
		let timeoutCleared = false

		const clearTimeout = () => {
			timeoutCleared = true
		}

		// Race between operation and timeout
		Promise.race([
			new Promise<GitFileInfo[]>((innerResolve, innerReject) => {
				try {
					if (!existsSync(dir)) {
						// SEC-008: Sanitize directory path in error message
						throw new Error(
							`The directory "${sanitizeErrorPath(dir)}" does not exist`,
						)
					}
					if (!existsSync(path.join(dir, '.git'))) {
						// SEC-008: Sanitize directory path in error message
						throw new Error(
							`The directory "${sanitizeErrorPath(dir)}" is not a git repository`,
						)
					}

					const git = spawn('git', ['--version'])
					git.on('error', () => {
						throw new Error('Git is not installed on this machine')
					})
					git.on('close', (code) => {
						if (code !== 0) {
							innerReject(
								new Error(
									`git --version command failed with code ${code}`,
								),
							)
							return
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
							if (data !== '') {
								gitDiff.kill() // Kill process on error
								innerReject(
									new Error(
										`git diff command failed with error: ${data}`,
									),
								)
							}
						})
						gitDiff.stdout?.on('data', (chunk: string) => {
							data += chunk
						})
						gitDiff.stdout?.on('close', (code: number | null) => {
							if (code !== 0 && code !== null) {
								innerReject(
									new Error(
										`git diff command failed with code ${code}`,
									),
								)
								return
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
							clearTimeout()
							innerResolve(files)
						})
						gitDiff.on('error', (error) => {
							clearTimeout()
							innerReject(error)
						})
					})
					git.on('error', (error) => {
						clearTimeout()
						innerReject(error)
					})
				} catch (error) {
					clearTimeout()
					innerReject(error)
				}
			}),
			timeoutPromise,
		])
			.then((result) => {
				if (!timeoutCleared) {
					clearTimeout()
				}
				resolve(result)
			})
			.catch((error) => {
				if (!timeoutCleared) {
					clearTimeout()
				}
				reject(error)
			})
	})
}

// SEC-004: Async wrapper for git log with timeout support
async function execGitWithTimeout(
	command: string[],
	cwd: string,
	timeoutMs: number,
): Promise<string> {
	return new Promise((resolve, reject) => {
		const gitProcess = nodeSpawn('git', command, { cwd })
		let stdout = ''
		let stderr = ''

		// SEC-004: Set up timeout
		const timeout = setTimeout(() => {
			gitProcess.kill()
			reject(
				new Error(
					`Git operation timed out after ${timeoutMs / 1000} seconds`,
				),
			)
		}, timeoutMs)

		gitProcess.stdout?.on('data', (data: Buffer) => {
			stdout += data.toString('utf-8')
		})

		gitProcess.stderr?.on('data', (data: Buffer) => {
			stderr += data.toString('utf-8')
		})

		gitProcess.on('close', (code) => {
			clearTimeout(timeout)
			if (code === 0) {
				resolve(stdout.trim())
			} else {
				reject(
					new Error(
						`Git command failed with code ${code}: ${stderr || stdout}`,
					),
				)
			}
		})

		gitProcess.on('error', (error) => {
			clearTimeout(timeout)
			if (error.message.indexOf('ENOENT') > -1) {
				reject(new Error('git not installed or no entry found in path'))
			} else {
				reject(error)
			}
		})
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

		// SEC-004: Use execFileSync for backward compatibility, but log timeout warning
		// Note: execFileSync doesn't support timeout, but this function is synchronous
		// For timeout support, consider using async version or spawn
		const gitLog = execFileSyncStub(
			'git',
			['log', '--format=format:%H', validatedRef],
			{
				cwd: dir,
				encoding: 'utf-8',
				// Note: timeout option not available in execFileSync
				// For timeout support, use async version with spawn
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

// SEC-004: Async version of log with timeout support
export async function logAsync(dir: string, gitRef: string): Promise<string[]> {
	// Security: Validate git reference before use
	const validatedRef = validateGitRef(gitRef)

	// SEC-004: Get timeout from environment or use default
	const timeoutMs = getGitTimeout()

	const gitLog = await execGitWithTimeout(
		['log', '--format=format:%H', validatedRef],
		dir,
		timeoutMs,
	)
	const commits = gitLog.split(os.EOL).filter((commit) => commit)
	return commits
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

export async function lastCommit({
	ctx,
	dir,
	fileName = 'index.yaml',
	existsSync,
	execFileSync: _execFileSyncStub = execFileSync, // Kept for backward compatibility but not used (SEC-004: using async with timeout)
	fileUtils,
}: LastCommitOptions & { ctx: AppContext }): Promise<LastCommitResult> {
	try {
		const folder = path.resolve(dir, '.sfdx', 'sfparty')
		const filePath = path.resolve(folder, fileName)
		let branchSpecificLastCommit: string | undefined

		// Ensure the folder exists
		await fileUtils.createDirectory(folder)

		// SEC-004: Get timeout from environment or use default (used for all git operations)
		const timeoutMs = getGitTimeout()

		if (existsSync(filePath)) {
			const data = (await fileUtils.readFile(
				ctx,
				filePath,
			)) as GitDefinition

			// Determine the current branch name
			// SEC-004: Use async version with timeout for git operations
			const currentBranch = (
				await execGitWithTimeout(
					['rev-parse', '--abbrev-ref', 'HEAD'],
					dir,
					timeoutMs,
				)
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

		// SEC-004: Use async version with timeout for git operations
		const latestCommit = await execGitWithTimeout(
			['log', '--format=format:%H', '-1'],
			dir,
			timeoutMs,
		)

		return {
			lastCommit: branchSpecificLastCommit,
			latestCommit: latestCommit,
		}
	} catch (error) {
		throw error
	}
}

interface UpdateLastCommitOptions {
	ctx: AppContext
	dir: string
	latest: string | undefined
	fileUtils: typeof fileUtils
	fs: typeof fs
}

export async function updateLastCommit({
	ctx,
	dir,
	latest,
	fileUtils,
	fs,
}: UpdateLastCommitOptions): Promise<void> {
	if (typeof latest !== 'string' && typeof latest !== 'undefined')
		throw new Error(
			`updateLastCommit received a ${typeof latest} instead of string`,
		)

	if (latest !== undefined) {
		const folder = path.join(dir, '.sfdx', 'sfparty')
		const fileName = path.join(folder, 'index.yaml')
		let data: GitDefinition | undefined = undefined

		if (
			await fileUtils.fileExists({
				filePath: fileName,
				fs,
				workspaceRoot: ctx.basedir,
			})
		) {
			data = (await fileUtils.readFile(ctx, fileName)) as GitDefinition
		}

		if (data === undefined) {
			data = defaultDefinition
		}

		// Determine the current branch name
		// SEC-004: Use async version with timeout for git operations
		const timeoutMs = getGitTimeout()
		const currentBranch = (
			await execGitWithTimeout(
				['rev-parse', '--abbrev-ref', 'HEAD'],
				dir,
				timeoutMs,
			)
		).trim()

		// Initialize branches object if not exist
		if (!data.git.branches) {
			data.git.branches = {}
		}

		// Update the last commit for the current branch
		data.git.branches[currentBranch] = latest

		await fileUtils.saveFile(ctx, data, fileName)
	}
}
