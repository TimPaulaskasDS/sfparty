# Reachability Analysis

## Methodology

For each file that is NOT at 100% coverage, we investigate:
1. What specific code is not covered (lines, branches, functions)
2. Why it's not covered
3. What is needed to reach 100% coverage
4. Classify each uncovered item and determine strategy

## Files Requiring Attention (Not at 100% Coverage)

### File: src/lib/pathUtils.ts

- **Current Coverage**: 
  - Statements: 80%
  - Branches: 66.66%
  - Functions: 100%
  - Lines: 77.77%
- **Target**: 100% for all metrics
- **Uncovered Items**:
  - Line 13: `return sanitizedPathCache.get(str)!` (cache hit path)
  - Line 28: `sanitizedPathCache.set(str, sanitized)` (cache set when string changed)
- **Analysis**:
  - **Line 13**: The cache hit path is not covered. This happens when `replaceSpecialChars()` is called with the same string twice, and the string contains special characters that were previously sanitized and cached.
  - **Line 28**: The cache set path is not covered. This happens when a string contains special characters that need sanitization, and the sanitized result differs from the original (triggering the cache set).
  - **Why not covered**: Current tests likely don't exercise the memoization cache - they probably test with different strings each time, or test strings that don't need sanitization.
- **Classification**: **A) Reachable via existing public API** - The `replaceSpecialChars()` function is public and can be tested directly. The cache behavior can be tested by calling the function multiple times with the same string.
- **What's Needed to Reach 100%**:
  - Test cache hit: Call `replaceSpecialChars()` with a string containing special characters, then call it again with the same string to hit the cache.
  - Test cache set: Call `replaceSpecialChars()` with a string containing special characters that need sanitization (e.g., `"test*file"`), verify the cache is set.
  - Test cache miss: Call `replaceSpecialChars()` with a string that doesn't need sanitization (e.g., `"normal-file"`), verify it's not cached.
- **Test Approach**:
  - Use existing test file: `test/lib/pathUtils.test.ts`
  - Test scenarios:
    1. Call `replaceSpecialChars("test*file")` twice - first call should sanitize and cache, second call should hit cache
    2. Call `replaceSpecialChars("normal-file")` - should not cache (string unchanged)
    3. Call `clearPathSanitizationCache()` and verify cache is cleared
- **Evidence**: Function is public export, cache is internal implementation detail that can be tested via public API.

---

### File: src/lib/fileUtils.ts

- **Current Coverage**: 
  - Statements: 90.28%
  - Branches: 83.17%
  - Functions: 80%
  - Lines: 90.11%
- **Target**: 100% for all metrics
- **Uncovered Items**:
  - Line 22: `return globalWriteBatcher` when `globalWriteBatcher` is `null`
  - Line 437: YAML parsing warning handler (`throw new Error(\`YAML parsing ${filePath}: ${warning}\`)`)
  - Line 483: Error re-throw in `convertXML()` function
  - Line 548: `findFile()` when `stat()` exists but `isFile()` returns false (directory exists but is not a file)
- **Analysis**:
  - **Line 22**: `getWriteBatcher()` returns `null` when the write batcher hasn't been initialized. This is the default state before `initWriteBatcher()` is called.
  - **Line 437**: YAML parsing warning handler is triggered when `yaml.load()` encounters a warning (e.g., duplicate keys, deprecated syntax). The `onWarning` callback throws an error.
  - **Line 483**: Error re-throw in `convertXML()` - this is the catch block that re-throws XML parsing errors. This path is hit when XML parsing fails.
  - **Line 548**: `findFile()` when a directory exists at the path but it's not a file. The `stat()` succeeds but `isFile()` returns false, so it continues to `nextLevelUp()`.
  - **Why not covered**: 
    - Line 22: Tests probably always initialize the write batcher before calling `getWriteBatcher()`
    - Line 437: Tests don't use YAML files with warnings
    - Line 483: Tests don't trigger XML parsing errors
    - Line 548: Tests don't create scenarios where a directory exists at the expected file path
- **Classification**: 
  - Line 22: **A) Reachable via existing public API** - Can test by calling `getWriteBatcher()` before initialization
  - Line 437: **D) Error-only paths** - Need to create YAML files with warnings to trigger the error path
  - Line 483: **D) Error-only paths** - Need to create invalid XML to trigger parsing errors
  - Line 548: **A) Reachable via existing public API** - Can test by creating a directory at the expected file path
