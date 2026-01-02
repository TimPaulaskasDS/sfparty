# Tests: packageUtil.ts Branch Coverage

## Purpose

Cover uncovered branches in `packageUtil.ts`: sort comparison with equal names and xml2json single-element array handling.

## Test File(s)

- `test/lib/package/getPackageXML.test.ts` (update existing)
- `test/lib/package/addMember.test.ts` (update existing)

## Scenarios to Cover

### Package Sorting with Equal Names
- Create package with multiple types that have equal names
- Verify sorting handles equal names correctly (lines 247-248)
- Test both `<` and `>` comparison paths

### XML to JSON Single-Element Array
- Create package XML that parses to single-element arrays
- Verify `xml2json()` converts single-element arrays to strings (line 322)
- Test with various single-element array structures

### Package Processing Branch (Line 56)
- Examine the specific branch at line 56
- Create test scenario that exercises this branch

## Fixtures Strategy

- Use existing fixtures from `test/data/packages/`
- Create new fixtures if needed:
  - `test/data/packages/packageWithEqualNames.xml` - Package with types having equal names
  - `test/data/packages/packageWithSingleElementArrays.xml` - Package with single-element arrays

## Test Implementation Notes

- Use existing test patterns from package test files
- Test package XML parsing and JSON transformation
- Verify sorting behavior with various name combinations

## Expected Coverage Improvement

- File: `src/lib/packageUtil.ts` from 100% statements, 90.24% branches to 100% for all metrics
- Branches: 56, 247-248, 322 from 0% to 100%

## Verification Commands

```bash
bun test test/lib/package/
bun run test:coverage
```

## Acceptance Criteria

- [ ] All new tests pass
- [ ] Coverage for `packageUtil.ts` increases to 100% for all metrics
- [ ] No flaky tests
- [ ] Tests are fast (<1s)
- [ ] Tests are isolated and independent
