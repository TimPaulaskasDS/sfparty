/**
 * Test helpers for creating AppContext in tests
 * SEC-013: Simplifies context creation for test suites
 */

import { vi } from 'vitest'
import type { AppContext, Icons } from '../../src/types/context.js'
import { createContext } from '../../src/types/context.js'

/**
 * Create a mock logger for testing
 */
function createMockLogger() {
	return {
		error: vi.fn(),
		warn: vi.fn(),
		info: vi.fn(),
		verbose: vi.fn(),
		debug: vi.fn(),
		silly: vi.fn(),
	} as unknown as AppContext['logger']
}

/**
 * Create mock icons for testing
 */
function createMockIcons(): Icons {
	return {
		warn: '⚠️',
		success: '✓',
		fail: '✗',
		working: '⏳',
		party: '🎉',
		delete: '❌',
	}
}

/**
 * Create mock console transport for testing
 */
function createMockTransport() {
	return {
		silent: false,
	}
}

/**
 * Create a test context with sensible defaults
 * Override any properties as needed for specific tests
 * @param overrides - Partial context to override defaults
 * @returns Complete AppContext for testing
 */
export function createTestContext(
	overrides: Partial<AppContext> = {},
): AppContext {
	return createContext({
		basedir: '/test',
		logger: createMockLogger(),
		displayError: vi.fn(),
		format: 'yaml',
		metaTypes: {},
		signConfig: false,
		verifyConfig: false,
		icons: createMockIcons(),
		consoleTransport: createMockTransport(),
		runType: 'test',
		...overrides,
	})
}
