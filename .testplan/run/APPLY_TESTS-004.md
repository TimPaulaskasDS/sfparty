# Tests: performanceLogger.ts Edge Cases

## Purpose

Cover uncovered lines in `performanceLogger.ts`: empty slowestFiles, no logFile, undefined duration, and write/save operations.

## Test File(s)

- `test/lib/performanceLogger.test.ts` (update existing)

## Scenarios to Cover

### Empty Slowest Files
- Create logger and call `printSummary()` without processing any files
- Verify it skips the slowest files section (line 309)

### No Log File Path
- Create `PerformanceLogger` without log file path (or with null/undefined)
- Call `printSummary()` 
- Verify it skips file write (line 328)

### Undefined Duration
- Log operations without duration information
- Verify operations are handled correctly (line 375)
- Verify duration-based updates are skipped when duration is undefined

### Write/Save Operations
- Log operations with type "write" or "save"
- Verify `writeTime` is updated correctly (line 381)
- Test various write/save operation types

## Fixtures Strategy

- No fixtures needed - use logger API directly

## Test Implementation Notes

- Use existing test patterns from `test/lib/performanceLogger.test.ts`
- Test logger with various configurations (with/without log file, with/without operations)
- Test different operation types and durations

## Expected Coverage Improvement

- File: `src/lib/performanceLogger.ts` from 99.25% statements, 89.28% branches to 100% for all metrics
- Lines: 309, 328, 375, 381 from 0% to 100%

## Verification Commands

```bash
bun test test/lib/performanceLogger.test.ts
bun run test:coverage
```

## Acceptance Criteria

- [ ] All new tests pass
- [ ] Coverage for `performanceLogger.ts` increases to 100% for all metrics
- [ ] No flaky tests
- [ ] Tests are fast (<1s)
- [ ] Tests are isolated and independent
