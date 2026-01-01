// Memoization cache for path sanitization
const sanitizedPathCache = new Map<string, string>()

/**
 * Replace special characters in file paths with Unicode equivalents
 * Results are memoized to reduce overhead
 */
export function replaceSpecialChars(str: string): string {
	if (typeof str !== 'string') return str

	// Check cache first
	if (sanitizedPathCache.has(str)) {
		return sanitizedPathCache.get(str)!
	}

	const sanitized = str
		.replace(/\*/g, '\u002a')
		.replace(/\?/g, '\u003f')
		.replace(/</g, '\u003c')
		.replace(/>/g, '\u003e')
		.replace(/"/g, '\u0022')
		.replace(/\|/g, '\u007c')
		.replace(/\\/g, '\u005c')
		.replace(/:/g, '\u003a')

	// Only cache if string actually changed (most paths don't need sanitization)
	if (sanitized !== str) {
		sanitizedPathCache.set(str, sanitized)
	}

	return sanitized
}

/**
 * Clear the path sanitization cache (primarily for testing)
 */
export function clearPathSanitizationCache(): void {
	sanitizedPathCache.clear()
}
