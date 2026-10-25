---
name: review-pr
description: Protocol for reviewing a GitHub Pull Request: understanding intent, validating codebase integration, and checking against acceptance criteria, CODING_STANDARDS.md, and CI status.
---

# Pull Request Reviewer Protocol

Review Pull Requests by thoroughly understanding the changes and verifying their fit with the existing codebase via `gh pr diff`, full-file/call-site inspection, and `gh pr checks`—without creating a worktree or re-running build/lint/test commands that `.github/workflows/ci.yml` already executes in CI.

---

## 1. Context, Diff & CI Status Gathering

1. **Inspect PR Metadata & CI Checks**:
   ```bash
   gh pr view <pr-number> --json number,title,body,headRefName,baseRefName,mergeable,mergeStateStatus
   gh pr checks <pr-number>
   ```
   *(Verify that the `CI Quality Gates` GitHub Actions job passed. If CI is still running or failed, inspect the failure with `gh run view` rather than rebuilding locally.)*
2. **Fetch the Unified Diff**:
   ```bash
   gh pr diff <pr-number>
   ```
3. **Read Linked Issue(s), Standards & ADRs**:
   - Fetch every linked issue referenced in the PR (`gh issue view <issue-number>`).
   - Read [**`CODING_STANDARDS.md`**](../../CODING_STANDARDS.md), [**`GLOSSARY.md`**](../../GLOSSARY.md), and [**`docs/adr/`**](../../docs/adr/).
4. **Deep-Dive into Surrounding Code & Call-Sites (Contextual Inspection)**:
   - **Never review diff hunks in isolation.** Open and read the full enclosing files for changed code to understand the surrounding module's architecture and state flow.
   - Search the codebase for call-sites, usages, and downstream consumers of any altered functions, types, components, or endpoints to ensure complete compatibility.

---

## 2. Three-Axis Evaluation

### Axis A: Semantic Fit & Codebase Integration ("Does this make sense here?")
- **Intent & Logic:** Do you understand the problem and why this specific solution was chosen? Is the control flow logical, readable, and robust?
- **Harmony with Existing Patterns:** Does the change follow established idioms in the codebase? Does it reuse existing helper functions, hooks, UI primitives, and domain types rather than reinventing parallel mechanisms?
- **Side Effects & Call-Site Safety:** Does the change introduce hidden side effects, unexpected state mutations, or break caller expectations?
- **Module Fit:** Does the new code belong in the files it was added to, or is it introducing misplaced responsibilities (e.g. backend business logic in components, or UI formatting in data-access layers)?

### Axis B: Spec & Acceptance Criteria Compliance
- Compare every requirement and acceptance criterion in the linked issue(s) against `gh pr diff <pr-number>`.
- Verify:
  - **Complete Coverage:** All requested behaviors and edge cases are implemented and covered by tests in the diff.
  - **No Scope Creep:** No unrelated refactoring or unrequested dependencies.

### Axis C: Coding Standards & Architectural Invariants ([`CODING_STANDARDS.md`](../../CODING_STANDARDS.md))
- **AST & Anti-Slop:** Every `as <Type>` cast has a preceding `// SAFETY:` comment; blank lines precede `if`/`for`/`switch`/`return`; no runtime `typeof` in domain/storage modules; no dead code.
- **Frontend & Map Invariants:** `100dvh` (`h-dvh`) + `overscroll-none` on app shell; `isolate z-0` stacking context on map container & `.leaflet-container`; parity across all 4 map engines (`OpenLayersEngine`, `MapLibreEngine`, `LeafletEngine`, `PigeonEngine`).
- **Backend & Domain Invariants:** `Europe/Berlin` timezone for DBB kickoff cutoffs; `drizzle/migrations/` SQL migration included whenever `schema.ts` is modified; filter parity between `MatchesService` and `use-matches.ts`.

---

## 3. Verdict & GitHub Submission

- **Approve:**
  ```bash
  gh pr review <pr-number> --approve --body "<formatted-markdown-review>"
  ```
- **Request Changes:**
  ```bash
  gh pr review <pr-number> --request-changes --body "<formatted-markdown-review>"
  ```
