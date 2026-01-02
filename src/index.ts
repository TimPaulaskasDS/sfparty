#!/usr/bin/env node
import axios from 'axios'
import { execFileSync, spawn, spawnSync } from 'child_process'
import clc from 'cli-color'
import convertHrtime from 'convert-hrtime'
import { XMLBuilder } from 'fast-xml-parser'
import fs from 'fs'
// marked and marked-terminal are lazy-loaded in help command
// ora is now only used in TUIProgressTracker fallback
import os from 'os'
import path, { dirname, resolve } from 'path'
import { argv, env } from 'process'
import { fileURLToPath } from 'url'
import winston from 'winston'
import type * as Yargs from 'yargs'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import * as auditLogger from './lib/auditLogger.js'
import { checkVersion } from './lib/checkVersion.js'
import { sanitizeErrorMessage, sanitizeErrorPath } from './lib/errorUtils.js'
import * as fileUtils from './lib/fileUtils.js'
import * as git from './lib/gitUtils.js'
import * as packageUtil from './lib/packageUtil.js'
import {
	PerformanceLogger,
	setPerformanceLogger,
} from './lib/performanceLogger.js'
import pkgObj from './lib/pkgObj.js'
import { suppressTerminalErrors } from './lib/terminalUtils.js'
import {
	getGlobalProgressTracker,
	setGlobalProgressTracker,
	TUIProgressTracker,
} from './lib/tuiProgressTracker.js'
import * as labelDefinition from './meta/CustomLabels.js'
import * as permsetDefinition from './meta/PermissionSets.js'
import * as profileDefinition from './meta/Profiles.js'
import * as workflowDefinition from './meta/Workflows.js'
import * as yargOptions from './meta/yargs.js'
import { Combine } from './party/combine.js'
import { Split } from './party/split.js'
import type { AppContext } from './types/context.js'
import { createContext } from './types/context.js'
import type { MetadataDefinition } from './types/metadata.js'

// Suppress terminal capability errors at the very start, before any imports that might trigger them
suppressTerminalErrors()

const processStartTime = process.hrtime.bigint()
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Marked setup moved to help command handler for lazy loading

interface Icons {
	warn: string
	success: string
	fail: string
	working: string
	party: string
	delete: string
}

interface GitConfig {
	enabled: boolean
	lastCommit?: string
	latestCommit?: string
	append: boolean
	delta: boolean
}

interface MetaTypeEntry {
	type: string
	definition: MetadataDefinition
	add: {
		files: string[]
		directories: string[]
	}
	remove: {
		files: string[]
		directories: string[]
	}
}

interface ProcessedStats {
	total: number
	errors: number
	current: number
}

interface GlobalContext {
	__basedir?: string
	logger?: winston.Logger
	consoleTransport?: {
		silent?: boolean
	}
	icons?: Icons
	displayError?: (error: string, quit?: boolean) => void
	git?: GitConfig
	metaTypes?: Record<string, MetaTypeEntry>
	runType?: string | null
	format?: string
	process?: ProcessedStats
	signConfig?: boolean
	verifyConfig?: boolean
}

declare const global: GlobalContext & typeof globalThis

global.__basedir = undefined

// Initialize logger with console and file transports
const logDir = path.join(process.cwd(), '.sfdx', 'sfparty')
// Ensure log directory exists
if (!fs.existsSync(logDir)) {
	fs.mkdirSync(logDir, { recursive: true })
}

const logFile = path.join(logDir, 'sfparty.log')

// Create logger with console transport that can be toggled
const consoleTransport = new winston.transports.Console({
	format: winston.format.cli(),
})

global.logger = winston.createLogger({
	levels: {
		error: 0,
		warn: 1,
		info: 2,
		http: 3,
		verbose: 4,
		debug: 5,
		silly: 6,
	},
	format: winston.format.combine(
		winston.format.timestamp(),
		winston.format.errors({ stack: true }),
		winston.format.json(),
	),
	defaultMeta: { service: 'sfparty' },
	transports: [
		consoleTransport,
		// Only create file transport if we'll actually log something
		// File logging is primarily for errors and warnings
		new winston.transports.File({
			filename: logFile,
			maxsize: 10 * 1024 * 1024, // 10MB
			maxFiles: 5,
			level: 'warn', // Only log warnings and errors to file (not info)
		}),
	],
})

// Store console transport reference for toggling
global.consoleTransport = consoleTransport

global.icons = {
	warn: '🔕',
	success: clc.greenBright('✔'),
	fail: '❗',
	working: '⏳',
	party: '🎉',
	delete: '❌💀❌',
}

global.displayError = (error: string, quit = false): void => {
	// SEC-008: Sanitize error messages before displaying to users
	// Log original error (with full details) for debugging
	global.logger?.error(error)

	// Display sanitized error to user (paths removed/replaced)
	const sanitized = sanitizeErrorMessage(error)
	console.info(sanitized)
	if (quit) process.exit(1)
}

const typeArray = ['label', 'profile', 'permset', 'workflow'] as const
type MetadataType = (typeof typeArray)[number]

global.git = {
	enabled: false,
	lastCommit: undefined,
	latestCommit: undefined,
	append: false,
	delta: false,
}

/**
 * Old ProgressTracker removed - TUIProgressTracker now handles both TUI and fallback spinner modes
 */

/**
 * Resource-aware concurrency calculator
 * Dynamically calculates optimal concurrency based on available system resources
 */
class ResourceManager {
	private readonly cpuCores: number
	private readonly totalMemory: number
	private readonly estimatedMemoryPerFile: number = 30 * 1024 * 1024 // 30MB per file (more realistic for profiles)
	private readonly minConcurrency: number = 10
	public readonly maxConcurrency: number

	constructor(maxConcurrencyOverride?: number) {
		this.cpuCores = os.cpus().length
		this.totalMemory = os.totalmem()
		// SEC-014: Allow CLI override of max concurrency (min: 1, max: 100)
		if (maxConcurrencyOverride !== undefined) {
			this.maxConcurrency = Math.max(
				1,
				Math.min(100, maxConcurrencyOverride),
			)
		} else {
			this.maxConcurrency = 100
		}
	}

