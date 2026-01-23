// This file exports package metadata for use in the CLI
import { createRequire } from 'module'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const require = createRequire(import.meta.url)
// Resolve path relative to project root (two levels up from dist/lib)
const pkgPath = resolve(__dirname, '../../package.json')
const pkg = require(pkgPath)

export default {
	version: pkg.version,
	description: pkg.description,
	name: pkg.name,
}
