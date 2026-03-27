/**
 * Configuration File Signing (SEC-015)
 * Provides optional signing and verification for critical configuration files
 * to prevent tampering attacks.
 */

import * as crypto from 'crypto'
import * as fs from 'fs'

const SIGNATURE_EXTENSION = '.sig'
const DEFAULT_ALGORITHM = 'sha256'
const DEFAULT_KEY_LENGTH = 32 // 256 bits for HMAC

/**
 * Generate a signing key from a passphrase or use a default key file
 * @param keyPath - Optional path to key file
 * @param passphrase - Optional passphrase to derive key from
 * @returns Signing key as Buffer
 */
export function generateSigningKey(
	keyPath?: string,
	passphrase?: string,
): Buffer {
	if (keyPath) {
		try {
			return fs.readFileSync(keyPath)
		} catch {
			throw new Error(`Failed to read signing key from ${keyPath}`)
		}
	}

	if (passphrase) {
		return crypto.pbkdf2Sync(
			passphrase,
			'sfparty-salt',
			10000,
			32,
			'sha256',
		)
	}

	// Default: use environment variable or generate from workspace
	const envKey = process.env.SFPARTY_SIGNING_KEY
	if (envKey) {
		return Buffer.from(envKey, 'hex')
	}

	// Fallback: generate deterministic key from workspace (not secure, but better than nothing)
	// In production, users should provide their own key
	const workspace = process.cwd()
	return crypto
		.createHash('sha256')
		.update(workspace)
		.digest()
		.subarray(0, DEFAULT_KEY_LENGTH)
}

/**
 * Sign a file's content
 * @param filePath - Path to file to sign
 * @param content - File content to sign
 * @param key - Signing key
 * @returns Signature as hex string
 */
export function signContent(content: string, key: Buffer): string {
	const hmac = crypto.createHmac(DEFAULT_ALGORITHM, key)
	hmac.update(content)
	return hmac.digest('hex')
}

/**
 * Verify a file's signature
 * @param content - File content to verify
 * @param signature - Expected signature (hex string)
 * @param key - Signing key
 * @returns True if signature is valid
 */
export function verifySignature(
	content: string,
	signature: string,
	key: Buffer,
): boolean {
	const expected = signContent(content, key)
	const expectedBuf = Buffer.from(expected, 'hex')
	const signatureBuf = Buffer.from(signature, 'hex')

	// timingSafeEqual requires buffers of the same length
	// If lengths differ, signature is invalid
	if (expectedBuf.length !== signatureBuf.length) {
		return false
	}

	return crypto.timingSafeEqual(expectedBuf, signatureBuf)
}

/**
 * Save signature to a separate file
 * @param filePath - Path to original file
 * @param signature - Signature to save
 */
export function saveSignature(filePath: string, signature: string): void {
	const sigPath = filePath + SIGNATURE_EXTENSION
	fs.writeFileSync(sigPath, signature, 'utf8')
	// Restrict permissions (owner read/write only)
	fs.chmodSync(sigPath, 0o600)
}

/**
 * Load signature from file
 * @param filePath - Path to original file
 * @returns Signature if file exists, undefined otherwise
 */
export function loadSignature(filePath: string): string | undefined {
	const sigPath = filePath + SIGNATURE_EXTENSION
	try {
		return fs.readFileSync(sigPath, 'utf8').trim()
	} catch {
		return undefined
	}
}

/**
 * Sign a configuration file
 * @param filePath - Path to file to sign
 * @param key - Signing key (optional, will be generated if not provided)
 * @returns Signature hex string
 */
export function signFile(filePath: string, key?: Buffer): string {
	const content = fs.readFileSync(filePath, 'utf8')
	const signingKey = key ?? generateSigningKey()
	const signature = signContent(content, signingKey)
	saveSignature(filePath, signature)
	return signature
}

/**
 * Verify a configuration file's signature
 * @param filePath - Path to file to verify
 * @param key - Signing key (optional, will be generated if not provided)
 * @returns True if signature is valid, false if signature file doesn't exist
 * @throws Error if signature is invalid
 */
export function verifyFile(filePath: string, key?: Buffer): boolean {
	const content = fs.readFileSync(filePath, 'utf8')
	const signature = loadSignature(filePath)

	if (!signature) {
		return false // No signature file - verification not possible
	}

	const signingKey = key ?? generateSigningKey()
	const isValid = verifySignature(content, signature, signingKey)

	if (!isValid) {
		throw new Error(
			`Signature verification failed for ${filePath}. File may have been tampered with.`,
		)
	}

	return true
}

/**
 * Check if a file has a signature
 * @param filePath - Path to file
 * @returns True if signature file exists
 */
export function hasSignature(filePath: string): boolean {
	const sigPath = filePath + SIGNATURE_EXTENSION
	return fs.existsSync(sigPath)
}
