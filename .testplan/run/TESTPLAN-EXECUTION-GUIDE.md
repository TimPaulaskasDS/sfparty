# TESTPLAN.md Execution Guide

## How TESTPLAN.md Now Works

When you execute `@prompts/TESTPLAN.md`, it now **automatically includes code path analysis**.

## Execution Flow

### PHASE 0 — Baseline & Commands
- [Executes as normal]

### PHASE 1 — Coverage Measurement  
- [Executes as normal]
- Generates `COVERAGE_SUMMARY.md`

### PHASE 2 — "Hard to Reach" Root Cause Analysis

**NEW: Automatic Code Path Analysis**

1. **Automatically runs code path analyzer:**
   ```bash
   bun .testplan/run/code-path-analyzer.ts
   ```
   - Analyzes each uncovered line
   - Identifies exact conditions needed
   - Generates test scenarios

2. **Generates analysis files:**
   - `CODE_PATH_ANALYSIS.md` - Detailed line-by-line analysis
   - Used to populate `REACHABILITY.md`

3. **Creates REACHABILITY.md:**
   - Enhanced with code path analysis data
   - Exact conditions for each uncovered line
   - Specific test scenarios

4. **Creates TEST_GENERATOR.md:**
   - Executable test code examples
   - Ready-to-use test implementations

### PHASE 3 — Refactor-for-Testability
- [Uses code path analysis to determine if refactors needed]

### PHASE 4 — Test Authoring Plan
- [Uses code path analysis to generate specific test code]

### PHASE 5 — Orchestrator (TRIAGE.md)
- [Includes pre-execution step to run analyzer if not already run]

## Key Improvement

**Before**: Manual analysis, guessing what conditions are needed

**Now**: Automatic code path analysis that:
- ✅ Reads actual source code
- ✅ Analyzes control flow
- ✅ Identifies exact conditions
- ✅ Generates executable test code

## Files Generated

**Required:**
- `BASELINE.md`
- `COVERAGE_SUMMARY.md`
- `CODE_PATH_ANALYSIS.md` ← **NEW: Auto-generated**
- `REACHABILITY.md` ← **Enhanced with code path data**
- `TEST_GENERATOR.md` ← **NEW: Executable test code**
- `TRIAGE.md`

**Optional:**
- `APPLY_REFACTOR-###.md`
- `APPLY_TESTS-###.md` ← **Enhanced with code path scenarios**
- `EXCEPTIONS.md`

## Running the Plan

Simply execute:
```
@prompts/TESTPLAN.md
```

The code path analyzer will run automatically during PHASE 2, and all subsequent phases will use the generated analysis.





