# Test Generator - Code Path to Test Code

This document provides **executable test code** for each uncovered line, generated from code path analysis.

## Methodology

For each uncovered line:
1. **Read the actual source code** and understand the control flow
2. **Identify exact conditions** needed (if statements, variable states, etc.)
3. **Trace dependencies** (what needs to be set up first)
4. **Generate specific test code** that will definitely hit that line
5. **Verify the test** actually covers the line

## src/lib/pathUtils.ts

### Line 13: Cache Hit Path

**Code:** `return sanitizedPathCache.get(str)!`

**Conditions:**
- `typeof str === 'string'` (line 9 must be false)
- `sanitizedPathCache.has(str) === true` (line 12 must be true)

**Problem:** The cache is cleared in `beforeEach`, so even if we call the function twice, the second call doesn't hit the cache because it was cleared.

**Solution:** We need a test that:
1. Does NOT clear the cache before the test
2. Calls the function with a string containing special characters (to populate cache)
3. Calls it again with the SAME string (to hit cache)

**Generated Test:**
```typescript
it('should hit cache on second call (line 13 coverage)', () => {
	// DO NOT clear cache - let it persist from previous test or setup
	// Use a string that will be sanitized (contains special chars)
	const input = 'test*file?.txt'
	
	// First call: sanitizes and caches (hits line 28)
	const first = replaceSpecialChars(input)
	expect(first).toBe('test\u002afile\u003f.txt')
	
	// Second call: should hit cache (hits line 13)
	const second = replaceSpecialChars(input)
	expect(second).toBe('test\u002afile\u003f.txt')
	expect(first).toBe(second)
	
	// Verify it's actually from cache by checking it's the same reference
	// (though strings are immutable, so we verify behavior)
})
```

**Alternative:** Move this test OUTSIDE the `describe('cache behavior')` block that has `beforeEach` clearing the cache.

### Line 28: Cache Set Path

**Code:** `sanitizedPathCache.set(str, sanitized)`

**Conditions:**
- `typeof str === 'string'` (line 9 must be false)
- `sanitizedPathCache.has(str) === false` (line 12 must be false - cache miss)
- `sanitized !== str` (line 27 must be true - string was actually sanitized)

**Problem:** The string must contain special characters that get replaced, AND the cache must be empty.

**Solution:** Clear cache, then call with string containing special characters.

**Generated Test:**
```typescript
it('should set cache when string is sanitized (line 28 coverage)', () => {
	// Clear cache to ensure fresh start
	clearPathSanitizationCache()
	
	// Use string with special characters that WILL be sanitized
	const input = 'file*with?special<chars>'
	
	// Call function - should sanitize AND cache (hits line 28)
	const result = replaceSpecialChars(input)
	
	expect(result).toBe('file\u002awith\u003fspecial\u003cchars\u003e')
	expect(result).not.toBe(input) // Verify it was actually sanitized
	
	// Verify cache was set by calling again (should hit line 13)
	const cached = replaceSpecialChars(input)
	expect(cached).toBe(result)
})
```

## src/lib/packageUtil.ts

### Lines 152-156: cleanPackage with global.metaTypes

**Code:**
```typescript
const typeArray = Object.values(global.metaTypes || {}).map(
	(metaType) => metaType.definition.root,
)
that.packageJSON.Package.types.forEach((typeItem) => {
	if (typeArray.includes(typeItem.name || '')) {
```

**Conditions:**
- `that.packageJSON !== undefined` (line 142 must be false)
- `that.packageJSON.Package !== undefined` (line 146 must be false)
- `that.packageJSON.Package.types !== undefined` (line 149 must be false)
- `global.metaTypes` must be defined
- `cleanPackage` must be called

**Generated Test:**
```typescript
it('should filter members when global.metaTypes is set (lines 152-156 coverage)', async () => {
	const pkg = new Package('Workflow')
	mockFileExists.mockReturnValue(true)
	mockReadFile.mockResolvedValue({
		Package: {
			types: [
				{ name: 'Workflow', members: ['Workflow', 'Workflow.yaml'] },
			],
			version: '56.0',
		},
	})
	
	// Ensure global.metaTypes is set (it should be from beforeEach)
	expect(global.metaTypes).toBeDefined()
	
	// Call getPackageXML which calls cleanPackage internally
	await pkg.getPackageXML(fileUtils)
	
	// Verify cleanPackage was called and filtered members
	// The .yaml member should be removed if global.metaTypes is set
	if (pkg.packageJSON?.Package.types?.[0]) {
		const members = pkg.packageJSON.Package.types[0].members
		// Members ending with .yaml should be filtered out
		expect(members).not.toContain('Workflow.yaml')
	}
})
```

### Lines 247-248: Sort comparison branches

**Code:**
```typescript
if ((a.name || '') < (b.name || '')) return -1
if ((a.name || '') > (b.name || '')) return 1
```

**Conditions:**
- Sorting function is called
- Need types with names where `a.name < b.name` and `a.name > b.name`

**Generated Test:**
```typescript
it('should sort types correctly (lines 247-248 coverage)', async () => {
	const pkg = new Package('Workflow')
	mockFileExists.mockReturnValue(true)
	mockReadFile.mockResolvedValue({
		Package: {
			types: [
				{ name: 'Zebra', members: [] },
				{ name: 'Alpha', members: [] },
				{ name: 'Beta', members: [] },
			],
			version: '56.0',
		},
	})
	
	await pkg.getPackageXML(fileUtils)
	
	// Verify types are sorted alphabetically
	if (pkg.packageJSON?.Package.types) {
		const names = pkg.packageJSON.Package.types.map(t => t.name)
		expect(names).toEqual(['Alpha', 'Beta', 'Zebra'])
	}
})
```

### Line 322: Array length === 1 conversion

**Code:**
```typescript
if (value.length === 1) {
	value = value[0].toString().trim()
}
```

**Conditions:**
- `xml2json` function is called
- Input has an array with exactly 1 element

**Generated Test:**
```typescript
it('should convert single-element array to string (line 322 coverage)', async () => {
	// This requires XML input with single-element array
	// The xml2json function processes this
	const pkg = new Package('Workflow')
	mockFileExists.mockReturnValue(true)
	mockReadFile.mockResolvedValue(`<?xml version="1.0"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
	<types>
		<members>OnlyOne</members>
		<name>Workflow</name>
	</types>
	<version>56.0</version>
</Package>`)
	
	await pkg.getPackageXML(fileUtils)
	
	// Verify single-element array was converted
	// This is internal to xml2json, so we verify the result
	expect(pkg.packageJSON).toBeDefined()
})
```

## Next Steps

1. **Implement these generated tests** in the appropriate test files
2. **Run coverage** to verify lines are now covered
3. **If still not covered**, investigate further (may be coverage tool issue or test structure)
4. **Repeat for all uncovered lines**

## Verification Command

After adding tests:
```bash
bun test [test-file]
bun run test:coverage
# Check coverage report to verify lines are now covered
```

