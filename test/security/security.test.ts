/**
 * Security Test Suite
 *
 * Tests for all security mitigations implemented in the codebase.
 * Covers attack vectors: path traversal, command injection, XXE, XML bombs,
 * YAML anchors, JSON prototype pollution, memory exhaustion, git timeouts, symlinks.
 */

import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
	readFile,
	safeJSONParse,
	validatePath,
	validateSymlink,
} from '../../src/lib/fileUtils.js'
import { createTestContext } from '../helpers/context.js'

// Mock child_process for git operation tests
vi.mock('child_process', async () => {
	const actual = await import('child_process')
	return {
		...actual,
		spawn: vi.fn(),
	}
})

describe('Security Test Suite', () => {
	describe('Path Traversal Protection', () => {
		it('should reject paths with .. sequences', () => {
			expect(() => validatePath('../file.txt')).toThrow(
				'Path traversal detected',
			)
			expect(() => validatePath('../../etc/passwd')).toThrow(
				'Path traversal detected',
			)
			expect(() => validatePath('path/../../etc/passwd')).toThrow(
				'Path traversal detected',
			)
		})

		it('should reject paths outside workspace root', () => {
			expect(() =>
				validatePath('/absolute/path/outside', '/workspace'),
			).toThrow('Path traversal detected: path outside workspace')
		})

		it('should accept valid paths within workspace', () => {
			const result = validatePath('subdir/file.txt', '/workspace')
			expect(result).toBe('/workspace/subdir/file.txt')
		})
	})

	describe('Command Injection Protection (Git Operations)', () => {
		it('should reject invalid git references with shell metacharacters', async () => {
			// Test that validateGitRef rejects dangerous characters
			const { logAsync } = await import('../../src/lib/gitUtils.js')

			// These should be rejected by validateGitRef
			await expect(logAsync('/test', '$(rm -rf /)')).rejects.toThrow()
			await expect(
				logAsync('/test', '; cat /etc/passwd'),
			).rejects.toThrow()
			await expect(logAsync('/test', '`whoami`')).rejects.toThrow()
			await expect(logAsync('/test', '| ls -la')).rejects.toThrow()
		})
	})

	describe('XXE Protection', () => {
		it('should not process external entities in XML', async () => {
			// XXE attack via external entity
			// fast-xml-parser doesn't support external entities, so this should fail to parse
			const xxeXml = `<?xml version="1.0"?>
<!DOCTYPE foo [
<!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<root>&xxe;</root>`

			const tempFile = path.join(
				os.tmpdir(),
				`xxe-test-${Date.now()}.xml`,
			)
			fs.writeFileSync(tempFile, xxeXml)

			try {
				const ctx = createTestContext({ basedir: os.tmpdir() })
				// fast-xml-parser should reject external entities
				await expect(readFile(ctx, tempFile, true)).rejects.toThrow()
			} finally {
				if (fs.existsSync(tempFile)) {
					fs.unlinkSync(tempFile)
				}
			}
		})
	})

	describe('XML Bomb Protection', () => {
		it('should reject XML files exceeding depth limit', async () => {
			// Create deeply nested XML (beyond MAX_PARSING_DEPTH = 100)
			let deepXml = '<root>'
			for (let i = 0; i < 150; i++) {
				deepXml += '<nested>'
			}
			for (let i = 0; i < 150; i++) {
				deepXml += '</nested>'
			}
			deepXml += '</root>'

			const tempFile = path.join(
				os.tmpdir(),
				`xml-bomb-test-${Date.now()}.xml`,
			)
			fs.writeFileSync(tempFile, deepXml)

			try {
				const ctx = createTestContext({ basedir: os.tmpdir() })
				await expect(readFile(ctx, tempFile, true)).rejects.toThrow(
					'exceeds maximum allowed depth',
				)
			} finally {
				if (fs.existsSync(tempFile)) {
					fs.unlinkSync(tempFile)
				}
			}
		})

		it('should reject XML files exceeding size limit', async () => {
			// This test is covered in test/lib/file/fileIO.test.ts
			// The estimateObjectSize function cannot be mocked as it's a getter
			// The actual size limit protection is tested in fileIO.test.ts
			expect(true).toBe(true) // Placeholder - functionality tested elsewhere
		})
	})

	describe('YAML Anchor Attack Protection', () => {
		it('should reject YAML files exceeding depth limit', async () => {
			// Create deeply nested YAML
			let deepYaml = 'root:'
			for (let i = 0; i < 150; i++) {
				deepYaml += `\n${'  '.repeat(i + 1)}nested:`
			}

			const tempFile = path.join(
				os.tmpdir(),
				`yaml-depth-test-${Date.now()}.yaml`,
			)
			fs.writeFileSync(tempFile, deepYaml)

			try {
				const ctx = createTestContext({ basedir: os.tmpdir() })
				await expect(readFile(ctx, tempFile, true)).rejects.toThrow(
					'exceeds maximum allowed depth',
				)
			} finally {
				if (fs.existsSync(tempFile)) {
					fs.unlinkSync(tempFile)
				}
			}
		})

		it('should reject YAML files exceeding size limit', async () => {
			// This test is covered in test/lib/file/fileIO.test.ts
			// The estimateObjectSize function cannot be mocked as it's a getter
			// The actual size limit protection is tested in fileIO.test.ts
			expect(true).toBe(true) // Placeholder - functionality tested elsewhere
		})
	})

	describe('JSON Prototype Pollution Protection', () => {
		it('should reject JSON with constructor key', () => {
			const maliciousJson = JSON.stringify({
				constructor: { prototype: { isAdmin: true } },
			})

			expect(() => safeJSONParse(maliciousJson)).toThrow(
				'Prototype pollution detected',
			)
		})

		it('should reject JSON with __proto__ key', () => {
			// JSON.stringify() omits __proto__ keys, so we construct the JSON string directly
			const maliciousJson = '{"__proto__":{"isAdmin":true}}'

			try {
				safeJSONParse(maliciousJson)
				expect.fail('Should have thrown an error')
			} catch (error) {
				expect((error as Error).message).toContain(
					'Prototype pollution detected',
				)
				expect((error as Error).message).toContain('__proto__')
			}
		})

		it('should accept valid JSON without prototype pollution', () => {
			const validJson = JSON.stringify({ name: 'test', value: 123 })
			const result = safeJSONParse(validJson)
			expect(result).toEqual({ name: 'test', value: 123 })
		})
	})

	describe('Memory Exhaustion Protection', () => {
		it('should reject files exceeding MAX_FILE_SIZE (100MB)', async () => {
			const largeSize = 101 * 1024 * 1024 // 101MB
			const tempFile = path.join(
				os.tmpdir(),
				`large-file-test-${Date.now()}.yaml`,
			)

			// Create a file that appears large (we'll mock the stat)
			fs.writeFileSync(tempFile, 'test')

			try {
				const mockFs = {
					promises: {
						lstat: vi.fn().mockResolvedValue({
							isSymbolicLink: () => false,
							isFile: () => true,
						}),
						stat: vi
							.fn()
							.mockResolvedValueOnce({
								isFile: () => true,
								size: largeSize,
							})
							.mockResolvedValueOnce({ size: largeSize }),
						readFile: vi.fn(),
					},
				}

				const ctx = createTestContext({ basedir: os.tmpdir() })
				await expect(
					readFile(
						ctx,
						tempFile,
						true,
						mockFs as unknown as typeof fs,
					),
				).rejects.toThrow('exceeds maximum limit')
			} finally {
				if (fs.existsSync(tempFile)) {
					fs.unlinkSync(tempFile)
				}
			}
		})
	})

	describe('Symlink Attack Protection', () => {
		beforeEach(() => {
			global.__basedir = '/workspace'
		})

		afterEach(() => {
			delete global.__basedir
		})

		it('should reject symlinks pointing outside workspace', async () => {
			const mockFs = {
				promises: {
					lstat: vi.fn().mockResolvedValue({
						isSymbolicLink: () => true,
					}),
					readlink: vi
						.fn()
						.mockResolvedValue('/outside/workspace/file.txt'),
				},
			}

			await expect(
				validateSymlink(
					'/workspace/symlink.txt',
					'/workspace',
					mockFs as unknown as typeof fs,
				),
			).rejects.toThrow('Symlink points outside workspace')
		})

		it('should accept symlinks pointing within workspace', async () => {
			const mockFs = {
				promises: {
					lstat: vi.fn().mockResolvedValue({
						isSymbolicLink: () => true,
					}),
					readlink: vi.fn().mockResolvedValue('target.txt'), // Relative path
				},
			}

			const result = await validateSymlink(
				'/workspace/symlink.txt',
				'/workspace',
				mockFs as unknown as typeof fs,
			)

			// Should resolve to path within workspace
			expect(result).toContain('/workspace')
		})

		it('should accept non-symlink files', async () => {
			const mockFs = {
				promises: {
					lstat: vi.fn().mockResolvedValue({
						isSymbolicLink: () => false,
					}),
				},
			}

			const result = await validateSymlink(
				'/workspace/file.txt',
				'/workspace',
				mockFs as unknown as typeof fs,
			)

			expect(result).toBe('/workspace/file.txt')
		})
	})
})
