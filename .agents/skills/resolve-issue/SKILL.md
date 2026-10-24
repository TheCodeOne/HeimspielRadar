---
name: resolve-issue
description: Autonomous GitHub Issue resolution protocol using isolated git worktrees. Use when assigned a GitHub issue to implement, test, commit, and submit as a Pull Request.
---

# Issue Resolver Protocol (Worktree-Isolated)

Execute all branch creation, file edits, builds, and tests inside an isolated Git Worktree under `.worktrees/issue-<id>` so the root repository (`/Users/dimi/Documents/git/sundayleague`) and any running local processes remain untouched.

---

## 1. Lifecycle Tagging & Worktree Setup

1. **Update GitHub Issue Label & Sync Kanban Board**:
   Add issue to [**HeimspielRadar Kanban Board**](https://github.com/users/TheCodeOne/projects/2) (GitHub Project #2):
   ```bash
   gh issue edit <issue-id> --add-label "in-progress" --remove-label "blocked,ready"
   gh project item-add 2 --owner TheCodeOne --url "https://github.com/TheCodeOne/HeimspielRadar/issues/<issue-id>"
   ```
2. **Read Issue Context**:
   ```bash
   gh issue view <issue-id>
   ```
3. **Create Dedicated Git Worktree**:
   ```bash
   git fetch origin main
   git worktree add .worktrees/issue-<issue-id> -b feat/issue-<issue-id>-<slug> origin/main
   ln -s ../../node_modules .worktrees/issue-<issue-id>/node_modules
   test -f .env.local && ln -s ../../.env.local .worktrees/issue-<issue-id>/.env.local
   ```
4. **Execution Path**:
   Set `Cwd` on all subsequent `run_command` calls and target all file edits to:
   `/Users/dimi/Documents/git/sundayleague/.worktrees/issue-<issue-id>`

---

## 2. Implementation & Co-Change Rules

- Read [**`CODING_STANDARDS.md`**](../../CODING_STANDARDS.md), [**`GLOSSARY.md`**](../../GLOSSARY.md), and [**`docs/adr/`**](../../docs/adr/) before writing code.
- **Adding or Updating npm Dependencies Inside a Worktree**:
  Because `node_modules` is symlinked to the root repository, running `npm install` directly against the symlink mutates the root `node_modules` and prunes packages from `package-lock.json`. When modifying `package.json`, update `package-lock.json` safely:
  ```bash
  rm -f node_modules
  npm install --package-lock-only --ignore-scripts
  npm run lockfile:check
  ln -s ../../node_modules node_modules
  ```
- **Modifying Database Schema (`apps/backend/src/app/database/schema.ts`)**:
  `DatabaseModule.onModuleInit` runs SQL migrations from `drizzle/migrations/` on startup. Whenever `schema.ts` is modified, generate and verify the migration inside the worktree:
  ```bash
  npm run db:generate
  npm run db:check
  ```

---

## 3. Quality Gates (Executed Inside `.worktrees/issue-<issue-id>`)

1. **Oxlint & Anti-Slop Check**:
   ```bash
   npx oxlint
   ```
   *(Completion criterion: exits with code 0, zero errors and zero warnings.)*
2. **Schema & Lockfile Checks** (when `schema.ts` or `package.json` changed):
   ```bash
   npm run db:check
   npm run lockfile:check
   ```
3. **Build & Backend Unit Tests**:
   ```bash
   npm run test:backend
   npm run build
   ```
4. **Local Visual & Interactive Verification with Playwright** (mandatory when `apps/frontend/` is modified):
   - **Step 1 (Interactive E2E Verification)**: Add or update a Playwright test in `e2e/` that exercises the implemented feature or bugfix, and run it on a worktree-specific port so Playwright boots this worktree's own Vite server:
     ```bash
     PLAYWRIGHT_PORT=42<issue-id> npm run test:e2e
     ```
   - **Step 2 (Visual Self-Check via `view_file`)**: Capture Desktop (`1280x800`) and Mobile (`390x844`) screenshots (e.g. `test-results/verify-desktop-chromium.png` and `test-results/verify-mobile-chromium.png`) and inspect both PNG files using `view_file` to verify 100% map geometry, `100dvh` scroll-lock, and overlay stacking (`isolate z-0`).

---

## 4. Commit & Pull Request Submission

From within `.worktrees/issue-<issue-id>`:
1. Stage and commit using Conventional Commits referencing the issue:
   ```bash
   git add .
   git commit -m "feat(<scope>): <concise description> (closes #<id>)"
   ```
2. Push the branch and open a Pull Request:
   ```bash
   git push -u origin feat/issue-<id>-<slug>
   gh pr create \
     --title "feat(<scope>): <title> (closes #<id>)" \
     --body "## Summary
   Resolves #<id>.

   ## Changes Made
   - <bullet points of key changes>

   ## Verification
   - [x] \`npx oxlint\` passes with 0 errors
   - [x] Build & unit tests pass cleanly
   - [x] Playwright E2E & visual screenshots verified (if frontend touched)

   Closes #<id>"
   ```
3. Add the newly created Pull Request to the Kanban Board:
   ```bash
   gh project item-add 2 --owner TheCodeOne --url "https://github.com/TheCodeOne/HeimspielRadar/pull/<pr-number>"
   ```
