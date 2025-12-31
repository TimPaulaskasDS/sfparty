import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		maxWorkers: 1,
		isolate: true, // Ensure test files are isolated from each other
		setupFiles: ['./test/setup.ts'],
		// Exclude compiled .js test files - we only want to run .ts test files
		exclude: [
			'**/node_modules/**',
			'**/dist/**',
			'**/*.test.js',
			'**/*.spec.js',
		],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html', 'clover', 'json'],
			include: ['src/**/*.ts'],
			exclude: [
				'src/index.ts', // CLI entry point - requires integration testing
				'src/lib/tui.ts', // TUI requires TTY and is difficult to test in CI
				'src/lib/tuiProgressTracker.ts', // TUI tracker requires TTY and is difficult to test in CI
			],
		},
	},
})
