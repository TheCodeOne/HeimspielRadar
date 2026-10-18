---
name: resolve-issue
description: Autonomous GitHub Issue resolution protocol using isolated git worktrees. Use when assigned a GitHub issue to implement, test, commit, and submit as a Pull Request.
---

# Issue Resolver Protocol (Worktree-Isolated)

> [!IMPORTANT]
> **STRICT ISOLATION RULE**: NEVER execute `git checkout` or `git switch` in the root repository. All branch creation, code modifications, testing, and commits must take place exclusively inside an isolated Git Worktree under `.worktrees/issue-<id>`.

---

## 1. Lifecycle Tagging & Worktree Setup

1. **Immediately Update GitHub Issue Tags**:
   As the **very first action**, update the issue lifecycle labels to indicate active development:
   ```bash
   gh issue edit <issue-id> --add-label "in-progress" --remove-label "blocked,ready"
   ```
2. **Read Issue Context**:
   ```bash
   gh issue view <issue-id>
   ```
3. **Create Dedicated Git Worktree**:
   ```bash
   git worktree add .worktrees/issue-<issue-id> -b feat/issue-<issue-id>-<slug> origin/main
   ```
4. **Symlink Dependencies & Config**:
   ```bash
   ln -s ../../node_modules .worktrees/issue-<issue-id>/node_modules
   test -f .env.local && ln -s ../../.env.local .worktrees/issue-<issue-id>/.env.local
   ```
5. **Mandatory Execution Path**:
   All subsequent tool calls (`run_command`, file modifications) MUST use:
   `Cwd: /Users/dimi/Documents/git/sundayleague/.worktrees/issue-<issue-id>`

---

## 2. Implementation Guidelines

- Consult [**`GLOSSARY.md`**](file:///Users/dimi/Documents/git/sundayleague/GLOSSARY.md) for domain concepts and terminology.
- Follow architectural decisions in [**`docs/adr/`**](file:///Users/dimi/Documents/git/sundayleague/docs/adr/).
- Adhere to the code standards documented in [**`AGENTS.md`**](file:///Users/dimi/Documents/git/sundayleague/AGENTS.md):
  - **No AI-Slop:** Avoid chained type assertions (`as unknown as ...`), redundant runtime guards, or cramped walls of code.
  - **Readable Spacing:** Add blank lines before control statements (`if`, `for`, `return`) as enforced by `anti-slop/require-readable-spacing`.
  - **Type Assertions:** When `as Type` is necessary (e.g. parsing external JSON), prepend an explicit justification:
    ```typescript
    // SAFETY: DBB REST API guarantees DbbSpielplanResponse structure
    const data = (await res.json()) as DbbSpielplanResponse;
    ```
  - **Clean Imports:** No unused imports or dead code.

---

## 3. Quality Gates (Executed Inside the Worktree)

Inside `.worktrees/issue-<issue-id>`:
1. **Oxlint & Anti-Slop Check:**
   ```bash
   npx oxlint
   ```
   *Must exit with code 0 (zero errors).*
2. **Build Verification:**
   - For backend changes: `npm run build:backend`
   - For frontend changes: `npm run build:frontend`
   - For monorepo changes: `npm run build`
   *Must compile with zero errors.*
3. **Automated Tests:**
   ```bash
   npm run test:backend
   ```

---

## 4. Commit & Pull Request Submission

From within `.worktrees/issue-<issue-id>`:
1. Stage and commit with Conventional Commits referencing the issue:
   ```bash
   git add .
   git commit -m "feat(<scope>): <concise description> (closes #<id>)"
   ```
2. Push the branch:
   ```bash
   git push -u origin feat/issue-<id>-<slug>
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
   - [x] Tests pass

   Closes #<id>"
   ```
4. Output the created PR URL as the deliverable.
