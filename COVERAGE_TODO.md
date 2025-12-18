# 100% Code Coverage Task

## Current Status
The codebase currently has **~92% coverage**. We need to achieve **100% code coverage** on all files. The vitest config excludes `src/index.ts` (CLI entry point) and `src/lib/pkgObj.cjs`, which is expected.

## Uncovered Lines to Fix

Based on the latest coverage report, here are the specific lines that need test coverage:

### checkVersion.ts
- **Line 69**: `validateStatus: (status: number) => status === 200,` - The validateStatus callback in axios config

### fileUtils.ts  
- **Line 265**: YAML `onWarning` callback that throws an error - This is hard to trigger but needs coverage

### packageUtil.ts
- **Line 115**: `reject(error)` in catch block when readFile promise rejects
- **Line 129**: `reject(error)` in catch block when creating new package fails  
- **Line 162**: `throw new Error('getPackageXML must be called before adding members')` - when packageJSON is undefined in cleanPackage
- **Line 166**: `throw new Error('Package initialization failed')` - when Package is undefined in cleanPackage
- **Line 239**: `throw error` in catch block within addMember forEach loop
- **Line 271**: `throw error` in catch block during sort operation in addMember

### yargs.ts
- **Line 44**: Branch where `option` is falsy in `getOptions` function

### combine.ts
- **Lines 830-841**: `updateFileStats` function with actual stats (atime/mtime comparisons)
- **Line 912**: `return 0` in sortJSON when `a[key] === b[key]`
- **Lines 983-992, 997**: `arrangeKeys` function with xmlOrder - various branch conditions:
  - Line 991: `aIndex < bIndex && aIndex !== 99`
  - Line 992: `aIndex > bIndex && bIndex !== 99`  
  - Line 997: `return 0` when `a === b`

### split.ts
- **Line 541**: `return 0` in keySort when `aVal === bVal` (string comparison)
- **Line 560**: `return 0` in keySort keyOrder comparison when indices are equal
- **Line 567**: `throw error` in catch block within keySort forEach
- **Line 586**: Recursive `keySort` call on nested objects
- **Line 605**: Array with `length === 1` in xml2json (converts to string)
- **Lines 613-617**: Error handling in xml2json catch block for non-primitive conversion errors

## Testing Framework
- **Framework**: Vitest
- **Coverage Provider**: v8
- **Test Location**: `test/` directory mirrors `src/` structure
- **Run Coverage**: `npm run test:coverage`

## Approach

1. **For error paths**: Create tests that actually trigger the error conditions, not just verify they exist
2. **For branch coverage**: Test both true and false paths of conditionals
3. **For edge cases**: Test boundary conditions (empty arrays, undefined values, equal comparisons)
4. **For hard-to-trigger code**: Use mocks/stubs to force the code path execution

## Key Files to Modify

- `test/lib/package/getPackageXML.test.ts` - Add tests for lines 115, 129, 162, 166
- `test/lib/package/addMember.test.ts` - Add tests for lines 239, 271
- `test/lib/checkVersion.spec.ts` - Add test for line 69
- `test/lib/file/fileIO.test.ts` - Add test for line 265 (YAML onWarning)
- `test/meta/yargs.test.ts` - Add test for line 44
- `test/party/combine.test.ts` - Add tests for lines 830-841, 912, 983-992, 997
- `test/party/split.test.ts` - Add tests for lines 541, 560, 567, 586, 605, 613-617

## Notes

- Some tests were attempted but failed because they didn't actually trigger the code paths
- The `cleanPackage` function is called internally during `getPackageXML`, so errors need to be triggered during that execution
- Some catch blocks are hard to trigger without breaking test infrastructure - may need creative mocking approaches
- The `validateStatus` callback in axios is tricky because axios validates status before calling the callback

## Success Criteria

Run `npm run test:coverage` and verify:
- All files show 100% statement coverage (except excluded files)
- All branch conditions are covered
- No uncovered lines remain in the coverage report
