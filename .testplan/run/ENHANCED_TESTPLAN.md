# Enhanced Test Plan - With Code Path Analysis

**This is an enhanced version of TESTPLAN.md that includes automatic code path analysis.**

## Key Enhancement

This plan **automatically runs code path analysis** to determine exact conditions needed to reach each uncovered line, rather than just identifying files and lines.

## Execution Flow

### PHASE 0 — Baseline & Commands
[Same as original TESTPLAN.md]

### PHASE 1 — Coverage Measurement
[Same as original TESTPLAN.md]

### PHASE 1.5 — Code Path Analysis (NEW)

**Goal**: Automatically analyze each uncovered line to determine exact test conditions.

**Tasks**:

1. **Run Code Path Analyzer**
   ```bash
   bun .testplan/run/code-path-analyzer.ts
   ```
   - Reads source code for each uncovered line
   - Analyzes control flow (if/else, try/catch, loops)
   - Identifies exact conditions needed
   - Generates test scenarios

2. **Review Generated Analysis**
   - Read `.testplan/run/CODE_PATH_ANALYSIS.md`
   - Review `.testplan/run/TEST_GENERATOR.md` for executable test code
   - Understand what each test needs to do

3. **Update REACHABILITY.md**
   - Use code path analysis to fill in exact conditions
   - Update test scenarios with specific code examples

### PHASE 2 — "Hard to Reach" Root Cause Analysis
[Enhanced with code path analysis data]

### PHASE 3 — Refactor-for-Testability
[Same as original]

### PHASE 4 — Test Authoring Plan
[Enhanced - use code path analysis to generate specific test code]

### PHASE 5 — Orchestrator
[Same as original, but includes code path analysis step]

## How to Use

1. **Run the enhanced plan:**
   ```bash
   # This will automatically run code path analysis
   Triage @.testplan/run/ENHANCED_TESTPLAN.md
   ```

2. **Or manually run analysis first:**
   ```bash
   bun .testplan/run/code-path-analyzer.ts
   # Then review CODE_PATH_ANALYSIS.md and TEST_GENERATOR.md
   # Then proceed with test implementation
   ```

## Benefits

- ✅ **Automatic code path analysis** - No manual code reading needed
- ✅ **Exact conditions identified** - Knows what's needed to hit each line
- ✅ **Test code generation** - Provides executable test examples
- ✅ **Systematic approach** - One line at a time with verification

## Files Generated

- `CODE_PATH_ANALYSIS.md` - Detailed analysis of each uncovered line
- `TEST_GENERATOR.md` - Executable test code examples
- `IMPROVED_TESTPLAN.md` - Methodology documentation
- `SOLUTION.md` - Summary of approach

