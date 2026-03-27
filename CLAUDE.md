# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project does

`sfparty` is a Salesforce metadata XML splitter for CI/CD. It splits large Salesforce metadata XML files (Profiles, PermissionSets, CustomLabels, Workflows) into smaller YAML/JSON files for source control, and combines them back into XML for deployment.

## Commands

```bash
bun run build          # Compile TypeScript → dist/
bun run build:watch    # Watch mode
bun run typecheck      # Type-check without emit
bun run test           # Build + run all tests (serial)
bun run test:watch     # Watch mode (no build step)
bun run test:coverage  # Build + run with v8 coverage
bun run lint           # Biome lint check
bun run lint:fix       # Biome lint + auto-fix
bun run format         # Biome format
```

**Running a single test file:**
```bash
bun vitest run test/meta/PermissionSets.test.ts
```

**⚠️ fileIO test quirk:** `test/lib/file/fileIO.test.ts` hangs indefinitely when run in isolation. Always test it via the full suite (`bun run test`) or with a timeout:
```bash
timeout 10 bun test test/lib/file/fileIO.test.ts
```

## Architecture

### Core data flow

```
CLI (index.ts)
  └─ parses yargs args
  └─ builds AppContext (dependency injection container)
  └─ invokes Split or Combine

Split (party/split.ts)
  └─ reads XML via fileUtils.ts (fast-xml-parser)
  └─ transforms to YAML/JSON per MetadataDefinition
  └─ writes split files via writeBatcher.ts

Combine (party/combine.ts)
  └─ reads YAML/JSON split files
  └─ rebuilds XML per MetadataDefinition
  └─ updates package.xml via packageUtil.ts
  └─ optionally uses git diffs (gitUtils.ts) to scope work
```

### Key directories

- **`src/party/`** — Core business logic: `split.ts` and `combine.ts`
- **`src/meta/`** — One file per supported Salesforce metadata type (`PermissionSets.ts`, `Profiles.ts`, `CustomLabels.ts`, `Workflows.ts`). Each exports a `metadataDefinition` object that drives how that type is split/combined — fields like `singleFiles`, `directories`, `sortKeys`, `keyOrder`.
- **`src/lib/`** — Utilities: file I/O, XML parsing, git ops, package.xml manipulation, terminal UI, audit/performance logging
- **`src/types/`** — Shared interfaces; `context.ts` defines `AppContext` (the DI container passed everywhere)

### Adding a new metadata type

Create `src/meta/NewType.ts` exporting a `metadataDefinition: MetadataDefinition` — see `PermissionSets.ts` as the canonical example. Register it in `index.ts`.

## Coding conventions

- **TypeScript strict mode** — `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns` all enforced
- **Biome** for lint + format: tabs (width 4), LF line endings, 80-char line width
- `useConst` is an error; `noExplicitAny` is a warning; `noUnusedVariables` is an error
- Tests use Vitest with globals (`describe`/`it`/`expect` without imports), coverage via v8

## Git / PR workflow

1. Create branch locally: `git checkout -b feat/branch-name`
2. Push to company remote: `git push company feat/branch-name`
3. Open PR within company repo: `DTS-Productivity-Engineering/sfparty:feat/branch-name` → `DTS-Productivity-Engineering/sfparty:main`
4. After company merge, `origin/main` auto-syncs via `.github/workflows/sync-to-public.yml`
5. Pull locally: `git pull origin main`

Use `/pr` to run this flow automatically.

**Remotes:**
- `origin` → `TimPaulaskasDS/sfparty` (public fork; updated automatically after each company merge)
- `company` → `DTS-Productivity-Engineering/sfparty` (company org, push branches here)

Local `main` tracks `origin/main`. The `company` SSH host authenticates as `Tim-Paulaskas_docusign` via `~/.ssh/id_ed25519`.
