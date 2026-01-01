# Test Plan Orchestration

**Purpose**: Generate a complete test plan and drive implementation to maximize meaningful test coverage (target ~100% where reasonable).

**Execution**: Execute this prompt via `@prompts/TESTPLAN.md` in Cursor.

**Output Location**: All artifacts go under `.testplan/run/` (assumed gitignored).

**Single Entrypoint**: After execution, only `.testplan/run/TRIAGE.md` is needed for triage.

---

## PHASE 0 — Baseline & Commands

**Goal**: Establish baseline understanding of the repository structure and available tooling.

### Tasks

1. **Detect Test Framework**
   - Read `package.json` to identify test framework (Vitest, Jest, Bun test, etc.)
   - Read test configuration files (e.g., `vitest.config.js`, `jest.config.js`)
   - Identify test command, coverage command, lint command, typecheck command, build command

2. **Analyze Repository Structure**
   - List source directories (`src/`, `lib/`, etc.)
   - List test directories (`test/`, `tests/`, `__tests__/`, etc.)
   - Identify entry points (CLI, library exports)

3. **Verify All Tests Pass (REQUIRED)**
   - Run: `bun test` (or detected test command)
   - **CRITICAL**: All tests must pass before proceeding
   - If any tests fail, document failures in `.testplan/run/logs/baseline-test-failures.log`
   - Save full test output to `.testplan/run/logs/baseline-test.log`
   - **STOP**: If tests fail, fix them first before continuing to PHASE 1

4. **Count Current Tests**
   - Extract test count from the test run output
   - Note number of test files and test cases

5. **Check Current Coverage (if available)**
   - Attempt to run coverage command
   - If coverage data exists, note current state
   - Save output to `.testplan/run/logs/baseline-coverage.log`

6. **Write Baseline Report**
   Create `.testplan/run/BASELINE.md` with:
   ```markdown
   # Baseline Report

   ## Repository Structure
   [Brief overview: source dirs, test dirs, entry points]

   ## Detected Commands
   - **Test**: `[command]`
   - **Coverage**: `[command]`
   - **Lint**: `[command]`
   - **Typecheck**: `[command]`
   - **Build**: `[command]`

   ## Test Status
   - **All Tests Pass**: ✅ Yes / ❌ No
   - **Test Count**: [Number of test files, number of test cases]
   - **Failures** (if any): [List of failing tests or "None"]

   ## Current Coverage (if available)
   [Summary of existing coverage, or "Not yet measured"]

   ## Test Framework
   [Framework name and version]

   ## Configuration Notes
   [Any relevant config exclusions, coverage provider, etc.]
   ```

---

## PHASE 1 — Coverage Measurement (Real, Not Guessy)

**Goal**: Obtain accurate, real coverage data using the project's actual tooling and identify ALL files that are not at 100% coverage.

### Tasks

1. **Run Coverage Command**
   - Execute the detected coverage command (e.g., `bun run test:coverage`)
   - Save full stdout/stderr to `.testplan/run/logs/coverage.log`
   - Ensure coverage output is generated (HTML, JSON, text, etc.)

2. **Extract Coverage Data**
   - Read coverage JSON if available (e.g., `coverage/coverage-final.json`)
   - If JSON not available, parse text/HTML output
   - Identify per-file coverage percentages
   - Identify per-function/branch coverage where available

3. **Identify Files Not at 100% Coverage**
   - **PRIMARY FOCUS**: List ALL files that are not at 100% coverage (any metric: statements, branches, functions, or lines)
   - Sort files by coverage (lowest first)
   - For each file not at 100%, identify:
     - Which metrics are below 100% (statements, branches, functions, lines)
     - Specific functions/branches with less than 100% coverage
     - Exact coverage percentages for each metric
   - Also note:
     - Files with 0% coverage
     - Files with <50% coverage
     - Files with <80% coverage
     - Files with 80-99% coverage (still need attention)

