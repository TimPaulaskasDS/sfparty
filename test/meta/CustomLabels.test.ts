import { describe, expect, it } from 'vitest'
import { metadataDefinition } from '../../src/meta/CustomLabels.js'
import type { MetadataDefinition } from '../../src/types/metadata.js'

describe('CustomLabels metadataDefinition', () => {
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
		expect(metadataDefinition.directory).toBe('labels')
		expect(metadataDefinition.filetype).toBe('labels')
		expect(metadataDefinition.root).toBe('CustomLabels')
		expect(metadataDefinition.type).toBe('CustomLabel')
		expect(metadataDefinition.alias).toBe('label')
		expect(metadataDefinition.main).toEqual(['$'])
		expect(Array.isArray(metadataDefinition.singleFiles)).toBe(true)
		expect(Array.isArray(metadataDefinition.directories)).toBe(true)
		expect(metadataDefinition.directories).toEqual(['labels'])
	})

	it('should have optional properties correctly set', () => {
		expect(metadataDefinition.packageTypeIsDirectory).toBe(true)
		expect(metadataDefinition.delta).toBe(true)
		expect(typeof metadataDefinition.sortKeys).toBe('object')
		expect(typeof metadataDefinition.keyOrder).toBe('object')
		expect(typeof metadataDefinition.xmlOrder).toBe('object')
	})

	it('should have correct nested structures', () => {
		expect(metadataDefinition.sortKeys.labels).toBe('fullName')
		expect(Array.isArray(metadataDefinition.keyOrder?.labels)).toBe(true)
		expect(Array.isArray(metadataDefinition.xmlOrder?.labels)).toBe(true)
		expect(metadataDefinition.xmlOrder?.labels).toEqual(['fullName'])
	})
})
