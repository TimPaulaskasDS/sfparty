export const metadataDefinition = {
	metaUrl:
		'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_customlabels.htm',
	directory: 'labels',
	filetype: 'labels',
	root: 'CustomLabels',
	type: 'CustomLabel',
	alias: 'label',
	main: ['$'],
	singleFiles: [],
	directories: ['labels'],
	sortKeys: {
		labels: 'fullName',
	},
	keyOrder: {
		labels: [
			'fullName',
			'shortDescription',
			'categories',
			'protected',
			'language',
			'value',
		],
	},
	xmlOrder: {
		labels: ['fullName'],
	},
	packageTypeIsDirectory: true,
	delta: true,
}
