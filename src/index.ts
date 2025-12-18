#!/usr/bin/env node
import axios from 'axios'
import { execFileSync, spawn, spawnSync } from 'child_process'
import clc from 'cli-color'
import convertHrtime from 'convert-hrtime'
import fs from 'fs'
import { marked } from 'marked'
// @ts-expect-error - no type definitions available
import markedTerminal from 'marked-terminal'
// @ts-ignore - no types available
import { createRequire } from 'module'
import path, { dirname, resolve } from 'path'
import { argv, env } from 'process'
import { fileURLToPath } from 'url'
import winston from 'winston'
import xml2js from 'xml2js'
import type * as Yargs from 'yargs'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { checkVersion } from './lib/checkVersion.js'
import * as fileUtils from './lib/fileUtils.js'
import * as git from './lib/gitUtils.js'
import * as packageUtil from './lib/packageUtil.js'
// @ts-expect-error - CJS module
import pkgObj from './lib/pkgObj.cjs'
import * as labelDefinition from './meta/CustomLabels.js'
import * as permsetDefinition from './meta/PermissionSets.js'
import * as profileDefinition from './meta/Profiles.js'
import * as workflowDefinition from './meta/Workflows.js'
import * as yargOptions from './meta/yargs.js'
import { Combine } from './party/combine.js'
import { Split } from './party/split.js'
import type { MetadataDefinition } from './types/metadata.js'

const processStartTime = process.hrtime.bigint()
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

marked.setOptions({
	renderer: new markedTerminal() as unknown as Parameters<
		typeof marked.setOptions
	>[0]['renderer'],
})

interface Logger {
	error: (message: string) => void
	warn: (message: string) => void
	info: (message: string) => void
	http: (message: string) => void
	verbose: (message: string) => void
	debug: (message: string) => void
	silly: (message: string) => void
}

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
	logger?: Logger
	icons?: Icons
	displayError?: (error: string, quit?: boolean) => void
	git?: GitConfig
	metaTypes?: Record<string, MetaTypeEntry>
	runType?: string | null
	format?: string
	process?: ProcessedStats
}

declare const global: GlobalContext & typeof globalThis

global.__basedir = undefined

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
	format: winston.format.cli(),
	defaultMeta: { service: 'sfparty' },
	transports: [new winston.transports.Console()],
}) as Logger

global.icons = {
	warn: '🔕',
	success: clc.greenBright('✔'),
	fail: '❗',
	working: '⏳',
	party: '🎉',
	delete: '❌💀❌',
}

