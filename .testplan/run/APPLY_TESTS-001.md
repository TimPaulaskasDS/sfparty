# Tests: pathUtils.ts Cache Coverage

## Purpose

Cover the memoization cache paths in `replaceSpecialChars()` to reach 100% coverage for `src/lib/pathUtils.ts`.

## Test File(s)

- `test/lib/pathUtils.test.ts` (update existing)

## Scenarios to Cover

### Cache Hit Path
- Call `replaceSpecialChars()` with a string containing special characters (e.g., `"test*file"`)
- Call it again with the same string
- Verify the second call hits the cache (line 13)

### Cache Set Path
- Call `replaceSpecialChars()` with a string containing special characters that need sanitization
- Verify the sanitized result differs from the original
- Verify the cache is set (line 28)

### Cache Miss Path
- Call `replaceSpecialChars()` with a string that doesn't need sanitization (e.g., `"normal-file"`)
- Verify it's not cached (string unchanged, so no cache set)

### Cache Clear
- Test `clearPathSanitizationCache()` clears the cache
- Verify cache is empty after clearing

## Fixtures Strategy

- No fixtures needed - use string literals in tests

## Test Implementation Notes

- Use existing test patterns from `test/lib/pathUtils.test.ts`
- Test cache behavior by calling function multiple times with same/different strings
- Verify cache state indirectly (by checking function behavior, not internal state)

## Expected Coverage Improvement

- File: `src/lib/pathUtils.ts` from 80% statements, 66.66% branches to 100% for all metrics
- Lines: 13, 28 from 0% to 100%

## Verification Commands

```bash
bun test test/lib/pathUtils.test.ts
bun run test:coverage
```

## Acceptance Criteria

- [ ] All new tests pass
- [ ] Coverage for `pathUtils.ts` increases to 100% for all metrics
- [ ] No flaky tests
- [ ] Tests are fast (<1s)
- [ ] Tests are isolated and independent
