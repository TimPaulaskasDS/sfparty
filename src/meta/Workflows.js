export const metadataDefinition = {
    metaUrl: 'https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_workflow.htm',
    directory: 'workflows',
    filetype: 'workflow',
    root: 'Workflow',
    alias: 'workflow',
    main: [
        '$',
    ],
    singleFiles: [
    ],
    directories: [
        'alerts',
        'fieldUpdates',
        'flowActions',
        'knowledgePublishes',
        'outboundMessages',
        'rules',
        'tasks',
    ],
    sortKeys: {
        'alerts': 'fullName',
        'fieldUpdates': 'fullName',
        'flowActions': 'label',
        'knowledgePublishes': 'label',
        'outboundMessages': 'fullName',
        'rules': 'fullName',
        'tasks': 'fullName',
        'recipients': 'type',
        'flowInputs': 'name',
        'criteriaItems': 'field',
        'actions': 'name',
        'workflowTimeTriggers': 'offsetFromField',
    },
    keyOrder: {
        'alerts': ['fullName', 'description', 'template', 'protected', 'senderType', 'senderAddress', 'ccEmails', 'recipients'],
        'fieldUpdates': ['fullName', 'name', 'description', 'field', 'notifyAssignee', 'protected', 'reevaluateOnChange', 'targetObject', 'operation', 'formula', 'literalValue', 'lookupValueType', 'lookupValue'],
        'flowActions': ['fullName', 'label', 'flow', 'description', 'language', 'protected', 'flowInputs'],
        'knowledgePublishes': ['label', 'description', 'action', 'language', 'protected'],
        'outboundMessages': ['fullName', 'name', 'description', 'endpointUrl', 'apiVersion', 'integrationUser', 'includeSessionId', 'protected', 'useDeadLetterQueue', 'fields'],
        'rules': ['fullName', 'description', 'triggerType', 'active', 'booleanFilter', 'formula', 'criteriaItems', 'actions', 'workflowTimeTriggers'],
        'tasks': ['fullName'],
        'recipients': ['type', 'field', 'recipient'],
        'flowInputs': ['name', 'value'],
        'criteriaItems': ['field', 'operation', 'value', 'valueField'],
        'actions': ['name', 'type'],
        'workflowTimeTriggers': ['offsetFromField', 'timeLength', 'workflowTimeTriggerUnit', 'actions'],
    },
    xmlOrder: {
        'alerts': ['fullName'],
        'fieldUpdates': ['fullName'],
        'flowActions': ['fullName'],
        'rules': ['fullName'],
        'outboundMessages': ['fullName'],
        'tasks': ['fullName'],
    },
    package: {
        'alerts': 'WorkflowAlert',
        'fieldUpdates': 'WorkflowFieldUpdate',
        'flowActions': 'WorkflowFlowAction',
        'knowledgePublishes': 'WorkflowKnowledgePublish',
        'outboundMessages': 'WorkflowOutboundMessage',
        'rules': 'WorkflowRule',
        'tasks': '	WorkflowTask',
    }
}
