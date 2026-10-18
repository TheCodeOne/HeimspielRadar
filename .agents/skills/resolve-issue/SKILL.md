---
name: resolve-issue
description: Autonomous GitHub Issue resolution protocol. Use when assigned a GitHub issue to implement, test, commit, and submit as a Pull Request.
---

# Issue Resolver Protocol

This skill guides an autonomous coding agent through resolving a GitHub issue, implementing changes, satisfying quality gates, and opening a Pull Request.

---

## 1. Preparation & Branching
1. Read the assigned GitHub issue details:
   ```bash
   gh issue view <issue-id>
   ```
2. Ensure you start from a clean `main` branch:
   ```bash
   git checkout main && git pull origin main
   ```
3. Create a dedicated feature branch for the issue:
   ```bash
   git checkout -b feat/issue-<id>-<short-slug>
   ```

---

## 2. Implementation Guidelines
- Consult [**`GLOSSARY.md`**](file:///Users/dimi/Documents/git/sundayleague/GLOSSARY.md) for domain concepts and terminology.
- Follow architectural decisions in [**`docs/adr/`**](file:///Users/dimi/Documents/git/sundayleague/docs/adr/).
- Adhere to the code standards documented in [**`apps/backend/AGENTS.md`**](file:///Users/dimi/Documents/git/sundayleague/apps/backend/AGENTS.md):
  - **No AI-Slop:** Avoid chained type assertions (`as unknown as ...`), redundant runtime guards, or cramped walls of code.
  - **Readable Spacing:** Add blank lines before control statements (`if`, `for`, `return`) as enforced by `anti-slop/require-readable-spacing`.
  - **Type Assertions:** When `as Type` is necessary (e.g. parsing external JSON), prepend an explicit justification:
    ```typescript
    // SAFETY: DBB REST API guarantees DbbSpielplanResponse structure
    const data = (await res.json()) as DbbSpielplanResponse;
    ```

---

## 3. Quality Gates (Must Pass Before Commit)
Run the required checks for the modified workspace:
1. **Oxlint & Anti-Slop Check:**
   ```bash
   npx oxlint
   ```
   *Must exit with code 0 (zero errors).*
2. **Build Verification:**
   - For backend changes: `npm run build:backend`
   - For frontend changes: `npm run build:frontend` (or `nx build frontend`)
   - For monorepo changes: `npm run build`
   *Must compile with zero errors.*

---

## 4. Commit & Pull Request Submission
1. Stage and commit with Conventional Commits referencing the issue:
   ```bash
   git add .
   git commit -m "feat(<scope>): <concise description> (closes #<id>)"
   ```
2. Push the branch to remote:
   ```bash
   git push -u origin feat/issue-<id>-<short-slug>
   ```
3. Open a GitHub Pull Request via `gh pr create`:
   ```bash
   gh pr create \
     --title "feat(<scope>): <title> (closes #<id>)" \
     --body "## Summary
   Resolves #<id>.

   ## Changes Made
   - <bullet points of key changes>

   ## Verification
   - [x] \`npx oxlint\` passes with 0 errors
   - [x] Build passes cleanly

   Closes #<id>"
   ```
4. Output the created PR URL as the final deliverable.
