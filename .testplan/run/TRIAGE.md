# Test Plan Triage

**Generated**: 2026-01-01 19:43:59 UTC
**Baseline Coverage**: 92.8% statements, 82% branches, 94.17% functions, 92.74% lines
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

**No refactors needed** - All uncovered code is reachable via existing public APIs or error conditions. See REACHABILITY.md for details.

### Phase 2: Tests

1. `APPLY_TESTS-001.md` - pathUtils.ts Cache Coverage
   - Cover memoization cache paths in `replaceSpecialChars()`
   - Target: `src/lib/pathUtils.ts` from 80% statements, 66.66% branches to 100%

2. `APPLY_TESTS-002.md` - fileUtils.ts Edge Cases and Error Paths
   - Cover write batcher null return, YAML warnings, XML errors, find() directory edge case
   - Target: `src/lib/fileUtils.ts` from 90.28% statements, 83.17% branches, 80% functions to 100%

3. `APPLY_TESTS-003.md` - packageUtil.ts Branch Coverage
   - Cover sort comparison with equal names and xml2json single-element array handling
   - Target: `src/lib/packageUtil.ts` from 100% statements, 90.24% branches to 100%

4. `APPLY_TESTS-004.md` - performanceLogger.ts Edge Cases
   - Cover empty slowestFiles, no logFile, undefined duration, write/save operations
   - Target: `src/lib/performanceLogger.ts` from 99.25% statements, 89.28% branches to 100%

5. `APPLY_TESTS-005.md` - writeBatcher.ts Concurrent Flush Paths
   - Cover recursive flush timer and concurrent flushAll() wait loop
   - Target: `src/lib/writeBatcher.ts` from 92.95% statements, 93.1% branches, 73.68% functions to 100%

6. `APPLY_TESTS-006.md` - yargs.ts Option Processing Edge Case
   - Cover option processing when option is falsy/null
   - Target: `src/meta/yargs.ts` from 100% statements, 87.5% branches to 100%

7. `APPLY_TESTS-007.md` - combine.ts Edge Cases and Error Paths
   - Cover no root definition, error message logging, arrangeKeys() edge cases
   - Target: `src/party/combine.ts` from 88.63% statements, 76.06% branches, 95.12% functions to 100%

8. `APPLY_TESTS-008.md` - split.ts Setter and Error Paths
   - Cover metadataDefinition setter, keySort error re-throw, convertBooleanValue error handling
   - Target: `src/party/split.ts` from 88.82% statements, 74.69% branches to 100%

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
