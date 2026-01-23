/**
 * Core type definitions for Salesforce metadata handling
 */

export interface MetadataDefinition {
	metaUrl: string
	directory: string
	filetype: string
	root: string
	type: string
	alias: string
	main: string[]
	singleFiles?: string[]
	directories?: string[]
	splitObjects?: string[]
	nodes?: string[]
	sortKeys: Record<string, string>
	keyOrder?: Record<string, string[]>
	xmlOrder?: Record<string, string[]>
	xmlFirst?: string
	packageTypeIsDirectory?: boolean
	delta?: boolean
	emptyPackage?: PackageStructure
	emptyNode?: PackageNode
	fallbackVersion?: string
	package?: Record<string, string>
}

export interface PackageStructure {
	Package: {
		$: { xmlns: string }
		version: string | undefined
	}
}

export interface PackageNode {
	members: string[]
	name: string | undefined
}

export interface YargsOption {
	demand?: boolean
	alias?: string
	description?: string
	demandOption?: boolean
	type?: 'string' | 'boolean' | 'number' | 'array'
	default?: string | boolean | number
	implies?: string
}

export interface YargsOptions {
	[key: string]: YargsOption | undefined
	type?: YargsOption
	format?: YargsOption
	name?: YargsOption
	source?: YargsOption
	target?: YargsOption
	git?: YargsOption
	append?: YargsOption
	delta?: YargsOption
	package?: YargsOption
	destructive?: YargsOption
}
