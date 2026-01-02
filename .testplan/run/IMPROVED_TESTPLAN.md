# Improved Test Plan - Code Path Driven

## Problem with Original Approach

The original TESTPLAN.md was too high-level. It identified files and lines but didn't:
1. **Analyze the actual code** to understand control flow
2. **Generate specific test code** - only descriptions
3. **Verify tests actually cover lines** - assumed they would

## New Approach: Code Path Analysis → Test Generation

### Phase 1: Code Path Analysis (DONE)
- ✅ Created `code-path-analyzer.js` that reads source code
- ✅ Analyzes control flow (if/else, try/catch, loops)
- ✅ Identifies exact conditions needed
- ✅ Generates test scenarios

### Phase 2: Test Code Generation (IN PROGRESS)
- ✅ Created `TEST_GENERATOR.md` with executable test code
- 🔄 Need to implement tests for each uncovered line
- 🔄 Verify coverage after each test

### Phase 3: Systematic Implementation

For each uncovered line:

1. **Read the source code** at that line
2. **Understand the control flow** - what conditions must be true?
3. **Trace dependencies** - what needs to be set up first?
4. **Write a minimal test** that definitely hits that line
5. **Run coverage** to verify
6. **If not covered**, debug why (coverage tool issue? test structure?)

### Example: pathUtils.ts Line 13

**Analysis:**
- Line 13: `return sanitizedPathCache.get(str)!`
- Inside: `if (sanitizedPathCache.has(str))`
- Need: Cache must contain the value
- Problem: `beforeEach` clears cache, so second call doesn't hit cache

**Solution:**
- Move cache hit test OUTSIDE the `describe` block with `beforeEach`
- OR: Create a separate test file that doesn't clear cache
- OR: Use a test that doesn't use `beforeEach` for that specific test

**Generated Test:**
```typescript
// In a separate describe block WITHOUT beforeEach
describe('cache hit coverage (line 13)', () => {
	it('should return cached value', () => {
		const input = 'test*file?.txt'
		// First call populates cache
		replaceSpecialChars(input)
		// Second call hits line 13
		const result = replaceSpecialChars(input)
		expect(result).toBe('test\u002afile\u003f.txt')
	})
})
```

## Files Needing Attention

### High Priority (Low Coverage)
1. **pathUtils.ts** (80%) - Lines 13, 28 - Cache paths
2. **packageUtil.ts** (100% stmts, 90% branches) - Lines 152-156, 247-248, 322
3. **performanceLogger.ts** (99%) - Lines 71, 123, 309, 328, 375, 381
4. **writeBatcher.ts** (93%) - Lines 107-109, 154

### Medium Priority
5. **fileUtils.ts** (90%) - Many uncovered lines
6. **yargs.ts** (100% stmts, 87.5% branches) - Line 44
7. **split.ts** (89%) - Many uncovered lines
8. **combine.ts** (89%) - Many uncovered lines

## Implementation Strategy

1. **Start with simplest** (pathUtils.ts - only 2 lines)
2. **Fix one line at a time**
3. **Verify coverage after each**
4. **If coverage tool shows it's still uncovered**, investigate:
   - Is the test actually running?
   - Is the code path actually being executed?
   - Is there a coverage tool bug?

## Tools Created

1. **code-path-analyzer.js** - Analyzes code and generates analysis
2. **TEST_GENERATOR.md** - Provides executable test code
3. **This document** - Improved methodology

## Next Actions

1. Implement tests from TEST_GENERATOR.md
2. Run coverage after each implementation
3. Debug any lines that still show as uncovered
4. Document any coverage tool limitations

