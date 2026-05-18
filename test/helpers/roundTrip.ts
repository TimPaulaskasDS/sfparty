/**
 * Real split -> combine round-trip harness for integration tests.
 *
 * No mocks: writes a fixture to a temp directory, runs the real Split, flushes
 * the write batcher, runs the real Combine, and returns the rebuilt XML so a
 * test can assert round-trip fidelity against the original.
 *
 * Supports combine's git modes via `options`: combine never calls git itself —
 * it consumes the `ctx.metaTypes[<alias>].add/remove.files` arrays, so delta
 * mode is driven by populating those directly (no real git repo needed).
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as fileUtils from '../../src/lib/fileUtils.js'
import * as packageUtil from '../../src/lib/packageUtil.js'
import * as labelDefinition from '../../src/meta/CustomLabels.js'
import * as permsetDefinition from '../../src/meta/PermissionSets.js'
import * as profileDefinition from '../../src/meta/Profiles.js'
import * as workflowDefinition from '../../src/meta/Workflows.js'
import { Combine } from '../../src/party/combine.js'
import { Split } from '../../src/party/split.js'
import type { MetadataDefinition } from '../../src/types/metadata.js'
import { createTestContext } from './context.js'

export interface RoundTripOptions {
	git?: { enabled?: boolean; append?: boolean; delta?: boolean }
	/** Paths (relative to the split output's <shortName>/ dir) to mark as
	 *  git-added — populates ctx.metaTypes[alias].add.files for delta mode. */
	deltaAddFiles?: string[]
	/** Same, for git-removed files (ctx.metaTypes[alias].remove.files). */
	deltaRemoveFiles?: string[]
	/** Files (relative to <shortName>/) to delete from the split output
	 *  before combine runs — drives the source-not-found / 'delete XML' path. */
	deleteSplitFiles?: string[]
}

export interface RoundTripResult {
	inputXml: string
	outputXml: string
	splitOk: boolean
	combineResult: boolean | string
	tmpDir: string
	addPkg: packageUtil.Package
	desPkg: packageUtil.Package
	/** Paths split produced, relative to the split output's <shortName>/ dir. */
	splitFiles: string[]
}

function buildMetaTypes() {
	const entry = (definition: MetadataDefinition) => ({
		type: definition.filetype,
		definition,
		add: { files: [] as string[], directories: [] as string[] },
		remove: { files: [] as string[], directories: [] as string[] },
	})
	return {
		label: entry(labelDefinition.metadataDefinition),
		profile: entry(profileDefinition.metadataDefinition),
		permset: entry(permsetDefinition.metadataDefinition),
		workflow: entry(workflowDefinition.metadataDefinition),
	}
}

/** Recursively list files under `dir`, as paths relative to `dir`. */
function listFiles(dir: string, prefix = ''): string[] {
	const out: string[] = []
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const rel = prefix ? `${prefix}/${entry.name}` : entry.name
		if (entry.isDirectory()) {
			out.push(...listFiles(path.join(dir, entry.name), rel))
		} else {
			out.push(rel)
		}
	}
	return out
}

/**
 * Run a fixture through split then combine. Cleanup of the returned tmpDir is
 * the caller's responsibility (see cleanupRoundTrip).
 */
export async function roundTrip(
	fixturePath: string,
	metadataDefinition: MetadataDefinition,
	options: RoundTripOptions = {},
): Promise<RoundTripResult> {
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sfparty-rt-'))
	const sourceDir = path.join(tmpDir, 'source')
	// Mirror the real layout `<...>/<directory>/<shortName>/` so the delta-mode
	// pathMatch (`/<directory>/<shortName>/`) resolves correctly.
	const splitDir = path.join(tmpDir, 'split', metadataDefinition.directory)
	const outDir = path.join(tmpDir, 'out')
	for (const dir of [sourceDir, splitDir, outDir]) {
		fs.mkdirSync(dir, { recursive: true })
	}

	const fixtureName = path.basename(fixturePath)
	const srcFile = path.join(sourceDir, fixtureName)
	fs.copyFileSync(fixturePath, srcFile)
	const inputXml = fs.readFileSync(fixturePath, 'utf8')

	const metaTypes = buildMetaTypes()
	const splitCtx = createTestContext({
		basedir: tmpDir,
		format: 'yaml',
		metaTypes,
		git: { enabled: false, append: false, delta: false },
	})

	fileUtils.resetWriteBatcher()
	fileUtils.initWriteBatcher()

	const split = new Split({
		ctx: splitCtx,
		metadataDefinition,
		sourceDir,
		targetDir: splitDir,
		metaFilePath: srcFile,
		sequence: 1,
		total: 1,
		keepFalseValues: true,
	})
	const splitOk = await split.split()
	await fileUtils.flushWriteBatcher()

	// split writes the fixture's contents into <splitDir>/<shortName>/
	const shortName = fixtureName.replace(
		new RegExp(`\\.${metadataDefinition.filetype}-meta\\.xml$`),
		'',
	)
	const splitMetaDir = path.join(splitDir, shortName)
	const splitFiles = fs.existsSync(splitMetaDir)
		? listFiles(splitMetaDir)
		: []

	// Source-not-found: remove part files before combine reads them.
	for (const rel of options.deleteSplitFiles ?? []) {
		fs.rmSync(path.join(splitMetaDir, rel), { force: true })
	}

	// Delta mode: combine consumes absolute paths from metaTypes[alias].
	const alias = metadataDefinition.alias as keyof typeof metaTypes
	if (metaTypes[alias]) {
		metaTypes[alias].add.files = (options.deltaAddFiles ?? []).map((rel) =>
			path.join(splitMetaDir, rel),
		)
		metaTypes[alias].remove.files = (options.deltaRemoveFiles ?? []).map(
			(rel) => path.join(splitMetaDir, rel),
		)
	}

	const combineCtx = createTestContext({
		basedir: tmpDir,
		format: 'yaml',
		metaTypes,
		git: {
			enabled: options.git?.enabled ?? false,
			append: options.git?.append ?? false,
			delta: options.git?.delta ?? false,
		},
	})

	const addPkg = new packageUtil.Package(path.join(tmpDir, 'package.xml'))
	const desPkg = new packageUtil.Package(
		path.join(tmpDir, 'destructiveChanges.xml'),
	)
	// combine's addMember requires getPackageXML to have run first; only the
	// git-enabled path calls addMember, so initialise only when needed.
	if (combineCtx.git?.enabled) {
		await addPkg.getPackageXML(combineCtx, fileUtils)
		await desPkg.getPackageXML(combineCtx, fileUtils)
	}

	const combine = new Combine({
		ctx: combineCtx,
		metadataDefinition,
		sourceDir: splitDir,
		targetDir: outDir,
		metaDir: shortName,
		sequence: 1,
		total: 1,
		addPkg,
		desPkg,
	})
	const combineResult = await combine.combine()
	await fileUtils.flushWriteBatcher()

	const outFile = path.join(
		outDir,
		`${shortName}.${metadataDefinition.filetype}-meta.xml`,
	)
	const outputXml = fs.existsSync(outFile)
		? fs.readFileSync(outFile, 'utf8')
		: ''

	return {
		inputXml,
		outputXml,
		splitOk,
		combineResult,
		tmpDir,
		addPkg,
		desPkg,
		splitFiles,
	}
}

export function cleanupRoundTrip(result: RoundTripResult): void {
	fs.rmSync(result.tmpDir, { recursive: true, force: true })
}