	/**
	 * Calculate optimal concurrency based on current system resources
	 */
	calculateOptimalConcurrency(fileCount: number): number {
		const freeMemory = os.freemem()
		const usedMemory = this.totalMemory - freeMemory
		const memoryUsagePercent = (usedMemory / this.totalMemory) * 100

		// Calculate memory-based concurrency
		// Reserve memory for system, but be more realistic about what's actually available
		// macOS often shows high memory usage due to file caching, but that memory is reclaimable
		// Reserve 500MB for system (more realistic than 1GB)
		const reservedMemory = 512 * 1024 * 1024 // 500MB
		const availableMemory = Math.max(0, freeMemory - reservedMemory)

		// Also consider that we can use some of the "used" memory if it's just file cache
		// macOS uses free memory for file caching, which is quickly reclaimable
		// If free memory is very low but we have reasonable total memory, assume some cache is reclaimable
		// However, be much more conservative when free memory is critically low (<200MB) to avoid swap thrashing
		let reclaimableCache = 0
		if (
			memoryUsagePercent > 85 &&
			this.totalMemory > 8 * 1024 * 1024 * 1024
		) {
			if (freeMemory < 200 * 1024 * 1024) {
				// Critically low free memory - assume minimal reclaimable cache to avoid swap
				reclaimableCache = Math.min(
					512 * 1024 * 1024,
					this.totalMemory * 0.05,
				) // Max 512MB or 5% when critical
			} else if (freeMemory < 500 * 1024 * 1024) {
				// Very low free memory - be conservative
				reclaimableCache = Math.min(
					1024 * 1024 * 1024,
					this.totalMemory * 0.08,
				) // Max 1GB or 8% when very low
			} else {
				// Low but not critical - can assume more cache is reclaimable
				reclaimableCache = Math.min(
					2 * 1024 * 1024 * 1024,
					this.totalMemory * 0.1,
				) // Up to 2GB or 10%
			}
		}

		const effectiveAvailableMemory = availableMemory + reclaimableCache
		const memoryBasedConcurrency = Math.floor(
			effectiveAvailableMemory / this.estimatedMemoryPerFile,
		)

		// Calculate CPU-based concurrency
		// For I/O-bound operations, we can use more than CPU cores
		// Scale based on CPU cores as a baseline
		const cpuBasedConcurrency = this.cpuCores * 3 // I/O bound can use 3x CPU cores

		// Adjust based on memory pressure, with more aggressive reductions for critical memory situations
		let memoryMultiplier = 1.0
		if (memoryUsagePercent > 98 && freeMemory < 200 * 1024 * 1024) {
			// Critical memory pressure - very conservative to avoid swap thrashing
			memoryMultiplier = 0.2
		} else if (memoryUsagePercent > 95 && freeMemory < 500 * 1024 * 1024) {
			// Extreme memory pressure with very little free - be very conservative
			memoryMultiplier = 0.3
		} else if (memoryUsagePercent > 90 && freeMemory < 1024 * 1024 * 1024) {
			// High memory pressure with <1GB free - reduce significantly
			memoryMultiplier = 0.5
		} else if (memoryUsagePercent > 85) {
			// Moderate-high memory pressure - reduce moderately
			memoryMultiplier = 0.7
		} else if (memoryUsagePercent < 50) {
			// Low memory usage - can be more aggressive
			memoryMultiplier = 1.3
		} else if (memoryUsagePercent < 70) {
			// Moderate memory usage - normal
			memoryMultiplier = 1.1
		}

		// Take the minimum of CPU and memory constraints, adjusted for pressure
		const baseConcurrency = Math.min(
			memoryBasedConcurrency,
			cpuBasedConcurrency,
		)
		const adjustedConcurrency = Math.floor(
			baseConcurrency * memoryMultiplier,
		)

		// Clamp to reasonable bounds, but allow lower minimum when memory is critical
		const minConcurrency =
			memoryUsagePercent > 98 && freeMemory < 200 * 1024 * 1024
				? 3 // Very low minimum when memory is critical
				: memoryUsagePercent > 95 && freeMemory < 500 * 1024 * 1024
					? 5 // Low minimum when memory is extreme
					: this.minConcurrency
		const concurrency = Math.max(
			minConcurrency,
			Math.min(this.maxConcurrency, adjustedConcurrency),
		)

		// Don't exceed file count
		return Math.min(concurrency, fileCount)
	}

	/**
	 * Get current system resource stats for logging
	 */
	getResourceStats(): {
		cpuCores: number
		totalMemory: number
		freeMemory: number
		usedMemory: number
		memoryUsagePercent: number
	} {
		const freeMemory = os.freemem()
		const usedMemory = this.totalMemory - freeMemory
		const memoryUsagePercent = (usedMemory / this.totalMemory) * 100

		return {
			cpuCores: this.cpuCores,
			totalMemory: this.totalMemory,
			freeMemory,
			usedMemory,
			memoryUsagePercent,
		}
	}

	/**
	 * Recalculate concurrency based on current resource state
	 * Used for adaptive adjustment during execution
	 */
	recalculateConcurrency(
		fileCount: number,
		currentConcurrency: number,
	): number {
		const newConcurrency = this.calculateOptimalConcurrency(fileCount)
		// Only adjust if there's a significant difference to avoid thrashing
		const difference = Math.abs(newConcurrency - currentConcurrency)
		if (difference > 2) {
			return newConcurrency
		}
		return currentConcurrency
	}
}

/**
 * Concurrency limiter using semaphore pattern with adaptive concurrency
 * Monitors performance and adjusts concurrency based on actual throughput
 */
async function limitConcurrency<T>(
	tasks: (() => Promise<T>)[],
	concurrency: number,
	resourceManager?: ResourceManager,
): Promise<T[]> {
	const results: T[] = new Array(tasks.length)
	let running = 0
	let index = 0
	let currentConcurrency = concurrency
	let _completedCount = 0
	let lastAdjustmentTime = Date.now()
	const taskDurations: number[] = [] // Track recent task durations for performance analysis
	const maxDurationHistory = 20 // Keep last 20 task durations

	// Periodically check and adjust concurrency based on resources and performance
	const adjustInterval = resourceManager
		? setInterval(() => {
				const now = Date.now()
				const timeSinceLastAdjustment = now - lastAdjustmentTime

				// Check resource-based adjustment
				const resourceConcurrency =
					resourceManager.recalculateConcurrency(
						tasks.length,
						currentConcurrency,
					)

				// Performance-based adjustment: analyze recent task completion times
				let performanceAdjustment = 0
				if (
					taskDurations.length >= 5 &&
					timeSinceLastAdjustment > 5000
				) {
					// Calculate average and median task duration
					const sorted = [...taskDurations].sort((a, b) => a - b)
					const avgDuration =
						taskDurations.reduce((a, b) => a + b, 0) /
						taskDurations.length
					const medianDuration = sorted[Math.floor(sorted.length / 2)]

					// Use median to avoid outliers, but also consider average
					const typicalDuration = (avgDuration + medianDuration) / 2

					// If tasks are taking > 4 seconds on average, reduce concurrency (I/O contention)
					if (typicalDuration > 4000 && currentConcurrency > 10) {
						performanceAdjustment = -3
					} else if (
						typicalDuration > 3000 &&
						currentConcurrency > 15
					) {
						performanceAdjustment = -2
					} else if (
						typicalDuration < 2000 &&
						currentConcurrency < resourceConcurrency
					) {
						// If tasks are completing quickly (< 2s), we can increase
						performanceAdjustment = 2
					} else if (
						typicalDuration < 1500 &&
						currentConcurrency < resourceConcurrency
					) {
						// Very fast completion, be more aggressive
						performanceAdjustment = 3
					}
				}

				// Apply adjustments (respect maxConcurrency from ResourceManager)
				const newConcurrency = Math.max(
					10,
					Math.min(
						resourceManager.maxConcurrency,
						resourceConcurrency + performanceAdjustment,
					),
				)

				if (newConcurrency !== currentConcurrency) {
					currentConcurrency = newConcurrency
					lastAdjustmentTime = now
					// Clear duration history when adjusting to get fresh metrics
					taskDurations.length = 0
				}
			}, 3000) // Check every 3 seconds
		: null

	return new Promise((resolve) => {
		function runNext(): void {
			// Start as many tasks as we can
			while (running < currentConcurrency && index < tasks.length) {
				running++
				const currentIndex = index++
				const task = tasks[currentIndex]
				const taskStart = Date.now()

				task()
					.then((result) => {
						results[currentIndex] = result
					})
					.catch((error) => {
						// Store error as result, caller can check
						results[currentIndex] = error as T
					})
					.finally(() => {
						_completedCount++
						const taskDuration = Date.now() - taskStart
						taskDurations.push(taskDuration)
						// Keep only recent durations
						if (taskDurations.length > maxDurationHistory) {
							taskDurations.shift()
						}
						running--
						runNext()
					})
			}

			// If all tasks are done, resolve
			if (running === 0 && index >= tasks.length) {
				if (adjustInterval) {
					clearInterval(adjustInterval)
				}
				resolve(results)
			}
		}

		// Start initial batch
		runNext()
	})
}

