# OPTIMIZATION.md — Bun/TypeScript Codebase Optimization Workflow (Deterministic)

## Purpose
Run a repeatable optimization workflow that:
- finds performance, extensibility, and maintainability improvements
- evaluates dependency choices (is a faster/better-maintained lib available for the same job?)
- generates a single orchestration file that can apply changes end-to-end
- keeps outputs out of source control (writes only to `.optimization/`)

## Non-negotiables
- Do **not** modify this file.
- Do **not** write outputs anywhere except `.optimization/`.
- Prefer safe, incremental refactors with verification steps.
- Preserve public behavior unless explicitly called out and tested.
- Lint, typecheck, and build **warnings are treated as actionable findings** and must be addressed or explicitly justified before completion.

## How to run
When I execute this prompt, you will:
1) Create a new run folder: `.optimization/run/<YYYYMMDD-HHMMSS>/`
2) Write all analysis + plans into that folder
3) Create ONE orchestration file: `.optimization/run/<run>/ORCHESTRATE.md`
4) Print a single next-step line:
   - `Next: execute @.optimization/run/<run>/ORCHESTRATE.md`
Nothing else should be required.

---

# Phase 0 — Setup & Baseline (read-only)
## Tasks
- Identify:
  - entrypoints (CLI/bin, src/index.ts, etc.)
  - major modules and hot paths
  - file I/O boundaries
  - parsing/serialization boundaries (XML/JSON/YAML)
- Capture baseline commands (Bun):
  - install: `bun install`
  - tests: `bun test` (or repo equivalent)
  - typecheck: `bun run typecheck` (or `tsc -p ...`)
  - lint: `bun run lint` (if present)
  - build: `bun run build` (if present)
  - run CLI help: `bun run <bin> --help` (or equivalent)
- Capture **all warnings** from:
  - `bun test` (test warnings/errors)
  - typecheck (TypeScript warnings)
  - build (compilation warnings)
  - lint (linting warnings)
- Store raw warning output (or summarized counts + categories) in `WARNINGS_BASELINE.md`
- **Important:** Warnings ≠ acceptable noise. Baseline warnings must be enumerated so regressions can be detected.

## Outputs (write these files)
- `STATUS.md` (short run header + what you're doing + one-line next step)
- `BASELINE.md` (repo overview, commands discovered, current branch, node/bun versions if visible)
- `METRICS.md` (how to measure perf in this repo; include any micro-benchmark ideas if relevant)
- `INVENTORY.md` (key modules + responsibilities + suspected hotspots)
- `WARNINGS_BASELINE.md` (all warnings from lint, typecheck, build, tests with counts and categories)

---

# Phase 1 — Findings (analysis)
## Requirements for findings
Produce 10–20 findings, each with:
- ID: `OPT-###`
- Category: Performance | Maintainability | Extensibility | Reliability | Dependency
- Impact: High/Med/Low
- Effort: S/M/L
- Risk: Low/Med/High
- Evidence:
  - file path(s)
  - function name(s)
  - line numbers (best effort)
  - brief "why this matters"
- Recommendation:
  - specific change
  - safer alternative if applicable
- Verification:
  - exact Bun commands to run
  - any targeted checks (unit tests, snapshot updates, etc.)

## Dependency performance review (must-do)
- Read `package.json` and identify runtime dependencies.
- For each dependency:
  - confirm why it's used (where imported, what functions)
  - assess performance/footprint risk for its use-case (parsing, globbing, FS, CLI, etc.)
  - propose alternatives **only** if there's a clear benefit
- For any recommended swap (example: `xml2js` → `fast-xml-parser`):
  - include compatibility constraints (API differences, options needed)
  - migration steps
  - regression risks
  - required test updates

## Output
- `FINDINGS.md` containing all findings.

---

# Phase 1.5 — Warnings Analysis

## Requirements
For each warning discovered in baseline or introduced during optimization:

- **Classify** each warning:
  - unused import
  - unused variable
  - unused function / call
  - unreachable code
  - deprecated API usage
  - type-only import that should be `import type`
  - other (specify)

- **Identify** for each warning:
  - file path
  - symbol/line number
  - root cause

- **Decide** action:
  - remove (preferred)
  - refactor
  - explicitly justify (rare, must document why)

## Rules
- **Do not ignore warnings**
- If a warning remains, justification is required and must be explicit
- Unused code, dead exports, unused imports, unused function calls, and unreachable code are treated as **mandatory cleanup**, not optional polish

## Output
- `WARNINGS.md` containing:
  - baseline warnings (from WARNINGS_BASELINE.md)
  - warnings resolved by patches (with commit reference)
  - any remaining warnings with explicit justification
  - warning count before vs after

---

# Phase 2 — Patch plan (one cohesive plan)
Create `PATCH_PLAN.md`:
- Order patches to minimize risk and maximize early wins
- Group into 3–6 commits max
- Each commit includes:
  - objectives
  - files touched
  - exact edits described
  - verification commands
  - **warnings resolved** (list specific warnings that will be fixed)
  - **warnings introduced** (should be zero; if any, must be justified)
- Cleanup of unused code triggered by refactors is **in-scope** (remove newly unused symbols immediately, not defer)

Also create `PATCHES/` folder containing one file per commit (not per finding):
- `PATCHES/COMMIT_1.md`
- `PATCHES/COMMIT_2.md`
- ...
Each COMMIT file is an executable set of instructions that can be applied in one go.

---

# Phase 3 — Orchestration (single file, end-to-end execution)
Create `ORCHESTRATE.md` that:
- Is the **only** file I need to run to do the work
- Contains:
  1) preflight checks (clean working tree guidance; do not force)
  2) run baseline commands
  3) apply each commit sequentially by *inlining the instructions* from `PATCHES/COMMIT_N.md`
     - IMPORTANT: Do not require me to run `@PATCHES/COMMIT_N.md` separately.
     - ORCHESTRATE must include everything needed to execute without extra prompts.
  4) after each commit: run verification commands + **warning gates**:
     - run lint, typecheck, and build
     - scan output for warnings
     - **If new warnings appear** → stop, fix them, then continue
     - **If existing warnings disappear** → note success
     - **If warnings remain** → they must be listed in `WARNINGS.md` with explicit justification
     - stop if failing and report what failed
  5) final summary:
     - what changed
     - perf/maintainability wins
     - **warning count before vs after**
     - **list of categories eliminated** (e.g., unused imports, dead code)
     - **confirmation: "No new lint/typecheck/build warnings introduced"**
     - any follow-ups

## Output structure
Write everything under:
`.optimization/run/<run>/`
Example:
- STATUS.md
- BASELINE.md
- METRICS.md
- INVENTORY.md
- WARNINGS_BASELINE.md
- FINDINGS.md
- WARNINGS.md
- PATCH_PLAN.md
- PATCHES/COMMIT_1.md ...
- ORCHESTRATE.md

---

# Execution rules while running ORCHESTRATE
When ORCHESTRATE is executed:
- Make code changes directly in the repo (normal edits)
- Keep commits optional; if you create commits, do so with clear messages from PATCH_PLAN
- Prefer mechanical refactors first, then behavior-sensitive changes
- Never "handwave"; if uncertain, add a TODO and a small focused test.
- **Enforce warning gates:** After every step, run lint, typecheck, and build. If new warnings appear, stop and fix them before proceeding.
- **Failure condition:** Optimization is incomplete if unresolved warnings remain without justification.

---

## Final console output (after generating artifacts)
Print exactly:
- `Created: .optimization/run/<run>/ORCHESTRATE.md`
- `Next: execute @.optimization/run/<run>/ORCHESTRATE.md`
