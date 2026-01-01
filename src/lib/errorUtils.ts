import * as path from 'path'

interface GlobalContext {
	__basedir?: string
}

declare const global: GlobalContext & typeof globalThis

/**
 * Sanitize file paths in error messages for security
 */
export function sanitizeErrorPath(filePath: string): string {
	if (!filePath || typeof filePath !== 'string') {
		return 'unknown'
	}

	// If global basedir is set, replace it with <workspace>
	if (global.__basedir && filePath.includes(global.__basedir)) {
		return filePath.replace(global.__basedir, '<workspace>')
	}

	// Otherwise just return the basename
	return path.basename(filePath)
}

/**
 * Create a sanitized error from an original error, replacing paths
 */
export function createSanitizedError(
	originalError: Error,
	pathPattern: RegExp = /\/[^\s]+/g,
): Error {
	const sanitized = new Error(
		originalError.message.replace(pathPattern, (match) =>
			sanitizeErrorPath(match),
		),
	)
	sanitized.stack = originalError.stack
	return sanitized
}

/**
 * Handle file operation errors with consistent sanitization
 */
export function handleFileError(
	error: unknown,
	logger?: { error: (error: Error | unknown) => void },
): never {
	if (error instanceof Error) {
		// Sanitize paths in error messages
		if (error.message && error.message.includes('/')) {
			const sanitized = createSanitizedError(error)
			logger?.error(sanitized)
			throw sanitized
		}
	}
	logger?.error(error)
	throw error
}
