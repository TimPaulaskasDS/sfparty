import type { MetadataDefinition } from '../types/metadata.js'

export const metadataDefinition: MetadataDefinition = {
	metaUrl:
		'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_profile.htm',
	directory: 'profiles',
	filetype: 'profile',
	root: 'Profile',
	type: 'Profile',
	alias: 'profile',
	main: ['fullName', 'custom', 'description', 'userLicense', '$'],
	singleFiles: [
		'agentAccesses', // API v63, Summer '25
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
		'servicePresenceStatusAccesses', // API v64, Summer '25
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
		agentAccesses: 'agent',
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
		servicePresenceStatusAccesses: 'servicePresenceStatus',
		tabVisibilities: 'tab',
		userPermissions: 'name',
	},
	keyOrder: {
		agentAccesses: ['agent', 'enabled'],
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
			'viewAllFields', // API v63, Spring '25
		],
		pageAccesses: ['apexPage', 'enabled'],
		profileActionOverrides: ['pageOrSobjectType'], // TODO
		recordTypeVisibilities: [
			'recordType',
			'default',
			'visible',
			'personAccountDefault',
		],
		servicePresenceStatusAccesses: ['servicePresenceStatus', 'enabled'],
		tabVisibilities: ['tab', 'visibility'],
		userPermissions: ['name', 'enabled'],
	},
	delta: true,
}
