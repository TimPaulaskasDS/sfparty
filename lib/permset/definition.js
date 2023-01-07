export const permsetDefinition = {
    metaUrl: 'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_permissionset.htm',
    main: [
        'label',
        'description',
        'custom',
        'hasActivationRequired',
        'license',
        'userLicense', // Replaced by license 
    ],
    singleFiles: [
        'applicationVisibilities',
        // 'categoryGroupVisibilities', // PROFILE ONLY
        'classAccesses',
        'customMetadataTypeAccesses',
        'customPermissions',
        'customSettingAccesses',
        'externalDataSourceAccesses',
        'flowAccesses',
        // 'layoutAssignments', // PROFILE ONLY
        // 'loginHours', // PROFILE ONLY
        // 'loginIpRanges', // PROFILE ONLY
        'pageAccesses',
        // 'profileActionOverrides', // PROFILE ONLY
        'tabSettings',
        // 'tabVisibilities', // PROFILE ONLY
        'userPermissions',
    ],
    directories: [
        'fieldPermissions',
        // 'loginFlows', // PROFILE ONLY
        'objectPermissions',
        'recordTypeVisibilities',
    ],
    ignore: [
        '$',
    ],
    sortKeys: {
        'applicationVisibilities': 'application',
        // 'categoryGroupVisibilities': 'dataCategoryGroup', // PROFILE ONLY
        'classAccesses': 'apexClass',
        'customMetadataTypeAccesses': 'name',
        'customPermissions': 'name',
        'customSettingAccesses': 'name',
        'externalDataSourceAccesses': 'externalDataSource',
        'fieldPermissions': 'field',
        'flowAccesses': 'flow',
        // 'layoutAssignments': 'layout', // PROFILE ONLY
        // 'loginFlows': 'friendlyName', // PROFILE ONLY
        // 'loginIpRanges': 'startAddress', // PROFILE ONLY
        'objectPermissions': 'object',
        'pageAccesses': 'apexPage',
        // 'profileActionOverrides': 'pageOrSobjectType', // PROFILE ONLY
        'recordTypeVisibilities': 'recordType',
        'tabSettings': 'tab',
        // 'tabVisibilities': 'tab', // PROFILE ONLY
        'userPermissions': 'name',        
    },
    keyOrder: {
        applicationVisibilities: ['application', 'visible'],
        classAccesses: ['apexClass', 'enabled'],
        customMetadataTypeAccesses: ['name', 'enabled'],
        customPermissions: ['name', 'enabled'],
        customSettingAccesses: ['name', 'enabled'],
        externalDataSourceAccesses: ['externalDataSource', 'enabled'],
        fieldPermissions: ['field', 'editable', 'readable'],
        flowAccesses: ['flow', 'enabled'],
        objectPermissions: ['object', 'allowCreate', 'allowRead', 'allowEdit', 'allowDelete', 'viewAllRecords', 'modifyAllRecords'],
        pageAccesses: ['apexPage', 'enabled'],
        recordTypeVisibilities: ['recordType', 'visible'],
        tabSettings: ['tab', 'visibility'],
        userPermissions: ['name', 'enabled'],
    },
}
