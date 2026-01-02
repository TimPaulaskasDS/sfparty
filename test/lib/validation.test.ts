/**
 * Tests for runtime type validation (SEC-012)
 */

import { describe, expect, it } from 'vitest'
import {
	MetadataSchema,
	PackageXmlSchema,
	SfdxProjectSchema,
	safeValidateData,
	validateData,
} from '../../src/lib/validation.js'

describe('Runtime Type Validation (SEC-012)', () => {
	describe('SfdxProjectSchema', () => {
		it('should validate valid sfdx-project.json', () => {
			const valid = {
				packageDirectories: [{ path: 'force-app', default: true }],
				name: 'sfparty',
				sourceApiVersion: '56.0',
			}

			const result = validateData(valid, SfdxProjectSchema)
			expect(result.packageDirectories).toBeDefined()
			expect(result.packageDirectories?.[0]?.path).toBe('force-app')
		})

		it('should reject invalid packageDirectories', () => {
			const invalid = {
				packageDirectories: [{ path: '' }], // Empty path
			}

			expect(() => validateData(invalid, SfdxProjectSchema)).toThrow(
				'Validation failed',
			)
		})

		it('should reject invalid sfdcLoginUrl', () => {
			const invalid = {
				sfdcLoginUrl: 'not-a-url',
			}

			expect(() => validateData(invalid, SfdxProjectSchema)).toThrow(
				'Validation failed',
			)
		})

		it('should accept minimal valid project', () => {
			const minimal = {
				sourceApiVersion: '56.0',
			}

			const result = validateData(minimal, SfdxProjectSchema)
			expect(result.sourceApiVersion).toBe('56.0')
		})
	})

	describe('PackageXmlSchema', () => {
		it('should validate valid package.xml structure', () => {
			const valid = {
				Package: {
					$: { xmlns: 'http://soap.sforce.com/2006/04/metadata' },
					version: '56.0',
					types: [
						{
							members: ['Profile1', 'Profile2'],
							name: 'Profile',
						},
					],
				},
			}

			const result = validateData(valid, PackageXmlSchema)
			expect(result.Package.version).toBe('56.0')
			expect(result.Package.types).toBeDefined()
		})

		it('should reject missing xmlns', () => {
			const invalid = {
				Package: {
					$: {},
					version: '56.0',
				},
			}

			expect(() => validateData(invalid, PackageXmlSchema)).toThrow(
				'Validation failed',
			)
		})
	})

	describe('MetadataSchema', () => {
		it('should validate any object structure', () => {
			const valid = {
				key1: 'value1',
				key2: 123,
				key3: { nested: true },
			}

			const result = validateData(valid, MetadataSchema)
			expect(result).toEqual(valid)
		})

		it('should reject non-object values', () => {
			expect(() => validateData('string', MetadataSchema)).toThrow(
				'Validation failed',
			)
			expect(() => validateData(123, MetadataSchema)).toThrow(
				'Validation failed',
			)
			expect(() => validateData(null, MetadataSchema)).toThrow(
				'Validation failed',
			)
		})
	})

	describe('safeValidateData', () => {
		it('should return validated data on success', () => {
			const valid = { sourceApiVersion: '56.0' }
			const result = safeValidateData(valid, SfdxProjectSchema)
			expect(result).toEqual(valid)
		})

		it('should return undefined on validation failure', () => {
			const invalid = { sourceApiVersion: 123 } // Wrong type
			const result = safeValidateData(invalid, SfdxProjectSchema)
			expect(result).toBeUndefined()
		})
	})
})
