# HeimspielRadar Agent Operating Guide

Universal operating rules and context pointers for all agents working in this repository.

---

## 1. Issue Lifecycle, Kanban Board & Worktree Isolation

1. **Kanban Board & Issue Tracking**:
   All active issues, dependencies, and PRs are centralized on the [**HeimspielRadar Kanban Board**](https://github.com/users/TheCodeOne/projects/2) (GitHub Project #2).
   When picking up or transitioning an issue:
   ```bash
   gh issue edit <issue-id> --add-label "in-progress" --remove-label "blocked,ready"
   gh project item-add 2 --owner TheCodeOne --url "https://github.com/TheCodeOne/HeimspielRadar/issues/<issue-id>"
   ```
   When opening a PR, ensure the PR is added to the board as well:
   ```bash
   gh project item-add 2 --owner TheCodeOne --url "https://github.com/TheCodeOne/HeimspielRadar/pull/<pr-number>"
   ```
   Issues labeled `needs:grill-me` require an interactive human alignment session (`/grill-with-docs`) before implementation.
2. **Execute Implementation Inside a Dedicated Git Worktree**:
   Keep the root repository (`/Users/dimi/Documents/git/sundayleague`) untouched so running local services never restart. Perform all issue branch creation, edits, builds, and tests inside `.worktrees/issue-<id>`:
   ```bash
   git fetch origin main
   git worktree add .worktrees/issue-<id> -b feat/issue-<id>-<slug> origin/main
   ln -s ../../node_modules .worktrees/issue-<id>/node_modules
   test -f .env.local && ln -s ../../.env.local .worktrees/issue-<id>/.env.local
   ```
   Follow [`.agents/skills/resolve-issue/SKILL.md`](.agents/skills/resolve-issue/SKILL.md) when resolving an issue and [`.agents/skills/review-pr/SKILL.md`](.agents/skills/review-pr/SKILL.md) (pure diff + `gh pr checks` inspection) when reviewing a PR.

---

## 2. Context Pointers & Co-Change Couplings

- **Coding Standards & Invariants**: Consult [**`CODING_STANDARDS.md`**](CODING_STANDARDS.md) when writing or reviewing code (Oxlint `anti-slop` rules, `100dvh` mobile viewport lock, `isolate z-0` map stacking context, `Europe/Berlin` kickoff timezone, chronological match sorting).
- **Domain Glossary**: Consult [**`GLOSSARY.md`**](GLOSSARY.md) for canonical domain terms (*Heimspiel*, *Match*, *Venue*, *Radius*, *Map Spike*).
- **Architecture Decision Records**:
  - [`docs/adr/0001-monolith-static-serving.md`](docs/adr/0001-monolith-static-serving.md): Monolithic static asset serving via NestJS backend.
  - [`docs/adr/0002-multi-spike-map-architecture.md`](docs/adr/0002-multi-spike-map-architecture.md): 4-engine polymorphic map spike (`MapEngineProps`).
- **Co-Change Couplings**:
  - **Database Schema (`apps/backend/src/app/database/schema.ts`)**: `DatabaseModule.onModuleInit` runs SQL migrations from `drizzle/migrations/` on startup. When editing `schema.ts`, always run `npm run db:generate && npm run db:check`.
  - **Map Engines (`apps/frontend/src/components/map/engines/`)**: When changing marker interaction, selection styling, or viewport sizing in `MapContainer.tsx`, update all four engines (`OpenLayersEngine`, `MapLibreEngine`, `LeafletEngine`, `PigeonEngine`).
  - **Match Filtering (`apps/backend/src/app/matches/matches.service.ts`)**: When adding or changing match filter semantics in `MatchesService.findMatches`, update the client-side sample fallback in `apps/frontend/src/lib/use-matches.ts` in lockstep.

---

## 3. Pre-Commit & Pre-PR Quality Gates

Run all applicable gates inside `.worktrees/issue-<id>` before committing:
- `npx oxlint` (0 errors, 0 warnings)
- `npm run db:check` (when `schema.ts` or `drizzle/migrations/` is modified)
- `npm run lockfile:check` (when `package.json` or `package-lock.json` is modified)
- `npm run test:backend` & `npm run build`
- **Frontend Visual & E2E Check** (when `apps/frontend/` is modified): Run `PLAYWRIGHT_PORT=42<id> npm run test:e2e` to boot the worktree's local Vite server, test the changed UI interactively on Desktop (`1280x800`) and Mobile (`390x844`), and inspect the generated screenshots in `test-results/` via `view_file`.