global.metaTypes = {
	label: {
		type: labelDefinition.metadataDefinition.filetype,
		definition: labelDefinition.metadataDefinition,
		add: { files: [], directories: [] },
		remove: { files: [], directories: [] },
	},
	profile: {
		type: profileDefinition.metadataDefinition.filetype,
		definition: profileDefinition.metadataDefinition,
		add: { files: [], directories: [] },
		remove: { files: [], directories: [] },
	},
	permset: {
		type: permsetDefinition.metadataDefinition.filetype,
		definition: permsetDefinition.metadataDefinition,
		add: { files: [], directories: [] },
		remove: { files: [], directories: [] },
	},
	workflow: {
		type: workflowDefinition.metadataDefinition.filetype,
		definition: workflowDefinition.metadataDefinition,
		add: { files: [], directories: [] },
		remove: { files: [], directories: [] },
	},
}

global.runType = null

let types: string[] = []
let packageDir: string = ''
let packageDirInitialized = false
let packageDirPromise: Promise<string> | null = null

const errorMessage = clc.red(
	'Please specify the action of ' +
		clc.whiteBright.bgRedBright('split') +
		' or ' +
		clc.whiteBright.bgRedBright('combine') +
		'.',
)
let addPkg: packageUtil.Package
let desPkg: packageUtil.Package
// Don't display header here - it will be shown in TUI or at the end

let checkYargs = false

/**
 * SEC-005: Validate and sanitize INIT_CWD environment variable
 * @param initCwd - INIT_CWD environment variable value
 * @returns Sanitized path or undefined if invalid
 */
function validateInitCwd(initCwd: string | undefined): string | undefined {
	if (!initCwd || typeof initCwd !== 'string') {
		return undefined
	}

	// Remove null bytes and other dangerous characters
	const sanitized = initCwd.replace(/\0/g, '').trim()

	// Basic validation: should be a valid path
	// Don't allow paths with dangerous patterns
	if (
		sanitized.includes('..') ||
		sanitized.includes('\n') ||
		sanitized.includes('\r') ||
		sanitized.length === 0 ||
		sanitized.length > 4096 // Max path length on most systems
	) {
		global.logger?.warn(
			`Invalid INIT_CWD environment variable detected, ignoring: ${sanitized.substring(0, 100)}`,
		)
		return undefined
	}

	// Validate it's an absolute path (INIT_CWD should always be absolute)
	if (!path.isAbsolute(sanitized)) {
		global.logger?.warn(
			`INIT_CWD is not an absolute path, ignoring: ${sanitized}`,
		)
		return undefined
	}

	return sanitized
}

const isRunningUnderNpx = (): boolean => {
	const npxIndicator = argv.some((arg) => arg.includes('_npx'))
	// SEC-005: Validate and sanitize INIT_CWD before use
	const initCwd = validateInitCwd(env.INIT_CWD)
	return npxIndicator || initCwd !== undefined
}

const isRunningDirectlyWithNode = async (): Promise<boolean> => {
	const modulePath = resolve(__dirname, 'index.js')
	const mainModulePath = process.argv[1]

	return modulePath === mainModulePath
}

const checkExecutionContext = async (): Promise<void> => {
	if (isRunningUnderNpx()) {
		global.runType = 'npx'
	} else if (await isRunningDirectlyWithNode()) {
		global.runType = 'node'
	} else {
		global.runType = 'global'
	}
}

checkExecutionContext()

interface SplitCombineArgv {
	_: (string | number)[]
	$0: string
	format: string
	git?: string
	append?: boolean
	delta?: boolean
	package?: string
	destructive?: string
	source?: string
	target?: string
	type?: string
	name?: string
	all?: boolean
	keepFalseValues?: boolean
	maxConcurrency?: number
	signConfig?: boolean
	verifyConfig?: boolean
}