global.displayError = (error: string, quit = false): void => {
	global.logger?.error(error)
	console.info(error)
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
const packageDir = getRootPath()

const errorMessage = clc.red(
	'Please specify the action of ' +
		clc.whiteBright.bgRedBright('split') +
		' or ' +
		clc.whiteBright.bgRedBright('combine') +
		'.',
)
let addPkg: packageUtil.Package
let desPkg: packageUtil.Package
displayHeader()

let checkYargs = false

const isRunningUnderNpx = (): boolean => {
	const npxIndicator = argv.some((arg) => arg.includes('_npx'))
	const initCwd = env.INIT_CWD
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
}

yargs(hideBin(process.argv))
	.command({
		command: 'help',
		aliases: ['h'],
		builder: (yargs) => {
			return yargs.check(yargCheck)
		},
		handler: (_argv) => {
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
				// @ts-expect-error - yargs options type mismatch
				.options(yargOptions.splitOptions)
				.choices('format', ['json', 'yaml'])
				.check(yargCheck)
			return yargs
		},
		handler: (argv) => {
			global.format = (argv as unknown as SplitCombineArgv).format
			splitHandler(argv as unknown as SplitCombineArgv, processStartTime)
		},
	})
	.command({
		command: '[combine]',
		aliases: ['combine'],
		describe: 'combines yaml/json files into metadata xml',
		builder: (yargs) => {
			yargs
				.example(yargOptions.combineExamples)
				// @ts-expect-error - yargs options type mismatch
				.options(yargOptions.combineOptions)
				.choices('format', ['json', 'yaml'])
				.check(yargCheck)
			return yargs
		},
		handler: (argv) => {
			global.format = (argv as unknown as SplitCombineArgv).format
			const startProm = new Promise<boolean>((resolve, reject) => {
				const argvTyped = argv as unknown as SplitCombineArgv
				if (argvTyped.git !== undefined) {
					const gitRef = sanitizeGitRef(argvTyped.git)
					global.git!.append = argvTyped.append || global.git!.append
					global.git!.delta = argvTyped.delta || global.git!.delta
					if (argvTyped.git === '') {
						const commit = git.lastCommit({
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
									diff.then((data) => {
										gitFiles(data)
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
						const diff = git.diff({
							dir: global.__basedir!,
							gitRef,
							existsSync: fs.existsSync,
							spawn,
						})
						diff.then((data) => {
							gitFiles(data)
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
					const prom1 = addPkg.getPackageXML(fileUtils)
					const prom2 = desPkg.getPackageXML(fileUtils)

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
	const split = processSplit(types[0], argv)
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

function processSplit(
	typeItem: string,
	argv: SplitCombineArgv,
): Promise<boolean> {
	return new Promise((resolve, _reject) => {
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
			if (!fileUtils.fileExists({ filePath: metaFilePath, fs })) {
				name += metaExtension
				metaFilePath = path.join(metaDirPath, name)
				if (!fileUtils.fileExists({ filePath: metaFilePath, fs })) {
					global.logger?.error('File not found: ' + metaFilePath)
					process.exit(1)
				}
			}
			fileList.push(name)
		} else {
			if (fileUtils.directoryExists({ dirPath: sourceDir, fs })) {
				fileUtils.getFiles(sourceDir, metaExtension).forEach((file) => {
					fileList.push(file)
				})
			}
		}

		processed.total = fileList.length

		if (processed.total === 0) {
			resolve(true)
			return
		}

		console.log(`${clc.bgBlackBright('Source path:')} ${sourceDir}`)
		console.log(`${clc.bgBlackBright('Target path:')} ${targetDir}`)
		console.log()
		console.log(`Splitting a total of ${processed.total} file(s)`)
		console.log()

		const promList: Promise<boolean>[] = []
		fileList.forEach((metaFile) => {
			const metadataItem = new Split({
				metadataDefinition: typeObj.definition,
				sourceDir: sourceDir,
				targetDir: targetDir,
				metaFilePath: path.join(sourceDir, metaFile),
				sequence: promList.length + 1,
				total: processed.total,
			})
			const metadataItemProm = metadataItem.split()
			promList.push(metadataItemProm)
			metadataItemProm.then((resolveVal) => {
				if (resolveVal === false) {
					processed.errors++
					processed.current--
				} else {
					processed.current++
				}
			})
		})
		Promise.allSettled(promList).then((_results) => {
			const message = `Split ${clc.bgBlackBright(
				processed.current > promList.length
					? promList.length
					: processed.current,
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
	})
}

function combineHandler(argv: SplitCombineArgv, startTime: bigint): void {
	const combine = processCombine(types[0], argv)
	combine.then((resolveVal) => {
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
				git.updateLastCommit({
					dir: global.__basedir!,
					latest: global.git!.latestCommit,
					fileUtils,
					fs,
				})
			}
			if (global.git!.enabled) {
				addPkg.savePackage(xml2js, fileUtils)
				desPkg.savePackage(xml2js, fileUtils)
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

function processCombine(
	typeItem: string,
	argv: SplitCombineArgv,
): Promise<boolean> {
	return new Promise((resolve, _reject) => {
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

		let processList: string[] = []
		const typeObj = global.metaTypes![typeItem]
		const type = typeObj.type

		let sourceDir = argv.source || ''
		let targetDir = argv.target || ''
		const name = argv.name
		const all =
			argv.type === undefined || name === undefined ? true : argv.all

		sourceDir = path.join(
			global.__basedir!,
			packageDir + '-party',
			'main',
			'default',
			typeObj.definition.directory,
		)
		if (targetDir === '') {
			targetDir = path.join(
				global.__basedir!,
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

		if (type === global.metaTypes!.label.type) {
			if (
				!global.git!.enabled ||
				[
					...new Set([
						...global.metaTypes![typeItem].add.directories,
						...global.metaTypes![typeItem].remove.directories,
					]),
				].includes(global.metaTypes![typeItem].definition.root)
			) {
				processList.push(global.metaTypes!.label.definition.root)
			}
		} else if (!all) {
			const metaDirPath = path.join(sourceDir, name || '')
			if (!fileUtils.directoryExists({ dirPath: metaDirPath, fs })) {
				global.logger?.error('Directory not found: ' + metaDirPath)
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
				processList = fileUtils.getDirectories(sourceDir)
			}
		}

		processed.total = processList.length
		console.log(
			`${clc.bgBlackBright(
				processed.total,
			)} ${typeItem} file(s) to process`,
		)

		if (processed.total === 0) {
			resolve(true)
			return
		}

		console.log()
		console.log(`${clc.bgBlackBright('Source path:')} ${sourceDir}`)
		console.log(`${clc.bgBlackBright('Target path:')} ${targetDir}`)
		console.log()

		const promList: Promise<boolean | string>[] = []
		processList.forEach((metaDir) => {
			const metadataItem = new Combine({
				metadataDefinition: typeObj.definition,
				sourceDir,
				targetDir,
				metaDir,
				sequence: promList.length + 1,
				total: processed.total,
				addPkg,
				desPkg,
			})
			const metadataItemProm = metadataItem.combine()
			promList.push(metadataItemProm)
			metadataItemProm.then(() => {
				processed.current++
			})
		})

		Promise.allSettled(promList).then((results) => {
			let successes = 0
			let errors = processed.errors++
			results.forEach((result) => {
				if (result.status === 'fulfilled') {
					if (result.value === true) {
						successes++
					} else if (result.value === false) {
						errors++
					}
				} else if (result.status === 'rejected') {
					errors++
				}
			})
			const message = `Combined ${clc.bgBlackBright(successes)} file(s) ${
				errors > 0
					? 'with ' +
						clc.bgBlackBright.red(processed.errors) +
						' error(s) '
					: ''
			}in `
			displayMessageAndDuration(startTime, message)
			if (errors > 0) {
				resolve(false)
			} else {
				resolve(true)
			}
		})
	})
}

interface GitFileItem {
	path: string
	action: string
}

function gitFiles(data: GitFileItem[]): void {
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

function getRootPath(packageDir?: string): string {
	const rootPath = fileUtils.find('sfdx-project.json')
	let defaultDir: string | undefined
	if (rootPath) {
		global.__basedir = fileUtils.fileInfo(rootPath).dirname
		let projectJSON:
			| {
					packageDirectories?: Array<{
						default?: boolean
						path: string
					}>
			  }
			| undefined
		try {
			projectJSON = JSON.parse(fs.readFileSync(rootPath, 'utf8')) as {
				packageDirectories?: Array<{ default?: boolean; path: string }>
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
