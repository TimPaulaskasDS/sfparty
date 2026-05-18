import type { MetadataDefinition } from '../types/metadata.js'

export const metadataDefinition: MetadataDefinition = {
	metaUrl:
		'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/manifest_samples.htm',
	directory: '',
	filetype: '',
	root: 'Package',
	type: '',
	alias: '',
	main: ['version'],
	nodes: ['types'],
	sortKeys: {
		types: 'name',
	},
	keyOrder: {
		types: ['members', 'name'],
	},
	emptyPackage: {
		Package: {
			$: { xmlns: 'http://soap.sforce.com/2006/04/metadata' },
			version: undefined,
		},
	},
	emptyNode: {
		members: [],
		name: undefined,
	},
}

// Drives the selective isArray() in fileUtils.getXmlParser(). package.xml and
// destructiveChanges.xml are the only XML files read through convertXML(), and
// `types`/`members` are their only repeatable elements — forcing them to arrays
// stops a single-element file from parsing as an object.
export const PACKAGE_ARRAY_ELEMENTS = new Set(['types', 'members'])
