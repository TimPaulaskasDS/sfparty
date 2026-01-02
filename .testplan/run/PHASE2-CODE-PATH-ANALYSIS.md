# PHASE 2 Enhancement: Automated Code Path Analysis

## Purpose

This phase enhances PHASE 2 of TESTPLAN.md by automatically running code path analysis to determine exact conditions needed to reach each uncovered line.

## Execution

**Automatically runs during PHASE 2 execution:**

```bash
bun .testplan/run/code-path-analyzer.ts
```

This generates:
- `.testplan/run/CODE_PATH_ANALYSIS.md` - Detailed analysis of each uncovered line
- Used to populate REACHABILITY.md with exact conditions

## Integration with TESTPLAN.md

When executing `@prompts/TESTPLAN.md`:

1. **PHASE 0** - Baseline (as normal)
2. **PHASE 1** - Coverage Measurement (as normal)
3. **PHASE 2** - Root Cause Analysis:
   - **Step 1**: Run code path analyzer automatically
   - **Step 2**: Use analysis to populate REACHABILITY.md
   - All other steps as normal
4. **PHASE 3-5** - Continue as normal

## What the Analyzer Does

For each uncovered line:
1. Reads the source code
2. Analyzes control flow (if/else, try/catch, loops)
3. Identifies exact conditions needed
4. Traces dependencies
5. Generates test scenarios with executable code

## Output

The analyzer creates detailed analysis that is then used in:
- `REACHABILITY.md` - Enhanced with code path data
- `TEST_GENERATOR.md` - Executable test code examples
- `APPLY_TESTS-###.md` - Specific test implementation prompts

## Manual Execution

If you need to regenerate analysis:
```bash
bun .testplan/run/code-path-analyzer.ts
```





