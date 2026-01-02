# Tests: combine.ts Edge Cases and Error Paths

## Purpose

Cover uncovered lines in `combine.ts`: no root definition, error message logging, and arrangeKeys() edge cases.

## Test File(s)

- `test/party/combine.test.ts` (update existing)

## Scenarios to Cover

### No Root Definition
- Create metadata definition without root
- Test combine operation
- Verify JSON is used as-is without wrapping (line 893)

### Error Message Logging
- Test combine with invalid YAML files
- Test combine with missing files
- Verify error message is set and logged (line 913)

### arrangeKeys() Edge Cases
- Test `arrangeKeys()` with array input
- Verify it returns early (line 1028)
- Test `arrangeKeys()` with primitive input
- Verify it returns early (line 1028)

## Fixtures Strategy

- Use existing fixtures from `test/data/`
- Create new fixtures if needed:
  - `test/data/metadata-without-root/` - Metadata definition without root
  - `test/data/invalid-yaml/` - Invalid YAML files for combine

## Test Implementation Notes

- Use existing test patterns from `test/party/combine.test.ts`
- Test with various metadata configurations
- Test error conditions (invalid YAML, missing files)
- Test arrangeKeys() with different input types

## Expected Coverage Improvement

- File: `src/party/combine.ts` from 88.63% statements, 76.06% branches, 95.12% functions to 100% for all metrics
- Lines: 893, 913, 1028 from 0% to 100%

## Verification Commands

```bash
bun test test/party/combine.test.ts
bun run test:coverage
```

## Acceptance Criteria

- [ ] All new tests pass
- [ ] Coverage for `combine.ts` increases to 100% for all metrics
- [ ] No flaky tests
- [ ] Tests are fast (<1s)
- [ ] Tests are isolated and independent
- [ ] Test fixtures are cleaned up after tests
