/**
 * Runtime Type Validation using Zod
 * SEC-012: Validate all external data to prevent type confusion attacks
 */

import { z } from 'zod'

/**
 * Schema for sfdx-project.json
 */
export const SfdxProjectSchema = z.object({
	packageDirectories: z
		.array(
			z.object({
				path: z.string().min(1),
				default: z.boolean().optional(),
			}),
		)
		.optional(),
	name: z.string().optional(),
	namespace: z.string().optional(),
	sfdcLoginUrl: z.string().url().optional(),
	sourceApiVersion: z.string().optional(),
})

export type SfdxProject = z.infer<typeof SfdxProjectSchema>

/**
 * Schema for package.xml structure
 */
export const PackageXmlSchema = z.object({
	Package: z.object({
		$: z.object({
			xmlns: z.string(),
		}),
		version: z.string().optional(),
		types: z
			.array(
				z.object({
					members: z.array(z.string()).or(z.string()),
					name: z.string(),
				}),
			)
			.optional(),
	}),
})

export type PackageXml = z.infer<typeof PackageXmlSchema>

/**
 * Generic metadata schema - validates basic structure
 * More specific schemas can be added for each metadata type
 */
export const MetadataSchema = z.record(z.string(), z.unknown())

export type Metadata = z.infer<typeof MetadataSchema>

/**
 * Validate data against a schema
 * @param data - Data to validate
 * @param schema - Zod schema to validate against
 * @returns Validated data
 * @throws Error if validation fails
 */
export function validateData<T>(data: unknown, schema: z.ZodSchema<T>): T {
	try {
		return schema.parse(data)
	} catch (error) {
		if (error instanceof z.ZodError) {
			const errors = error.issues
				.map((err: z.ZodIssue) => {
					const path =
						err.path.length > 0 ? err.path.join('.') : 'root'
					return `${path}: ${err.message}`
				})
				.join('; ')
			throw new Error(`Validation failed: ${errors}`)
		}
		throw error
	}
}

/**
 * Safe validation - returns validated data or undefined if validation fails
 * @param data - Data to validate
 * @param schema - Zod schema to validate against
 * @returns Validated data or undefined
 */
export function safeValidateData<T>(
	data: unknown,
	schema: z.ZodSchema<T>,
): T | undefined {
	try {
		return schema.parse(data)
	} catch {
		return undefined
	}
}