yargs(hideBin(process.argv))
	.command({
		command: 'help',
		aliases: ['h'],
		builder: (yargs) => {
			return yargs.check(yargCheck)
		},
		handler: async (_argv) => {
			const { marked } = await import('marked')
			// @ts-expect-error - marked-terminal has no type definitions available
			const markedTerminal = (await import('marked-terminal')).default
			marked.setOptions({
				renderer: new markedTerminal() as unknown as Parameters<
					typeof marked.setOptions
				>[0]['renderer'],
			})
			const data = fs.readFileSync(
				path.join(process.cwd(), 'README.md'),
				'utf8',
			)
			console.log(marked(data))
		},
	})
	.command({
		command: '[test]',
		aliases: ['test'],
		builder: (yargs) => {
			return yargs.check(yargCheck)
		},
		handler: (_argv) => {
			global.logger?.info(
				clc.magentaBright(
					`${global.icons?.party} TEST ${global.icons?.party}`,
				),
			)
		},
	})
	.command({
		command: '[update]',
		aliases: ['update'],
		builder: (yargs) => {
			return yargs.check(yargCheck)
		},
		handler: (_argv) => {
			checkVersion({
				axios,
				spawnSync,
				currentVersion: pkgObj.version,
				update: true,
			})
		},
	})
	.command({
		command: '[split]',
		aliases: ['split'],
		describe: 'splits metadata xml to yaml/json files',
		builder: (yargs) => {
			yargs
				.example(yargOptions.splitExamples)
				// @ts-expect-error - yargs options type mismatch (known issue with yargs v17 types)
				.options(yargOptions.splitOptions)
				.choices('format', ['json', 'yaml'])
				.check(yargCheck)
			return yargs
		},
		handler: (argv) => {
			const argvTyped = argv as unknown as SplitCombineArgv
			global.format = argvTyped.format
			global.signConfig = argvTyped.signConfig ?? false
			global.verifyConfig = argvTyped.verifyConfig ?? false
			splitHandler(argvTyped, processStartTime)
		},
	})
	.command({
		command: '[combine]',
		aliases: ['combine'],
		describe: 'combines yaml/json files into metadata xml',
		builder: (yargs) => {
			yargs
				.example(yargOptions.combineExamples)
				// @ts-expect-error - yargs options type mismatch (known issue with yargs v17 types)
				.options(yargOptions.combineOptions)
				.choices('format', ['json', 'yaml'])
				.check(yargCheck)
			return yargs
		},
		handler: (argv) => {
			const argvTyped = argv as unknown as SplitCombineArgv
			global.format = argvTyped.format
			// SEC-014: Validate concurrency if provided
			if (argvTyped.maxConcurrency !== undefined) {
				if (
					argvTyped.maxConcurrency < 1 ||
					argvTyped.maxConcurrency > 100
				) {
					throw new Error(
						'Concurrency must be between 1 and 100 (inclusive)',
					)
				}
			}
			const startProm = new Promise<boolean>((resolve, reject) => {
				if (argvTyped.git !== undefined) {
					const gitRef = sanitizeGitRef(argvTyped.git)
					global.git!.append = argvTyped.append || global.git!.append
					global.git!.delta = argvTyped.delta || global.git!.delta
					if (argvTyped.git === '') {
						// SEC-013: Create temporary context for lastCommit call
						const tempCtx = createContext({
							basedir: global.__basedir || '',
							logger: global.logger!,
							displayError: global.displayError!,
							format: 'yaml',
							metaTypes: global.metaTypes!,
							git: global.git,
							signConfig: false,
							verifyConfig: false,
							icons: global.icons!,
							consoleTransport: global.consoleTransport!,
							runType: global.runType ?? null,
						})
						const commit = git.lastCommit({
							ctx: tempCtx,
							dir: global.__basedir!,
							existsSync: fs.existsSync,
							execFileSync,
							fileUtils,
						})
						commit
							.then((data) => {
								global.git!.latestCommit = data.latestCommit
								global.git!.lastCommit = data.lastCommit
								if (data.lastCommit === undefined) {
									gitMode({ status: 'not active' })
									resolve(false)
								} else {
									gitMode({
										status: 'active',
										lastCommit: data.lastCommit,
										latestCommit: data.latestCommit,
									})
									const diff = git.diff({
										dir: global.__basedir!,
										gitRef: `${data.lastCommit}..${data.latestCommit}`,
										existsSync: fs.existsSync,
										spawn,
									})
									diff.then(async (data) => {
										// Use tempCtx that was created above for lastCommit
										await gitFiles(tempCtx, data)
										resolve(true)
									}).catch((error) => {
										global.logger?.error(error)
										reject(error)
									})
								}
							})
							.catch((error) => {
								global.logger?.error(error)
								throw error
							})
					} else {
						gitMode({ status: 'active', gitRef })
						// SEC-007: Initialize audit logger when git mode is enabled
						auditLogger.initAuditLogger(global.__basedir)
						const diff = git.diff({
							dir: global.__basedir!,
							gitRef,
							existsSync: fs.existsSync,
							spawn,
						})
						diff.then(async (data) => {
							// Create a temporary ctx for gitFiles
							const tempCtx = createContext({
								basedir: global.__basedir || '',
								logger: global.logger!,
								displayError: global.displayError!,
								format: global.format || 'yaml',
								metaTypes: global.metaTypes!,
								git: global.git,
								icons: global.icons!,
								consoleTransport: global.consoleTransport!,
								runType: global.runType ?? null,
							})
							await gitFiles(tempCtx, data)
							resolve(true)
						}).catch((error) => {
							global.logger?.error(error)
							reject(error)
						})
					}
				} else {
					resolve(false)
				}
			})
			startProm.then((result) => {
				global.git!.enabled = result

				if (global.git!.enabled) {
					const addManifest =
						(argv as unknown as SplitCombineArgv).package ||
						'manifest/package-party.xml'
					const desManifest =
						(argv as unknown as SplitCombineArgv).destructive ||
						'manifest/destructiveChanges-party.xml'

					addPkg = new packageUtil.Package(addManifest)
					desPkg = new packageUtil.Package(desManifest)
					// SEC-013: Create temporary context for getPackageXML calls
					// Note: This is a temporary workaround until full migration
					const tempCtx = createContext({
						basedir: global.__basedir || '',
						logger: global.logger!,
						displayError: global.displayError!,
						format:
							(argv as unknown as SplitCombineArgv).format ||
							'yaml',
						metaTypes: global.metaTypes!,
						git: global.git,
						signConfig: false,
						verifyConfig: false,
						icons: global.icons!,
						consoleTransport: global.consoleTransport!,
						runType: global.runType ?? null,
					})
					const prom1 = addPkg.getPackageXML(tempCtx, fileUtils)
					const prom2 = desPkg.getPackageXML(tempCtx, fileUtils)

					Promise.allSettled([prom1, prom2]).then((results) => {
						const rejected = results.filter(
							(p) => p.status === 'rejected',
						)
						if (rejected.length > 0) {
							const rejectedValue = (
								rejected[0] as PromiseRejectedResult
							).reason
							throw new Error(rejectedValue)
						} else {
							combineHandler(
								argv as unknown as SplitCombineArgv,
								processStartTime,
							)
						}
					})
				} else {
					combineHandler(
						argv as unknown as SplitCombineArgv,
						processStartTime,
					)
				}
			})
			startProm.catch((error) => {
				global.displayError?.(error, true)
			})
		},
	})
	.demandCommand(1, errorMessage)
	.example([
		['$0 split --type=profile --all'],
		['$0 split --type=profile --name="Profile Name"'],
		['$0 combine --type=permset --all'],
		['$0 combine --type=permset --name="Permission Set Name"'],
	])
	.help(false)
	.version(false).argv

if (!checkYargs)
	checkVersion({
		axios,
		spawnSync,
		currentVersion: pkgObj.version,
		update: false,
	})

interface GitModeParams {
	status: string
	gitRef?: string
	lastCommit?: string
	latestCommit?: string
}

function gitMode({
	status,
	gitRef,
	lastCommit,
	latestCommit,
}: GitModeParams): void {
	let statusMessage: string
	let displayMessage: string
	if (status === 'not active') {
		statusMessage = clc.bgMagentaBright('not active:')
		displayMessage = `no prior commit - processing all`
	} else {
		statusMessage = clc.magentaBright('active:')
		if (gitRef === undefined) {
			displayMessage = `${
				clc.bgBlackBright(lastCommit) +
				'..' +
				clc.bgBlackBright(latestCommit)
			}`
		} else {
			let delimiter = '..'

			if (/\s/.test(gitRef)) {
				delimiter = ' '
			}

			const refArray = gitRef.split(delimiter)
			const updatedArray = refArray.map((item) => clc.bgBlackBright(item))
			displayMessage = updatedArray.join(delimiter)
		}
	}
	console.log(
		`${clc.yellowBright('git mode')} ${statusMessage} ${displayMessage}`,
	)
	console.log()
}

function sanitizeGitRef(gitRef: string): string {
	if (!gitRef || typeof gitRef !== 'string') {
		throw new Error('Invalid git reference')
	}

	const trimmed = gitRef.trim()

	if (!/^[a-zA-Z0-9._\-\/^~@]+(\.\.+[a-zA-Z0-9._\-\/^~@]+)?$/.test(trimmed)) {
		throw new Error(
			'Git reference contains invalid characters. Only alphanumeric, dots, dashes, underscores, slashes, ^, ~, and @ are allowed.',
		)
	}

	return trimmed
}

