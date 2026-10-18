# ReFlow — AI Implementation Rules

These rules apply to any AI agent implementing changes in the ReFlow codebase. Agents read this file automatically.

ReFlow is a three-tier RPA SaaS (Next.js cloud control plane, Electron desktop worker, CDP automation engine) built by AbuZar and Alina. Planning, implementation, and review roles are defined in [docs/agent-context/AI_WORKFLOW.md](docs/agent-context/AI_WORKFLOW.md).

## Operating Modes

Always identify which mode the user's prompt requests (if the prompt doesn't name a mode, default to Careful mode):

- **Quick mode**:
  - A fix touching one or two files, with no change to authentication, schema, runner tokens, or tenant isolation.
  - Used for targeted fixes and self-contained tasks with minimal scope (one concern per prompt).
  - Implement directly, run relevant checks, and report what changed and what was run.
- **Careful mode**:
  - Anything that is not Quick mode, or any change to authentication, schema, runner tokens, or tenant isolation, regardless of size.
  - Used for multi-step features, architectural changes, or high-risk tasks.
  - Work strictly follows a plan that the user has explicitly approved.
  - For any security, authentication, or data-isolation change, tests must be written before implementing the fix.

## Stop-and-Ask Rule

If the prompt's assumptions do not match the actual code (for example: a referenced file is missing, an API contract differs, or existing behavior contradicts the prompt), **stop and report immediately before editing any files**. Do not proceed on invalid assumptions.

## Out-of-Scope Rule

If you discover a bug, security flaw, or code quality issue outside the assigned task, **report it in the completion report and do not fix it**. Keep changes strictly scoped to the requested task.

## Git Rules

- Before starting, run `git status` and stop if there are uncommitted changes.
- Always work on a branch named for the task (e.g., `feat/...`, `fix/...`, `docs/...`).
- **Never commit directly to `main`**.
- Make small, atomic commits with clear, descriptive messages.
- Never run `git reset --hard`, `git clean`, or any command that discards uncommitted work without the user's explicit approval.
- Do not merge branches or push to any remote unless the user explicitly asks.
- **Never force-push (`git push --force`)** and never rewrite published git history.

## Read-First List (Exact Paths)

Before modifying code in sensitive runtime boundaries, read the relevant context document:

- [docs/agent-context/CURRENT_STATE.md](docs/agent-context/CURRENT_STATE.md): Read before touching runner authentication, the desktop bridge, or tenant data boundaries to review known security audit findings and active risk areas.
- [docs/agent-context/ARCHITECTURE.md](docs/agent-context/ARCHITECTURE.md) (and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)): Read before touching auth (`apps/web/src/lib/auth/`), the local HTTP bridge (`apps/desktop/src/main/http-bridge.js`), the runner daemon / engine (`packages/engine/`), or cloud APIs (`apps/web/src/app/api/v1/`).

## Nested Instructions

- Before editing `apps/web`, you **must** read [apps/web/AGENTS.md](apps/web/AGENTS.md).
- Check for nested `AGENTS.md` or `CLAUDE.md` in any package before making changes there.

## Context Docs Rule

Context documents (in `docs/agent-context/` and `docs/`) are updated **only when the task explicitly asks**. Do not edit or update context documentation on your own initiative.

## Evidence & Verification Standard

- **Never claim a test passed, a command ran, or code changed without concrete evidence.**
- If a command was not run or cannot be run, state that clearly instead of implying success.
- Distinguish verified facts from unverified assumptions.

## Completion Report

Every completed task must conclude with a report structured into these exact sections:

1. **Summary**: High-level explanation of what was implemented or resolved.
2. **Files changed**: Complete list of created, modified, or deleted files.
3. **Commands run with actual results**: Exact commands executed and their output or exit status.
4. **Known gaps**: Unhandled edge cases, missing test coverage, or deferred items.
5. **Deviations from the prompt**: Any departure from the requested plan and the justification.
6. **Anything the user must verify by hand**: Manual steps, visual checks, or browser interactions needed to confirm behavior.
