# AI Collaboration & Planning Workflow

## 1. Purpose and Architecture

This document defines the planning, architecture, implementation, and review workflow for ReFlow. It applies to human planners, AI planners, implementers, and reviewers alike, and is deliberately tool-agnostic: roles are described by responsibility rather than by vendor or product name.

Implementation rules for the executing agent are maintained separately in root [AGENTS.md](../../AGENTS.md).

All prompt handoffs, context sharing, and report transfers are handled manually by the user. There is no automated model-to-model communication or direct execution bridge.

## 2. Roles and Boundaries

Roles are defined by responsibility, not by which tool fills them. A single tool may fill several roles across different tasks, and role assignment is expected to move as tooling and access change:

- **The Planner**:
  - **Primary responsibility**: System architecture, multi-file planning, and implementation prompt drafting.
  - **Capability required**: Read access to the repository (directly or through a Repomix context pack) plus enough reasoning depth to evaluate complex logic and trade-offs.
  - **Workflow**: Analyzes requirements, applies the pushback rules for big modules, formulates trade-offs, and drafts the implementation prompt for the implementer.
- **The Implementer**:
  - **Primary responsibility**: Local code implementation and test execution.
  - **Capability required**: Direct file modification and terminal execution in the working directory.
  - **Workflow**: Reads root `AGENTS.md`, executes in Quick mode or Careful mode, writes negative tests before sensitive fixes, and returns a structured completion report.
- **The Verifier**:
  - **Primary responsibility**: Verification, regression checking, and final implementation review.
  - **Capability required**: The ability to inspect commits, diffs, branches, and code files directly rather than trusting report summaries.
  - **Workflow**: Compares actual git commits and pull request diffs against the original requirements and acceptance criteria.

### Why Roles Can Change
Roles are not rigid entitlements. They can change when:
- **Repository access changes**: If a verifier cannot read the repository directly, another tool with code access performs the review from diff packs or commit patches.
- **Quota and rate limits**: When one tool exhausts its usage quota, another capable tool assumes planning or review duties.
- **Context window requirements**: A refactor requiring an exceptionally large single-pass context window may require shifting planning to a tool with higher token limits.
- **Tooling updates**: When IDE extensions, local plugins, or platform capabilities evolve.

## 3. Quota Management Rules

Planning and review tooling consumes significant quota and must be used with discipline:

- **Quick fixes skip planning and review entirely**: Bug fixes, localized tweaks, typos, single-file edits, and straightforward improvements go straight to the implementer. Do not involve planner or verifier roles for routine edits.
- **Reserve planners and verifiers for Careful mode**: Involve them only for planning big modules, complex multi-step features, architectural refactors, or high-risk security audits.
- **Prefer narrow Repomix packs over full-repo packs**: When creating context packs for planners, pack only the relevant package or directory (for example, `apps/web`, `packages/engine`, or `apps/desktop`). Never generate or feed a full-monorepo pack when a targeted pack suffices. Narrow packs preserve context window token limits and reduce latency.

## 4. Repomix Snapshot Rules

No repository-level Repomix configuration file exists in the codebase. Therefore, exclusion patterns must be supplied explicitly with every pack command rather than relying on automatic configuration.

Every pack command must explicitly exclude `.env`, `.env.*`, and `*.pem` using Repomix's ignore option.

### Verified Command Format (Repomix 1.18.1)
The installed version of Repomix (`1.18.1`, verified via `npx repomix --version`) provides the `--ignore` / `-i` flag accepting comma-separated exclusion patterns.

The exact command format to run is:
```bash
npx repomix <directory> --style markdown -o <output-file> --ignore ".env,.env.*,*.pem"
```

Examples for targeted packs:
- **Web Plane**: `npx repomix apps/web --style markdown -o reflow-web.md --ignore ".env,.env.*,*.pem"`
- **Automation Engine**: `npx repomix packages/engine --style markdown -o reflow-engine.md --ignore ".env,.env.*,*.pem"`
- **Desktop Worker**: `npx repomix apps/desktop --style markdown -o reflow-desktop.md --ignore ".env,.env.*,*.pem"`

### Repository Safety
- **Never commit packs to the repository**: Repomix markdown packs (such as `reflow-web.md`, `reflow-engine.md`, `reflow-desktop-db.md`, or `repomix-output.txt`) must remain local, untracked, and ignored. Never stage or commit packs to git.

## 5. Pushback Rules for Big Modules Only

To prevent bureaucratic slowdowns, planners must not question or debate routine changes. Pushback and preliminary questioning are strictly reserved for **big modules**.

### Definition of a Big Module
A change qualifies as a big module if and only if it involves:
1. A new feature or new module.
2. A database schema change (e.g., Supabase table migrations, column alterations, or RLS policy updates).
3. Anything touching authentication, authorization, secrets, runner tokens, or tenant isolation.
4. A new external dependency (npm package or third-party service).
5. A refactoring that spans multiple files or packages.

### The Three Preliminary Questions
When presented with a big module, the planner must not draft an implementation prompt immediately. Instead, the planner must first ask the user **up to three structured questions**:
1. **The Main Goal**: What is the core business and technical outcome required?
2. **Approach Options & Recommendation**: What are the viable implementation approaches, and which one does the planner recommend with trade-offs?
3. **Workflow Changes**: How does this change the existing user journey, runner execution flow, or API contract?

*Small changes and routine fixes get no preliminary questions; the user or planner proceeds immediately with the prompt.*

## 6. Security Checklist for Auth and Tenant Changes

Whenever a task touches authentication (`apps/web/src/lib/auth/`), runner tokens, API routes (`apps/web/src/app/api/v1/`), or tenant isolation, the planner must incorporate this checklist into the prompt, and Flash must implement a test for every item before writing the fix:

- [ ] **Wrong, short, and guessed tokens**:
  - Test rejection of incorrect token strings.
  - Test rejection of short or truncated tokens (e.g., truncated `rf_live_` prefixes or missing secret).
  - Test rejection of guessed prefixes or fake UUID combinations.
- [ ] **Cross-tenant organization ID spoofing**:
  - Test that passing another organization's ID in query parameters (`?org_id=`), headers, or request bodies (`org_id`, `orgId`) is rejected or ignored.
  - Test that workflow and run operations are strictly scoped to the authenticated organization.
- [ ] **Missing or malformed fields**:
  - Test rejection when authorization headers, required body fields, or token payloads are absent, empty, or malformed.
- [ ] **Test coverage requirement**:
  - Every condition listed above must have an explicit automated test asserting rejection (HTTP 401 Unauthorized or 403 Forbidden).

## 7. Implementation Prompt Structure

When a planner prepares a Careful-mode prompt for the implementer, the prompt must include:
1. **Task Title & Mode**: Clearly marked as Careful mode.
2. **Goal & Source Scope**: Specific user-visible outcome and explicit files to inspect.
3. **Pre-Implementation Test Requirement**: Negative security tests required before fix code.
4. **Requirements & Edge Cases**: Detailed behavioral specifications.
5. **Acceptance Criteria**: Concrete, observable outcomes.
6. **Completion Report Requirement**: Mandate the six required report sections defined in root `AGENTS.md`.

## 8. Review and Verification Standard

When reviewing a completed task:
- The verifier inspects the commit directly through repository access, or reviews an explicit git diff.
- Verify against the code in the repository, not unverified claims in the completion report.
- Confirm all negative security tests were written and executed.
- Ensure no out-of-scope files were modified.
- If issues remain, issue one targeted correction prompt specifying the exact file and expected behavior.
