# Test Data Coverage Mapping

This document maps test data files to uncovered code lines.

## Coverage by File

### `test/data/workflows/Case.workflow-meta.xml`
**Covers:**
- `combine.ts:983-992, 997` - xmlOrder scenarios with alerts, rules, fieldUpdates
- `combine.ts:830-841` - updateFileStats when processing files
- `split.ts:586` - Recursive processing of nested recipients arrays

**Key Features:**
- Multiple `<alerts>` with `fullName` (in xmlOrder)
- `<rules>` with `fullName` (in xmlOrder)
- `<fieldUpdates>` with `fullName` (in xmlOrder)
- `<recipients>` arrays with nested structures
- `<outboundMessages>` and `<tasks>` for additional coverage

### `test/data/workflows/NestedStructure.workflow-meta.xml`
**Covers:**
- `split.ts:586` - Deeply nested object structures in arrays
- `split.ts:517, 567` - Potential error scenarios in recursive processing

**Key Features:**
- `<recipients>` with nested `<recipient>` objects
- `<nested>` structures with multiple levels (level1 > level2)
- `<parameters>` with `<nestedParams>` in actions
- Tests recursive `keySort` processing

### `test/data/workflows/SingleElementArray.workflow-meta.xml`
**Covers:**
- `packageUtil.ts:336` - Single-element arrays converted to strings
- `split.ts:336` - Same scenario in split.ts

**Key Features:**
- `<singleValue><item>onlyValue</item></singleValue>` - Single element array
- `<singleBoolean>true</singleBoolean>` - Single boolean value
- `<singleMember><value>single</value></singleMember>` - Single member array

### `test/data/workflows/KeyOrderTest.workflow-meta.xml`
**Covers:**
- `split.ts:560` - Keys not in keyOrder (indexOf === -1)
- `combine.ts:983-992` - Keys not in xmlOrder (index 99)

**Key Features:**
- `<unknownField>` - Not in keyOrder, should return index -1
- `<anotherUnknownField>` - Another unknown field for comparison
- `<unknownRuleField>` - Unknown field in rules section
- Mixed with known fields (`fullName`, `description`) to test sorting

### `test/data/workflows/BooleanConversion.workflow-meta.xml`
**Covers:**
- `split.ts:613-617` - Error handling in boolean conversion
- Boolean string to boolean conversion

**Key Features:**
- `<booleanTrue>true</booleanTrue>` - String "true" to boolean
- `<booleanFalse>false</booleanFalse>` - String "false" to boolean
- `<stringTrue>true</stringTrue>` - Additional true value
- `<stringFalse>false</stringFalse>` - Additional false value

### `test/data/labels/CustomLabels.labels-meta.xml`
**Covers:**
- `combine.ts:909-912` - sortJSON with array and key
- `combine.ts:983-992` - xmlOrder for labels

**Key Features:**
- Multiple `<labels>` entries
- Each label has `<fullName>` for sorting
- Can be sorted by `fullName` key
- Tests array sorting functionality

### `test/data/profiles/loginIpRanges-sandbox.yaml`
**Covers:**
- `split.ts:231` - sandboxLoginIpRange exists scenario

**Key Features:**
- Valid YAML structure with `loginIpRanges` array
- Multiple IP range entries
- Used when splitting profiles

### `test/data/packages/package.xml`
**Covers:**
- `packageUtil.ts:171-175` - cleanPackage filtering members
- `packageUtil.ts:266-267` - Sorting package types

**Key Features:**
- Multiple types: Workflow, CustomLabels, Profile, PermissionSet
- Members ending with `.yaml` to test filtering
- Types in different order to test sorting

### `test/data/packages/packageWithSorting.xml`
**Covers:**
- `packageUtil.ts:266-267` - Sorting with a.name < b.name and a.name > b.name

**Key Features:**
- Types: Workflow, Profile, CustomLabels, PermissionSet
- Unsorted order to test both < and > comparisons
- Should sort to: CustomLabels, PermissionSet, Profile, Workflow

### `test/data/packages/sfdx-project.json`
**Covers:**
- `packageUtil.ts:145` - Reading sfdx-project.json

**Key Features:**
- Contains `sourceApiVersion: "56.0"`
- Valid sfdx-project.json structure
- Used to set package version

## Coverage Summary

| Uncovered Line | Test Data File | Status |
|---------------|----------------|--------|
| `fileUtils.ts:343-344` | Requires test setup (undefined params) | ⚠️ |
| `packageUtil.ts:145` | `packages/sfdx-project.json` | ✅ |
| `packageUtil.ts:171-175` | `packages/package.xml` | ✅ |
| `packageUtil.ts:266-267` | `packages/packageWithSorting.xml` | ✅ |
| `packageUtil.ts:336` | `workflows/SingleElementArray.workflow-meta.xml` | ✅ |
| `yargs.ts:44` | Requires test setup | ⚠️ |
| `combine.ts:830-841` | Any workflow/label file | ✅ |
| `combine.ts:909-912` | `labels/CustomLabels.labels-meta.xml` | ✅ |
| `combine.ts:983-992, 997` | `workflows/Case.workflow-meta.xml`, `workflows/KeyOrderTest.workflow-meta.xml` | ✅ |
| `split.ts:231` | `profiles/loginIpRanges-sandbox.yaml` | ✅ |
| `split.ts:517, 567` | `workflows/NestedStructure.workflow-meta.xml` (with error injection) | ⚠️ |
| `split.ts:560` | `workflows/KeyOrderTest.workflow-meta.xml` | ✅ |
| `split.ts:586` | `workflows/NestedStructure.workflow-meta.xml` | ✅ |
| `split.ts:613-617` | `workflows/BooleanConversion.workflow-meta.xml` (with error injection) | ⚠️ |

## Test Implementation Notes

### Files that need additional test setup:

1. **fileUtils.ts:343-344** - Need to explicitly pass `undefined` for atime/mtime
   ```typescript
   fileUtils.writeFile(fileName, data, undefined, undefined)
   ```

2. **yargs.ts:44** - Need to ensure options are properly defined when calling getOptions

3. **split.ts:517, 567** - Need to inject error scenario or create malformed data
   ```typescript
   // Mock or create scenario that causes error in keySort
   ```

4. **split.ts:613-617** - Need to create scenario where boolean conversion throws error
   ```typescript
   // Mock value conversion to throw error with different message
   ```

### Files ready for direct use:

All other files can be used directly in tests without additional setup. They contain real data structures that will naturally exercise the uncovered code paths.

## Usage Examples

### Example 1: Testing xmlOrder (combine.ts:983-992)
```typescript
import fs from 'fs'
import { Combine } from '../../src/party/combine.js'
import * as workflowDefinition from '../../src/meta/Workflows.js'

const xmlData = fs.readFileSync('test/data/workflows/Case.workflow-meta.xml', 'utf8')
// Process with Combine to test xmlOrder sorting
```

### Example 2: Testing package sorting (packageUtil.ts:266-267)
```typescript
import fs from 'fs'
import { Package } from '../../src/lib/packageUtil.js'

const packageXML = fs.readFileSync('test/data/packages/packageWithSorting.xml', 'utf8')
// Process to test type sorting
```

### Example 3: Testing loginIpRanges (split.ts:231)
```typescript
import fs from 'fs'
import { Split } from '../../src/party/split.js'

const yamlData = fs.readFileSync('test/data/profiles/loginIpRanges-sandbox.yaml', 'utf8')
// Use in profile split test
```
