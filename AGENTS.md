# HeimspielRadar Agent Operating Guide

Welcome to the HeimspielRadar repository. This guide defines the universal protocols that **all autonomous agents** (Overseer, Issue Resolvers, and PR Reviewers) must strictly follow.

---

## 1. Issue Lifecycle & Mandatory GitHub Tag Management

Every agent working on an issue or PR is responsible for keeping the GitHub board accurate and real-time.

### Label Taxonomy:
* `in-progress` (Blue): Active development by an agent.
* `blocked` (Amber): Dependent on another issue. Cannot proceed until prerequisite PR is merged.
* `ready` (Green): Unblocked and ready to be picked up by an agent.
* `needs:grill-me` (Red/Rose): High-risk architectural decision or external credentials needed. Requires an interactive Grill-Me alignment session with the human. **Do NOT start autonomously.**

### Mandatory Rule upon Starting Work:
As the **very first action** when assigned an issue, the agent MUST transition its labels:
```bash
gh issue edit <issue-id> --add-label "in-progress" --remove-label "blocked,ready"
```

### Mandatory Rule upon Opening a Pull Request:
Always link the issue in the PR title and description using GitHub keywords (e.g. `(closes #<id>)` or `Resolves #<id>`) so GitHub automatically closes the issue when merged.

---

## 2. Git Worktree Isolation Protocol

To enable seamless, conflict-free parallel execution of multiple autonomous agents:

> [!IMPORTANT]
> **STRICT ISOLATION RULE**: NEVER execute `git checkout` or `git switch` in the root repository (`/Users/dimi/Documents/git/sundayleague`).

* Every task runs inside a dedicated Git Worktree:
  - Issue Resolvers: `.worktrees/issue-<id>`
  - PR Reviewers: `.worktrees/pr-<number>`
* Symlink shared dependencies from the root:
  ```bash
  ln -s ../../node_modules .worktrees/issue-<id>/node_modules
  test -f .env.local && ln -s ../../.env.local .worktrees/issue-<id>/.env.local
  ```
* All command executions (`run_command` with `Cwd`) and file modifications MUST be strictly confined within the assigned `.worktrees/...` path.

---

## 3. Anti-AI-Slop Standards & Quality Gates

This repository strictly enforces AST-level rules via **Oxlint** with Dillon Mulroy's vendored `anti-slop` plugin:

1. **Type Assertion Invariants**:
   Every single `as <Type>` cast MUST be preceded directly by an explicit justification comment:
   ```typescript
   // SAFETY: DBB REST API guarantees DbbSpielplanResponse structure
   const data = (await res.json()) as DbbSpielplanResponse;
   ```
2. **Readable Spacing**:
   Control-flow statements (`if`, `for`, `switch`, `return`) and multiline variable declarations MUST have a preceding blank line (`anti-slop/require-readable-spacing`).
3. **No Lazy Hacks**:
   No `as unknown as Type`, no unevidenced `any`, no dead code or unused imports.
4. **Automated Verification**:
   Before committing, agents MUST ensure:
   - `npx oxlint` exits with code 0 (zero errors, zero warnings).
   - Relevant build passes (`npm run build:backend` / `npm run build:frontend` / `npm run build`).
   - Relevant tests pass (`npm run test:backend`).

---

## 4. Domain & Architectural Anchors
* **GLOSSARY.md**: Consult for canonical domain terms (*Heimspiel*, *Match*, *Venue*, *Radius*, *Map Spike*).
* **docs/adr/**:
  - `docs/adr/0001-monolith-static-serving.md`: Monolithic static asset serving via NestJS backend.
  - `docs/adr/0002-multi-spike-map-architecture.md`: 4-engine polymorphic map spike architecture (`MapEngineProps`).
