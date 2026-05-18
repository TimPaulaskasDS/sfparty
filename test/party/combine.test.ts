import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Package } from '../../src/lib/packageUtil.js'
import * as labelDefinition from '../../src/meta/CustomLabels.js'
import * as profileDefinition from '../../src/meta/Profiles.js'
import { Combine } from '../../src/party/combine.js'
import type { AppContext } from '../../src/types/context.js'
import { createTestContext } from '../helpers/context.js'

/**
 * Unit tests for the `Combine` class surface — constructor, getters and
 * setters. The end-to-end behaviour of `combine()` is verified by the real
 * split -> combine round-trip suite in `roundTrip.test.ts`, which runs the
 * actual Split and Combine against a temp filesystem with no mocks. The mocked
 * `combine()` tests that used to live here asserted only `result === true`
 * against an unrealistic `fileUtils` mock and verified nothing.
 */

interface GlobalContext {
	format?: string
	__basedir?: string
	git?: { enabled?: boolean; append?: boolean; delta?: boolean }
	logger?: AppContext['logger']
	icons?: AppContext['icons']
	metaTypes?: AppContext['metaTypes']
	displayError?: AppContext['displayError']
	consoleTransport?: { silent: boolean }
}

declare const global: GlobalContext & typeof globalThis

const pkg = () => ({ addMember: vi.fn() }) as unknown as Package

describe('Combine class', () => {
	beforeEach(() => {
		global.format = 'yaml'
		global.__basedir = '/workspace'
		global.git = { enabled: false, append: false, delta: false }
		global.logger = {
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
			debug: vi.fn(),
		} as unknown as AppContext['logger']
		global.icons = {
			warn: '🔕',
			success: '✔',
			fail: '❗',
			working: '⏳',
			party: '🎉',
			delete: '❌',
		}
		global.metaTypes = {}
		global.displayError = vi.fn()
		global.consoleTransport = { silent: false }
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	function createCtxFromGlobal(
		overrides: Partial<AppContext> = {},
	): AppContext {
		return createTestContext({
			basedir: global.__basedir || '/workspace',
			logger: global.logger,
			displayError: global.displayError || vi.fn(),
			format: global.format || 'yaml',
			metaTypes: global.metaTypes || {},
			git: global.git
				? {
						enabled: global.git.enabled || false,
						append: global.git.append || false,
						delta: global.git.delta || false,
					}
				: undefined,
			icons: global.icons,
			consoleTransport: global.consoleTransport || { silent: false },
			process: { current: 0, total: 0, errors: 0 },
			...overrides,
		})
	}

	function makeConfig(
		overrides: Partial<ConstructorParameters<typeof Combine>[0]> = {},
	): ConstructorParameters<typeof Combine>[0] {
		return {
			ctx: createCtxFromGlobal(),
			metadataDefinition: labelDefinition.metadataDefinition,
			sourceDir: '/source',
			targetDir: '/target',
			metaDir: 'CustomLabels',
			sequence: 1,
			total: 1,
			addPkg: pkg(),
			desPkg: pkg(),
			...overrides,
		}
	}

	describe('Constructor', () => {
		it('should initialize with required config', () => {
			const combine = new Combine(
				makeConfig({ sourceDir: '/source', targetDir: '/target' }),
			)
			expect(combine.metadataDefinition).toBe(
				labelDefinition.metadataDefinition,
			)
			expect(combine.sourceDir).toBe('/source')
			expect(combine.targetDir).toBe('/target')
		})

		it('should set type and root from metadata definition', () => {
			const combine = new Combine(
				makeConfig({
					metadataDefinition: profileDefinition.metadataDefinition,
					metaDir: 'Admin',
				}),
			)
			expect(combine.metadataDefinition.filetype).toBe('profile')
			expect(combine.metadataDefinition.root).toBe('Profile')
		})
	})

	describe('Metadata Type Support', () => {
		it('should support CustomLabels metadata type', () => {
			const combine = new Combine(
				makeConfig({
					metadataDefinition: labelDefinition.metadataDefinition,
				}),
			)
			expect(combine.metadataDefinition.filetype).toBe('labels')
			expect(combine.metadataDefinition.directory).toBe('labels')
		})

		it('should support Profile metadata type', () => {
			const combine = new Combine(
				makeConfig({
					metadataDefinition: profileDefinition.metadataDefinition,
					metaDir: 'Admin',
				}),
			)
			expect(combine.metadataDefinition.filetype).toBe('profile')
			expect(combine.metadataDefinition.directory).toBe('profiles')
		})
	})

	describe('Instance Properties', () => {
		it('should have sequence and total properties', () => {
			const combine = new Combine(makeConfig({ sequence: 5, total: 20 }))
			expect(combine.sequence).toBe(5)
			expect(combine.total).toBe(20)
		})

		it('should have sourceDir and targetDir properties', () => {
			const combine = new Combine(
				makeConfig({
					sourceDir: '/path/to/source',
					targetDir: '/path/to/target',
				}),
			)
			expect(combine.sourceDir).toBe('/path/to/source')
			expect(combine.targetDir).toBe('/path/to/target')
		})

		it('should accept package objects', () => {
			const addPkg = pkg()
			const desPkg = pkg()
			const combine = new Combine(makeConfig({ addPkg, desPkg }))
			expect(combine.addPkg).toBe(addPkg)
			expect(combine.desPkg).toBe(desPkg)
		})
	})

	describe('Git Integration', () => {
		it('should respect git enabled flag', () => {
			global.git = { ...global.git, enabled: true }
			const combine = new Combine(makeConfig())
			expect(combine.ctx.git?.enabled).toBe(true)
		})

		it('should respect git disabled flag', () => {
			global.git = { ...global.git, enabled: false }
			const combine = new Combine(makeConfig())
			expect(combine.ctx.git?.enabled).toBe(false)
		})
	})

	describe('metaDir setter', () => {
		it('should set fileName properties from metaDir', () => {
			const combine = new Combine(
				makeConfig({
					metadataDefinition: profileDefinition.metadataDefinition,
					metaDir: 'Admin',
				}),
			)
			expect(combine.metaDir).toBe('Admin')
		})

		it('should handle nested path in metaDir', () => {
			const combine = new Combine(
				makeConfig({
					metadataDefinition: profileDefinition.metadataDefinition,
					metaDir: 'path/to/Admin',
				}),
			)
			expect(combine.metaDir).toBe('path/to/Admin')
		})
	})

	describe('Sequence tracking', () => {
		it('should return ctx.process.current when it is higher', () => {
			const ctx = createCtxFromGlobal({
				process: { current: 5, total: 0, errors: 0 },
			})
			const combine = new Combine(
				makeConfig({ ctx, sequence: 3, total: 10 }),
			)
			expect(combine.sequence).toBe(5)
		})

		it('should return configured sequence when higher than ctx.process', () => {
			const ctx = createCtxFromGlobal({
				process: { current: 2, total: 0, errors: 0 },
			})
			const combine = new Combine(
				makeConfig({ ctx, sequence: 5, total: 10 }),
			)
			expect(combine.sequence).toBe(5)
		})
	})
})
