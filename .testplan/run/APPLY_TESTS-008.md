# Tests: split.ts Setter and Error Paths

## Purpose

Cover uncovered lines in `split.ts`: metadataDefinition setter, keySort error re-throw, and convertBooleanValue error handling.

## Test File(s)

- `test/party/split.test.ts` (update existing)

## Scenarios to Cover

### metadataDefinition Setter
- Create Split object with initial metadata definition
- Set `metadataDefinition` to a different definition
- Verify internal state is updated (line 83)

### keySort() Error Re-throw
- Test split with malformed JSON that triggers keySort errors
- Verify error is re-thrown (line 844)
- Test with various malformed structures

### convertBooleanValue() Error Handling
- Test `convertBooleanValue()` with values that cause unexpected errors
- Verify it handles errors gracefully (lines 893-903)
- Test with values that trigger non-standard errors

## Fixtures Strategy

- Use existing fixtures from `test/data/`
- Create new fixtures if needed:
  - `test/data/malformed-json/` - Malformed JSON/YAML files that trigger keySort errors
  - Test values that cause unexpected errors in boolean conversion

## Test Implementation Notes

- Use existing test patterns from `test/party/split.test.ts`
- Test setter method directly
- Test with malformed data that triggers errors
- Test error handling in convertBooleanValue()

## Expected Coverage Improvement

- File: `src/party/split.ts` from 88.82% statements, 74.69% branches to 100% for all metrics
- Lines: 83, 844, 893-903 from 0% to 100%

## Verification Commands

```bash
bun test test/party/split.test.ts
bun run test:coverage
```

## Acceptance Criteria

- [ ] All new tests pass
- [ ] Coverage for `split.ts` increases to 100% for all metrics
- [ ] No flaky tests
- [ ] Tests are fast (<1s)
- [ ] Tests are isolated and independent
- [ ] Test fixtures are cleaned up after tests
