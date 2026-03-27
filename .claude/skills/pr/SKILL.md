---
name: pr
description: >
  Run the full sfparty PR workflow: push the current branch to the company
  remote and open a pull request targeting DTS-Productivity-Engineering/sfparty:main.
  Use this skill whenever the user types /pr, says "create a PR", "open a PR",
  "submit a PR", or asks to push their work for review.
---

# sfparty PR Workflow

Branches are pushed directly to the `company` remote
(`DTS-Productivity-Engineering/sfparty`) and PRs are opened within that repo.
After a PR merges, the `sync-to-public.yml` workflow automatically pushes
`main` to `origin` (`TimPaulaskasDS/sfparty`) — no manual origin push needed.

## Pre-flight checks

Before doing anything, run all three:

```bash
git status --short          # any uncommitted changes?
git branch --show-current   # confirm not on main
git log --oneline @{u}..    # any unpushed commits?
```

- **Uncommitted files**: stop and tell the user to commit or stash first.
- **On main**: stop and tell the user to create a feature branch first.
- **No unpushed commits** (and branch already exists on company): the branch
  is already up to date — ask the user if they just want to open the PR.

## Steps

### 1. Push the branch to company

```bash
git push company <branch-name>
```

If the branch already exists on company and has diverged (e.g. after a rebase),
use `--force-with-lease` — never bare `--force`.

### 2. Open the PR within the company repo

```bash
gh pr create \
  --repo DTS-Productivity-Engineering/sfparty \
  --base main \
  --title "<title>" \
  --body "<body>"
```

Write a concise title (imperative, ≤70 chars). The body should summarise *what*
changed and *why*. Keep it short — bullet points are fine.

Note: `gh pr create` picks up the current branch automatically when run inside
the repo with `company` as the target. No `--head` flag needed.

### 3. After PR is merged

The `sync-to-public.yml` workflow pushes company `main` → `origin/main`
automatically. Just pull locally:

```bash
git checkout main && git pull origin main
```

## Notes

- `origin` (`TimPaulaskasDS/sfparty`) is updated automatically after every
  company merge — no manual push to origin required.
- Local `main` tracks `origin/main`.
- If CI fails on the PR, fix on the same branch, push to company again — no
  new PR needed.
- The `company` SSH host uses `id_ed25519` and authenticates as
  `Tim-Paulaskas_docusign`, which has write access to the org.
