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
