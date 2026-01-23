import { afterEach, beforeEach, vi } from 'vitest'

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
	// Mock console methods to prevent output but allow assertions
	// Tests that need their own spies can create them in their beforeEach
	// (which runs after this global one)
	vi.spyOn(console, 'log').mockImplementation(() => {})
	vi.spyOn(console, 'error').mockImplementation(() => {})
	vi.spyOn(console, 'info').mockImplementation(() => {})
	vi.spyOn(console, 'warn').mockImplementation(() => {})
})
// Clean up after each test
afterEach(() => {
	vi.clearAllMocks()
})
//# sourceMappingURL=setup.js.map
