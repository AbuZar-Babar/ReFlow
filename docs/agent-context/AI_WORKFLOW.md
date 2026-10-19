# AI Collaboration & Planning Workflow

## 1. Purpose

This document describes how planning, implementation, and review actually happen on ReFlow today. It covers a single AI coding assistant working directly in the repository, alongside the human project owner.

Implementation rules — what the agent may and may not do — live in root [AGENTS.md](../../AGENTS.md). That file is authoritative. This document only explains the surrounding workflow and the reasoning behind it.

Where the two disagree, `AGENTS.md` wins.

## 2. How Work Is Divided

There are two participants, not three.

**The owner (human).** Decides what matters, approves or rejects proposals, reviews the result, and does the manual verification that only a person can do: opening a page, clicking through a flow, running the desktop worker, looking at a screen. The owner is the only one who can authorize new features, new dependencies, schema changes, or new API routes.

**The coding agent (AI).** Reads the repository, proposes an approach, writes code, runs the commands, and reports back in plain language. The agent works in the live codebase and is expected to exercise judgment — including refusing to build something that will not work.

There is no separate planner or verifier role. The agent plans its own work and checks its own work. The owner decides whether the outcome is right.

### Why it is not split into three roles

Earlier revisions of this document defined distinct Planner, Implementer, and Verifier roles, with manual handoffs between them and quota discipline to ration planning access. That structure was built for a chain of separate chat sessions where context could not carry over.

That constraint is gone. A single agent with repository access and command execution can plan, build, and check in one pass. Splitting it into roles would add handoff cost and lose context at every boundary, while the approval that genuinely matters — the owner's — happened at the end regardless.

Manual handoffs between AI tools are no longer part of this workflow.

## 3. What Happens on a Typical Task

1. **The owner states a goal.**
2. **The agent checks the ground.** It reads the code the change touches before proposing anything. If the request assumes something the code does not do, the agent says so and stops rather than inventing a plausible implementation.
3. **The agent pushes back if warranted.** For anything large or uncertain, the agent assesses feasibility first: does this fit the existing architecture, does something in the codebase already do most of it, what is the smallest version that delivers the outcome, what will break. If the idea is harder than it sounds, the agent says so before writing code.
4. **The owner decides.** The agent does not build a new feature, add a dependency, add a migration, or add an API route without a clear yes.
5. **The agent implements.** Improved existing behavior is the default; new features require approval.
6. **The agent verifies.** It runs the relevant commands and records what it actually saw. If a command was not run, it says so.
7. **The agent reports.** A short plain-language summary: what changed, why the old version was inadequate, what is still wrong, what the owner needs to do by hand, and what was noticed but deliberately left alone.

The full rules behind steps 2, 3, 5, and 7 are in `AGENTS.md`, sections 1 through 4 and 12.

## 4. When the Agent Must Stop and Ask

The agent pauses and waits for the owner in these situations:

- **The request does not match the code.** A referenced file, function, endpoint, or environment variable does not exist, or the existing behavior contradicts the request.
- **A new feature is needed.** The agent proposes it and waits; it does not build it unprompted.
- **A new dependency, migration, schema change, RLS policy, API route, or top-level package is needed.**
- **A large or vague task may not be feasible as described.** The agent explains the obstacle and offers the smaller version that works.

Routine fixes, small improvements, and cleanup inside the current task need no ceremony — the agent proceeds and reports.

## 5. Security and Tenant Boundary Work

Work touching authentication, runner tokens, tenant isolation, the desktop bridge, or RLS is the highest-risk category in this repository. The specific invariants are enumerated in `AGENTS.md`, section 6, and known findings are tracked in [CURRENT_STATE.md](CURRENT_STATE.md).

Testing is not mandatory on this project. For security and tenant-isolation changes, however, a test that asserts the rejection is the only durable evidence that a fix holds — the next change can silently reopen a hole without one. Write it when practical; prefer it when the change is about rejecting an unauthorized caller.

Negative cases worth covering when the work touches these boundaries:

- **Wrong, short, or guessed runner tokens.** Incorrect strings, truncated `rf_live_` prefixes, missing secrets, and fabricated org IDs should all be rejected.
- **Cross-tenant spoofing.** An organization ID supplied through `?org_id=`, a header, or `body.orgId` must never be honored; tenant scope comes from the authenticated session alone.
- **Missing or malformed input.** Absent or empty authorization headers, required body fields, and token payloads should be rejected.

## 6. Reviewing a Finished Task

The owner reviews against the code, not against the agent's summary. A confident report is not evidence.

What to check:

- Does the diff contain only what the task asked for? Out-of-scope edits are a red flag, even when they look like improvements.
- Does the described behavior match what the code actually does?
- Were the regression commands run, and did the result differ from the known baseline in `AGENTS.md`, section 9?
- Do the manual steps the agent listed actually work when a human performs them?

If something is wrong, the correction is one specific instruction naming the exact file and the expected behavior — not a general invitation to "fix it".

## 7. Repository Context Packs

Repomix is still useful for handing a narrow slice of the repository to an AI tool that does not have direct filesystem access, or for occasional cross-checking. It is not part of the normal loop now that the working agent reads the repository directly.

No repository-level Repomix configuration exists. Exclusion patterns must be passed explicitly on every invocation.

Every pack must exclude `.env`, `.env.*`, and `*.pem`. This repository is public, and a pack is a plain-text copy of source — leaking a key into one is the same as committing it.

Verified command format (Repomix 1.18.1, confirmed via `npx repomix --version`):

```bash
npx repomix <directory> --style markdown -o <output-file> --ignore ".env,.env.*,*.pem"
```

Narrow packs, one plane at a time:

```bash
npx repomix apps/web       --style markdown -o reflow-web.md     --ignore ".env,.env.*,*.pem"
npx repomix packages/engine --style markdown -o reflow-engine.md --ignore ".env,.env.*,*.pem"
npx repomix apps/desktop   --style markdown -o reflow-desktop.md --ignore ".env,.env.*,*.pem"
```

Never generate or feed a full-monorepo pack when a targeted one will do; it wastes context and raises the chance of pulling in excluded material.

**Never commit a pack.** Pack output (`reflow-*.md`, `repomix-output.txt`) is local scratch. Do not stage or commit it.
