# PHASE 2 Automatic Code Path Analysis

## Integration with TESTPLAN.md

When executing `@prompts/TESTPLAN.md`, **PHASE 2 automatically runs code path analysis**.

## What Happens Automatically

During PHASE 2 execution, the following happens automatically:

1. **Run Code Path Analyzer:**
   ```bash
   bun .testplan/run/code-path-analyzer.ts
   ```
   - This analyzes each uncovered line
   - Generates `CODE_PATH_ANALYSIS.md`
   - Provides exact conditions needed

2. **Use Analysis in REACHABILITY.md:**
   - The generated analysis is used to populate REACHABILITY.md
   - Each uncovered line gets detailed code path analysis
   - Exact conditions and test scenarios are included

3. **Generate TEST_GENERATOR.md:**
   - Executable test code examples
   - Ready-to-use implementations

## No Manual Steps Required

When you execute `@prompts/TESTPLAN.md`:
- ✅ PHASE 0 runs (baseline)
- ✅ PHASE 1 runs (coverage)
- ✅ **PHASE 2 automatically runs code path analyzer** ← NEW
- ✅ PHASE 3-5 continue as normal

## Output

All analysis files are automatically generated:
- `CODE_PATH_ANALYSIS.md` - Detailed line analysis
- `REACHABILITY.md` - Enhanced with code path data
- `TEST_GENERATOR.md` - Executable test code

## Manual Override

If you need to regenerate analysis manually:
```bash
bun .testplan/run/code-path-analyzer.ts
```

But this is **not required** - it runs automatically during PHASE 2.





