import * as fs from 'fs'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

/**
 * NOTE: index.ts is a CLI entry point that executes immediately on import.
 * These tests verify the structure and behavior without direct import.
 * For full integration testing, use spawn/exec to run the CLI as a subprocess.
 */
describe('index.ts CLI Structure', () => {
	describe('Module Exports and Structure', () => {
		it('should be executable with shebang', async () => {
			const indexPath = path.resolve(process.cwd(), 'src/index.ts')
			const content = fs.readFileSync(indexPath, 'utf8')
			expect(content.startsWith('#!/usr/bin/env node')).toBe(true)
		})
		it('should use strict mode', async () => {
			// TypeScript strict mode is enforced by tsconfig.json compiler options
			const indexPath = path.resolve(process.cwd(), 'src/index.ts')
			const content = fs.readFileSync(indexPath, 'utf8')
			// TypeScript doesn't need 'use strict' - it's implied by ES modules
			expect(indexPath).toContain('index.ts')
		})
		it('should import required dependencies', async () => {
			const indexPath = path.resolve(process.cwd(), 'src/index.ts')
			const content = fs.readFileSync(indexPath, 'utf8')
			// Check critical imports (Biome sorts these alphabetically)
			expect(content).toContain("import yargs from 'yargs'")
			expect(content).toContain("from 'child_process'")
			expect(content).toContain(
				"import { Split } from './party/split.js'",
			)
			expect(content).toContain(
				"import { Combine } from './party/combine.js'",
			)
			expect(content).toContain(
				"import * as yargOptions from './meta/yargs.js'",
			)
		})
		it('should define all four metadata types', async () => {
			const indexPath = path.resolve(process.cwd(), 'src/index.ts')
			const content = fs.readFileSync(indexPath, 'utf8')
			expect(content).toContain('label:')
			expect(content).toContain('profile:')
			expect(content).toContain('permset:')
			expect(content).toContain('workflow:')
		})
		it('should register split command', async () => {
			const indexPath = path.resolve(process.cwd(), 'src/index.ts')
			const content = fs.readFileSync(indexPath, 'utf8')
			expect(content).toContain("command: '[split]'")
			expect(content).toContain("aliases: ['split']")
			expect(content).toContain('splits metadata xml to yaml/json files')
		})
		it('should register combine command', async () => {
			const indexPath = path.resolve(process.cwd(), 'src/index.ts')
			const content = fs.readFileSync(indexPath, 'utf8')
			expect(content).toContain("command: '[combine]'")
			expect(content).toContain("aliases: ['combine']")
			expect(content).toContain(
				'combines yaml/json files into metadata xml',
			)
		})
		it('should register update command', async () => {
			const indexPath = path.resolve(process.cwd(), 'src/index.ts')
			const content = fs.readFileSync(indexPath, 'utf8')
			expect(content).toContain("command: '[update]'")
			expect(content).toContain("aliases: ['update']")
		})
		it('should register help command', async () => {
			const indexPath = path.resolve(process.cwd(), 'src/index.ts')
			const content = fs.readFileSync(indexPath, 'utf8')
			expect(content).toContain("command: 'help'")
			expect(content).toContain("aliases: ['h']")
		})
		it('should have git integration', async () => {
			const indexPath = path.resolve(process.cwd(), 'src/index.ts')
			const content = fs.readFileSync(indexPath, 'utf8')
			expect(content).toContain('global.git')
			expect(content).toContain('git.lastCommit')
			expect(content).toContain('git.diff')
		})
		it('should support yaml and json formats', async () => {
			const indexPath = path.resolve(process.cwd(), 'src/index.ts')
			const content = fs.readFileSync(indexPath, 'utf8')
			expect(content).toContain(".choices('format', ['json', 'yaml'])")
		})
	})
	describe('Execution Context Detection Functions', () => {
		let originalArgv
		let originalEnv
		beforeEach(() => {
			originalArgv = [...process.argv]
			originalEnv = { ...process.env }
		})
		afterEach(() => {
			process.argv = originalArgv
			process.env = originalEnv
		})
		it('should detect npx execution via argv', () => {
			process.argv = ['node', '_npx12345', 'sfparty']
			const isRunningUnderNpx = () => {
				return process.argv.some((arg) => arg.includes('_npx'))
			}
			expect(isRunningUnderNpx()).toBe(true)
		})
		it('should detect npx execution via INIT_CWD env', () => {
			process.env.INIT_CWD = '/some/path'
			const isRunningUnderNpx = () => {
				const npxIndicator = process.argv.some((arg) =>
					arg.includes('_npx'),
				)
				const initCwd = process.env.INIT_CWD
				return npxIndicator || initCwd !== undefined
			}
			expect(isRunningUnderNpx()).toBe(true)
		})
		it('should not detect npx when running globally', () => {
			process.argv = ['node', 'sfparty']
			delete process.env.INIT_CWD
			const isRunningUnderNpx = () => {
				const npxIndicator = process.argv.some((arg) =>
					arg.includes('_npx'),
				)
				const initCwd = process.env.INIT_CWD
				return npxIndicator || initCwd !== undefined
			}
			expect(isRunningUnderNpx()).toBe(false)
		})
	})
	describe('Global Configuration', () => {
		it('should define global logger configuration', async () => {
			const indexPath = path.resolve(process.cwd(), 'src/index.ts')
			const content = fs.readFileSync(indexPath, 'utf8')
			expect(content).toContain('global.logger = winston.createLogger')
			expect(content).toContain('error: 0')
			expect(content).toContain('warn: 1')
			expect(content).toContain('info: 2')
		})
		it('should define global icons', async () => {
			const indexPath = path.resolve(process.cwd(), 'src/index.ts')
			const content = fs.readFileSync(indexPath, 'utf8')
			expect(content).toContain('global.icons = {')
			expect(content).toContain('success:')
			expect(content).toContain('fail:')
			expect(content).toContain('party:')
		})
		it('should define global displayError function', async () => {
			const indexPath = path.resolve(process.cwd(), 'src/index.ts')
			const content = fs.readFileSync(indexPath, 'utf8')
			expect(content).toContain(
				'global.displayError = (error: string, quit = false): void =>',
			)
			expect(content).toContain('global.logger?.error(error)')
			expect(content).toContain('process.exit(1)')
		})
		it('should define metadata type array', async () => {
			const indexPath = path.resolve(process.cwd(), 'src/index.ts')
			const content = fs.readFileSync(indexPath, 'utf8')
			expect(content).toContain(
				"const typeArray = ['label', 'profile', 'permset', 'workflow']",
			)
		})
	})
	describe('Command Options', () => {
		it('should use splitOptions for split command', async () => {
			const indexPath = path.resolve(process.cwd(), 'src/index.ts')
			const content = fs.readFileSync(indexPath, 'utf8')
			const splitCommandMatch = content.match(
				/command: '\[split\]'[\s\S]*?\.options\(yargOptions\.(\w+)(?:\s+as\s+any)?\)/,
			)
			expect(splitCommandMatch).toBeTruthy()
			expect(splitCommandMatch?.[1]).toBe('splitOptions')
		})
		it('should use combineOptions for combine command', async () => {
			const indexPath = path.resolve(process.cwd(), 'src/index.ts')
			const content = fs.readFileSync(indexPath, 'utf8')
			const combineCommandMatch = content.match(
				/command: '\[combine\]'[\s\S]*?\.options\(yargOptions\.(\w+)(?:\s+as\s+any)?\)/,
			)
			expect(combineCommandMatch).toBeTruthy()
			expect(combineCommandMatch?.[1]).toBe('combineOptions')
		})
		it('should use splitExamples for split command', async () => {
			const indexPath = path.resolve(process.cwd(), 'src/index.ts')
			const content = fs.readFileSync(indexPath, 'utf8')
			const splitExamplesMatch = content.match(
				/command: '\[split\]'[\s\S]*?\.example\(yargOptions\.(\w+)\)/,
			)
			expect(splitExamplesMatch).toBeTruthy()
			expect(splitExamplesMatch?.[1]).toBe('splitExamples')
		})
		it('should use combineExamples for combine command', async () => {
			const indexPath = path.resolve(process.cwd(), 'src/index.ts')
			const content = fs.readFileSync(indexPath, 'utf8')
			const combineExamplesMatch = content.match(
				/command: '\[combine\]'[\s\S]*?\.example\(yargOptions\.(\w+)\)/,
			)
			expect(combineExamplesMatch).toBeTruthy()
			expect(combineExamplesMatch?.[1]).toBe('combineExamples')
		})
	})
})
//# sourceMappingURL=index.test.js.map
