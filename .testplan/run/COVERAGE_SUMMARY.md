# Coverage Summary

## Overall Coverage

- **Statements**: 92.8%
- **Branches**: 82%
- **Functions**: 94.17%
- **Lines**: 92.74%

## Coverage by File

| File | Statements | Branches | Functions | Lines | Status |
|------|------------|----------|-----------|-------|--------|
| src/lib/checkVersion.ts | 100% | 100% | 100% | 100% | ✅ 100% |
| src/lib/errorUtils.ts | 100% | 100% | 100% | 100% | ✅ 100% |
| src/lib/gitUtils.ts | 100% | 100% | 100% | 100% | ✅ 100% |
| src/lib/pkgObj.ts | 100% | 100% | 100% | 100% | ✅ 100% |
| src/lib/terminalUtils.ts | 100% | 100% | 100% | 100% | ✅ 100% |
| src/meta/CustomLabels.ts | 100% | 100% | 100% | 100% | ✅ 100% |
| src/meta/Package.ts | 100% | 100% | 100% | 100% | ✅ 100% |
| src/meta/PermissionSets.ts | 100% | 100% | 100% | 100% | ✅ 100% |
| src/meta/Profiles.ts | 100% | 100% | 100% | 100% | ✅ 100% |
| src/meta/Workflows.ts | 100% | 100% | 100% | 100% | ✅ 100% |
| src/lib/pathUtils.ts | 80% | 66.66% | 100% | 77.77% | ⚠️ <100% |
| src/lib/fileUtils.ts | 90.28% | 83.17% | 80% | 90.11% | ⚠️ <100% |
| src/lib/packageUtil.ts | 100% | 90.24% | 100% | 100% | ⚠️ <100% |
| src/lib/performanceLogger.ts | 99.25% | 89.28% | 100% | 100% | ⚠️ <100% |
| src/lib/writeBatcher.ts | 92.95% | 93.1% | 73.68% | 94.28% | ⚠️ <100% |
| src/meta/yargs.ts | 100% | 87.5% | 100% | 100% | ⚠️ <100% |
| src/party/combine.ts | 88.63% | 76.06% | 95.12% | 88.05% | ⚠️ <100% |
| src/party/split.ts | 88.82% | 74.69% | 100% | 88.51% | ⚠️ <100% |

## Files Not at 100% Coverage (PRIMARY FOCUS)

### 1. src/lib/pathUtils.ts
- **Current Coverage**: 
  - Statements: 80%
  - Branches: 66.66%
  - Functions: 100%
  - Lines: 77.77%
- **Uncovered Lines**: 13, 28
- **Analysis**: 
  - Line 13: Cache hit path (`return sanitizedPathCache.get(str)!`)
  - Line 28: Cache set path when string actually changed (`sanitizedPathCache.set(str, sanitized)`)
- **What's Needed**: Tests that exercise the cache (hit and miss scenarios)

### 2. src/lib/fileUtils.ts
- **Current Coverage**: 
  - Statements: 90.28%
  - Branches: 83.17%
  - Functions: 80%
  - Lines: 90.11%
- **Uncovered Lines**: 22, 437, 483, 548
- **Analysis**:
  - Line 22: `getWriteBatcher()` returning `null` when batcher not initialized
  - Line 437: YAML parsing warning handler (`throw new Error(\`YAML parsing ${filePath}: ${warning}\`)`)
  - Line 483: Error re-throw in `convertXML()` function
  - Line 548: `findFile()` when `stat()` exists but `isFile()` returns false (directory exists but is not a file)
- **What's Needed**: 
  - Test `getWriteBatcher()` when not initialized
  - Test YAML parsing with warnings
  - Test XML parsing error paths
  - Test `find()` when directory exists but is not a file

### 3. src/lib/packageUtil.ts
- **Current Coverage**: 
  - Statements: 100%
  - Branches: 90.24%
  - Functions: 100%
  - Lines: 100%
- **Uncovered Branches**: 56, 247-248, 322
- **Analysis**:
  - Line 56: Branch in package processing logic
  - Lines 247-248: Sort comparison branches (`if ((a.name || '') < (b.name || ''))` and `if ((a.name || '') > (b.name || ''))`)
  - Line 322: `xml2json()` array handling branch (`if (value.length === 1)`)
