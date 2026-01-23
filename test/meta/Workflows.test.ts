import { describe, expect, it } from 'vitest'
import { metadataDefinition } from '../../src/meta/Workflows.js'
import type { MetadataDefinition } from '../../src/types/metadata.js'

describe('Workflows metadataDefinition', () => {
	it('should export metadataDefinition', () => {
		expect(metadataDefinition).toBeDefined()
		expect(typeof metadataDefinition).toBe('object')
	})

	it('should match MetadataDefinition type', () => {
		const def: MetadataDefinition = metadataDefinition
		expect(def).toBeDefined()
	})

	it('should have all required properties', () => {
		expect(metadataDefinition.metaUrl).toBeDefined()
		expect(metadataDefinition.directory).toBeDefined()
		expect(metadataDefinition.filetype).toBeDefined()
		expect(metadataDefinition.root).toBeDefined()
		expect(metadataDefinition.type).toBeDefined()
		expect(metadataDefinition.alias).toBeDefined()
		expect(metadataDefinition.main).toBeDefined()
		expect(metadataDefinition.sortKeys).toBeDefined()
	})

	it('should have correct property types', () => {
		expect(typeof metadataDefinition.metaUrl).toBe('string')
		expect(typeof metadataDefinition.directory).toBe('string')
		expect(typeof metadataDefinition.filetype).toBe('string')
		expect(typeof metadataDefinition.root).toBe('string')
		expect(typeof metadataDefinition.type).toBe('string')
		expect(typeof metadataDefinition.alias).toBe('string')
		expect(Array.isArray(metadataDefinition.main)).toBe(true)
		expect(typeof metadataDefinition.sortKeys).toBe('object')
	})

	it('should have correct structure', () => {
		expect(metadataDefinition.directory).toBe('workflows')
		expect(metadataDefinition.filetype).toBe('workflow')
		expect(metadataDefinition.root).toBe('Workflow')
		expect(metadataDefinition.type).toBe('Workflow')
		expect(metadataDefinition.alias).toBe('workflow')
		expect(metadataDefinition.main).toEqual(['$'])
		expect(Array.isArray(metadataDefinition.singleFiles)).toBe(true)
		expect(Array.isArray(metadataDefinition.directories)).toBe(true)
	})

	it('should have optional properties correctly set', () => {
		expect(metadataDefinition.delta).toBe(true)
		expect(typeof metadataDefinition.sortKeys).toBe('object')
		expect(typeof metadataDefinition.keyOrder).toBe('object')
		expect(typeof metadataDefinition.xmlOrder).toBe('object')
	})

	it('should have correct nested structures', () => {
		expect(metadataDefinition.sortKeys.alerts).toBe('fullName')
		expect(Array.isArray(metadataDefinition.keyOrder?.alerts)).toBe(true)
		expect(Array.isArray(metadataDefinition.xmlOrder?.alerts)).toBe(true)
		expect(metadataDefinition.xmlOrder?.alerts).toEqual(['fullName'])
	})
})
