/**
 * Tests for configuration file signing (SEC-015)
 */

import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
	generateSigningKey,
	hasSignature,
	loadSignature,
	saveSignature,
	signContent,
	signFile,
	verifyFile,
	verifySignature,
} from '../../src/lib/fileSigning.js'

describe('Configuration File Signing (SEC-015)', () => {
	let tempDir: string
	let testFile: string

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sfparty-test-'))
		testFile = path.join(tempDir, 'test-config.json')
		fs.writeFileSync(testFile, JSON.stringify({ test: 'data' }), 'utf8')
	})

	afterEach(() => {
		if (fs.existsSync(tempDir)) {
			fs.rmSync(tempDir, { recursive: true, force: true })
		}
	})

	describe('generateSigningKey', () => {
		it('should generate key from passphrase', () => {
			const key1 = generateSigningKey(undefined, 'test-passphrase')
			const key2 = generateSigningKey(undefined, 'test-passphrase')
			expect(key1).toEqual(key2) // Same passphrase = same key
			expect(key1.length).toBe(32) // 256 bits
		})

		it('should generate different keys for different passphrases', () => {
			const key1 = generateSigningKey(undefined, 'pass1')
			const key2 = generateSigningKey(undefined, 'pass2')
			expect(key1).not.toEqual(key2)
		})

		it('should read key from file', () => {
			const keyFile = path.join(tempDir, 'key.bin')
			const keyData = Buffer.from('test-key-data-1234567890123456')
			fs.writeFileSync(keyFile, keyData)
			const key = generateSigningKey(keyFile)
			expect(key).toEqual(keyData)
		})

		it('should throw error if key file does not exist', () => {
			expect(() => generateSigningKey('/nonexistent/key.bin')).toThrow(
				'Failed to read signing key',
			)
		})

		it('should use environment variable if available', () => {
			const envKey =
				'0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
			process.env.SFPARTY_SIGNING_KEY = envKey
			const key = generateSigningKey()
			expect(key.toString('hex')).toBe(envKey)
			delete process.env.SFPARTY_SIGNING_KEY
		})

		it('should generate deterministic key from workspace if no key provided', () => {
			const originalCwd = process.cwd()
			process.chdir(tempDir)
			const key1 = generateSigningKey()
			const key2 = generateSigningKey()
			expect(key1).toEqual(key2) // Same workspace = same key
			process.chdir(originalCwd)
		})
	})

	describe('signContent and verifySignature', () => {
		it('should sign and verify content', () => {
			const key = generateSigningKey(undefined, 'test-key')
			const content = 'test content'
			const signature = signContent(content, key)
			expect(signature).toBeTruthy()
			expect(typeof signature).toBe('string')
			expect(signature.length).toBeGreaterThan(0)

			const isValid = verifySignature(content, signature, key)
			expect(isValid).toBe(true)
		})

		it('should reject invalid signature', () => {
			const key = generateSigningKey(undefined, 'test-key')
			const content = 'test content'
			const signature = signContent(content, key)
			const invalidSig = 'invalid-signature'

			const isValid = verifySignature(content, invalidSig, key)
			expect(isValid).toBe(false)
		})

		it('should reject signature for modified content', () => {
			const key = generateSigningKey(undefined, 'test-key')
			const content = 'test content'
			const signature = signContent(content, key)
			const modifiedContent = 'modified content'

			const isValid = verifySignature(modifiedContent, signature, key)
			expect(isValid).toBe(false)
		})

		it('should reject signature with wrong key', () => {
			const key1 = generateSigningKey(undefined, 'key1')
			const key2 = generateSigningKey(undefined, 'key2')
			const content = 'test content'
			const signature = signContent(content, key1)

			const isValid = verifySignature(content, signature, key2)
			expect(isValid).toBe(false)
		})
	})

	describe('saveSignature and loadSignature', () => {
		it('should save and load signature', () => {
			const signature = 'test-signature-hex'
			saveSignature(testFile, signature)
			const loaded = loadSignature(testFile)
			expect(loaded).toBe(signature)
		})

		it('should return undefined if signature file does not exist', () => {
			const loaded = loadSignature('/nonexistent/file.json')
			expect(loaded).toBeUndefined()
		})

		it('should set restrictive permissions on signature file', () => {
			const signature = 'test-signature'
			saveSignature(testFile, signature)
			const sigFile = testFile + '.sig'
			const stats = fs.statSync(sigFile)
			// Should be 0o600 (owner read/write only)
			expect(stats.mode & 0o777).toBe(0o600)
		})
	})

	describe('signFile', () => {
		it('should sign a file and create signature file', () => {
			const signature = signFile(testFile)
			expect(signature).toBeTruthy()
			expect(hasSignature(testFile)).toBe(true)
			const loaded = loadSignature(testFile)
			expect(loaded).toBe(signature)
		})

		it('should generate same signature for same content', () => {
			const key = generateSigningKey(undefined, 'test-key')
			const sig1 = signFile(testFile, key)
			// Re-sign with same key
			const sig2 = signFile(testFile, key)
			expect(sig1).toBe(sig2)
		})

		it('should generate different signature if content changes', () => {
			const key = generateSigningKey(undefined, 'test-key')
			const sig1 = signFile(testFile, key)
			fs.writeFileSync(
				testFile,
				JSON.stringify({ modified: true }),
				'utf8',
			)
			const sig2 = signFile(testFile, key)
			expect(sig1).not.toBe(sig2)
		})
	})

	describe('verifyFile', () => {
		it('should verify valid signature', () => {
			const key = generateSigningKey(undefined, 'test-key')
			signFile(testFile, key)
			const isValid = verifyFile(testFile, key)
			expect(isValid).toBe(true)
		})

		it('should return false if signature file does not exist', () => {
			const key = generateSigningKey(undefined, 'test-key')
			const isValid = verifyFile(testFile, key)
			expect(isValid).toBe(false)
		})

		it('should throw error if signature is invalid', () => {
			const key = generateSigningKey(undefined, 'test-key')
			signFile(testFile, key)
			// Modify file content
			fs.writeFileSync(
				testFile,
				JSON.stringify({ tampered: true }),
				'utf8',
			)
			expect(() => verifyFile(testFile, key)).toThrow(
				'Signature verification failed',
			)
		})

		it('should throw error if signature file is corrupted', () => {
			const key = generateSigningKey(undefined, 'test-key')
			signFile(testFile, key)
			// Corrupt signature file
			fs.writeFileSync(testFile + '.sig', 'invalid-hex', 'utf8')
			expect(() => verifyFile(testFile, key)).toThrow(
				'Signature verification failed',
			)
		})
	})

	describe('hasSignature', () => {
		it('should return true if signature file exists', () => {
			signFile(testFile)
			expect(hasSignature(testFile)).toBe(true)
		})

		it('should return false if signature file does not exist', () => {
			expect(hasSignature(testFile)).toBe(false)
		})
	})
})
