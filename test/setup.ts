import { afterEach, beforeEach, vi } from 'vitest'
import {
	clearVerifiedDirectoriesCache,
	resetWriteBatcher,
} from '../src/lib/fileUtils.js'

// Mock logUpdate to prevent spinner output in tests
vi.mock('log-update', () => {
	const mockLogUpdate = vi.fn()
	// @ts-expect-error - log-update's done property needs to be added dynamically
	mockLogUpdate.done = vi.fn()
	return {
		default: mockLogUpdate,
	}
})

// Setup console mocks before each test
// This prevents output but allows tests to assert on calls
// Tests can override these spies in their own beforeEach hooks if needed
beforeEach(() => {
	// Clear module-level caches before each test to ensure isolation
	clearVerifiedDirectoriesCache()
	resetWriteBatcher()

	// Mock console methods to prevent output but allow assertions
	// Tests that need their own spies can create them in their beforeEach
	// (which runs after this global one)
	vi.spyOn(console, 'log').mockImplementation(() => {})
	vi.spyOn(console, 'error').mockImplementation(() => {})
	vi.spyOn(console, 'info').mockImplementation(() => {})
	vi.spyOn(console, 'warn').mockImplementation(() => {})

	// Setup global.logger mock for tests
	// @ts-expect-error - global.logger is added dynamically
	global.logger = {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
		log: vi.fn(),
	} as any
})

// Clean up after each test
afterEach(() => {
	vi.clearAllMocks()
	// Clear module-level caches to ensure test isolation
	clearVerifiedDirectoriesCache()
	resetWriteBatcher()
	// @ts-expect-error - global.logger is added dynamically
	delete global.logger
	// @ts-expect-error - global.__basedir is added dynamically
	delete global.__basedir
})
