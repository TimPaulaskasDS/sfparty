import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		threads: 1,
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html', 'clover', 'json'],
			include: ['src/**/*.ts'],
			exclude: [
				'src/lib/pkgObj.cjs',
				'src/index.ts', // CLI entry point - requires integration testing
			],
		},
	},
})