function yargCheck(argv: Yargs.Arguments, _options: Yargs.Options): boolean {
	checkYargs = true
	const argvKeys = Object.keys(argv)
	// Build list of valid option keys from both split and combine options
	const validKeys = new Set([
		...Object.keys(yargOptions.splitOptions),
		...Object.keys(yargOptions.combineOptions),
	])
	// Also include aliases as valid keys
	const allOptions = {
		...yargOptions.splitOptions,
		...yargOptions.combineOptions,
	}
	Object.values(allOptions).forEach((option) => {
		if (option && typeof option === 'object' && option !== null) {
			const alias = (option as { alias?: string | string[] }).alias
			if (typeof alias === 'string') {
				validKeys.add(alias)
			} else if (Array.isArray(alias)) {
				alias.forEach((a: string) => validKeys.add(a))
			}
		}
	})
	// Also add kebab-case versions of camelCase keys (yargs converts these)
	// Convert camelCase to kebab-case for validation
	validKeys.forEach((key) => {
		const kebabCase = key.replace(/([A-Z])/g, '-$1').toLowerCase()
		if (kebabCase !== key) {
			validKeys.add(kebabCase)
		}
	})
	const invalidKeys = argvKeys.filter(
		(key) => !['_', '$0'].includes(key) && !validKeys.has(key),
	)

	const argvArray = Array.isArray(argv._) ? argv._ : []
	if (
		!argvArray.includes('update') &&
		!argvArray.includes('combine') &&
		!argvArray.includes('split')
	) {
		checkVersion({
			axios,
			spawnSync,
			currentVersion: pkgObj.version,
			update: false,
		})
	}

	if (invalidKeys.length > 0) {
		const invalidKeysWithColor = invalidKeys.map((key) =>
			clc.redBright(key),
		)
		throw new Error(
			`Invalid options specified: ${invalidKeysWithColor.join(', ')}`,
		)
	}

	const name = argv.name
	const typeValue = argv.type
	types =
		typeValue !== undefined && typeof typeValue === 'string'
			? typeValue.split(',')
			: Array.from(typeArray)
	types.forEach((type) => {
		type = type.trim()
		if (!typeArray.includes(type as MetadataType)) {
			throw new Error(`Invalid type: ${type}`)
		}
	})

	if (types.length > 1) {
		if (typeof name !== 'undefined' && name !== '') {
			throw new Error(
				clc.redBright(
					'You cannot specify ' +
						clc.whiteBright.bgRedBright('--name') +
						' when using multiple types.',
				),
			)
		}
	} else {
		switch (argv.type) {
			case 'label':
				if (typeof name !== 'undefined' && name !== '') {
					throw new Error(
						clc.redBright(
							'You cannot specify ' +
								clc.whiteBright.bgRedBright('--name') +
								'  when using label.',
						),
					)
				}
				break
		}
	}
	return true
}

function displayMessageAndDuration(startTime: bigint, message: string): void {
	const diff = process.hrtime.bigint() - BigInt(startTime)
	let durationMessage: string
	const executionTime = convertHrtime(diff)
	const minutes = Math.floor(
		(executionTime.seconds +
			Math.round(executionTime.milliseconds / 100000)) /
			60,
	)
	const seconds = Math.round(
		(executionTime.seconds +
			Math.round(executionTime.milliseconds / 100000)) %
			60,
	)
	if (minutes === 0 && seconds === 0) {
		durationMessage = message + clc.magentaBright(`<1s`)
	} else if (minutes > 0) {
		durationMessage = message + clc.magentaBright(`${minutes}m ${seconds}s`)
	} else {
		durationMessage = message + clc.magentaBright(`${seconds}s`)
	}
	console.log('\n' + durationMessage)
}

let callAmount = 0
process.on('SIGINT', function () {
	if (callAmount < 1) {
		console.log(`✅ Received abort command`)
		process.exit(1)
	}

	callAmount++
})

function splitHandler(argv: SplitCombineArgv, startTime: bigint): void {
	// SEC-013: Create context from global state and argv
	const ctx = createContext({
		basedir: global.__basedir || '',
		logger: global.logger!,
		displayError: global.displayError!,
		format: argv.format,
		metaTypes: global.metaTypes!,
		signConfig: argv.signConfig ?? false,
		verifyConfig: argv.verifyConfig ?? false,
		icons: global.icons!,
		consoleTransport: global.consoleTransport!,
		runType: global.runType ?? null,
	})
	const split = processSplit(ctx, types[0], argv)
	split.then(() => {
		types.shift()
		if (types.length > 0) {
			console.log()
			splitHandler(argv, startTime)
		} else {
			if (argv.type === undefined || argv.type.split(',').length > 1) {
				const message = `Split completed in `
				displayMessageAndDuration(startTime, message)
			}
			checkVersion({
				axios,
				spawnSync,
				currentVersion: pkgObj.version,
				update: false,
			})
		}
	})
}

