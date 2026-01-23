/**
 * SEC-007: Audit logging for file operations in git mode
 * Logs all file write operations with timestamp, file path, operation type, git commit, and user
 */

import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

interface AuditLogEntry {
	timestamp: string
	operation: 'write' | 'delete' | 'update'
	filePath: string
	gitCommit?: string
	gitBranch?: string
	user?: string
	success: boolean
	error?: string
}

interface GlobalContext {
	__basedir?: string
	git?: {
		enabled: boolean
		lastCommit?: string
		latestCommit?: string
	}
	logger?: {
		error: (message: string) => void
		warn: (message: string) => void
	}
}

declare const global: GlobalContext & typeof globalThis

// SEC-007: Audit log configuration
const MAX_LOG_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_LOG_FILES = 5
const AUDIT_LOG_DIR = '.sfdx/sfparty'
const AUDIT_LOG_FILE = 'audit.log'

let auditLogPath: string | null = null
let logRotationInProgress = false

/**
 * Initialize audit logging (only in git mode)
 */
export function initAuditLogger(workspaceRoot?: string): void {
	if (!global.git?.enabled) {
		return // Only log in git mode
	}

	const baseDir = workspaceRoot || global.__basedir || process.cwd()
	const logDir = path.join(baseDir, AUDIT_LOG_DIR)

	// Ensure log directory exists
	if (!fs.existsSync(logDir)) {
		fs.mkdirSync(logDir, { recursive: true })
	}

	auditLogPath = path.join(logDir, AUDIT_LOG_FILE)
}

/**
 * Get current git branch (if available)
 */
async function getCurrentGitBranch(dir: string): Promise<string | undefined> {
	try {
		const { execFileSync } = await import('child_process')
		const branch = execFileSync(
			'git',
			['rev-parse', '--abbrev-ref', 'HEAD'],
			{
				cwd: dir,
				encoding: 'utf-8',
				stdio: 'pipe',
			},
		)
		return branch.trim()
	} catch {
		return undefined
	}
}

/**
 * Get current user (if available)
 */
function getCurrentUser(): string | undefined {
	return process.env.USER || process.env.USERNAME || undefined
}

/**
 * Rotate audit log files when size limit is reached
 */
async function rotateLogFile(logPath: string): Promise<void> {
	if (logRotationInProgress) {
		return // Prevent concurrent rotations
	}

	try {
		logRotationInProgress = true

		// Check if log file exists and is too large
		if (!fs.existsSync(logPath)) {
			return
		}

		const stats = await fs.promises.stat(logPath)
		if (stats.size < MAX_LOG_SIZE) {
			return // No rotation needed
		}

		const logDir = path.dirname(logPath)
		const logBaseName = path.basename(logPath, path.extname(logPath))
		const logExt = path.extname(logPath)

		// Rotate existing files: audit.log.4 -> audit.log.5, etc.
		for (let i = MAX_LOG_FILES - 1; i >= 1; i--) {
			const oldFile = path.join(logDir, `${logBaseName}.${i}${logExt}`)
			const newFile = path.join(
				logDir,
				`${logBaseName}.${i + 1}${logExt}`,
			)

			if (fs.existsSync(oldFile)) {
				await fs.promises.rename(oldFile, newFile)
			}
		}

		// Move current log to .1
		const firstRotatedFile = path.join(logDir, `${logBaseName}.1${logExt}`)
		await fs.promises.rename(logPath, firstRotatedFile)

		// Create new empty log file
		await fs.promises.writeFile(logPath, '', 'utf8')
	} catch (error) {
		global.logger?.error(
			`Failed to rotate audit log: ${error instanceof Error ? error.message : String(error)}`,
		)
	} finally {
		logRotationInProgress = false
	}
}

/**
 * Write audit log entry (async, non-blocking)
 */
async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
	// Only log in git mode
	if (!global.git?.enabled || !auditLogPath) {
		return
	}

	try {
		// Check if rotation is needed
		await rotateLogFile(auditLogPath)

		// Format entry as JSON line
		const logLine = JSON.stringify(entry) + os.EOL

		// Append to log file (non-blocking)
		await fs.promises.appendFile(auditLogPath, logLine, 'utf8')
	} catch (error) {
		// Don't throw - audit logging failures shouldn't break the application
		global.logger?.warn(
			`Failed to write audit log: ${error instanceof Error ? error.message : String(error)}`,
		)
	}
}

/**
 * Log file write operation
 */
export async function logFileWrite(
	filePath: string,
	success: boolean,
	error?: string,
): Promise<void> {
	if (!global.git?.enabled) {
		return // Only log in git mode
	}

	const baseDir = global.__basedir || process.cwd()
	const gitCommit = global.git.latestCommit || global.git.lastCommit
	const gitBranch = await getCurrentGitBranch(baseDir)
	const user = getCurrentUser()

	// Sanitize file path for logging (remove workspace root if present)
	let sanitizedPath = filePath
	if (baseDir && filePath.startsWith(baseDir)) {
		sanitizedPath = path.relative(baseDir, filePath)
	}

	const entry: AuditLogEntry = {
		timestamp: new Date().toISOString(),
		operation: 'write',
		filePath: sanitizedPath,
		gitCommit,
		gitBranch,
		user,
		success,
		error,
	}

	await writeAuditLog(entry)
}

/**
 * Log file delete operation
 */
export async function logFileDelete(
	filePath: string,
	success: boolean,
	error?: string,
): Promise<void> {
	if (!global.git?.enabled) {
		return // Only log in git mode
	}

	const baseDir = global.__basedir || process.cwd()
	const gitCommit = global.git.latestCommit || global.git.lastCommit
	const gitBranch = await getCurrentGitBranch(baseDir)
	const user = getCurrentUser()

	// Sanitize file path for logging
	let sanitizedPath = filePath
	if (baseDir && filePath.startsWith(baseDir)) {
		sanitizedPath = path.relative(baseDir, filePath)
	}

	const entry: AuditLogEntry = {
		timestamp: new Date().toISOString(),
		operation: 'delete',
		filePath: sanitizedPath,
		gitCommit,
		gitBranch,
		user,
		success,
		error,
	}

	await writeAuditLog(entry)
}

/**
 * Log file update operation
 */
export async function logFileUpdate(
	filePath: string,
	success: boolean,
	error?: string,
): Promise<void> {
	if (!global.git?.enabled) {
		return // Only log in git mode
	}

	const baseDir = global.__basedir || process.cwd()
	const gitCommit = global.git.latestCommit || global.git.lastCommit
	const gitBranch = await getCurrentGitBranch(baseDir)
	const user = getCurrentUser()

	// Sanitize file path for logging
	let sanitizedPath = filePath
	if (baseDir && filePath.startsWith(baseDir)) {
		sanitizedPath = path.relative(baseDir, filePath)
	}

	const entry: AuditLogEntry = {
		timestamp: new Date().toISOString(),
		operation: 'update',
		filePath: sanitizedPath,
		gitCommit,
		gitBranch,
		user,
		success,
		error,
	}

	await writeAuditLog(entry)
}