- **What's Needed to Reach 100%**:
  - Test `getWriteBatcher()` before initialization (should return `null`)
  - Test YAML parsing with warnings (create YAML file with duplicate keys or deprecated syntax)
  - Test XML parsing errors (create invalid XML file)
  - Test `find()` when directory exists at expected file path (should continue searching)
- **Test Approach**:
  - Use existing test file: `test/lib/file/fileIO.test.ts` or create new tests
  - Test scenarios:
    1. Call `getWriteBatcher()` before `initWriteBatcher()` - should return `null`
    2. Create YAML file with duplicate keys, call `readFile()` with `convert: true` - should throw error with warning message
    3. Create invalid XML file, call `readFile()` with `convert: true` - should throw error
    4. Create directory at path where file is expected, call `find()` - should continue searching up directory tree
- **Fixtures Needed**:
  - YAML file with warnings (duplicate keys)
  - Invalid XML file
  - Test directory structure with directory at expected file path
- **Evidence**: All functions are public exports, error paths can be triggered with invalid input.

---

### File: src/lib/packageUtil.ts

- **Current Coverage**: 
  - Statements: 100%
  - Branches: 90.24%
  - Functions: 100%
  - Lines: 100%
- **Target**: 100% for all metrics
- **Uncovered Items**:
  - Line 56: Branch in package processing logic (need to examine specific branch)
  - Lines 247-248: Sort comparison branches (`if ((a.name || '') < (b.name || ''))` and `if ((a.name || '') > (b.name || ''))`)
  - Line 322: `xml2json()` array handling branch (`if (value.length === 1)`)
- **Analysis**:
  - **Line 56**: Need to examine the specific branch condition
  - **Lines 247-248**: Sort comparison branches for package types. The branches for `a.name < b.name` and `a.name > b.name` are covered, but the equal case (when both return 0) might not be fully covered, or the specific comparison paths need more coverage.
  - **Line 322**: `xml2json()` converts single-element arrays to strings. The branch `if (value.length === 1)` is not covered, meaning tests don't exercise XML parsing that results in single-element arrays.
  - **Why not covered**: 
    - Sort branches: Tests might not include packages with equal names, or the comparison paths aren't fully exercised
    - Array branch: Tests don't include XML that parses to single-element arrays
- **Classification**: **A) Reachable via existing public API** - Can test by creating package XML with specific structures
- **What's Needed to Reach 100%**:
  - Test package sorting with equal names (should return 0)
  - Test package sorting with names that trigger both `<` and `>` comparisons
  - Test XML parsing that results in single-element arrays (should convert to string)
- **Test Approach**:
  - Use existing test file: `test/lib/package/getPackageXML.test.ts` or `test/lib/package/addMember.test.ts`
  - Test scenarios:
    1. Create package with multiple types, some with equal names - verify sorting handles equal names
    2. Create package XML that parses to single-element arrays - verify `xml2json()` converts to string
- **Fixtures Needed**:
  - Package XML with types that have equal names
  - Package XML with elements that parse to single-element arrays
- **Evidence**: Package class is public, can be tested with various XML structures.

---

### File: src/lib/performanceLogger.ts

- **Current Coverage**: 
  - Statements: 99.25%
  - Branches: 89.28%
  - Functions: 100%
  - Lines: 100%
- **Target**: 100% for all metrics
- **Uncovered Items**:
  - Line 309: `if (summary.slowestFiles.length > 0)` - when there are no slowest files
  - Line 328: `if (!this.logFile) return` - when logFile is not set
  - Line 375: `if (operation.duration !== undefined)` - when duration is undefined
  - Line 381: `else if (opType.includes('write') || opType.includes('save'))` - write/save operation type
- **Analysis**:
  - **Line 309**: The branch for when there are no slowest files is not covered. This happens when `printSummary()` is called but no files have been processed, or all files processed very quickly.
  - **Line 328**: The early return when `logFile` is not set is not covered. This happens when `PerformanceLogger` is created without a log file path.
  - **Line 375**: The branch when `operation.duration` is undefined is not covered. This happens when operations are logged without duration information.
  - **Line 381**: The write/save operation type branch is not covered. Operations are logged with types like "read", "parse", but not "write" or "save".
  - **Why not covered**: 
    - Tests probably always process files (so slowestFiles is never empty)
    - Tests probably always provide a log file path
    - Tests probably always log operations with duration
    - Tests probably don't log write/save operations