async function processSplit(
	ctx: AppContext,
	typeItem: string,
	argv: SplitCombineArgv,
): Promise<boolean> {
	// Ensure packageDir is initialized
	if (!packageDirInitialized) {
		if (!packageDirPromise) {
			packageDirPromise = getRootPath(ctx)
		}
		packageDir = await packageDirPromise
		packageDirInitialized = true
	}
	// Update ctx.basedir if it was just initialized
	if (packageDir && global.__basedir && ctx.basedir !== global.__basedir) {
		ctx.basedir = global.__basedir
	}

	return new Promise(async (resolve, _reject) => {
		const processed: ProcessedStats = {
			total: 0,
			errors: 0,
			current: 1,
		}
		const startTime = process.hrtime.bigint()

		if (!typeArray.includes(typeItem as MetadataType)) {
			global.logger?.error('Metadata type not supported: ' + typeItem)
			process.exit(1)
		}

		const fileList: string[] = []
		const typeObj = global.metaTypes![typeItem]
		const type = typeObj.type
		const metaExtension = `.${type}-meta.xml`

		let sourceDir = argv.source || ''
		let targetDir = argv.target || ''
		let name = argv.name
		const all =
			argv.type === undefined || name === undefined ? true : argv.all

		if (type === global.metaTypes!.label.type) {
			name = global.metaTypes!.label.definition.root
		}
		sourceDir = path.join(
			global.__basedir!,
			packageDir,
			'main',
			'default',
			typeObj.definition.directory,
		)
		if (targetDir === '') {
			targetDir = path.join(
				global.__basedir!,
				packageDir + '-party',
				'main',
				'default',
				typeObj.definition.directory,
			)
		} else {
			targetDir = path.join(
				targetDir,
				'main',
				'default',
				typeObj.definition.directory,
			)
		}
		const metaDirPath = sourceDir

		if (!all && name) {
			let metaFilePath = path.join(metaDirPath, name)
			if (!(await fileUtils.fileExists({ filePath: metaFilePath, fs }))) {
				name += metaExtension
				metaFilePath = path.join(metaDirPath, name)
				if (
					!(await fileUtils.fileExists({
						workspaceRoot: ctx.basedir,
						filePath: metaFilePath,
						fs,
					}))
				) {
					// SEC-008: Sanitize file path in error message
					global.logger?.error(
						'File not found: ' + sanitizeErrorPath(metaFilePath),
					)
					process.exit(1)
				}
			}
			fileList.push(name)
		} else {
			if (
				await fileUtils.directoryExists({
					dirPath: sourceDir,
					fs,
					workspaceRoot: ctx.basedir,
				})
			) {
				const files = await fileUtils.getFiles(sourceDir, metaExtension)
				files.forEach((file) => {
					fileList.push(file)
				})
			}
		}

		processed.total = fileList.length

		if (processed.total === 0) {
			resolve(true)
			return
		}

		// Resource-aware concurrency calculation
		// SEC-014: Allow CLI override of max concurrency
		const resourceManager = new ResourceManager(argv.maxConcurrency)
		const stats = resourceManager.getResourceStats()
		const concurrency = resourceManager.calculateOptimalConcurrency(
			processed.total,
		)

		// Initialize write batcher for optimized file writes
		// Use very small batches (2-3 files) even with memory pressure to get I/O batching benefits
		// With low concurrency, use smaller batches and shorter delays to prevent blocking
		// With high concurrency, use larger batches to reduce I/O overhead
		const freeMemory = stats.freeMemory
		const criticalMemory = freeMemory < 200 * 1024 * 1024 // <200MB free
		let writeBatcherMsg = ''

		if (criticalMemory) {
			// Use very small batches (2-3 files) even with critical memory
			// This provides I/O batching benefits with minimal memory overhead (~few MB)
			const batchSize = 2 // Very small batch to minimize memory usage
			const batchDelay = 1 // Minimal delay for immediate flushing
			fileUtils.initWriteBatcher(batchSize, batchDelay)
			writeBatcherMsg = `Write batcher initialized with minimal batch size: ${batchSize} (critical memory: ${(freeMemory / 1024 / 1024).toFixed(2)}MB free)`
		} else {
			const batchSize =
				concurrency < 5
					? Math.max(5, Math.min(10, concurrency * 2)) // Smaller batches for low concurrency
					: Math.max(15, Math.min(40, Math.floor(concurrency * 1.2))) // Larger batches for high concurrency
			const batchDelay = concurrency < 5 ? 1 : 3 // Very short delays to prevent blocking
			fileUtils.initWriteBatcher(batchSize, batchDelay)
			writeBatcherMsg = `Write batcher initialized with batch size: ${batchSize}, delay: ${batchDelay}ms`
		}

		// Read queue disabled - it was adding overhead and slowing down reads
		// The stat optimization (combining fileExists + stat) is sufficient
		// Direct reads with processing concurrency work better than limiting reads separately

		// Use TUI for beautiful real-time progress display
		const progress = new TUIProgressTracker(processed.total, 'Split')
		setGlobalProgressTracker(progress)

		// Set startup information in TUI instead of console.log
		progress.setStartupInfo({
			sourcePath: sourceDir,
			targetPath: targetDir,
			totalFiles: processed.total,
			systemResources: `System resources: ${stats.cpuCores} CPU cores, ${(stats.totalMemory / 1024 / 1024 / 1024).toFixed(2)}GB total RAM, ${(stats.freeMemory / 1024 / 1024 / 1024).toFixed(2)}GB free (${stats.memoryUsagePercent.toFixed(1)}% used)`,
			concurrency: `Processing ${processed.total} file(s) with concurrency: ${concurrency} (processing ${concurrency} file(s) simultaneously)`,
			writeBatcher: writeBatcherMsg,
		})

		// Set up queue stats getter for TUI
		progress.setQueueStatsGetter(() => {
			const writeBatcher = fileUtils.getWriteBatcher()
			if (writeBatcher) {
				return writeBatcher.getQueueStats()
			}
			return null
		})

		// Update resource stats in TUI
		progress.updateResourceStats({
			...stats,
			concurrency,
		})

		const perfLogFile = path.join(logDir, 'performance.log')
		const perfLogger = new PerformanceLogger(perfLogFile)
		setPerformanceLogger(perfLogger)

		// Create tasks for all files
		const queueStartTime = process.hrtime.bigint()
		const tasks = fileList.map((metaFile, index) => {
			return async (): Promise<boolean> => {
				const filePath = path.join(sourceDir, metaFile)
				// Track queue wait time
				const queueWaitTime =
					Number(process.hrtime.bigint() - queueStartTime) / 1_000_000
				perfLogger.setQueueWaitTime(filePath, queueWaitTime)

				progress.addActive(metaFile)

				try {
					const metadataItem = new Split({
						ctx,
						metadataDefinition: typeObj.definition,
						sourceDir: sourceDir,
						targetDir: targetDir,
						metaFilePath: filePath,
						sequence: index + 1,
						total: processed.total,
						keepFalseValues: argv.keepFalseValues || false,
					})
					const result = await metadataItem.split()

					if (result === false) {
						processed.errors++
						progress.readComplete(metaFile, false)
						progress.writeComplete(metaFile, false)
						// Mark file as failed in performance logger
						perfLogger.completeFile(
							filePath,
							false,
							'Split operation returned false',
						)
						return false
					}

					// Read/parse is complete when split() returns
					progress.readComplete(metaFile, true)
					// Write is queued/complete when split() returns (may still be in batch queue)
					progress.writeComplete(metaFile, true)
					return true
				} catch (error) {
					processed.errors++
					progress.readComplete(metaFile, false)
					progress.writeComplete(metaFile, false)
					const message = `Failed to split ${metaFile}: ${error instanceof Error ? error.message : String(error)}`
					// Mark file as failed in performance logger
					const filePath = path.join(sourceDir, metaFile)
					perfLogger.completeFile(filePath, false, message)
					// Errors are already logged in split.ts, but log here too if TUI is active
					const progressTracker = getGlobalProgressTracker()
					if (progressTracker) {
						progressTracker.logError(message)
					} else {
						if (
							!global.consoleTransport ||
							!global.consoleTransport.silent
						) {
							global.logger?.error(message)
						}
					}
					return false
				}
			}
		})

		// Update resource stats periodically during processing
		const resourceUpdateInterval = setInterval(() => {
			const currentStats = resourceManager.getResourceStats()
			const currentConcurrency =
				resourceManager.calculateOptimalConcurrency(processed.total)
			progress.updateResourceStats({
				...currentStats,
				concurrency: currentConcurrency,
			})
		}, 2000) // Update every 2 seconds

		// Process all files with resource-aware concurrency control
		await limitConcurrency(tasks, concurrency, resourceManager)

		// Clear resource update interval
		clearInterval(resourceUpdateInterval)

		// Flush all batched writes before completion (only if batching was enabled)
		// Check if write batcher exists (it won't if memory was critical)
		const writeBatcher = fileUtils.getWriteBatcher()
		if (writeBatcher) {
			let remainingWrites = fileUtils.getWriteBatcherQueueLength()
			if (remainingWrites > 0) {
				// Show flushing progress - update during flush to show remaining writes
				const flushInterval = setInterval(() => {
					const currentRemaining =
						fileUtils.getWriteBatcherQueueLength()
					if (currentRemaining > 0) {
						progress.flushing(currentRemaining)
					} else {
						clearInterval(flushInterval)
					}
				}, 200) // Update every 200ms during flush to reduce overhead

				// Flush all remaining writes (flushAll is more efficient than multiple small flushes)
				await fileUtils.flushWriteBatcher()

				// Clear the interval and verify all writes completed
				clearInterval(flushInterval)
				remainingWrites = fileUtils.getWriteBatcherQueueLength()
				if (remainingWrites > 0) {
					global.logger?.warn(
						`Warning: ${remainingWrites} writes still pending after flush`,
					)
				}
			}
		}

		// Wait for all writes to complete before marking as done
		// doneWithWrites() will cleanup the TUI, then we can safely output console messages
		await progress.doneWithWrites()
		setGlobalProgressTracker(null)

		// Now safe to output console messages after TUI is cleaned up
		// Show app name and version in ANSI box like before
		displayHeader()
		console.log(
			`Split operation completed: ${processed.total - processed.errors} successful, ${processed.errors} failed`,
		)

		// Print performance summary - use same startTime to avoid discrepancy
		perfLogger.printSummary(startTime)

		const message = `Split ${clc.bgBlackBright(
			processed.total - processed.errors,
		)} file(s) ${
			processed.errors > 0
				? 'with ' +
					clc.bgBlackBright.red(processed.errors) +
					' error(s) '
				: ''
		}in `
		displayMessageAndDuration(startTime, message)
		if (processed.errors > 0) {
			resolve(false)
		} else {
			resolve(true)
		}
	})
}

