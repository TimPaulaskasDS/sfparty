import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { suppressTerminalErrors } from '../../src/lib/terminalUtils.js'

describe('terminalUtils', () => {
	let originalIsTTY: boolean | undefined
	let originalTerm: string | undefined
	let originalStderrWrite: typeof process.stderr.write
	let stderrWriteCalls: Array<{
		chunk: string | Uint8Array
		encodingOrCb?: BufferEncoding | ((err?: Error | null) => void)
		cb?: (err?: Error | null) => void
	}> = []

	beforeEach(() => {
		originalIsTTY = process.stdout.isTTY
		originalTerm = process.env.TERM
		originalStderrWrite = process.stderr.write.bind(process.stderr)
		stderrWriteCalls = []

		// Track calls to stderr.write without actually writing to stderr (prevents test output pollution)
		process.stderr.write = function (
			chunk: string | Uint8Array,
			encodingOrCb?: BufferEncoding | ((err?: Error | null) => void),
			cb?: (err?: Error | null) => void,
		): boolean {
			stderrWriteCalls.push({ chunk, encodingOrCb, cb })
			// Call callback if provided, but don't write to actual stderr
			const actualCb =
				typeof encodingOrCb === 'function' ? encodingOrCb : cb
			if (typeof actualCb === 'function') {
				actualCb()
			}
			return true
		} as typeof process.stderr.write
	})

	afterEach(() => {
		process.stdout.isTTY = originalIsTTY
		if (originalTerm !== undefined) {
			process.env.TERM = originalTerm
		} else {
			delete process.env.TERM
		}
		process.stderr.write = originalStderrWrite
		stderrWriteCalls = []
	})

	describe('suppressTerminalErrors', () => {
		it('should do nothing when process.stdout.isTTY is false', () => {
			process.stdout.isTTY = false
			process.env.TERM = 'xterm-256color'

			suppressTerminalErrors()

			const message = 'xterm-256color.Setulc error'
			process.stderr.write(message)

			// Should call original write (not filtered)
			expect(stderrWriteCalls.length).toBe(1)
			expect(stderrWriteCalls[0].chunk.toString()).toBe(message)
		})

		it('should do nothing when process.env.TERM is "dumb"', () => {
			process.stdout.isTTY = true
			process.env.TERM = 'dumb'

			suppressTerminalErrors()

			const message = 'xterm-256color.Setulc error'
			process.stderr.write(message)

			// Should call original write (not filtered)
			expect(stderrWriteCalls.length).toBe(1)
			expect(stderrWriteCalls[0].chunk.toString()).toBe(message)
		})

		it('should filter xterm-256color.Setulc errors', () => {
			process.stdout.isTTY = true
			process.env.TERM = 'xterm-256color'

			suppressTerminalErrors()

			const message = 'xterm-256color.Setulc error message'
			const result = process.stderr.write(message)

			expect(result).toBe(true)
			expect(stderrWriteCalls.length).toBe(0) // Should not call original
		})

		it('should filter stack.pop errors', () => {
			process.stdout.isTTY = true
			process.env.TERM = 'xterm-256color'

			suppressTerminalErrors()

			const message = 'stack.pop error'
			const result = process.stderr.write(message)

			expect(result).toBe(true)
			expect(stderrWriteCalls.length).toBe(0)
		})

		it('should filter out.push errors', () => {
			process.stdout.isTTY = true
			process.env.TERM = 'xterm-256color'

			suppressTerminalErrors()

			const message = 'out.push error'
			const result = process.stderr.write(message)

			expect(result).toBe(true)
			expect(stderrWriteCalls.length).toBe(0)
		})

		it('should filter var v, errors', () => {
			process.stdout.isTTY = true
			process.env.TERM = 'xterm-256color'

			suppressTerminalErrors()

			const message = 'var v, error'
			const result = process.stderr.write(message)

			expect(result).toBe(true)
			expect(stderrWriteCalls.length).toBe(0)
		})

		it('should filter stack.push errors', () => {
			process.stdout.isTTY = true
			process.env.TERM = 'xterm-256color'

			suppressTerminalErrors()

			const message = 'stack.push error'
			const result = process.stderr.write(message)

			expect(result).toBe(true)
			expect(stderrWriteCalls.length).toBe(0)
		})

		it('should filter stack = errors', () => {
			process.stdout.isTTY = true
			process.env.TERM = 'xterm-256color'

			suppressTerminalErrors()

			const message = 'stack = error'
			const result = process.stderr.write(message)

			expect(result).toBe(true)
			expect(stderrWriteCalls.length).toBe(0)
		})

		it('should filter out = errors', () => {
			process.stdout.isTTY = true
			process.env.TERM = 'xterm-256color'

			suppressTerminalErrors()

			const message = 'out = error'
			const result = process.stderr.write(message)

			expect(result).toBe(true)
			expect(stderrWriteCalls.length).toBe(0)
		})

		it('should filter return out.join errors', () => {
			process.stdout.isTTY = true
			process.env.TERM = 'xterm-256color'

			suppressTerminalErrors()

			const message = 'return out.join error'
			const result = process.stderr.write(message)

			expect(result).toBe(true)
			expect(stderrWriteCalls.length).toBe(0)
		})

		it('should filter Error on xterm errors', () => {
			process.stdout.isTTY = true
			process.env.TERM = 'xterm-256color'

			suppressTerminalErrors()

			const message = 'Error on xterm'
			const result = process.stderr.write(message)

			expect(result).toBe(true)
			expect(stderrWriteCalls.length).toBe(0)
		})

		it('should filter \\u001b[58:: errors', () => {
			process.stdout.isTTY = true
			process.env.TERM = 'xterm-256color'

			suppressTerminalErrors()

			const message = '\\u001b[58:: error'
			const result = process.stderr.write(message)

			expect(result).toBe(true)
			expect(stderrWriteCalls.length).toBe(0)
		})

		it('should filter %p1%{65536} errors', () => {
			process.stdout.isTTY = true
			process.env.TERM = 'xterm-256color'

			suppressTerminalErrors()

			const message = '%p1%{65536} error'
			const result = process.stderr.write(message)

			expect(result).toBe(true)
			expect(stderrWriteCalls.length).toBe(0)
		})

		it('should filter \x1b[58:: errors', () => {
			process.stdout.isTTY = true
			process.env.TERM = 'xterm-256color'

			suppressTerminalErrors()

			const message = '\x1b[58:: error'
			const result = process.stderr.write(message)

			expect(result).toBe(true)
			expect(stderrWriteCalls.length).toBe(0)
		})

		it('should allow non-terminal errors through', () => {
			process.stdout.isTTY = true
			process.env.TERM = 'xterm-256color'

			suppressTerminalErrors()

			const message = 'Regular error message'
			const result = process.stderr.write(message)

			expect(result).toBeDefined()
			expect(stderrWriteCalls.length).toBe(1)
			expect(stderrWriteCalls[0].chunk.toString()).toBe(message)
		})

		it('should call callback when filtering terminal errors', () => {
			process.stdout.isTTY = true
			process.env.TERM = 'xterm-256color'

			suppressTerminalErrors()

			const callback = vi.fn()
			const message = 'xterm-256color.Setulc error'

			process.stderr.write(message, callback)

			expect(callback).toHaveBeenCalledTimes(1)
			expect(callback).toHaveBeenCalledWith()
			expect(stderrWriteCalls.length).toBe(0)
		})

		it('should handle stderr.write(chunk) overload', () => {
			process.stdout.isTTY = true
			process.env.TERM = 'xterm-256color'

			suppressTerminalErrors()

			const message = 'Regular error'
			process.stderr.write(message)

			expect(stderrWriteCalls.length).toBe(1)
			expect(stderrWriteCalls[0].chunk.toString()).toBe(message)
		})

		it('should handle stderr.write(chunk, encoding) overload', () => {
			process.stdout.isTTY = true
			process.env.TERM = 'xterm-256color'

			suppressTerminalErrors()

			const message = 'Regular error'
			process.stderr.write(message, 'utf8')

			expect(stderrWriteCalls.length).toBe(1)
			expect(stderrWriteCalls[0].chunk.toString()).toBe(message)
			expect(stderrWriteCalls[0].encodingOrCb).toBe('utf8')
		})

		it('should handle stderr.write(chunk, cb) overload', () => {
			process.stdout.isTTY = true
			process.env.TERM = 'xterm-256color'

			suppressTerminalErrors()

			const message = 'Regular error'
			const callback = vi.fn()
			process.stderr.write(message, callback)

			expect(stderrWriteCalls.length).toBe(1)
			expect(stderrWriteCalls[0].chunk.toString()).toBe(message)
			expect(typeof stderrWriteCalls[0].encodingOrCb).toBe('function')
		})

		it('should handle stderr.write(chunk, encoding, cb) overload', () => {
			process.stdout.isTTY = true
			process.env.TERM = 'xterm-256color'

			suppressTerminalErrors()

			const message = 'Regular error'
			const callback = vi.fn()
			process.stderr.write(message, 'utf8', callback)

			expect(stderrWriteCalls.length).toBe(1)
			expect(stderrWriteCalls[0].chunk.toString()).toBe(message)
			expect(stderrWriteCalls[0].encodingOrCb).toBe('utf8')
			expect(stderrWriteCalls[0].cb).toBe(callback)
		})

		it('should handle Uint8Array chunks', () => {
			process.stdout.isTTY = true
			process.env.TERM = 'xterm-256color'

			suppressTerminalErrors()

			const message = new Uint8Array([72, 101, 108, 108, 111]) // "Hello"
			process.stderr.write(message)

			expect(stderrWriteCalls.length).toBe(1)
		})

		it('should handle empty chunk', () => {
			process.stdout.isTTY = true
			process.env.TERM = 'xterm-256color'

			suppressTerminalErrors()

			process.stderr.write('')

			expect(stderrWriteCalls.length).toBe(1)
		})
	})
})
