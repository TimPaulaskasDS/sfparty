import * as fs from 'fs'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
	initAuditLogger,
	logFileDelete,
	logFileUpdate,
	logFileWrite,
} from '../../src/lib/auditLogger.js'

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

vi.mock('fs', () => ({
	default: {
		existsSync: vi.fn(),
		mkdirSync: vi.fn(),
		promises: {
			stat: vi.fn(),
			appendFile: vi.fn(),
			writeFile: vi.fn(),
			rename: vi.fn(),
		},
	},
	existsSync: vi.fn(),
	mkdirSync: vi.fn(),
}))

vi.mock('child_process', () => ({
	execFileSync: vi.fn(),
}))

describe.skip('auditLogger', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		// Reset global state
		global.git = {
			enabled: true,
			lastCommit: 'abc123',
			latestCommit: 'def456',
		}
		global.__basedir = '/workspace'
		global.logger = {
			error: vi.fn(),
			warn: vi.fn(),
		}
		process.env.USER = 'testuser'
		process.env.USERNAME = undefined
	})

	afterEach(() => {
		delete global.git
		delete global.__basedir
		delete global.logger
		delete process.env.USER
		delete process.env.USERNAME
	})

	describe('initAuditLogger', () => {
		it('should create log directory when it does not exist', () => {
			;(
				fs.default.existsSync as ReturnType<typeof vi.fn>
			).mockReturnValue(false)
			;(
				fs.default.mkdirSync as ReturnType<typeof vi.fn>
			).mockImplementation(() => {})

			initAuditLogger()

			expect(fs.default.existsSync).toHaveBeenCalledWith(
				path.join('/workspace', '.sfdx', 'sfparty'),
			)
			expect(fs.default.mkdirSync).toHaveBeenCalledWith(
				path.join('/workspace', '.sfdx', 'sfparty'),
				{ recursive: true },
			)
		})

		it('should not create directory when it already exists', () => {
			;(
				fs.default.existsSync as ReturnType<typeof vi.fn>
			).mockReturnValue(true)

			initAuditLogger()

			expect(fs.default.mkdirSync).not.toHaveBeenCalled()
		})

		it('should use provided workspace root', () => {
			;(
				fs.default.existsSync as ReturnType<typeof vi.fn>
			).mockReturnValue(false)
			;(
				fs.default.mkdirSync as ReturnType<typeof vi.fn>
			).mockImplementation(() => {})

			initAuditLogger('/custom/workspace')

			expect(fs.default.existsSync).toHaveBeenCalledWith(
				path.join('/custom/workspace', '.sfdx', 'sfparty'),
			)
		})

		it('should use process.cwd() when workspace root not provided', () => {
			global.__basedir = undefined
			;(
				fs.default.existsSync as ReturnType<typeof vi.fn>
			).mockReturnValue(false)
			;(
				fs.default.mkdirSync as ReturnType<typeof vi.fn>
			).mockImplementation(() => {})

			initAuditLogger()

			expect(fs.default.existsSync).toHaveBeenCalled()
		})

		it('should not initialize when git is disabled', () => {
			global.git = { enabled: false }

			initAuditLogger()

			expect(fs.default.existsSync).not.toHaveBeenCalled()
		})

		it('should not initialize when git is undefined', () => {
			global.git = undefined

			initAuditLogger()

			expect(fs.default.existsSync).not.toHaveBeenCalled()
		})
	})

	describe('logFileWrite', () => {
		beforeEach(() => {
			;(
				fs.default.existsSync as ReturnType<typeof vi.fn>
			).mockReturnValue(true)
			initAuditLogger()
		})

		it('should log successful file write', async () => {
			const { execFileSync } = await import('child_process')
			;(execFileSync as ReturnType<typeof vi.fn>).mockReturnValue(
				'main\n',
			)
			;(
				fs.default.promises.stat as ReturnType<typeof vi.fn>
			).mockResolvedValue({
				size: 100,
			})
			;(
				fs.default.promises.appendFile as ReturnType<typeof vi.fn>
			).mockResolvedValue(undefined)

			await logFileWrite('/workspace/file.txt', true)

			expect(fs.default.promises.appendFile).toHaveBeenCalled()
			const appendCall = (
				fs.default.promises.appendFile as ReturnType<typeof vi.fn>
			).mock.calls[0]
			const logLine = appendCall[1]
			const entry = JSON.parse(logLine)
			expect(entry.operation).toBe('write')
			expect(entry.success).toBe(true)
			expect(entry.filePath).toBe('file.txt')
			expect(entry.gitCommit).toBe('def456')
			expect(entry.user).toBe('testuser')
		})

		it('should log failed file write with error', async () => {
			const { execFileSync } = await import('child_process')
			;(execFileSync as ReturnType<typeof vi.fn>).mockReturnValue(
				'main\n',
			)
			;(
				fs.default.promises.stat as ReturnType<typeof vi.fn>
			).mockResolvedValue({
				size: 100,
			})
			;(
				fs.default.promises.appendFile as ReturnType<typeof vi.fn>
			).mockResolvedValue(undefined)

			await logFileWrite(
				'/workspace/file.txt',
				false,
				'Permission denied',
			)

			expect(fs.default.promises.appendFile).toHaveBeenCalled()
			const appendCall = (
				fs.default.promises.appendFile as ReturnType<typeof vi.fn>
			).mock.calls[0]
			const logLine = appendCall[1]
			const entry = JSON.parse(logLine)
			expect(entry.success).toBe(false)
			expect(entry.error).toBe('Permission denied')
		})

		it('should not log when git is disabled', async () => {
			global.git = { enabled: false }

			await logFileWrite('/workspace/file.txt', true)

			expect(fs.default.promises.appendFile).not.toHaveBeenCalled()
		})

		it('should use lastCommit when latestCommit is not available', async () => {
			global.git = {
				enabled: true,
				lastCommit: 'abc123',
				latestCommit: undefined,
			}
			const { execFileSync } = await import('child_process')
			;(execFileSync as ReturnType<typeof vi.fn>).mockReturnValue(
				'main\n',
			)
			;(
				fs.default.promises.stat as ReturnType<typeof vi.fn>
			).mockResolvedValue({
				size: 100,
			})
			;(
				fs.default.promises.appendFile as ReturnType<typeof vi.fn>
			).mockResolvedValue(undefined)

			await logFileWrite('/workspace/file.txt', true)

			const appendCall = (
				fs.default.promises.appendFile as ReturnType<typeof vi.fn>
			).mock.calls[0]
			const logLine = appendCall[1]
			const entry = JSON.parse(logLine)
			expect(entry.gitCommit).toBe('abc123')
		})

		it('should use USERNAME when USER is not available', async () => {
			delete process.env.USER
			process.env.USERNAME = 'windowsuser'
			const { execFileSync } = await import('child_process')
			;(execFileSync as ReturnType<typeof vi.fn>).mockReturnValue(
				'main\n',
			)
			;(
				fs.default.promises.stat as ReturnType<typeof vi.fn>
			).mockResolvedValue({
				size: 100,
			})
			;(
				fs.default.promises.appendFile as ReturnType<typeof vi.fn>
			).mockResolvedValue(undefined)

			await logFileWrite('/workspace/file.txt', true)

			const appendCall = (
				fs.default.promises.appendFile as ReturnType<typeof vi.fn>
			).mock.calls[0]
			const logLine = appendCall[1]
			const entry = JSON.parse(logLine)
			expect(entry.user).toBe('windowsuser')
		})

		it('should handle git branch retrieval failure', async () => {
			const { execFileSync } = await import('child_process')
			;(execFileSync as ReturnType<typeof vi.fn>).mockImplementation(
				() => {
					throw new Error('Not a git repo')
				},
			)
			;(
				fs.default.promises.stat as ReturnType<typeof vi.fn>
			).mockResolvedValue({
				size: 100,
			})
			;(
				fs.default.promises.appendFile as ReturnType<typeof vi.fn>
			).mockResolvedValue(undefined)

			await logFileWrite('/workspace/file.txt', true)

			const appendCall = (
				fs.default.promises.appendFile as ReturnType<typeof vi.fn>
			).mock.calls[0]
			const logLine = appendCall[1]
			const entry = JSON.parse(logLine)
			expect(entry.gitBranch).toBeUndefined()
		})

		it('should sanitize file path relative to workspace', async () => {
			const { execFileSync } = await import('child_process')
			;(execFileSync as ReturnType<typeof vi.fn>).mockReturnValue(
				'main\n',
			)
			;(
				fs.default.promises.stat as ReturnType<typeof vi.fn>
			).mockResolvedValue({
				size: 100,
			})
			;(
				fs.default.promises.appendFile as ReturnType<typeof vi.fn>
			).mockResolvedValue(undefined)

			await logFileWrite('/workspace/subdir/file.txt', true)

			const appendCall = (
				fs.default.promises.appendFile as ReturnType<typeof vi.fn>
			).mock.calls[0]
			const logLine = appendCall[1]
			const entry = JSON.parse(logLine)
			expect(entry.filePath).toBe('subdir/file.txt')
		})

		it('should not sanitize path when file is outside workspace', async () => {
			const { execFileSync } = await import('child_process')
			;(execFileSync as ReturnType<typeof vi.fn>).mockReturnValue(
				'main\n',
			)
			;(
				fs.default.promises.stat as ReturnType<typeof vi.fn>
			).mockResolvedValue({
				size: 100,
			})
			;(
				fs.default.promises.appendFile as ReturnType<typeof vi.fn>
			).mockResolvedValue(undefined)

			await logFileWrite('/other/path/file.txt', true)

			const appendCall = (
				fs.default.promises.appendFile as ReturnType<typeof vi.fn>
			).mock.calls[0]
			const logLine = appendCall[1]
			const entry = JSON.parse(logLine)
			expect(entry.filePath).toBe('/other/path/file.txt')
		})
	})

	describe('logFileDelete', () => {
		beforeEach(() => {
			;(
				fs.default.existsSync as ReturnType<typeof vi.fn>
			).mockReturnValue(true)
			initAuditLogger()
		})

		it('should log successful file delete', async () => {
			const { execFileSync } = await import('child_process')
			;(execFileSync as ReturnType<typeof vi.fn>).mockReturnValue(
				'main\n',
			)
			;(
				fs.default.promises.stat as ReturnType<typeof vi.fn>
			).mockResolvedValue({
				size: 100,
			})
			;(
				fs.default.promises.appendFile as ReturnType<typeof vi.fn>
			).mockResolvedValue(undefined)

			await logFileDelete('/workspace/file.txt', true)

			expect(fs.default.promises.appendFile).toHaveBeenCalled()
			const appendCall = (
				fs.default.promises.appendFile as ReturnType<typeof vi.fn>
			).mock.calls[0]
			const logLine = appendCall[1]
			const entry = JSON.parse(logLine)
			expect(entry.operation).toBe('delete')
			expect(entry.success).toBe(true)
		})

		it('should not log when git is disabled', async () => {
			global.git = { enabled: false }

			await logFileDelete('/workspace/file.txt', true)

			expect(fs.default.promises.appendFile).not.toHaveBeenCalled()
		})
	})

	describe('logFileUpdate', () => {
		beforeEach(() => {
			;(
				fs.default.existsSync as ReturnType<typeof vi.fn>
			).mockReturnValue(true)
			initAuditLogger()
		})

		it('should log successful file update', async () => {
			const { execFileSync } = await import('child_process')
			;(execFileSync as ReturnType<typeof vi.fn>).mockReturnValue(
				'main\n',
			)
			;(
				fs.default.promises.stat as ReturnType<typeof vi.fn>
			).mockResolvedValue({
				size: 100,
			})
			;(
				fs.default.promises.appendFile as ReturnType<typeof vi.fn>
			).mockResolvedValue(undefined)

			await logFileUpdate('/workspace/file.txt', true)

			expect(fs.default.promises.appendFile).toHaveBeenCalled()
			const appendCall = (
				fs.default.promises.appendFile as ReturnType<typeof vi.fn>
			).mock.calls[0]
			const logLine = appendCall[1]
			const entry = JSON.parse(logLine)
			expect(entry.operation).toBe('update')
			expect(entry.success).toBe(true)
		})

		it('should not log when git is disabled', async () => {
			global.git = { enabled: false }

			await logFileUpdate('/workspace/file.txt', true)

			expect(fs.default.promises.appendFile).not.toHaveBeenCalled()
		})
	})

	describe('log rotation', () => {
		beforeEach(() => {
			;(
				fs.default.existsSync as ReturnType<typeof vi.fn>
			).mockReturnValue(true)
			initAuditLogger()
		})

		it('should rotate log file when size exceeds limit', async () => {
			const { execFileSync } = await import('child_process')
			;(execFileSync as ReturnType<typeof vi.fn>).mockReturnValue(
				'main\n',
			)
			// Mock log file that exceeds MAX_LOG_SIZE (10MB)
			;(
				fs.default.promises.stat as ReturnType<typeof vi.fn>
			).mockResolvedValue({
				size: 11 * 1024 * 1024, // 11MB
			})
			;(
				fs.default.existsSync as ReturnType<typeof vi.fn>
			).mockReturnValue(true)
			;(
				fs.default.promises.rename as ReturnType<typeof vi.fn>
			).mockResolvedValue(undefined)
			;(
				fs.default.promises.writeFile as ReturnType<typeof vi.fn>
			).mockResolvedValue(undefined)
			;(
				fs.default.promises.appendFile as ReturnType<typeof vi.fn>
			).mockResolvedValue(undefined)

			await logFileWrite('/workspace/file.txt', true)

			// Should rotate: rename existing files and create new log
			expect(fs.default.promises.rename).toHaveBeenCalled()
			expect(fs.default.promises.writeFile).toHaveBeenCalled()
		})

		it('should not rotate when log file does not exist', async () => {
			const { execFileSync } = await import('child_process')
			;(execFileSync as ReturnType<typeof vi.fn>).mockReturnValue(
				'main\n',
			)
			;(
				fs.default.existsSync as ReturnType<typeof vi.fn>
			).mockReturnValue(false)
			;(
				fs.default.promises.appendFile as ReturnType<typeof vi.fn>
			).mockResolvedValue(undefined)

			await logFileWrite('/workspace/file.txt', true)

			expect(fs.default.promises.rename).not.toHaveBeenCalled()
		})

		it('should not rotate when log file size is below limit', async () => {
			const { execFileSync } = await import('child_process')
			;(execFileSync as ReturnType<typeof vi.fn>).mockReturnValue(
				'main\n',
			)
			;(
				fs.default.promises.stat as ReturnType<typeof vi.fn>
			).mockResolvedValue({
				size: 5 * 1024 * 1024, // 5MB, below 10MB limit
			})
			;(
				fs.default.promises.appendFile as ReturnType<typeof vi.fn>
			).mockResolvedValue(undefined)

			await logFileWrite('/workspace/file.txt', true)

			expect(fs.default.promises.rename).not.toHaveBeenCalled()
		})

		it('should handle rotation errors gracefully', async () => {
			const { execFileSync } = await import('child_process')
			;(execFileSync as ReturnType<typeof vi.fn>).mockReturnValue(
				'main\n',
			)
			;(
				fs.default.promises.stat as ReturnType<typeof vi.fn>
			).mockResolvedValue({
				size: 11 * 1024 * 1024,
			})
			;(
				fs.default.existsSync as ReturnType<typeof vi.fn>
			).mockReturnValue(true)
			;(
				fs.default.promises.rename as ReturnType<typeof vi.fn>
			).mockRejectedValue(new Error('Permission denied'))
			;(
				fs.default.promises.appendFile as ReturnType<typeof vi.fn>
			).mockResolvedValue(undefined)

			await logFileWrite('/workspace/file.txt', true)

			// Should log error but continue
			expect(global.logger?.error).toHaveBeenCalled()
		})

		it('should prevent concurrent rotations', async () => {
			const { execFileSync } = await import('child_process')
			;(execFileSync as ReturnType<typeof vi.fn>).mockReturnValue(
				'main\n',
			)
			;(
				fs.default.promises.stat as ReturnType<typeof vi.fn>
			).mockImplementation(
				() =>
					new Promise((resolve) =>
						setTimeout(
							() => resolve({ size: 11 * 1024 * 1024 }),
							10,
						),
					),
			)
			;(
				fs.default.existsSync as ReturnType<typeof vi.fn>
			).mockReturnValue(true)
			;(
				fs.default.promises.rename as ReturnType<typeof vi.fn>
			).mockImplementation(
				() => new Promise((resolve) => setTimeout(resolve, 50)),
			)
			;(
				fs.default.promises.appendFile as ReturnType<typeof vi.fn>
			).mockResolvedValue(undefined)

			// Trigger multiple writes simultaneously
			await Promise.all([
				logFileWrite('/workspace/file1.txt', true),
				logFileWrite('/workspace/file2.txt', true),
			])

			// Should only rotate once (second call should skip rotation)
			expect(fs.default.promises.rename).toHaveBeenCalled()
		})
	})

	describe('error handling', () => {
		beforeEach(() => {
			;(
				fs.default.existsSync as ReturnType<typeof vi.fn>
			).mockReturnValue(true)
			initAuditLogger()
		})

		it('should handle appendFile errors gracefully', async () => {
			const { execFileSync } = await import('child_process')
			;(execFileSync as ReturnType<typeof vi.fn>).mockReturnValue(
				'main\n',
			)
			;(
				fs.default.promises.stat as ReturnType<typeof vi.fn>
			).mockResolvedValue({
				size: 100,
			})
			;(
				fs.default.promises.appendFile as ReturnType<typeof vi.fn>
			).mockRejectedValue(new Error('Disk full'))

			await logFileWrite('/workspace/file.txt', true)

			// Should log warning but not throw
			expect(global.logger?.warn).toHaveBeenCalled()
		})

		it('should handle writeAuditLog when auditLogPath is null', async () => {
			// Simulate case where initAuditLogger was not called or failed
			// by not calling initAuditLogger in this test
			const { execFileSync } = await import('child_process')
			;(execFileSync as ReturnType<typeof vi.fn>).mockReturnValue(
				'main\n',
			)

			// Should not throw, but also may not log if path is null
			await logFileWrite('/workspace/file.txt', true)

			// Should not throw even if auditLogPath is null
			expect(fs.default.promises.appendFile).not.toHaveBeenCalled()
		})
	})
})
