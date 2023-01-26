export const metadataDefinition = {
	metaUrl:
		'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_profile.htm',
	directory: 'profiles',
	filetype: 'profile',
	root: 'Profile',
	type: 'Profile',
	alias: 'profile',
	main: ['fullName', 'custom', 'description', 'userLicense', '$'],
	singleFiles: [
		'applicationVisibilities',
		'categoryGroupVisibilities',
		'classAccesses',
		'customMetadataTypeAccesses',
		'customPermissions',
		'customSettingAccesses',
		'externalDataSourceAccesses',
		'flowAccesses',
		'layoutAssignments',
		// TODO 'loginHours',
		'loginIpRanges',
		'pageAccesses',
		// TODO 'profileActionOverrides',
		'tabVisibilities',
		'userPermissions',
	],
	directories: [
		'fieldPermissions',
		'loginFlows',
		'objectPermissions',
		'recordTypeVisibilities',
	],
	splitObjects: [
		'fieldPermissions',
		'objectPermissions',
		'recordTypeVisibilities',
	],
	sortKeys: {
		applicationVisibilities: 'application',
		categoryGroupVisibilities: 'dataCategoryGroup',
		classAccesses: 'apexClass',
		customMetadataTypeAccesses: 'name',
		customPermissions: 'name',
		customSettingAccesses: 'name',
		externalDataSourceAccesses: 'externalDataSource',
		fieldPermissions: 'field',
		flowAccesses: 'flow',
		layoutAssignments: 'layout',
		loginFlows: 'friendlyName',
		loginIpRanges: 'startAddress',
		objectPermissions: 'object',
		pageAccesses: 'apexPage',
		profileActionOverrides: 'pageOrSobjectType',
		recordTypeVisibilities: 'recordType',
		tabVisibilities: 'tab',
		userPermissions: 'name',
	},
	keyOrder: {
		applicationVisibilities: ['application', 'visible'],
		categoryGroupVisibilities: ['dataCategoryGroup'], // TODO
		classAccesses: ['apexClass', 'enabled'],
		customMetadataTypeAccesses: ['name', 'enabled'],
		customPermissions: ['name', 'enabled'],
		customSettingAccesses: ['name', 'enabled'],
		externalDataSourceAccesses: ['externalDataSource', 'enabled'],
		fieldPermissions: ['field', 'editable', 'readable'],
		flowAccesses: ['flow', 'enabled'],
		layoutAssignments: ['layout'], // TODO
		loginFlows: ['friendlyName'], // TODO
		loginIpRanges: ['startAddress'], // TODO
		objectPermissions: [
			'object',
			'allowCreate',
			'allowRead',
			'allowEdit',
			'allowDelete',
			'viewAllRecords',
			'modifyAllRecords',
		],
		pageAccesses: ['apexPage', 'enabled'],
		profileActionOverrides: ['pageOrSobjectType'], // TODO
		recordTypeVisibilities: ['recordType', 'visible'],
		tabVisibilities: ['tab', 'visibility'],
		userPermissions: ['name', 'enabled'],
	},
	xmlFirst: 'fullName',
	delta: false,
}
