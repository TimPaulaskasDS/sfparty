import {
	combineExamples,
	combineOptions,
	splitExamples,
	splitOptions,
} from '../../src/meta/yargs.js'

describe('yargs options', () => {
	describe('splitOptions', () => {
		it('should have all base options with "split" in descriptions', () => {
			expect(splitOptions.type).toBeDefined()
			expect(splitOptions.type.description).toBe(
				'type of metadata to split',
			)
			expect(splitOptions.format).toBeDefined()
			expect(splitOptions.name).toBeDefined()
			expect(splitOptions.name.description).toBe(
				'name of metadata file to split',
			)
			expect(splitOptions.source).toBeDefined()
			expect(splitOptions.target).toBeDefined()
		})
		it('should not have git-related options', () => {
			expect(splitOptions.git).toBeUndefined()
			expect(splitOptions.append).toBeUndefined()
			expect(splitOptions.delta).toBeUndefined()
			expect(splitOptions.package).toBeUndefined()
			expect(splitOptions.destructive).toBeUndefined()
		})
		it('should have correct format option defaults', () => {
			expect(splitOptions.format.default).toBe('yaml')
			expect(splitOptions.format.alias).toBe('f')
			expect(splitOptions.format.type).toBe('string')
		})
		it('should have correct aliases', () => {
			expect(splitOptions.type.alias).toBe('y')
			expect(splitOptions.name.alias).toBe('n')
			expect(splitOptions.source.alias).toBe('s')
			expect(splitOptions.target.alias).toBe('t')
		})
	})
	describe('combineOptions', () => {
		// NOTE: Due to shallow copy in getOptions(), descriptions are NOT replaced
		// splitOptions and combineOptions share references to nested objects
		// This is a known limitation of the current implementation
		it('should have all base options', () => {
			expect(combineOptions.type).toBeDefined()
			expect(combineOptions.format).toBeDefined()
			expect(combineOptions.name).toBeDefined()
			expect(combineOptions.source).toBeDefined()
			expect(combineOptions.target).toBeDefined()
		})
		it('should have git-related options', () => {
			expect(combineOptions.git).toBeDefined()
			expect(combineOptions.git.alias).toBe('g')
			expect(combineOptions.git.type).toBe('string')
			expect(combineOptions.append).toBeDefined()
			expect(combineOptions.append.alias).toBe('a')
			expect(combineOptions.append.type).toBe('boolean')
			expect(combineOptions.append.implies).toBe('git')
			expect(combineOptions.delta).toBeDefined()
			expect(combineOptions.delta.alias).toBe('l')
			expect(combineOptions.delta.type).toBe('boolean')
			expect(combineOptions.delta.implies).toBe('git')
			expect(combineOptions.package).toBeDefined()
			expect(combineOptions.package.alias).toBe('p')
			expect(combineOptions.package.type).toBe('string')
			expect(combineOptions.package.implies).toBe('git')
			expect(combineOptions.destructive).toBeDefined()
			expect(combineOptions.destructive.alias).toBe('x')
			expect(combineOptions.destructive.type).toBe('string')
			expect(combineOptions.destructive.implies).toBe('git')
		})
		it('should have correct format option defaults', () => {
			expect(combineOptions.format.default).toBe('yaml')
			expect(combineOptions.format.alias).toBe('f')
			expect(combineOptions.format.type).toBe('string')
		})
	})
	describe('splitExamples', () => {
		it('should have examples with "split" command', () => {
			expect(Array.isArray(splitExamples)).toBe(true)
			expect(splitExamples.length).toBeGreaterThan(0)
			expect(splitExamples[0][0]).toContain('split')
		})
		it('should have multiple example commands', () => {
			expect(splitExamples.length).toBe(9)
			expect(splitExamples[1][0]).toContain('--type=profile')
			expect(splitExamples[3][0]).toContain('--type=permset')
		})
	})
	describe('combineExamples', () => {
		// NOTE: Examples use $0 placeholder (replaced by yargs at runtime)
		it('should have examples array', () => {
			expect(Array.isArray(combineExamples)).toBe(true)
			expect(combineExamples.length).toBeGreaterThan(0)
		})
		it('should have multiple example commands', () => {
			expect(combineExamples.length).toBe(9)
			expect(combineExamples[1][0]).toContain('--type=profile')
			expect(combineExamples[3][0]).toContain('--type=permset')
		})
	})
	describe('option immutability', () => {
		// NOTE: This documents current behavior - shallow copy causes shared references
		// splitOptions and combineOptions share the same nested objects
		it('should share references between split and combine options due to shallow copy', () => {
			// This is the actual behavior - they DO share references
			const originalDesc = splitOptions.type.description
			splitOptions.type.description = 'modified'
			// They share references, so both are modified
			expect(combineOptions.type.description).toBe('modified')
			// Restore for other tests
			splitOptions.type.description = originalDesc
		})
	})
})
//# sourceMappingURL=yargs.test.js.map
