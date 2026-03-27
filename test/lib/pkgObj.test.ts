import { describe, expect, it } from 'vitest'
import pkgObj from '../../src/lib/pkgObj.js'

describe('pkgObj', () => {
	it('should export package name', () => {
		expect(pkgObj.name).toBe('@ds-sfdc/sfparty')
	})

	it('should export package version', () => {
		expect(pkgObj.version).toBeDefined()
		expect(typeof pkgObj.version).toBe('string')
		// Version should match semantic version format
		expect(pkgObj.version).toMatch(/^\d+\.\d+\.\d+/)
	})

	it('should export package description', () => {
		expect(pkgObj.description).toBeDefined()
		expect(typeof pkgObj.description).toBe('string')
		expect(pkgObj.description).toBe(
			'Salesforce metadata XML splitter for CI/CD',
		)
	})

	it('should export all required properties', () => {
		expect(pkgObj).toHaveProperty('name')
		expect(pkgObj).toHaveProperty('version')
		expect(pkgObj).toHaveProperty('description')
	})
})
