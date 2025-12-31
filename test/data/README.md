# Test Data Files

This directory contains test data files extracted from the SalesforceCI repository to test uncovered code lines.

## File Structure

```
test/data/
├── workflows/
│   ├── Case.workflow-meta.xml              # Workflow with alerts, rules, fieldUpdates (xmlOrder scenarios)
│   ├── NestedStructure.workflow-meta.xml   # Nested structures for recursive processing (split.ts:586)
│   ├── SingleElementArray.workflow-meta.xml # Single-element arrays (packageUtil.ts:336)
│   ├── KeyOrderTest.workflow-meta.xml       # Keys not in keyOrder (split.ts:560)
│   └── BooleanConversion.workflow-meta.xml  # Boolean conversion scenarios (split.ts:613-617)
├── labels/
│   └── CustomLabels.labels-meta.xml        # CustomLabels for array sorting (combine.ts:909-912)
├── profiles/
│   └── loginIpRanges-sandbox.yaml          # Login IP ranges for split.ts:231
└── packages/
    ├── package.xml                          # Package with multiple types (packageUtil.ts:171-175, 266-267)
    ├── packageWithSorting.xml               # Package for sorting tests (packageUtil.ts:266-267)
    └── sfdx-project.json                    # Project file for packageUtil.ts:145
```

## Coverage Scenarios

### combine.ts:830-841 (updateFileStats)
- **Files**: Any workflow or label file
- **Scenario**: Process multiple files with different timestamps to update atime/mtime

### combine.ts:909-912 (sortJSON)
- **Files**: `labels/CustomLabels.labels-meta.xml`
- **Scenario**: Array of labels sorted by `fullName` key

### combine.ts:983-992, 997 (arrangeKeys with xmlOrder)
- **Files**: `workflows/Case.workflow-meta.xml`, `workflows/KeyOrderTest.workflow-meta.xml`
- **Scenarios**:
  - Keys in xmlOrder (alerts, rules, fieldUpdates)
  - Keys not in xmlOrder (unknownField, anotherUnknownField)
  - Mixed scenarios

### fileUtils.ts:343-344 (undefined atime/mtime)
- **Scenario**: Write files with `atime: undefined` or `mtime: undefined` explicitly

### packageUtil.ts:145 (sfdx-project.json)
- **File**: `packages/sfdx-project.json`
- **Scenario**: Read sourceApiVersion from sfdx-project.json

### packageUtil.ts:171-175 (cleanPackage with types)
- **File**: `packages/package.xml`
- **Scenario**: Filter members ending with `.yaml` when types match global.metaTypes

### packageUtil.ts:266-267 (sorting package types)
- **File**: `packages/packageWithSorting.xml`
- **Scenario**: Sort types: CustomLabels < PermissionSet < Profile < Workflow

### packageUtil.ts:336 (xml2json array length === 1)
- **File**: `workflows/SingleElementArray.workflow-meta.xml`
- **Scenario**: Single-element arrays converted to strings

### split.ts:231 (sandboxLoginIpRange)
- **File**: `profiles/loginIpRanges-sandbox.yaml`
- **Scenario**: Profile split with loginIpRanges-sandbox.yaml file

### split.ts:517, 567 (error in keySort)
- **Scenario**: Create test that triggers error in keySort processing

### split.ts:560 (keyOrder.indexOf === -1)
- **File**: `workflows/KeyOrderTest.workflow-meta.xml`
- **Scenario**: Keys not in keyOrder return index -1, need to handle comparison

### split.ts:586 (recursive array processing)
- **File**: `workflows/NestedStructure.workflow-meta.xml`
- **Scenario**: Arrays with nested objects processed recursively

### split.ts:613-617 (error in boolean conversion)
- **File**: `workflows/BooleanConversion.workflow-meta.xml`
- **Scenario**: Boolean conversion with potential error handling

## Usage in Tests

These files can be used in test cases to exercise the uncovered code paths. Example:

```typescript
import * as fs from 'fs'
import { Combine } from '../../src/party/combine.js'
import * as workflowDefinition from '../../src/meta/Workflows.js'

const workflowXML = fs.readFileSync('test/data/workflows/Case.workflow-meta.xml', 'utf8')
// Use in test to cover xmlOrder scenarios
```

## Notes

- All XML files are valid Salesforce metadata format
- YAML files follow Salesforce metadata structure
- Files are extracted from real SalesforceCI repository data
- Some scenarios may require additional test setup (mocking, error injection, etc.)