- **Classification**: **A) Reachable via existing public API** - Can test by controlling the logger state and operations
- **What's Needed to Reach 100%**:
  - Test `printSummary()` when no files have been processed (slowestFiles should be empty)
  - Test `PerformanceLogger` without log file path (should skip file write)
  - Test logging operations without duration (should skip duration-based updates)
  - Test logging write/save operations (should update writeTime)
- **Test Approach**:
  - Use existing test file: `test/lib/performanceLogger.test.ts`
  - Test scenarios:
    1. Create logger, call `printSummary()` without processing any files - should skip slowest files section
    2. Create logger without log file path, call `printSummary()` - should skip file write
    3. Log operation without duration, verify it's handled correctly
    4. Log write/save operations, verify writeTime is updated
- **Evidence**: PerformanceLogger is public, can be tested with various configurations.

---

### File: src/lib/writeBatcher.ts

- **Current Coverage**: 
  - Statements: 92.95%
  - Branches: 93.1%
  - Functions: 73.68%
  - Lines: 94.28%
- **Target**: 100% for all metrics
- **Uncovered Items**:
  - Lines 107-109: Recursive flush timer setup when more writes are queued after flush
  - Line 154: `flushAll()` wait loop when flushing is in progress
- **Analysis**:
  - **Lines 107-109**: After a flush completes, if there are more writes in the queue, a new flush timer is scheduled. This recursive flush path is not covered.
  - **Line 154**: When `flushAll()` is called while a flush is already in progress, it waits in a loop until the current flush completes. This concurrent flush path is not covered.
  - **Why not covered**: 
    - Tests probably don't trigger writes during an active flush
    - Tests probably don't call `flushAll()` while a flush is in progress
- **Classification**: **A) Reachable via existing public API** - Can test by controlling write timing and flush calls
- **What's Needed to Reach 100%**:
  - Test write batcher with writes queued during flush (should schedule another flush)
  - Test `flushAll()` when already flushing (should wait for current flush to complete)
- **Test Approach**:
  - Use existing test file: `test/lib/writeBatcher.test.ts`
  - Test scenarios:
    1. Queue writes, trigger flush, then queue more writes before flush completes - should schedule another flush
    2. Start a flush, then call `flushAll()` before flush completes - should wait and then flush all
- **Evidence**: WriteBatcher is public, can be tested with controlled timing.

---

### File: src/meta/yargs.ts

- **Current Coverage**: 
  - Statements: 100%
  - Branches: 87.5%
  - Functions: 100%
  - Lines: 100%
- **Target**: 100% for all metrics
- **Uncovered Items**:
  - Line 44: Option processing branch when `option` is falsy/null
- **Analysis**:
  - **Line 44**: The branch when `option` is falsy/null in the `getOptions()` function. This happens when iterating over options and an option is undefined or null.
  - **Why not covered**: Tests probably don't create scenarios where options are undefined or null in the options object.
- **Classification**: **A) Reachable via existing public API** - Can test by calling `getOptions()` with modified options object
- **What's Needed to Reach 100%**:
  - Test `getOptions()` with options object containing undefined/null values
- **Test Approach**:
  - Use existing test file: `test/meta/yargs.test.ts`
  - Test scenarios:
    1. Create options object with undefined/null values, call `getOptions()` - should handle gracefully
- **Evidence**: `getOptions()` is used internally but can be tested directly.

---

### File: src/party/combine.ts

- **Current Coverage**: 
  - Statements: 88.63%
  - Branches: 76.06%
  - Functions: 95.12%
  - Lines: 88.05%
- **Target**: 100% for all metrics
- **Uncovered Items**:
  - Line 6: Import statement (likely not a real coverage issue, may be false positive)
  - Line 893: `jsonToBuild = that.#json` - when no root is defined
  - Line 913: `global.logger?.error(...)` - error message logging path
  - Line 1028: `return json as Record<string, unknown>` - when json is not an object or is an array
