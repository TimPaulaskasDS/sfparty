import { vi } from 'vitest'
import type * as fileUtils from '../../src/lib/fileUtils.js'
import type { Package } from '../../src/lib/packageUtil.js'

/**
 * Create a typed mock for fileUtils
 */
export function createMockFileUtils(): typeof fileUtils {
	return {
		fileExists: vi.fn(),
		readFile: vi.fn(),
		directoryExists: vi.fn(),
		getFiles: vi.fn(),
		getDirectories: vi.fn(),
		saveFile: vi.fn(),
		fileInfo: vi.fn(),
		find: vi.fn(),
		initWriteBatcher: vi.fn(),
		getWriteBatcher: vi.fn(),
		getWriteBatcherQueueLength: vi.fn(),
		getWriteBatcherQueueStats: vi.fn(),
		flushWriteBatcher: vi.fn(),
		resetWriteBatcher: vi.fn(),
		safeJSONParse: vi.fn(),
		convertXML: vi.fn(),
		validatePath: vi.fn(),
	} as unknown as typeof fileUtils
}

/**
 * Create a typed mock for Package
 */
export function createMockPackage(): Package {
	return {
		getPackageXML: vi.fn(),
		savePackage: vi.fn(),
	} as unknown as Package
}

/**
 * Create a typed mock for ListrTask
 */
export interface MockListrTask {
	output: string[]
	title: string
}

export function createMockListrTask(): MockListrTask {
	return {
		output: [],
		title: '',
	}
}
