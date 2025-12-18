# Agent Prompt: Achieve 100% Code Coverage

## Context
I'm working on a TypeScript project (sfparty) and need to achieve **100% code coverage** on all source files. The project uses Vitest for testing with v8 coverage provider.

## Current State
- **Current Coverage**: ~92% overall
- **Test Framework**: Vitest
- **Coverage Command**: `npm run test:coverage`
- **Excluded Files**: `src/index.ts` (CLI entry point) and `src/lib/pkgObj.cjs` (expected exclusions)

## Task
Add comprehensive tests to cover all remaining uncovered lines to reach 100% coverage.

## Specific Uncovered Lines

### 1. checkVersion.ts (Line 69)
- **Line 69**: `validateStatus: (status: number) => status === 200,` 
- **Issue**: The axios validateStatus callback needs to be tested
- **Approach**: Mock axios to return non-200 status and verify the callback is used

### 2. fileUtils.ts (Line 265)
- **Line 265**: YAML `onWarning` callback that throws: `throw new Error(\`YAML parsing ${filePath}: ${warning}\`)`
- **Issue**: Hard to trigger YAML warnings with js-yaml JSON_SCHEMA
- **Approach**: May need to use a YAML that triggers warnings or mock the yaml.load function

### 3. packageUtil.ts (Lines 115, 129, 162, 166, 239, 271)
- **Line 115**: `reject(error)` in catch when readFile promise rejects
- **Line 129**: `reject(error)` in catch when creating new package fails
- **Line 162**: `throw new Error('getPackageXML must be called before adding members')` when packageJSON is undefined in `cleanPackage`
- **Line 166**: `throw new Error('Package initialization failed')` when Package is undefined in `cleanPackage`
- **Line 239**: `throw error` in catch block within addMember forEach loop
- **Line 271**: `throw error` in catch block during sort operation in addMember

**Note**: `cleanPackage` is called internally during `getPackageXML`, so errors need to be triggered during that execution. The current tests at lines 414-439 in `getPackageXML.test.ts` are failing because they don't actually trigger the errors.

### 4. yargs.ts (Line 44)
- **Line 44**: Branch where `option` is falsy in `getOptions` function: `if (option) {`
- **Approach**: Need to test when an option in the options object is undefined/null

### 5. combine.ts (Lines 830-841, 912, 983-992, 997)
- **Lines 830-841**: `updateFileStats` function - need to test when stats exist and atime/mtime comparisons
- **Line 912**: `return 0` in `sortJSON` when `a[key] === b[key]`
- **Lines 983-992, 997**: `arrangeKeys` function with xmlOrder:
  - Line 991: `if (aIndex < bIndex && aIndex !== 99) return -1`
  - Line 992: `if (aIndex > bIndex && bIndex !== 99) return 1`
  - Line 997: `return 0` when `a === b` (keys not in xmlOrder)

### 6. split.ts (Lines 541, 560, 567, 586, 605, 613-617)
- **Line 541**: `return 0` in keySort when `aVal === bVal` (string comparison)
- **Line 560**: `return 0` in keySort keyOrder comparison when indices are equal
- **Line 567**: `throw error` in catch block within keySort forEach
- **Line 586**: Recursive `keySort` call on nested objects
- **Line 605**: Array with `length === 1` in xml2json (converts to string)
- **Lines 613-617**: Error handling in xml2json catch block for non-primitive conversion errors

## Current Test Failures
There are 2 failing tests in `test/lib/package/getPackageXML.test.ts`:
1. "should throw error when packageJSON is undefined in cleanPackage" - The promise resolves instead of rejecting
2. "should throw error when Package is undefined in cleanPackage" - The promise resolves instead of rejecting

These tests need to be fixed or removed and replaced with tests that actually trigger the error conditions.

## Key Files to Modify
- `test/lib/package/getPackageXML.test.ts` - Fix failing tests and add coverage for lines 115, 129, 162, 166
- `test/lib/package/addMember.test.ts` - Add tests for lines 239, 271
- `test/lib/checkVersion.spec.ts` - Add test for line 69
- `test/lib/file/fileIO.test.ts` - Add test for line 265 (YAML onWarning)
- `test/meta/yargs.test.ts` - Add test for line 44
- `test/party/combine.test.ts` - Add tests for lines 830-841, 912, 983-992, 997
- `test/party/split.test.ts` - Add tests for lines 541, 560, 567, 586, 605, 613-617

## Approach
1. **Fix failing tests first** - Remove or fix the two failing tests in getPackageXML.test.ts
2. **For error paths**: Create tests that actually trigger the error conditions during execution, not just verify they exist
3. **For branch coverage**: Test both true and false paths of conditionals
4. **For edge cases**: Test boundary conditions (empty arrays, undefined values, equal comparisons)
5. **For hard-to-trigger code**: Use mocks/stubs to force the code path execution
6. **Run coverage after each addition** - Use `npm run test:coverage` to verify coverage increases

## Success Criteria
- All tests pass (no failing tests)
- Run `npm run test:coverage` and verify 100% statement coverage on all included files
- No uncovered lines remain in the coverage report (except excluded files)

## Important Notes
- The `cleanPackage` function is called internally during `getPackageXML` promise resolution, so errors need to be triggered during that async execution
- Some catch blocks are hard to trigger without breaking test infrastructure - may need creative mocking approaches
- The `validateStatus` callback in axios is tricky because axios validates status before calling the callback - may need to mock axios differently
- When testing error paths, ensure the errors are actually thrown during execution, not just that the error handling code exists

## Getting Started
1. Run `npm run test:coverage` to see current coverage report
2. Identify which specific lines are still uncovered
3. Fix the 2 failing tests first
4. Systematically add tests for each uncovered line
5. Verify coverage increases with each test addition
6. Continue until 100% coverage is achieved

Good luck! Focus on making tests that actually execute the uncovered code paths, not just tests that verify the code exists.