- **What's Needed**: 
  - Test package sorting with equal names
  - Test `xml2json()` with single-element arrays

### 4. src/lib/performanceLogger.ts
- **Current Coverage**: 
  - Statements: 99.25%
  - Branches: 89.28%
  - Functions: 100%
  - Lines: 100%
- **Uncovered Lines**: 309, 328, 375, 381
- **Analysis**: Need to examine specific lines to determine uncovered paths
- **What's Needed**: Identify and test uncovered error/edge case paths

### 5. src/lib/writeBatcher.ts
- **Current Coverage**: 
  - Statements: 92.95%
  - Branches: 93.1%
  - Functions: 73.68%
  - Lines: 94.28%
- **Uncovered Lines**: 107-109, 154
- **Analysis**:
  - Lines 107-109: Recursive flush timer setup when more writes are queued after flush
  - Line 154: `flushAll()` wait loop when flushing is in progress
- **What's Needed**: 
  - Test write batcher with writes queued during flush
  - Test `flushAll()` when already flushing

### 6. src/meta/yargs.ts
- **Current Coverage**: 
  - Statements: 100%
  - Branches: 87.5%
  - Functions: 100%
  - Lines: 100%
- **Uncovered Line**: 44
- **Analysis**:
  - Line 44: Option processing branch when `option` is falsy/null
- **What's Needed**: Test `getOptions()` with invalid or missing option configurations

### 7. src/party/combine.ts
- **Current Coverage**: 
  - Statements: 88.63%
  - Branches: 76.06%
  - Functions: 95.12%
  - Lines: 88.05%
- **Uncovered Lines**: 6, 893, 913, 1028
- **Analysis**: Need to examine specific lines to determine uncovered paths
- **What's Needed**: Identify and test uncovered error/edge case paths in combine operation

### 8. src/party/split.ts
- **Current Coverage**: 
  - Statements: 88.82%
  - Branches: 74.69%
  - Functions: 100%
  - Lines: 88.51%
- **Uncovered Lines**: 83, 844, 893-903
- **Analysis**: Need to examine specific lines to determine uncovered paths
- **What's Needed**: Identify and test uncovered error/edge case paths in split operation

## Coverage Breakdown

- **Files at 100%**: 10 files
- **Files at 80-99%**: 8 files
  - src/lib/pathUtils.ts (80% statements, 66.66% branches)
  - src/lib/fileUtils.ts (90.28% statements, 83.17% branches)
  - src/lib/packageUtil.ts (100% statements, 90.24% branches)
  - src/lib/performanceLogger.ts (99.25% statements, 89.28% branches)
  - src/lib/writeBatcher.ts (92.95% statements, 93.1% branches)
  - src/meta/yargs.ts (100% statements, 87.5% branches)
  - src/party/combine.ts (88.63% statements, 76.06% branches)
  - src/party/split.ts (88.82% statements, 74.69% branches)
- **Files at 50-79%**: 0 files
- **Files at <50%**: 0 files
- **Files at 0%**: 0 files (excluding intentionally excluded files)

## Zero Coverage Functions/Branches

- **writeBatcher.ts**: Some functions not fully covered (73.68% function coverage)
- **fileUtils.ts**: Some functions not fully covered (80% function coverage)
- **combine.ts**: Some functions not fully covered (95.12% function coverage)

## Coverage Exclusions (from config)

Files excluded in `vitest.config.js`:
- `src/index.ts` - CLI entry point (requires integration testing)
- `src/lib/tui.ts` - TUI requires TTY and is difficult to test in CI
- `src/lib/tuiProgressTracker.ts` - TUI tracker requires TTY and is difficult to test in CI

**Justification**: These files require interactive TTY or full CLI integration testing, which is difficult to test in automated CI environments.

## Raw Coverage Data Location

- Logs: `.testplan/run/logs/coverage.log`
- Coverage reports: `coverage/` (HTML/JSON generated)
- Coverage JSON: `coverage/coverage-final.json`
