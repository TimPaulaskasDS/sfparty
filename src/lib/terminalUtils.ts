/**
 * SEC-005: Validate environment variable value
 * @param value - Environment variable value
 * @param maxLength - Maximum allowed length (default: 256)
 * @returns Sanitized value or undefined if invalid
 */
function validateEnvVar(
	value: string | undefined,
	maxLength = 256,
): string | undefined {
	if (!value || typeof value !== 'string') {
		return undefined
	}

	// Remove null bytes and control characters
	const sanitized = value.replace(/[\0\n\r]/g, '').trim()

	// Basic validation
	if (
		sanitized.length === 0 ||
		sanitized.length > maxLength ||
		/[<>"|\\]/.test(sanitized) // Dangerous characters
	) {
		return undefined
	}

	return sanitized
}

/**
 * Suppress terminal capability errors from stderr
 * Used to filter out noisy terminal capability warnings from blessed library
 */
export function suppressTerminalErrors(): void {
	// SEC-005: Validate TERM environment variable
	const term = validateEnvVar(process.env.TERM, 64)
	if (process.stdout.isTTY && term !== 'dumb') {
		const originalStderrWrite = process.stderr.write.bind(process.stderr)

		process.stderr.write = function (
			chunk: string | Uint8Array,
			encodingOrCb?: BufferEncoding | ((err?: Error | null) => void),
			cb?: (err?: Error | null) => void,
		): boolean {
			const message = chunk?.toString() || ''
			// Filter out terminal capability errors
			if (
				message.includes('xterm-256color.Setulc') ||
				message.includes('stack.pop') ||
				message.includes('out.push') ||
				message.includes('var v,') ||
				message.includes('stack.push') ||
				message.includes('stack =') ||
				message.includes('out =') ||
				message.includes('return out.join') ||
				message.includes('Error on xterm') ||
				message.includes('\\u001b[58::') ||
				message.includes('%p1%{65536}') ||
				message.includes('\x1b[58::')
			) {
				const actualCb =
					typeof encodingOrCb === 'function' ? encodingOrCb : cb
				if (typeof actualCb === 'function') {
					actualCb()
				}
				return true
			}

			// Handle overloads: (chunk, cb) or (chunk, encoding, cb)
			if (typeof encodingOrCb === 'function') {
				return originalStderrWrite(chunk, encodingOrCb)
			} else if (cb) {
				return originalStderrWrite(
					chunk,
					encodingOrCb as BufferEncoding,
					cb,
				)
			} else if (encodingOrCb) {
				return originalStderrWrite(
					chunk,
					encodingOrCb as BufferEncoding,
				)
			} else {
				return originalStderrWrite(chunk)
			}
		} as typeof process.stderr.write
	}
}
