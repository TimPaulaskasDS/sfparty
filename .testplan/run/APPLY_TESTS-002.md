# Tests: fileUtils.ts Edge Cases and Error Paths

## Purpose

Cover uncovered lines in `fileUtils.ts`: write batcher null return, YAML warnings, XML errors, and find() directory edge case.

## Test File(s)

- `test/lib/file/fileIO.test.ts` (update existing)

## Scenarios to Cover

### Write Batcher Null Return
- Call `getWriteBatcher()` before `initWriteBatcher()` is called
- Verify it returns `null` (line 22)

### YAML Parsing Warnings
- Create a YAML file with duplicate keys (triggers warning)
- Call `readFile()` with `convert: true` on the YAML file
- Verify it throws an error with warning message (line 437)

### XML Parsing Errors
- Create an invalid XML file (malformed XML)
- Call `readFile()` with `convert: true` on the XML file
- Verify it throws an error (line 483)

### Find() Directory Edge Case
- Create a directory at a path where a file is expected
- Call `find()` to search for a file
- Verify it continues searching up the directory tree (line 548)
- Verify it eventually finds the file or returns null

## Fixtures Strategy

- Create test fixtures in `test/data/`:
  - `test/data/yaml-with-warnings.yaml` - YAML file with duplicate keys
  - `test/data/invalid.xml` - Malformed XML file
  - Test directory structure with directory at expected file path

## Test Implementation Notes

- Use existing test patterns from `test/lib/file/fileIO.test.ts`
- For YAML warnings, use js-yaml's duplicate key feature
- For XML errors, create malformed XML (unclosed tags, invalid syntax)
- For find() test, create temporary directory structure

## Expected Coverage Improvement

- File: `src/lib/fileUtils.ts` from 90.28% statements, 83.17% branches, 80% functions to 100% for all metrics
- Lines: 22, 437, 483, 548 from 0% to 100%

## Verification Commands

```bash
bun test test/lib/file/fileIO.test.ts
bun run test:coverage
```

## Acceptance Criteria

- [ ] All new tests pass
- [ ] Coverage for `fileUtils.ts` increases to 100% for all metrics
- [ ] No flaky tests
- [ ] Tests are fast (<1s)
- [ ] Tests are isolated and independent
- [ ] Test fixtures are cleaned up after tests
