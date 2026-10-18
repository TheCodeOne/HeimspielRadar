---
name: review-pr
description: Protocol for reviewing a GitHub Pull Request against linked issue acceptance criteria, repository standards, and anti-slop rules using isolated git worktrees.
---

# Pull Request Reviewer Protocol (Worktree-Isolated)

> [!IMPORTANT]
> **STRICT ISOLATION RULE**: NEVER execute `git checkout` or `git switch` in the root repository (`/Users/dimi/Documents/git/sundayleague`). Automated checks must run inside a temporary Git Worktree (`.worktrees/pr-<number>`) or via diff inspection.

---

## 1. Inspection & Context Gathering

1. **Inspect Pull Request Details**:
   ```bash
   gh pr view <pr-number> --json number,title,body,headRefName,baseRefName
   ```
2. **Fetch the Unified Diff**:
   ```bash
   gh pr diff <pr-number>
   ```
3. **Identify & Fetch Linked Issue(s)**:
   Extract issue references from the PR title or body (e.g. `closes #5`, `resolves #1`). Fetch the issue requirements and Acceptance Criteria:
   ```bash
   gh issue view <issue-number>
   ```

---

## 2. Automated Quality Gates in Worktree

To execute build, lint, or tests against the PR branch:
1. **Create Temporary PR Worktree**:
   ```bash
   git worktree add .worktrees/pr-<pr-number> <headRefName>
   ln -s ../../node_modules .worktrees/pr-<pr-number>/node_modules
   test -f .env.local && ln -s ../../.env.local .worktrees/pr-<pr-number>/.env.local
   ```
2. **Run Quality Gates INSIDE `.worktrees/pr-<pr-number>`**:
   *(Always set Cwd to `.worktrees/pr-<pr-number>`)*
   - **Oxlint & Anti-Slop:** `npx oxlint` (must exit 0)
   - **Build Verification:** `npm run build:backend` / `npm run build:frontend`
   - **Backend Tests:** `npm run test:backend`
   - **Frontend E2E & Visual Verification (for PRs touching `apps/frontend/`):** Run `PLAYWRIGHT_PORT=42<pr-number> npm run test:e2e` inside the PR worktree to boot the PR's Vite server and verify Desktop (`1280x800`) and Mobile (`390x844`) geometry, scroll-lock, and interactive behavior (optionally inspecting screenshots in `test-results/` via `view_file`).
3. **Clean Up Worktree Immediately**:
   ```bash
   git worktree remove .worktrees/pr-<pr-number>
   ```

---

## 3. Two-Axis Evaluation

Evaluate the PR across two distinct axes:

### Axis A: Spec & Acceptance Criteria Compliance
- Compare every requirement and acceptance criterion in the linked issue against the diff.
- Verify:
  - **Complete Coverage:** All requested items are implemented.
  - **Correctness:** Logic matches requirements without edge-case regressions.
  - **No Scope Creep:** No unsolicited refactoring or extraneous packages.

### Axis B: Standards & Anti-Slop Compliance
- **Anti-Slop:**
  - Every `as <Type>` cast MUST have a preceding `// SAFETY: <explanation>` comment.
  - Blank lines before control statements (`if`, `for`, `switch`, `return`).
  - No dead code, no unused imports.
- **Architecture:** Conformance with [**`GLOSSARY.md`**](file:///Users/dimi/Documents/git/sundayleague/GLOSSARY.md) and [**`docs/adr/`**](file:///Users/dimi/Documents/git/sundayleague/docs/adr/).

---

## 4. Verdict & GitHub Submission

Submit review via GitHub CLI:
- **If all criteria and quality gates pass:**
  ```bash
  gh pr review <pr-number> --approve --body "<formatted-markdown-review>"
  ```
- **If any acceptance criterion fails, anti-slop violations are found, or build/tests fail:**
  ```bash
  gh pr review <pr-number> --request-changes --body "<formatted-markdown-review>"
  ```