function combineHandler(argv: SplitCombineArgv, startTime: bigint): void {
	// SEC-013: Create context from global state and argv
	const ctx = createContext({
		basedir: global.__basedir || '',
		logger: global.logger!,
		displayError: global.displayError!,
		format: argv.format,
		metaTypes: global.metaTypes!,
		git: global.git,
		signConfig: argv.signConfig ?? false,
		verifyConfig: argv.verifyConfig ?? false,
		icons: global.icons!,
		consoleTransport: global.consoleTransport!,
		runType: global.runType ?? null,
	})
	const combine = processCombine(ctx, types[0], argv)
	combine.then(async (resolveVal) => {
		if (resolveVal === false) {
			global.logger?.error(
				'Will not continue due to YAML format issues. Please correct and try again.',
			)
			process.exit(1)
		}
		types.shift()
		if (types.length > 0) {
			console.log()
			combineHandler(argv, startTime)
		} else {
			if (global.git!.latestCommit !== undefined) {
				await git.updateLastCommit({
					ctx,
					dir: global.__basedir!,
					latest: global.git!.latestCommit,
					fileUtils,
					fs,
				})
			}
			if (global.git!.enabled) {
				await addPkg.savePackage(ctx, { XMLBuilder }, fileUtils)
				await desPkg.savePackage(ctx, { XMLBuilder }, fileUtils)
			}
			if (argv.type === undefined || argv.type.split(',').length > 1) {
				const message = `Combine completed in `
				displayMessageAndDuration(startTime, message)
			}
			checkVersion({
				axios,
				spawnSync,
				currentVersion: pkgObj.version,
				update: false,
			})
		}
	})
	combine.catch((error) => {
		throw error
	})
}

async function processCombine(
	ctx: AppContext,
	typeItem: string,
	argv: SplitCombineArgv,
): Promise<boolean> {
	// Ensure packageDir is initialized
	if (!packageDirInitialized) {
		if (!packageDirPromise) {
			packageDirPromise = getRootPath(ctx)
		}
		packageDir = await packageDirPromise
		packageDirInitialized = true
	}

	return new Promise(async (resolve, _reject) => {
		const processed: ProcessedStats = {
			total: 0,
			errors: 0,
			current: 1,
		}
		const startTime = process.hrtime.bigint()

		if (!typeArray.includes(typeItem as MetadataType)) {
			ctx.logger.error('Metadata type not supported: ' + typeItem)
			process.exit(1)
		}

		let processList: string[] = []
		const typeObj = ctx.metaTypes[typeItem]
		const type = typeObj.type

		let sourceDir = argv.source || ''
		let targetDir = argv.target || ''
		const name = argv.name
		const all =
			argv.type === undefined || name === undefined ? true : argv.all

		sourceDir = path.join(
			ctx.basedir,
			packageDir + '-party',
			'main',
			'default',
			typeObj.definition.directory,
		)
		if (targetDir === '') {
			targetDir = path.join(
				ctx.basedir,
				packageDir,
				'main',
				'default',
				typeObj.definition.directory,
			)
		} else {
			targetDir = path.join(
				targetDir,
				'main',
				'default',
				typeObj.definition.directory,
			)
		}

		if (type === ctx.metaTypes.label.type) {
			if (
				!ctx.git?.enabled ||
				[
					...new Set([
						...ctx.metaTypes[typeItem].add.directories,
						...ctx.metaTypes[typeItem].remove.directories,
					]),
				].includes(ctx.metaTypes[typeItem].definition.root)
			) {
				processList.push(global.metaTypes!.label.definition.root)
			}
		} else if (!all) {
			const metaDirPath = path.join(sourceDir, name || '')
			const dirExists = await fileUtils.directoryExists({
				workspaceRoot: ctx.basedir,
				dirPath: metaDirPath,
				fs,
			})
			if (!dirExists) {
				// SEC-008: Sanitize directory path in error message
				global.logger?.error(
					'Directory not found: ' + sanitizeErrorPath(metaDirPath),
				)
				process.exit(1)
			}
			processList.push(name || '')
		} else {
			if (global.git!.enabled) {
				processList = [
					...new Set([
						...global.metaTypes![typeItem].add.directories,
						...global.metaTypes![typeItem].remove.directories,
					]),
				]
			} else {
				processList = await fileUtils.getDirectories(sourceDir)
			}
		}

		processed.total = processList.length

		if (processed.total === 0) {
			resolve(true)
			return
		}

		// Resource-aware concurrency calculation
		// SEC-014: Allow CLI override of max concurrency
		const resourceManager = new ResourceManager(argv.maxConcurrency)
		const stats = resourceManager.getResourceStats()
		const concurrency = resourceManager.calculateOptimalConcurrency(
			processed.total,
		)

		// Use TUI for beautiful real-time progress display
		const progress = new TUIProgressTracker(processed.total, 'Combine')
		setGlobalProgressTracker(progress)

		// Set startup information in TUI instead of console.log
		progress.setStartupInfo({
			sourcePath: sourceDir,
			targetPath: targetDir,
			totalFiles: processed.total,
			systemResources: `System resources: ${stats.cpuCores} CPU cores, ${(stats.totalMemory / 1024 / 1024 / 1024).toFixed(2)}GB total RAM, ${(stats.freeMemory / 1024 / 1024 / 1024).toFixed(2)}GB free (${stats.memoryUsagePercent.toFixed(1)}% used)`,
			concurrency: `Processing ${processed.total} file(s) with concurrency: ${concurrency} (processing ${concurrency} file(s) simultaneously)`,
		})

		// Update resource stats in TUI
		progress.updateResourceStats({
			...stats,
			concurrency,
		})

		const perfLogFile = path.join(logDir, 'performance.log')
		const perfLogger = new PerformanceLogger(perfLogFile)
		setPerformanceLogger(perfLogger)

		// Create tasks for all directories
		const tasks = processList.map((metaDir, index) => {
			return async (): Promise<boolean> => {
				progress.addActive(metaDir)
				const fileStartTime = process.hrtime.bigint()

				try {
					const metadataItem = new Combine({
						ctx,
						metadataDefinition: typeObj.definition,
						sourceDir,
						targetDir,
						metaDir,
						sequence: index + 1,
						total: processed.total,
						addPkg,
						desPkg,
					})
					const result = await metadataItem.combine()

					const fileEndTime = process.hrtime.bigint()
					const duration = convertHrtime(fileEndTime - fileStartTime)
					const durationStr = `${duration.seconds}.${duration.milliseconds}s`

					if (result === false) {
						processed.errors++
						progress.complete(metaDir, durationStr, false)
						return false
					}

					progress.complete(metaDir, durationStr, true)
					return true
				} catch (error) {
					processed.errors++
					const fileEndTime = process.hrtime.bigint()
					const duration = convertHrtime(fileEndTime - fileStartTime)
					const durationStr = `${duration.seconds}.${duration.milliseconds}s`
					progress.complete(metaDir, durationStr, false)
					global.logger?.error(
						`Failed to combine ${metaDir}: ${error instanceof Error ? error.message : String(error)}`,
					)
					return false
				}
			}
		})

		// Update resource stats periodically during processing
		const resourceUpdateInterval = setInterval(() => {
			const currentStats = resourceManager.getResourceStats()
			const currentConcurrency =
				resourceManager.calculateOptimalConcurrency(processed.total)
			progress.updateResourceStats({
				...currentStats,
				concurrency: currentConcurrency,
			})
		}, 2000) // Update every 2 seconds

		// Process all directories with resource-aware concurrency control
		await limitConcurrency(tasks, concurrency, resourceManager)

		// Clear resource update interval
		clearInterval(resourceUpdateInterval)

		// Wait for TUI cleanup before console output
		await progress.doneWithWrites()
		setGlobalProgressTracker(null)

		// Now safe to output console messages after TUI is cleaned up
		// Show app name and version in ANSI box like before
		displayHeader()
		console.log(
			`Combine operation completed: ${processed.total - processed.errors} successful, ${processed.errors} failed`,
		)

		// Print performance summary - use same startTime to avoid discrepancy
		perfLogger.printSummary(startTime)

		const message = `Combined ${clc.bgBlackBright(
			processed.total - processed.errors,
		)} file(s) ${
			processed.errors > 0
				? 'with ' +
					clc.bgBlackBright.red(processed.errors) +
					' error(s) '
				: ''
		}in `
		displayMessageAndDuration(startTime, message)
		if (processed.errors > 0) {
			resolve(false)
		} else {
			resolve(true)
		}
	})
}