- **Analysis**:
  - **Line 6**: Import statement - likely a false positive or edge case in coverage tool
  - **Line 893**: When combining metadata, if no root is defined in the metadata definition, the JSON is used as-is without wrapping. This path is not covered.
  - **Line 913**: Error message logging when `#errorMessage` is not empty. This error path is not covered.
  - **Line 1028**: In `arrangeKeys()`, when json is not an object or is an array, it returns early. This path is not covered.
  - **Why not covered**: 
    - Line 893: Tests probably always use metadata types with root definitions
    - Line 913: Tests probably don't trigger error conditions that set `#errorMessage`
    - Line 1028: Tests probably always pass objects to `arrangeKeys()`, not arrays or primitives
- **Classification**: 
  - Line 893: **A) Reachable via existing public API** - Can test with metadata types without root
  - Line 913: **D) Error-only paths** - Need to trigger error conditions during combine
  - Line 1028: **A) Reachable via existing public API** - Can test with arrays/primitives
- **What's Needed to Reach 100%**:
  - Test combine with metadata type that has no root definition
  - Test combine with error conditions (invalid YAML, missing files, etc.)
  - Test `arrangeKeys()` with arrays and primitives
- **Test Approach**:
  - Use existing test file: `test/party/combine.test.ts`
  - Test scenarios:
    1. Create metadata definition without root, test combine - should use JSON as-is
    2. Test combine with invalid YAML files - should set error message and log error
    3. Test `arrangeKeys()` with array input - should return early
    4. Test `arrangeKeys()` with primitive input - should return early
- **Fixtures Needed**:
  - Invalid YAML files for combine
  - Metadata definition without root
- **Evidence**: Combine class is public, can be tested with various configurations.

---

### File: src/party/split.ts

- **Current Coverage**: 
  - Statements: 88.82%
  - Branches: 74.69%
  - Functions: 100%
  - Lines: 88.51%
- **Target**: 100% for all metrics
- **Uncovered Items**:
  - Line 83: `set metadataDefinition(...)` - setter method
  - Line 844: `throw error` - error re-throw in keySort
  - Lines 893-903: Error handling in `convertBooleanValue()` when error is not the specific "Cannot convert object to primitive value" error
- **Analysis**:
  - **Line 83**: The setter for `metadataDefinition` is not covered. This happens when the metadata definition is changed after object creation.
  - **Line 844**: Error re-throw in `keySort()` when processing keys fails. This error path is not covered.
  - **Lines 893-903**: Error handling in `convertBooleanValue()` for errors other than "Cannot convert object to primitive value". This path handles unexpected errors during boolean conversion.
  - **Why not covered**: 
    - Line 83: Tests probably always set metadata definition in constructor
    - Line 844: Tests probably don't trigger errors in keySort processing
    - Lines 893-903: Tests probably don't trigger unexpected errors during boolean conversion
- **Classification**: 
  - Line 83: **A) Reachable via existing public API** - Can test by setting metadataDefinition after construction
  - Line 844: **D) Error-only paths** - Need to trigger errors in keySort
  - Lines 893-903: **D) Error-only paths** - Need to trigger unexpected errors in boolean conversion
- **What's Needed to Reach 100%**:
  - Test setting `metadataDefinition` after object creation
  - Test `keySort()` with data that triggers errors (malformed objects, etc.)
  - Test `convertBooleanValue()` with values that trigger unexpected errors
- **Test Approach**:
  - Use existing test file: `test/party/split.test.ts`
  - Test scenarios:
    1. Create Split object, then set `metadataDefinition` - should update internal state
    2. Test split with malformed JSON that triggers keySort errors - should throw error
    3. Test `convertBooleanValue()` with values that cause unexpected errors - should handle gracefully
- **Fixtures Needed**:
  - Malformed JSON/YAML files that trigger keySort errors
  - Values that cause unexpected errors in boolean conversion
- **Evidence**: Split class is public, can be tested with various configurations.

---

## Summary

All uncovered code is classified as either:
- **A) Reachable via existing public API** (most cases) - Can be tested directly through public functions
- **D) Error-only paths** (some cases) - Need targeted tests with invalid input or error conditions

**No refactoring needed** - All code can be reached through existing public APIs or error conditions. The main work is writing comprehensive tests that cover:
1. Edge cases (cache hits/misses, empty arrays, undefined values)
2. Error paths (invalid input, parsing errors, file system errors)
3. Alternative code paths (different metadata configurations, operation types)
