# Baseline Report

## Repository Structure

**Source Directories:**
- `src/` - Main source code
  - `src/lib/` - Core library utilities (11 files)
  - `src/meta/` - Metadata type definitions (6 files)
  - `src/party/` - Split and combine operations (2 files)
  - `src/types/` - Type definitions (2 files)
  - `src/index.ts` - CLI entry point

**Test Directories:**
- `test/` - Test files mirroring source structure
  - `test/lib/` - Tests for library utilities
  - `test/meta/` - Tests for metadata definitions
  - `test/party/` - Tests for split/combine operations
  - `test/src/` - Tests for CLI entry point

**Entry Points:**
- CLI: `src/index.ts` (bin: `sfparty`)
- Library: `dist/index.js` (main export)

## Detected Commands

- **Test**: `bun run test` (runs `bun run build && vitest run --maxWorkers=1`)
- **Coverage**: `bun run test:coverage` (runs `bun run build && vitest run --coverage --maxWorkers=1`)
- **Lint**: `bun run lint` (runs `biome check --max-diagnostics=1000 src/ test/`)
- **Typecheck**: `bun run typecheck` (runs `tsc --noEmit`)
- **Build**: `bun run build` (runs `tsc`)

## Test Status

- **All Tests Pass**: ✅ Yes
- **Test Count**: 41 test files, 730 test cases
- **Failures**: None

## Current Coverage

**Overall Coverage:**
- Statements: 92.8%
- Branches: 82%
- Functions: 94.17%
- Lines: 92.74%

**Coverage by Directory:**
- `src/lib/`: 96.32% statements, 90.95% branches, 91.72% functions, 96.54% lines
- `src/meta/`: 100% statements, 87.5% branches, 100% functions, 100% lines
- `src/party/`: 88.73% statements, 75.45% branches, 97.64% functions, 88.3% lines
- `src/`: 0% (excluded: `src/index.ts`, `src/index.d.ts`)
- `src/types/`: 0% (type definition files)

**Files Not at 100% Coverage:**
1. `src/lib/pathUtils.ts` - 80% statements, 66.66% branches, 100% functions, 77.77% lines (uncovered: 13, 28)
2. `src/lib/fileUtils.ts` - 90.28% statements, 83.17% branches, 80% functions, 90.11% lines (uncovered: ...22,437,483,548)
3. `src/lib/packageUtil.ts` - 100% statements, 90.24% branches, 100% functions, 100% lines (uncovered branches: ...56,247-248,322)
4. `src/lib/performanceLogger.ts` - 99.25% statements, 89.28% branches, 100% functions, 100% lines (uncovered: ...09,328,375,381)
5. `src/lib/writeBatcher.ts` - 92.95% statements, 93.1% branches, 73.68% functions, 94.28% lines (uncovered: 107-109,154)
6. `src/meta/yargs.ts` - 100% statements, 87.5% branches, 100% functions, 100% lines (uncovered: 44)
7. `src/party/combine.ts` - 88.63% statements, 76.06% branches, 95.12% functions, 88.05% lines (uncovered: ...6,893,913,1028)
8. `src/party/split.ts` - 88.82% statements, 74.69% branches, 100% functions, 88.51% lines (uncovered: ...83,844,893-903)

**Files at 100% Coverage:**
- `src/lib/checkVersion.ts`
- `src/lib/errorUtils.ts`
- `src/lib/gitUtils.ts`
- `src/lib/pkgObj.ts`
- `src/lib/terminalUtils.ts`
- `src/meta/CustomLabels.ts`
- `src/meta/Package.ts`
- `src/meta/PermissionSets.ts`
- `src/meta/Profiles.ts`
- `src/meta/Workflows.ts`

**Excluded Files (from vitest.config.js):**
- `src/index.ts` - CLI entry point (requires integration testing)
- `src/lib/tui.ts` - TUI requires TTY and is difficult to test in CI
- `src/lib/tuiProgressTracker.ts` - TUI tracker requires TTY and is difficult to test in CI

## Test Framework

- **Framework**: Vitest v4.0.10
- **Coverage Provider**: v8
- **Test Environment**: Node
- **Max Workers**: 1 (configured for isolation)
- **Setup File**: `test/setup.ts`

## Configuration Notes

- Coverage includes: `src/**/*.ts`
- Coverage excludes: `src/index.ts`, `src/lib/tui.ts`, `src/lib/tuiProgressTracker.ts`
- Test files are isolated (`isolate: true`)
- Coverage reporters: text, html, clover, json
- TypeScript strict mode enabled
- Build output: `dist/`