4. **Write Coverage Summary**
   Create `.testplan/run/COVERAGE_SUMMARY.md` with:
   ```markdown
   # Coverage Summary

   ## Overall Coverage
   - **Statements**: [X]%
   - **Branches**: [X]%
   - **Functions**: [X]%
   - **Lines**: [X]%

   ## Coverage by File
   | File | Statements | Branches | Functions | Lines | Status |
   |------|------------|----------|-----------|-------|--------|
   | [file] | [%] | [%] | [%] | [%] | ✅ 100% / ⚠️ <100% |
   ...

   ## Files Not at 100% Coverage (PRIMARY FOCUS)
   [List ALL files that are not at 100% for ANY metric, sorted by lowest coverage first]
   - For each file, show which metrics are below 100% and by how much
   - Include specific functions/branches that need coverage

   ## Coverage Breakdown
   - **Files at 100%**: [count]
   - **Files at 80-99%**: [count and list]
   - **Files at 50-79%**: [count and list]
   - **Files at <50%**: [count and list]
   - **Files at 0%**: [count and list]

   ## Zero Coverage Functions/Branches
   [Specific functions/branches with 0% coverage]

   ## Coverage Exclusions (from config)
   [Files excluded in coverage config, with justification if available]

   ## Raw Coverage Data Location
   - Logs: `.testplan/run/logs/coverage.log`
   - Coverage reports: `coverage/` (if HTML/JSON generated)
   ```

---

## PHASE 2 — "Hard to Reach" Root Cause Analysis

**Goal**: For each file/function/branch that is NOT at 100% coverage, investigate why it's not fully covered and determine what is needed to reach 100% coverage.

### CRITICAL: Code Correctness Verification (MUST DO FIRST)

**Before classifying uncovered code, you MUST verify the code actually works as intended:**

1. **For Each Uncovered Line/Branch**:
   - Read the code and understand what it's supposed to do
   - **Verify the code logic is correct** - check for logic bugs that prevent execution
   - Test the code manually or with a simple script to see if it actually executes
   - Check if conditions can ever be true (e.g., `if (x !== x)` will never execute)
   - Verify dependencies and state (e.g., cache, module-level variables) work as expected

2. **Common Logic Bugs to Check**:
   - Conditions that are always false (e.g., `if (sanitized !== str)` when they're always equal)
   - Module-level state that never gets set (e.g., cache that never populates)
   - Type comparisons that can never match
   - String comparisons with Unicode escapes that are identical in JavaScript
   - Dead code paths due to impossible conditions

3. **If Logic Bug Found**:
   - **FIX THE BUG FIRST** before writing tests
   - Document the bug in the reachability analysis
   - Then proceed with test writing
   - **DO NOT** write tests for unreachable code caused by bugs

4. **Verification Steps**:
   ```bash
   # For functions: Test manually
   node -e "const {func} = require('./dist/lib/file.js'); console.log(func('test'))"
   
   # For cache/state: Check if it actually populates
   node -e "const {func, getState} = require('./dist/lib/file.js'); func('test'); console.log(getState())"
   
   # For conditions: Verify they can be true
   node -e "const x = 'test'; const y = x.replace(/a/g, '\\u0061'); console.log(x === y)" # Should show if condition can be true
   ```

### Classification Categories

- **A) Reachable via existing public API/CLI path** → Write tests using public entrypoints
- **B) Reachable only with controlled dependencies** → Introduce test seams (dependency injection, mocks, fakes)
- **C) Truly unreachable** → Propose delete/refactor (dead code, impossible branch, legacy path, **OR LOGIC BUG**)
- **D) Error-only paths** → Write tests using targeted fakes/mocks to trigger exceptions
- **E) Environment-conditional code** → Write tests by simulating environment (platform, env vars, TTY)

### Tasks

