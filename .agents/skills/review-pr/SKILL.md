---
name: review-pr
description: Protocol for reviewing a GitHub Pull Request against linked issue acceptance criteria, repository standards, and anti-slop rules. Evaluates whether the PR is ready to merge and submits an actionable review verdict.
---

# Pull Request Reviewer Protocol

This skill guides an autonomous review agent through evaluating a GitHub Pull Request for HeimspielRadar. The reviewer inspects the code diff, verifies compliance with the linked issue's acceptance criteria, ensures adherence to architectural decisions (ADRs) and anti-slop standards, runs automated quality gates, and posts an official GitHub review verdict (`APPROVE` or `REQUEST_CHANGES`).

---

## 1. Inspection & Context Gathering

1. **Inspect Pull Request Details**:
   ```bash
   gh pr view <pr-number> --json number,title,body,headRefName,baseRefName,headRepositoryOwner
   ```
2. **Fetch the Unified Diff**:
   ```bash
   gh pr diff <pr-number>
   ```
3. **Identify & Fetch Linked Issue(s)**:
   Extract issue references from the PR title or description (e.g. `closes #5`, `resolves #2`, `fixes #1`). Fetch the issue description and acceptance criteria:
   ```bash
   gh issue view <issue-number>
   ```

---

## 2. Review Axes

The review must evaluate the Pull Request across two separate, distinct axes:

### Axis A: Spec & Acceptance Criteria Compliance
- Compare every single requirement and Acceptance Criterion in the linked issue against the diff.
- Verify:
  - **Complete Coverage:** Are all requested features, scripts, or configurations implemented?
  - **Correctness:** Does the implementation do what the issue specifies without subtle logic flaws?
  - **No Scope Creep:** Did the author add unnecessary files, dependencies, or unrequested refactorings?

### Axis B: Code Standards, Architecture & Anti-Slop
- **Domain & Architecture Alignment:**
  - Adherence to [**`GLOSSARY.md`**](file:///Users/dimi/Documents/git/sundayleague/GLOSSARY.md) for domain naming and concepts.
  - Adherence to [**`docs/adr/`**](file:///Users/dimi/Documents/git/sundayleague/docs/adr/) architectural decisions.
- **Anti-AI-Slop Rules (Oxlint / Dillon Mulroy ruleset):**
  - **Type Assertions:** Every single `as <Type>` cast must have an explicit `// SAFETY: <justification>` comment directly above it explaining why the external payload conforms.
  - **Readable Spacing:** Control-flow statements (`if`, `for`, `switch`, `return`) and multiline blocks must have preceding blank lines.
  - **No Lazy Hacks:** No chained type assertions (`as unknown as ...`), unnecessary any-casts, or unhandled promise errors.
  - **Dead Code:** No unused imports, unused variables, or orphan helper functions.

---

## 3. Automated Quality Gates

Checkout the PR branch or run the checks in an isolated worktree to verify that automated tooling passes:
1. **Oxlint & Anti-Slop:**
   ```bash
   npx oxlint
   ```
   *Must exit with 0 errors and 0 warnings.*
2. **Type Checking & Build:**
   ```bash
   npm run build:backend  # if backend files were changed
   npm run build:frontend # if frontend files were changed
   ```
   *Must compile cleanly with zero errors.*
3. **Automated Tests:**
   ```bash
   npm run test:backend   # if backend tests exist
   ```
   *All tests must pass.*

---

## 4. Verdict & GitHub Submission

Formulate a structured review summary following this template:

```markdown
## PR Review: #<pr-number> - <pr-title>

### 1. Acceptance Criteria Checklist
- [x] Criterion 1 (Implemented in `path/to/file.ts`)
- [ ] Criterion 2 (Missing or flawed)

### 2. Standards & Quality Gates
- [x] \`npx oxlint\` anti-slop check (0 errors, 0 warnings)
- [x] Build verification passes cleanly
- [x] Unit/Integration tests pass

### 3. Detailed Feedback & Findings
- **Strengths:** <concise summary of clean implementations>
- **Findings / Blockers:** <specific code references, or "None">

### 4. Verdict
**APPROVED** / **CHANGES REQUESTED**
```

### Submitting the Review via GitHub CLI:
- **If all criteria and quality gates pass:**
  ```bash
  gh pr review <pr-number> --approve --body "<formatted-markdown-review>"
  ```
- **If any acceptance criterion fails, anti-slop violations are found, or build/tests fail:**
  ```bash
  gh pr review <pr-number> --request-changes --body "<formatted-markdown-review>"
  ```
