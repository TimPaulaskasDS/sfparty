/**
 * Application Context for Dependency Injection
 * SEC-013: Replaces global state with explicit context objects
 */

import type { Logger } from 'winston'

/**
 * Git configuration
 */
export interface GitConfig {
	enabled: boolean
	lastCommit?: string
	latestCommit?: string
	append: boolean
	delta: boolean
}

import type { MetadataDefinition } from './metadata.js'

/**
 * Metadata type entry
 */
export interface MetaTypeEntry {
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

/**
 * Processing statistics
 */
export interface ProcessedStats {
	total: number
	errors: number
	current: number
}

/**
 * Icons for UI display
 */
export interface Icons {
	warn?: string
	success?: string
	fail?: string
	working?: string
	party?: string
	delete?: string
}

/**
 * Application context containing all dependencies
 * Previously accessed via global state, now passed explicitly
 */
export interface AppContext {
	/** Project root directory */
	basedir: string
	/** Winston logger instance */
	logger: Logger
	/** Error display function */
	displayError: (message: string, quit?: boolean) => void
	/** Output format (yaml/json) */
	format: string
	/** Metadata type registry */
	metaTypes: Record<string, MetaTypeEntry>
	/** Git operation configuration */
	git?: GitConfig
	/** Sign configuration files flag */
	signConfig: boolean
	/** Verify configuration files flag */
	verifyConfig: boolean
	/** Processing statistics (mutable during operation) */
	process?: ProcessedStats
	/** UI icons */
	icons: Icons
	/** Console transport for logger */
	consoleTransport: {
		silent?: boolean
	}
	/** Execution context (npx/node/global) */
	runType: string | null
}

/**
 * Create application context from options
 * @param options - Partial context with required/optional properties
 * @returns Complete AppContext
 */
export function createContext(options: Partial<AppContext>): AppContext {
	// Validate required properties
	if (!options.basedir && options.basedir !== '') {
		throw new Error('AppContext requires basedir')
	}
	if (!options.logger) {
		throw new Error('AppContext requires logger')
	}
	if (!options.displayError) {
		throw new Error('AppContext requires displayError')
	}
	if (!options.format) {
		throw new Error('AppContext requires format')
	}
	if (!options.metaTypes) {
		throw new Error('AppContext requires metaTypes')
	}
	if (!options.icons) {
		throw new Error('AppContext requires icons')
	}
	if (!options.consoleTransport) {
		throw new Error('AppContext requires consoleTransport')
	}

	return {
		basedir: options.basedir,
		logger: options.logger,
		displayError: options.displayError,
		format: options.format,
		metaTypes: options.metaTypes,
		git: options.git,
		signConfig: options.signConfig ?? false,
		verifyConfig: options.verifyConfig ?? false,
		process: options.process,
		icons: options.icons,
		consoleTransport: options.consoleTransport,
		runType: options.runType ?? null,
	}
}
