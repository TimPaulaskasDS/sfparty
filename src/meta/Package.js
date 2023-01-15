export const metadataDefinition = {
    metaUrl: 'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/manifest_samples.htm',
    root: 'Package',
    main: ['version',],
    nodes: ['types'],
    sortKeys: {
        types: 'name',
    },
    keyOrder: {
        types: ['members', 'name'],
    },
    emptyPackage: {
        Package: {
            $: { xmlns: 'https://soap.sforce.com/2006/04/metadata' },
            version: undefined,
        }
    },
    emptyNode: {
        members: [],
        name: undefined,
    },
    fallbackVersion: '55.0'
}
