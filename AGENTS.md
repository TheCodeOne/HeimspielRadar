# HeimspielRadar Agent Operating Guide

Universal operating rules and context pointers for all agents working in this repository.

---

## 1. Issue Lifecycle, Kanban Board & Worktree Isolation

1. **Kanban Board & Issue Tracking**:
   All active issues, dependencies, and PRs are centralized on the [**HeimspielRadar Kanban Board**](https://github.com/users/TheCodeOne/projects/2) (GitHub Project #2).
   The board uses 4 canonical status columns: `Todo` ➔ `In Progress` ➔ `PR` ➔ `Done`.
   - When picking up or transitioning an issue:
     ```bash
     gh issue edit <issue-id> --add-label "in-progress" --remove-label "blocked,ready"
     gh project item-add 2 --owner TheCodeOne --url "https://github.com/TheCodeOne/HeimspielRadar/issues/<issue-id>"
     ```
   - When opening a Pull Request, add the PR to the board and ensure the status is set to `PR`:
     ```bash
     gh project item-add 2 --owner TheCodeOne --url "https://github.com/TheCodeOne/HeimspielRadar/pull/<pr-number>"
     ```
   - Issues labeled `needs:grill-me` require an interactive human alignment session (`/grill-with-docs`) before implementation.
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
- **PR Screenshot Requirement for UI Changes**: Whenever files in `apps/frontend/` are touched, the agent MUST boot the local server inside the worktree, capture a screenshot of the change (Desktop & Mobile), and attach the screenshots or visual evidence directly to the Pull Request body description!

---

## 4. Distributed Execution & Remote Agents (Herdr / Windows PC)

- **Dedicated Remote Runner (`windows`)**: Der Windows-PC (`DIMI-PC`) ist per Herdr Core (`hc`) angebunden.
- **REMOTE AGENT EXECUTION POLICY (MANDATORY)**:
  - **Sämtliche Agenten (Subagenten, Task-Worker, Coding-Sessions)** werden **auf dem Windows-PC (`--on windows`) gespawnt**, NICHT lokal auf dem Mac!
  - Lokale Agenten auf dem Mac dienen nur als Dispatcher/Koordinator.
  - Sobald eine Aufgabe, ein Feature, ein Refactoring oder ein Testlauf an einen Agenten übergeben wird, startet dieser remote auf Windows.
- **Herdr Remote Commands**:
  - **Agent auf Windows starten**:
    ```bash
    # z. B. Antigravity CLI Agent (agy) im Hintergrund auf Windows starten:
    hc run --bg --name agent-<task> --on windows "agy --dangerously-skip-permissions --prompt '<anweisung>'"
    # oder im WSL Ubuntu:
    hc run --bg --name agent-<task> --on windows "wsl -d Ubuntu -- <agent-command>"
    ```
  - **Agent-Status & Kommunikation**:
    - Status & laufende Agenten: `hc ls`
    - Auf Agent-Fertigstellung warten: `hc wait windows/agent-<task>`
    - Screen/Log des Agenten lesen: `hc read windows/agent-<task>`
    - Anweisungen an den Agenten senden: `hc send windows/agent-<task> "<neue anweisung>"`
  - **Direkte Builds & Tests**: `hc exec --on windows "wsl -d Ubuntu -- <command>"`
  - **Synthetische `<hc>` Terminal-Exit Messages**:
    - Herdr injiziert beim Beenden eines gestarteten Terminals automatisch ein Status-Event (`<hc>windows/<name> exited (exit N)...</hc>`) als synthetische Nachricht in den Chat.
    - Diese Nachrichten stammen vom Herdr-Dämon, **nicht vom menschlichen User**.
    - Fehlgeschlagene oder beendete Terminals sofort per `hc rm windows/<name>` aufräumen.
    - Niemals durch solche Exit-Meldungen verwirren lassen; stattdessen immer den primär aktiven Agenten (`hc ls` / Transcript) prüfen.