interface GitFileItem {
	path: string
	action: string
}

async function gitFiles(ctx: AppContext, data: GitFileItem[]): Promise<void> {
	// Ensure packageDir is initialized
	if (!packageDirInitialized) {
		if (!packageDirPromise) {
			packageDirPromise = getRootPath(ctx)
		}
		packageDir = await packageDirPromise
		packageDirInitialized = true
	}

	data.forEach((item) => {
		if (item.path.indexOf(packageDir + '-party/') === 0) {
			const pathArray = item.path.split('/')
			if (pathArray.length > 3) {
				if (getDirectories().includes(pathArray[3])) {
					switch (item.action) {
						case 'add':
							global.metaTypes![
								getKey(pathArray[3])!
							].add.files.push(
								path.join(global.__basedir!, item.path),
							)
							if (
								!global.metaTypes![
									getKey(pathArray[3])!
								].add.directories.includes(pathArray[4])
							) {
								global.metaTypes![
									getKey(pathArray[3])!
								].add.directories.push(pathArray[4])
							}
							break
						case 'delete':
							global.metaTypes![
								getKey(pathArray[3])!
							].remove.files.push(
								path.join(global.__basedir!, item.path),
							)
							if (
								!global.metaTypes![
									getKey(pathArray[3])!
								].remove.directories.includes(pathArray[4])
							) {
								global.metaTypes![
									getKey(pathArray[3])!
								].remove.directories.push(pathArray[4])
							}
							break
					}
				}
			}
		}
	})
}

function getKey(directory: string): string | undefined {
	let key: string | undefined = undefined
	Object.keys(global.metaTypes!).forEach((type) => {
		if (global.metaTypes![type].definition.directory === directory) {
			key = type
		}
	})
	return key
}

function getDirectories(): string[] {
	const types: string[] = []
	Object.keys(global.metaTypes!).forEach((type) => {
		try {
			types.push(global.metaTypes![type].definition.directory)
		} catch (error) {
			throw error
		}
	})
	return types
}

function displayHeader(): void {
	const box = {
		topLeft: '╭',
		topRight: '╮',
		bottomLeft: '╰',
		bottomRight: '╯',
		horizontal: '─',
		vertical: '│',
	}
	const versionString = `sfparty v${pkgObj.version}${
		process.stdout.columns > pkgObj.description.length + 15
			? ' - ' + pkgObj.description
			: ''
	}`
	let titleMessage = `${global.icons?.party} ${clc.yellowBright(
		versionString,
	)} ${global.icons?.party}`
	titleMessage = titleMessage.padEnd(
		process.stdout.columns / 2 + versionString.length / 1.65,
	)
	titleMessage = titleMessage.padStart(process.stdout.columns)
	titleMessage =
		clc.blackBright(box.vertical) +
		'  ' +
		titleMessage +
		'      ' +
		clc.blackBright(box.vertical)
	console.log(
		`${clc.blackBright(
			box.topLeft +
				box.horizontal.repeat(process.stdout.columns - 2) +
				box.topRight,
		)}`,
	)
	console.log(titleMessage)
	console.log(
		`${clc.blackBright(
			box.bottomLeft +
				box.horizontal.repeat(process.stdout.columns - 2) +
				box.bottomRight,
		)}`,
	)
	console.log()
}

async function getRootPath(
	ctx: AppContext,
	packageDir?: string,
): Promise<string> {
	const rootPath = await fileUtils.find('sfdx-project.json')
	let defaultDir: string | undefined
	if (rootPath) {
		const fileInfoResult = await fileUtils.fileInfo(
			rootPath,
			fs,
			ctx.basedir,
		)
		global.__basedir = fileInfoResult.dirname
		let projectJSON:
			| {
					packageDirectories?: Array<{
						default?: boolean
						path: string
					}>
			  }
			| undefined
		try {
			// SEC-002: Use safe JSON parser to prevent prototype pollution
			const fileContent = await fs.promises.readFile(rootPath, 'utf8')
			const parsed = fileUtils.safeJSONParse(fileContent)
			// SEC-012: Validate runtime type
			const { validateData, SfdxProjectSchema } = await import(
				'./lib/validation.js'
			)
			projectJSON = validateData(parsed, SfdxProjectSchema)

			// SEC-015: Verify configuration file signature if verification is enabled
			if (global.verifyConfig) {
				const { verifyFile } = await import('./lib/fileSigning.js')
				try {
					const hasSig = verifyFile(rootPath)
					if (!hasSig) {
						global.logger?.warn(
							`Configuration file ${rootPath} has no signature. Use --sign-config to sign it.`,
						)
					}
				} catch (error) {
					global.displayError?.(
						`Configuration file signature verification failed: ${error instanceof Error ? error.message : String(error)}`,
						true,
					)
					process.exit(1)
				}
			}
		} catch (error) {
			if (
				error instanceof Error &&
				error.message.indexOf('JSON at position') > 0
			) {
				global.displayError?.(
					'sfdx-project.json has invalid JSON',
					true,
				)
			} else if (
				error instanceof Error &&
				error.message.indexOf('Validation failed') >= 0
			) {
				global.displayError?.(
					`sfdx-project.json validation failed: ${error.message}`,
					true,
				)
			} else {
				global.displayError?.(String(error), true)
			}
		}
		if (projectJSON && Array.isArray(projectJSON.packageDirectories)) {
			projectJSON.packageDirectories.every((directory) => {
				if (
					directory.default ||
					projectJSON.packageDirectories!.length === 1
				)
					defaultDir = directory.path
				if (directory.path === packageDir) {
					defaultDir = directory.path
					return false
				}
				return true
			})
		}
	} else {
		global.logger?.error(
			'Could not determine base path of Salesforce source directory. No sfdx-project.json found. Please specify a source path or execute from Salesforce project directory.',
		)
		process.exit(1)
	}
	if (packageDir && packageDir !== defaultDir) {
		global.logger?.error(
			'Could not find directory in sfdx-project.json. Please specify a package directory path from the sfdx-project.json file.',
		)
		process.exit(1)
	}

	return defaultDir || ''
}
