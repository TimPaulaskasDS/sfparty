/**
 * Tests for AppContext and context creation
 * SEC-013: Validates context infrastructure
 */

import { describe, expect, it } from 'vitest'
import { createContext } from '../../src/types/context.js'
import { createTestContext } from '../helpers/context.js'

describe('AppContext', () => {
	describe('createContext', () => {
		it('should create context with all required properties', () => {
			const mockLogger = {
				error: () => {},
				warn: () => {},
				info: () => {},
				verbose: () => {},
				debug: () => {},
				silly: () => {},
			} as any

			const ctx = createContext({
				basedir: '/test',
				logger: mockLogger,
				displayError: () => {},
				format: 'yaml',
				metaTypes: {},
				icons: {},
				consoleTransport: { silent: false },
			})

			expect(ctx.basedir).toBe('/test')
			expect(ctx.logger).toBe(mockLogger)
			expect(ctx.format).toBe('yaml')
			expect(ctx.signConfig).toBe(false)
			expect(ctx.verifyConfig).toBe(false)
			expect(ctx.runType).toBe(null)
		})

		it('should throw error if required properties missing', () => {
			expect(() => {
				createContext({
					basedir: '/test',
					// Missing logger
				} as any)
			}).toThrow('AppContext requires logger')

			expect(() => {
				createContext({
					basedir: '/test',
					logger: {} as any,
					// Missing displayError
				} as any)
			}).toThrow('AppContext requires displayError')
		})

		it('should use default values for optional properties', () => {
			const mockLogger = {
				error: () => {},
				warn: () => {},
				info: () => {},
				verbose: () => {},
				debug: () => {},
				silly: () => {},
			} as any

			const ctx = createContext({
				basedir: '/test',
				logger: mockLogger,
				displayError: () => {},
				format: 'yaml',
				metaTypes: {},
				icons: {},
				consoleTransport: { silent: false },
			})

			expect(ctx.signConfig).toBe(false)
			expect(ctx.verifyConfig).toBe(false)
			expect(ctx.runType).toBe(null)
		})

		it('should allow overriding optional properties', () => {
			const mockLogger = {
				error: () => {},
				warn: () => {},
				info: () => {},
				verbose: () => {},
				debug: () => {},
				silly: () => {},
			} as any

			const ctx = createContext({
				basedir: '/test',
				logger: mockLogger,
				displayError: () => {},
				format: 'json',
				metaTypes: {},
				icons: {},
				consoleTransport: { silent: false },
				signConfig: true,
				verifyConfig: true,
				runType: 'npx',
			})

			expect(ctx.format).toBe('json')
			expect(ctx.signConfig).toBe(true)
			expect(ctx.verifyConfig).toBe(true)
			expect(ctx.runType).toBe('npx')
		})
	})

	describe('createTestContext', () => {
		it('should create test context with defaults', () => {
			const ctx = createTestContext()

			expect(ctx.basedir).toBe('/test')
			expect(ctx.format).toBe('yaml')
			expect(ctx.signConfig).toBe(false)
			expect(ctx.verifyConfig).toBe(false)
			expect(ctx.runType).toBe('test')
			expect(ctx.logger).toBeDefined()
			expect(ctx.displayError).toBeDefined()
		})

		it('should allow overriding test context properties', () => {
			const ctx = createTestContext({
				basedir: '/custom',
				format: 'json',
			})

			expect(ctx.basedir).toBe('/custom')
			expect(ctx.format).toBe('json')
			expect(ctx.runType).toBe('test') // Still default
		})
	})
})
