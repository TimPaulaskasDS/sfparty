# Tests: yargs.ts Option Processing Edge Case

## Purpose

Cover uncovered branch in `yargs.ts`: option processing when option is falsy/null.

## Test File(s)

- `test/meta/yargs.test.ts` (update existing)

## Scenarios to Cover

### Falsy/Null Options
- Create options object with undefined/null values
- Call `getOptions()` with the modified options
- Verify it handles falsy/null options gracefully (line 44)

## Fixtures Strategy

- No fixtures needed - use options object directly

## Test Implementation Notes

- Use existing test patterns from `test/meta/yargs.test.ts`
- Test with options object containing undefined/null values
- Verify function doesn't crash and handles edge cases

## Expected Coverage Improvement

- File: `src/meta/yargs.ts` from 100% statements, 87.5% branches to 100% for all metrics
- Line: 44 from 0% to 100%

## Verification Commands

```bash
bun test test/meta/yargs.test.ts
bun run test:coverage
```

## Acceptance Criteria

- [ ] All new tests pass
- [ ] Coverage for `yargs.ts` increases to 100% for all metrics
- [ ] No flaky tests
- [ ] Tests are fast (<1s)
- [ ] Tests are isolated and independent
