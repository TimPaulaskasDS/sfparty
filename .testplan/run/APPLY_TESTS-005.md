# Tests: writeBatcher.ts Concurrent Flush Paths

## Purpose

Cover uncovered lines in `writeBatcher.ts`: recursive flush timer and concurrent flushAll() wait loop.

## Test File(s)

- `test/lib/writeBatcher.test.ts` (update existing)

## Scenarios to Cover

### Recursive Flush Timer
- Queue writes to the batcher
- Trigger a flush
- Queue more writes before the flush completes
- Verify another flush is scheduled (lines 107-109)

### Concurrent flushAll()
- Start a flush operation
- Call `flushAll()` before the current flush completes
- Verify it waits for the current flush to complete (line 154)
- Verify all writes are eventually flushed

## Fixtures Strategy

- No fixtures needed - use writeBatcher API directly
- May need to use timing controls (setTimeout, Promise delays) to test concurrent behavior

## Test Implementation Notes

- Use existing test patterns from `test/lib/writeBatcher.test.ts`
- Use timing controls to test concurrent behavior
- May need to mock or control setTimeout for precise timing tests
- Test both scenarios: writes during flush, and flushAll() during flush

## Expected Coverage Improvement

- File: `src/lib/writeBatcher.ts` from 92.95% statements, 93.1% branches, 73.68% functions to 100% for all metrics
- Lines: 107-109, 154 from 0% to 100%

## Verification Commands

```bash
bun test test/lib/writeBatcher.test.ts
bun run test:coverage
```

## Acceptance Criteria

- [ ] All new tests pass
- [ ] Coverage for `writeBatcher.ts` increases to 100% for all metrics
- [ ] No flaky tests
- [ ] Tests are fast (<1s)
- [ ] Tests are isolated and independent
- [ ] Timing-dependent tests are stable