1. **For Each File Not at 100% Coverage**:
   - Read the source file completely
   - Identify specific uncovered lines, branches, and functions
   - **CRITICAL: Verify code correctness first** (see "Code Correctness Verification" above)
   - **If logic bug found, fix it before proceeding**
   - Trace call paths (who calls this? from where?)
   - Identify dependencies (fs, process, network, time, TTY, env vars)
   - For each uncovered item:
     - **First**: Verify the code can actually execute (not a logic bug)
     - Determine why it's not covered
     - Classify into category A–E (use Category C if it's a logic bug)
     - Determine what is needed to reach 100% coverage (fix bug first if needed)
     - Identify specific test scenarios needed

2. **For Category B (Dependency-Controlled)**:
   - Identify exact dependencies that need to be controlled
   - Propose minimal refactor (dependency injection, adapter layer, pure function extraction)
   - Ensure behavior-preserving

3. **For Category C (Unreachable or Logic Bug)**:
   - Prove unreachability (no callers, impossible conditions, legacy code, **OR LOGIC BUG**)
   - **If logic bug**: Fix the bug first, then write tests
   - **If truly unreachable**: Propose deletion or refactor to remove dead code
   - If refactor, ensure behavior-preserving

4. **For Category D (Error Paths)**:
   - Identify how to trigger the error (invalid input, network failure, fs error, etc.)
   - Propose test approach (mocks, fakes, invalid data)

5. **For Category E (Environment-Conditional)**:
   - Identify environment conditions (platform checks, env vars, TTY detection)
   - Propose test approach (env var mocking, platform simulation, TTY simulation)

6. **Write Reachability Analysis**
   Create `.testplan/run/REACHABILITY.md` with:
   ```markdown
   # Reachability Analysis

   ## Methodology
   For each file that is NOT at 100% coverage, we investigate:
   1. What specific code is not covered (lines, branches, functions)
   2. Why it's not covered
   3. What is needed to reach 100% coverage
   4. Classify each uncovered item and determine strategy

   ## Files Requiring Attention (Not at 100% Coverage)

   ### [File: path/to/file.ts]
   - **Current Coverage**: 
     - Statements: [X]%
     - Branches: [X]%
     - Functions: [X]%
     - Lines: [X]%
   - **Target**: 100% for all metrics
   - **Uncovered Items**:
     - [List specific uncovered lines, branches, functions]
   - **Code Correctness Verification**:
     - [Verify each uncovered item can actually execute]
     - [Check for logic bugs that prevent execution]
     - [Test manually if needed to verify behavior]
     - [If logic bug found, document and fix before proceeding]
   - **Analysis**:
     - [Why each uncovered item is not covered]
     - [What dependencies or conditions prevent coverage]
     - [If logic bug: describe the bug and fix]
   - **Classification**: [A/B/C/D/E for each uncovered item]
   - **What's Needed to Reach 100%**:
     - [Detailed strategy for each uncovered item]
     - [Specific test scenarios required]
   - **Required Refactor** (if any):
     - [Description of minimal, behavior-preserving refactor]
     - Files to modify: `[list]`
     - Verification: [test + typecheck + build commands]
   - **Test Approach**:
     - [How to write tests for each uncovered item]
     - [Fixtures/mocks needed]
     - [Verification command]
   - **Evidence**: [Code references, call traces, etc.]

   [Repeat for each file not at 100%]
   ```

---

## PHASE 3 — Refactor-for-Testability (Only When Needed)

**Goal**: Create APPLY prompts for minimal, behavior-preserving refactors that enable testability.

### Refactoring Principles

- **Behavior-preserving**: No functional changes, only structural
- **Minimal**: Smallest change that enables testing
- **Prefer**: Dependency injection, pure function extraction, adapter layers
- **Avoid**: Global state, hidden singletons, direct `process.exit` in core logic
- **For CLI tools**: Separate argument parsing, core transformation logic, IO boundaries

### Tasks

1. **Group Refactors by File**
   - Collect all refactors needed from PHASE 2
   - Group by file to minimize changes
   - Order refactors (dependencies first)

2. **Create APPLY Refactor Prompts**
   For each refactor group, create `.testplan/run/APPLY_REFACTOR-###.md`:
   ```markdown
   # Refactor: [Brief Description]

   ## Purpose
   [Why this refactor is needed for testability]

   ## Changes to Make

   ### File: `[path/to/file.ts]`
   [Detailed changes with code examples]
   - Extract pure function: `[function name]`
   - Add dependency injection: `[parameter name]`
   - Wrap IO operation: `[operation]` → `[wrapper]`
   - [Other changes]

   ## Files to Modify
   - `[file1.ts]`
   - `[file2.ts]`

   ## Acceptance Criteria
   - [ ] All existing tests pass
   - [ ] Typecheck passes: `bun run typecheck`
   - [ ] Build succeeds: `bun run build`
   - [ ] Lint passes: `bun run lint`
   - [ ] No behavior changes (verify with manual testing if needed)
   - [ ] Code is now testable (can write tests that reach previously unreachable code)

   ## Verification Commands
   ```bash
   bun run typecheck
   bun run build
   bun run lint
   bun test
   ```

   ## Notes
   [Any additional context, risks, or considerations]
   ```

3. **Number Refactors Sequentially**
   - Use format: `APPLY_REFACTOR-001.md`, `APPLY_REFACTOR-002.md`, etc.
   - Order by dependency (refactors that enable other refactors first)

---

## PHASE 4 — Test Authoring Plan

**Goal**: Create APPLY prompts for writing comprehensive tests.

### Test Authoring Principles

- **Coverage**: Happy paths, edge cases, error paths
- **Fixtures**: Use real fixtures where possible, minimal mocking
- **Avoid Brittle Snapshots**: Prefer assertions over snapshots, or use stable snapshots
- **Isolation**: Tests should be independent and runnable in any order
- **Performance**: Tests should run quickly

### Tasks

1. **Group Tests by File/Feature**
   - Collect all test needs from PHASE 2
   - Group by test file (one test file per source file typically)
   - Order tests (simple tests first, complex tests later)

2. **Create APPLY Test Prompts**
   For each test group, create `.testplan/run/APPLY_TESTS-###.md`:
   ```markdown
   # Tests: [Brief Description]

   ## Purpose
   [What code paths/features these tests will cover]

   ## Test File(s)
   - `test/[path/to/test.ts]` (new or update existing)

   ## Scenarios to Cover

   ### Happy Paths
   - [Scenario 1]
   - [Scenario 2]

   ### Edge Cases
   - [Edge case 1]
   - [Edge case 2]

   ### Error Paths
   - [Error scenario 1]
   - [Error scenario 2]

   ## Fixtures Strategy
   - [Use existing fixtures from `test/data/`]
   - [Create new fixtures: `test/data/[name]/`]
   - [Mock dependencies: `[list]`]
   - [Fake implementations: `[list]`]

   ## Test Implementation Notes
   - [Specific testing patterns to use]
   - [How to avoid brittle snapshots]
   - [How to handle async operations]
   - [How to simulate environment conditions]

   ## Expected Coverage Improvement
   - File: `[path]` from [X]% to [Y]%
   - Functions: `[list]` from 0% to 100%
   - Branches: `[list]` from 0% to 100%

   ## Verification Commands
   ```bash
   bun test [specific test file]
   bun run test:coverage
   ```

   ## Acceptance Criteria
   - [ ] All new tests pass
   - [ ] Coverage increases as expected
   - [ ] No flaky tests
   - [ ] Tests are fast (<1s per test file)
   - [ ] Tests are isolated and independent
   ```

3. **Number Test Prompts Sequentially**
   - Use format: `APPLY_TESTS-001.md`, `APPLY_TESTS-002.md`, etc.
   - Order by dependency (tests that don't require refactors first)

---

## PHASE 5 — Orchestrator (TRIAGE.md)

**Goal**: Create the single entrypoint that orders all work and includes diagnostics gates.

### Tasks

1. **Collect All APPLY Files**
   - List all `APPLY_REFACTOR-###.md` files (in order)
   - List all `APPLY_TESTS-###.md` files (in order)

2. **Determine Execution Order**
   - Refactors must come before tests that depend on them
   - Tests that don't require refactors can come first
   - Group by logical feature/area where possible

3. **Define Diagnostics Gates**
   After each APPLY:
   - Run tests: `bun test`
   - Run typecheck: `bun run typecheck`
   - Run build: `bun run build`
   - Run lint: `bun run lint`
   - Treat warnings as work to fix (no ignoring)

4. **Define Stop Conditions**
   - **REQUIRED**: All tests must pass (`bun test` must exit with success)
   - Coverage target reached (~100% where reasonable)
   - OR remaining gap is justified (unreachable, not worth risk)
   - Justification must be written to `.testplan/run/EXCEPTIONS.md`
   - **CRITICAL**: Work is NOT complete until all tests pass—do not leave failed tests

5. **Write TRIAGE.md**
   Create `.testplan/run/TRIAGE.md`:
   ```markdown
   # Test Plan Triage

   **Generated**: [timestamp]
   **Baseline Coverage**: [from BASELINE.md]
   **Target Coverage**: ~100% where reasonable

   ## Execution Order

   Execute each APPLY file in order. After each, run the Diagnostics Gate.

   ### Diagnostics Gate (After Each APPLY)
   ```bash
   bun test
   bun run typecheck
   bun run build
   bun run lint
   ```
   **Rules**:
   - **CRITICAL**: All commands must pass—especially `bun test`
   - **NO FAILED TESTS**: If `bun test` fails, you MUST fix the failures before proceeding
   - Warnings are treated as failures (fix them)
   - If any command fails, stop and fix before proceeding
   - Do not leave failed tests—the work is incomplete until all tests pass

   ### Phase 1: Refactors (if any)
   [List APPLY_REFACTOR files in order]
   1. `APPLY_REFACTOR-001.md` - [Brief description]
   2. `APPLY_REFACTOR-002.md` - [Brief description]
   ...

   ### Phase 2: Tests
   [List APPLY_TESTS files in order]
   1. `APPLY_TESTS-001.md` - [Brief description]
   2. `APPLY_TESTS-002.md` - [Brief description]
   ...

   ## Stop Conditions

   **REQUIRED BEFORE COMPLETION**: All tests must pass (`bun test` must exit with success)

   Continue until:
   - ✅ **ALL TESTS PASS** (`bun test` exits successfully)
   - ✅ Coverage target reached (~100% where reasonable)
   - OR
   - ✅ Remaining gap is justified (see EXCEPTIONS.md)

   **CRITICAL**: Do NOT consider the work complete if there are any failing tests. Fix all test failures before stopping.

   If stopping with remaining gaps, you MUST:
   1. **Verify all tests pass**: Run `bun test` and ensure it exits successfully
   2. Write `.testplan/run/EXCEPTIONS.md` with evidence for each gap
   3. Re-run coverage to verify current state
   4. Update COVERAGE_SUMMARY.md with final numbers

   ## Final Verification

   **REQUIRED**: After all APPLY files are complete, you MUST verify everything passes:

   ```bash
   bun test
   bun run test:coverage
   bun run typecheck
   bun run build
   bun run lint
   ```

   **CRITICAL REQUIREMENTS**:
   - ✅ **ALL TESTS MUST PASS**: `bun test` must exit with success (exit code 0)
   - ✅ No test failures, no skipped tests that should run
   - ✅ All other commands must pass
   - ✅ Compare final coverage to baseline
   - ✅ Document any exceptions in EXCEPTIONS.md

   **DO NOT STOP UNTIL ALL TESTS PASS**: If any tests fail, you must fix them. The work is incomplete and unacceptable if there are failing tests.

   ## Related Files

   - Baseline: `.testplan/run/BASELINE.md`
   - Coverage Summary: `.testplan/run/COVERAGE_SUMMARY.md`
   - Reachability Analysis: `.testplan/run/REACHABILITY.md`
   - Exceptions (if any): `.testplan/run/EXCEPTIONS.md`
   - Logs: `.testplan/run/logs/`
   ```

6. **Create EXCEPTIONS Template** (if needed later)
   If there are known unreachable paths, create `.testplan/run/EXCEPTIONS.md`:
   ```markdown
   # Coverage Exceptions

   This document justifies code that is intentionally not covered by tests.

   ## Unreachable Code

   ### [File: path/to/file.ts] - [Function/Branch]
   - **Coverage**: [X]%
   - **Justification**: [Why this code cannot be reached or is not worth testing]
   - **Evidence**: [Code references, analysis, etc.]
   - **Risk Assessment**: [Low/Medium/High risk of not testing]

   [Repeat for each exception]
   ```

---

## Execution Instructions

When executing this prompt:

1. **Create Output Directory**
   ```bash
   mkdir -p .testplan/run/logs
   ```

2. **Execute Each Phase Sequentially**
   - PHASE 0 → PHASE 1 → PHASE 2 → PHASE 3 → PHASE 4 → PHASE 5
   - **CRITICAL**: In PHASE 0, ensure ALL tests pass before proceeding
   - **FOCUS**: In PHASE 1, identify ALL files not at 100% coverage
   - **INVESTIGATE**: In PHASE 2, investigate each file not at 100% to determine what's needed
   - Save all outputs to `.testplan/run/`
   - Do not modify `prompts/TESTPLAN.md` (it is committed and immutable)

3. **After Execution**
   - Verify `.testplan/run/TRIAGE.md` exists and is complete
   - User will then execute: "Triage @.testplan/run/TRIAGE.md"
   - **CRITICAL**: When executing TRIAGE.md, ensure all tests pass at the end—do not leave failed tests

---

## Output Files Summary

**Required** (always generated):
- `.testplan/run/BASELINE.md`
- `.testplan/run/COVERAGE_SUMMARY.md`
- `.testplan/run/REACHABILITY.md`
- `.testplan/run/TRIAGE.md`
- `.testplan/run/logs/coverage.log`
- `.testplan/run/logs/baseline-test.log`
- `.testplan/run/logs/baseline-coverage.log`

**Optional** (generated as needed):
- `.testplan/run/APPLY_REFACTOR-###.md` (one per refactor group)
- `.testplan/run/APPLY_TESTS-###.md` (one per test group)
- `.testplan/run/EXCEPTIONS.md` (if gaps remain)

---

## Notes

- This prompt is **committed and immutable**—never modify it during runs
- All run artifacts are under `.testplan/run/` (assumed gitignored)
- The single entrypoint is `.testplan/run/TRIAGE.md`
- **CRITICAL**: All tests must pass before starting coverage analysis
- **CRITICAL**: All tests must pass after TRIAGE execution—do not leave failed tests
- **PRIMARY GOAL**: Identify ALL files not at 100% coverage and investigate what's needed to reach 100%
- Treat "hard to reach" code as an investigation, not an excuse
- Refactors must be minimal and behavior-preserving
- Tests should be meaningful, not just coverage-driven
- Diagnostics gates ensure quality at each step
- Focus on files at 80-99% coverage as well as lower coverage files—all need to reach 100%
- **NO FAILED TESTS**: The work is incomplete and unacceptable if there are any failing tests at the end

## Known Intentional Patterns (DO NOT REFACTOR)

These code patterns are intentional and should NOT be refactored or removed during test plan execution:

### YAML Parsing Error Handling (src/lib/fileUtils.ts, lines 434-476)

**CRITICAL**: The try-catch wrapper around `yaml.load()` in `readFile()` is REQUIRED and must NOT be removed or refactored.

**Location**: `src/lib/fileUtils.ts`, lines 434-476 (the try-catch block wrapping `yaml.load()`)

**Why This Exists**:
- js-yaml has two error paths:
  1. **Warnings**: Calls `onWarning` callback → gets "YAML parsing" prefix from callback
  2. **Errors**: Throws directly (e.g., duplicate keys, invalid syntax) → does NOT call `onWarning`
- When js-yaml encounters duplicate keys or other fatal errors, it throws directly WITHOUT calling `onWarning`
- Without the try-catch wrapper, these direct throws lack the "YAML parsing" prefix
- The test `test/lib/file/fileIO.test.ts` "should handle YAML parsing warnings" requires this prefix

**What the Code Does**:
- Wraps `yaml.load()` in try-catch to catch ALL YAML errors (both from `onWarning` and direct throws)
- Ensures all YAML parsing errors have consistent "YAML parsing" prefix
- Checks if error already includes "YAML parsing" to avoid double-wrapping

**DO NOT**:
- Remove the try-catch wrapper
- Refactor it into a separate function (it needs to be inline to catch direct throws)
- Simplify it by removing the error message check
- "Fix" it by assuming `onWarning` always gets called

**Documentation**: See extensive comments in `src/lib/fileUtils.ts` lines 434-456 explaining this pattern.

**Test**: `test/lib/file/fileIO.test.ts` - "should handle YAML parsing warnings (line 437)"

**History**: This has been fixed multiple times. See git history for context. The try-catch wrapper is the correct solution.

