import { describe, expect, it } from 'vitest'
import { metadataDefinition } from '../../src/meta/Package.js'
import type { MetadataDefinition } from '../../src/types/metadata.js'

describe('Package metadataDefinition', () => {
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
		expect(metadataDefinition.root).toBe('Package')
		expect(metadataDefinition.main).toEqual(['version'])
		expect(Array.isArray(metadataDefinition.nodes)).toBe(true)
		expect(metadataDefinition.nodes).toEqual(['types'])
	})

	it('should have optional properties correctly set', () => {
		expect(typeof metadataDefinition.sortKeys).toBe('object')
		expect(typeof metadataDefinition.keyOrder).toBe('object')
		expect(metadataDefinition.emptyPackage).toBeDefined()
		expect(metadataDefinition.emptyNode).toBeDefined()
	})

	it('should have correct nested structures', () => {
		expect(metadataDefinition.sortKeys.types).toBe('name')
		expect(Array.isArray(metadataDefinition.keyOrder?.types)).toBe(true)
		expect(metadataDefinition.keyOrder?.types).toEqual(['members', 'name'])
		expect(metadataDefinition.emptyPackage?.Package).toBeDefined()
		expect(metadataDefinition.emptyNode?.members).toEqual([])
	})
})
