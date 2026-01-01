# Codebase Optimization Review — Bun / TypeScript
# Usage: execute @prompts/OPTIMIZATION.md
# This file is immutable and committed to source control.

## Purpose
Perform a read-only, high-signal review of the current Bun/TypeScript codebase to identify:
- performance improvements
- extensibility / architectural improvements
- maintainability and safety improvements

This prompt must not modify source code.
All findings are written to .optimization/ (gitignored).

---

## Directory Contract

Ensure these exist (create if missing):

- prompts/
- .optimization/
- .optimization/README.md
- .optimization/issues.md
- .optimization/patch_plan.md
- .optimization/metrics.md
- .optimization/risk.md
- .optimization/commands.sh

Rules:
- Never write outputs anywhere else
- Never modify files in prompts/
- Never implement fixes in this run

---

## Phase 1 — Repo Understanding (read-only)

Identify and record:

Project Shape:
- Entry points (CLI, server, pipeline, workers)
- Build config (bunfig.toml, tsconfig.json)
- Test framework (bun test / vitest / other)
- Linting / formatting (biome, eslint, prettier)
- Package manager: Bun
- Runtime assumptions (Node vs Bun APIs)

Structure:
- Core hot-path modules
- IO boundaries (fs, network, JSON, logging)
- Long-running loops or pipelines
- Places where determinism matters (ordering, time, randomness)

Record summary in .optimization/README.md.

---

## Phase 2 — Objective Signals

Discover and record (do not invent):

- Install command
- Test command(s)
- Typecheck command(s)
- Lint command(s)
- Any benchmark or profiling scripts

Write to .optimization/metrics.md using this format:

Commands:
- install:
- test:
- typecheck:
- lint:
- benchmark:

Baseline (if runnable):
- test runtime:
- key script runtime:

---

## Phase 3 — Static Review (no execution required)

Performance:
- repeated JSON.parse / stringify in loops
- unnecessary array or object cloning
- O(N²) scans where indexing would help
- repeated filesystem globbing or stat calls
- logging inside hot loops
- non-streaming reads of large files
- missed Bun-native optimizations (fs, spawn, file, streaming)

Extensibility / Architecture:
- god modules with multiple responsibilities
- tight coupling between stages
- hard-coded constants instead of config
- new features require touching many files
- missing interfaces or adapters

Maintainability:
- duplicated logic
- unclear naming or mixed concerns
- error handling gaps
- brittle tests or missing contracts
- unclear ownership of data shapes

Safety / Determinism:
- reliance on object key ordering
- unsorted globs
- time-dependent logic
- implicit globals or mutable module state
- missing validation at read/write boundaries

---

## Phase 4 — Write Findings

Populate the following files.

### .optimization/issues.md

Use EXACT format:

# Codebase Optimization Review (YYYY-MM-DD)

## Summary (max 5 bullets)

## Top Recommendations (ranked)

### R1 — <title>
Impact: High|Medium|Low
Effort: Small|Medium|Large
Risk: Low|Medium|High

Why it matters:
- ...

Evidence:
- file: path/to/file.ts
- pattern observed:

Proposed improvement:
- ...

Verification:
- command(s):
- expected outcome:

Notes:
- ...

Repeat for R2, R3, etc.

---

### .optimization/patch_plan.md

# Patch Plan

## Commit 1 — <title>
Files:
- ...

Edits:
- ...

Verification:
- ...

## Commit 2 — <title>
...

---

### .optimization/risk.md

# Risks & Guardrails

Assumptions:
- ...

Potential regressions:
- ...

Required guardrails:
- tests
- assertions
- bounded logging

---

### .optimization/commands.sh

Commands only. No prose.

Include:
- bun install
- bun test
- bun typecheck (if present)
- bun lint (if present)
- any profiling or determinism checks

---

## Constraints
- No code changes
- No formatting
- No dependency upgrades
- No speculative rewrites
- Prefer small, composable improvements
- Assume future execution is manual and deliberate

---

## Completion Signal

When finished:
- Confirm outputs written to .optimization/
- State: Review complete. Start with .optimization/issues.md.
- Stop.

