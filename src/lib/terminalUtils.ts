/**
 * Suppress terminal capability errors from stderr
 * Used to filter out noisy terminal capability warnings from blessed library
 */
export function suppressTerminalErrors(): void {
	if (process.stdout.isTTY && process.env.TERM !== 'dumb') {
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
