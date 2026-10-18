---
name: review-pr
description: Protocol for reviewing a GitHub Pull Request against linked issue acceptance criteria, repository standards, and anti-slop rules using isolated git worktrees.
---

# Pull Request Reviewer Protocol (Worktree-Isolated)

Run all PR inspections, builds, and tests inside a temporary Git Worktree (`.worktrees/pr-<number>`) or via diff inspection so the root repository (`/Users/dimi/Documents/git/sundayleague`) remains untouched.

---

## 1. Inspection & Context Gathering

1. **Inspect Pull Request Details & Diff**:
   ```bash
   gh pr view <pr-number> --json number,title,body,headRefName,baseRefName,mergeable,mergeStateStatus
   gh pr diff <pr-number>
   ```
2. **Fetch Linked Issue(s) & Standards**:
   - Read every linked issue (`gh issue view <issue-number>`).
   - Read [**`CODING_STANDARDS.md`**](../../CODING_STANDARDS.md), [**`GLOSSARY.md`**](../../GLOSSARY.md), and [**`docs/adr/`**](../../docs/adr/).

---

## 2. Automated Quality Gates in Worktree

1. **Create Temporary PR Worktree**:
   ```bash
   git fetch origin <headRefName>
   git worktree add .worktrees/pr-<pr-number> origin/<headRefName>
   ln -s ../../node_modules .worktrees/pr-<pr-number>/node_modules
   test -f .env.local && ln -s ../../.env.local .worktrees/pr-<pr-number>/.env.local
   ```
2. **Run Quality Gates Inside `.worktrees/pr-<pr-number>`**:
   - **Oxlint & Anti-Slop:** `npx oxlint` (exits 0)
   - **Lockfile & Schema Sync:** `npm run lockfile:check && npm run db:check`
   - **Build & Backend Tests:** `npm run test:backend && npm run build`
   - **Frontend E2E & Visual Verification** (when `apps/frontend/` is touched): Run `PLAYWRIGHT_PORT=42<pr-number> npm run test:e2e` and inspect `test-results/verify-*.png` via `view_file`.
3. **Clean Up Worktree**:
   ```bash
   git worktree remove .worktrees/pr-<pr-number>
   ```

---

## 3. Two-Axis Evaluation

### Axis A: Spec & Acceptance Criteria Compliance
- Verify every requirement and acceptance criterion in the linked issue(s) is implemented and covered by tests without scope creep.

### Axis B: Coding Standards & Architectural Invariants ([`CODING_STANDARDS.md`](../../CODING_STANDARDS.md))
- **AST & Anti-Slop:** Every `as <Type>` cast has a preceding `// SAFETY:` comment; blank lines precede `if`/`for`/`switch`/`return`; no runtime `typeof` in domain/storage modules; no dead code.
- **Frontend & Map Invariants:** `100dvh` (`h-dvh`) + `overscroll-none` on app shell; `isolate z-0` stacking context on map container & `.leaflet-container`; parity across all 4 map engines.
- **Backend & Domain Invariants:** `Europe/Berlin` timezone for DBB kickoff cutoffs; `drizzle/migrations/` generated whenever `schema.ts` changes; filter parity between `MatchesService` and `use-matches.ts`.

---

## 4. Verdict & GitHub Submission

- **Approve:**
  ```bash
  gh pr review <pr-number> --approve --body "<formatted-markdown-review>"
  ```
- **Request Changes:**
  ```bash
  gh pr review <pr-number> --request-changes --body "<formatted-markdown-review>"
  ```
