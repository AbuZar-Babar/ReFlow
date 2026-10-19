# ReFlow — Instructions for AI Coding Agents

This file governs how an AI coding agent works in this repository. Read it before doing anything. It is written for a single coding assistant working directly in the codebase.

ReFlow is a browser-automation RPA platform with three parts: a Next.js control plane (`apps/web`), an Electron desktop worker (`apps/desktop`), and a shared Chrome DevTools Protocol automation engine (`packages/engine`).

---

## 1. Improving What Exists Beats Adding What Doesn't

This is the most important rule in this file.

**Do not add new features on your own initiative.** Your default job is to find what already exists and make it better: fix it, simplify it, make it faster, make it correct, remove dead code, close gaps.

When you believe a new feature is genuinely needed, **stop and ask first**. Explain in plain terms what you want to add, why the existing code cannot cover it, and what it would cost. Wait for a clear yes before writing code.

Also ask before:
- Adding any new dependency (root, web, desktop, or engine).
- Adding a new database table, column, migration, or RLS policy.
- Adding a new API route.
- Adding a new top-level directory or package.

If the idea is simply *further out than what you were asked for*, do not build it — report it and move on.

---

## 2. Push Back on Big Ideas

You are not a order-taker. When given a large or vague task, evaluate it honestly **before** writing code.

Ask yourself:
- Is this actually feasible with the architecture that exists today?
- Does it need a schema change, a new dependency, or a new runtime boundary?
- Is there already something in the codebase that does most of this?
- What is the simplest version that delivers the real outcome?
- What will break, and what is the hidden cost?

If the answer is "this is harder than it sounds", "this partly exists already", or "this cannot work the way you described" — **say so immediately, in plain language, before doing any work**. Challenge the premise. Suggest the smaller version that actually works.

Do not silently implement a task while privately believing it is a bad approach. Pushback is expected and wanted.

After pushing back, if the user still wants it, build it as specified.

---

## 3. Check the Ground Before You Build

If a request references a file, function, endpoint, env var, or behavior that does not exist, or if the code contradicts what the request assumes:

**Stop, report the mismatch, and wait.** Do not invent a plausible-looking implementation to satisfy the wording.

Read the code that your change touches before changing it. Confirm a function does what its name suggests rather than assuming.

---

## 4. Stay in Scope

Do one task at a time. If you spot a bug, security issue, or messy code outside the current task, **report it in your final message and leave it alone**. Do not "helpfully" fix it. Unrelated edits make real changes impossible to review.

If the user asks for extra work, they will say so.

---

## 5. Be Honest About What the Product Does

ReFlow's landing page and UI copy must only claim what the code actually implements. Past commits removed false claims about cron scheduling, concurrent workers, and download availability. Do not reintroduce them.

Never write marketing or UI text describing a capability the codebase does not have. If you add a claim to user-facing copy, you must be able to point at the file that implements it.

When you notice existing copy that overstates what the product does, report it. Do not quietly expand the claim to match.

---

## 6. Security and Tenant Isolation

These are the parts of the codebase where a mistake leaks one customer's data to another. Treat them with care.

**The sensitive boundaries are:**
- Authentication: `apps/web/src/lib/auth/`
- Cloud API routes: `apps/web/src/app/api/v1/`
- The desktop local bridge: `apps/desktop/src/main/http-bridge.js`
- The runner daemon and engine: `packages/engine/src/runner/`, `packages/engine/src/replay/`
- Database schema and RLS: `supabase/`

**Non-negotiable invariants:**

- Tenant scope comes from the authenticated session only. Never accept an organization ID from a request body, query string, or header. `?org_id=` and `body.orgId` are not identity.
- Every workflow, run, artifact, and runner lookup must be filtered by the authenticated organization.
- Supabase service-role access bypasses Row-Level Security. When using it, enforce organization ownership in application code. RLS alone is not enough.
- Runner tokens are secrets. The only valid format is `rf_live_<16 hex>_<32 hex>`. They are stored only as a SHA-256 hash in `wf_organizations.runner_token_hash` and compared in constant time. Never log, return, or echo a token.
- The desktop bridge binds to `127.0.0.1:49152` only. Do not widen its CORS origin list beyond the configured cloud URL and localhost.
- Never commit `.env` or any file containing keys, tokens, or Supabase credentials.

**Read `docs/agent-context/CURRENT_STATE.md` before touching any of these.** It records which security findings are closed and which are still open (F-03 bridge command authentication remains partially hardened).

Tests are not mandatory in this repository, but for security or tenant-isolation changes a test that proves the rejection is the only real evidence the fix works. Write one when it is practical.

---

## 7. Bugs and Regressions

Before you start, know what "working" looks like. Fix the cause, not the symptom. If a change alters behavior users can see, say so clearly in your final message.

Do not suppress errors, swallow exceptions, or add a try/catch that hides a real failure in order to make something appear to pass.

---

## 8. Git Rules

- This is a **public repository**. Never commit secrets, `.env` files, API keys, tokens, credentials, personal data, or local machine paths.
- Work on a branch named for the task: `fix/...`, `feat/...`, `docs/...`, `chore/...`.
- **Never commit directly to `main`.**
- Make small, focused commits with clear messages. One concern per commit.
- **Never** run `git reset --hard`, `git clean`, `git checkout -- .`, or anything that discards uncommitted work without explicit approval.
- Do not merge branches, push to a remote, or force-push unless explicitly asked. Never rewrite published history.
- Do not commit build output, `node_modules/`, `dist/`, `recordings/`, `downloads/`, `data/`, `Run/`, or agent coordination directories (`.agents/`, `.workbuddy-ai/`) — all are gitignored, keep them that way.

---

## 9. Commands

Run from the repository root. These are verified against the current code.

| Purpose | Command |
|---|---|
| Engine tests | `npm test --prefix packages/engine` |
| Web tests | `npm test --prefix apps/web` |
| Desktop bridge tests | `npm test --prefix apps/desktop` |
| Web lint | `npm run lint --prefix apps/web` |
| Web production build | `npm run build --prefix apps/web` |
| Run the web app locally | `npm run dev` |
| Run the desktop worker | `npm run desktop` |
| Run the automation runner | `npm run runner` |
| Runner health check | `npm run runner:doctor` |
| Build the Windows installer | `npm run desktop:build` |

You may run these commands yourself.

**Known baseline — do not mistake these for damage you caused:**

- `apps/web` tests have one pre-existing failure: `F-04.3`, which asserts a literal `rf_live_` string in `dashboard/runners/page.tsx`. It is a stale assertion, not a product bug.
- `npm run lint --prefix apps/web` currently reports errors and warnings that predate your work.
- `npm run build --prefix apps/web` should stay green. If you turn it red, you broke it.

Record the exit code you actually saw. If a command was not run, say it was not run.

---

## 10. Environment and Platform Notes

- Development is on **Windows** with PowerShell. Use PowerShell-safe quoting.
- The Next.js version is **16** with the App Router. APIs and file conventions differ from older Next.js. Read the guides in `apps/web/node_modules/next/dist/docs/` before writing route or layout code.
- `apps/web/AGENTS.md` is **generated by `next dev`**. Its content is re-added automatically. Do not treat it as a file to curate, and do not fight it in a diff.
- The desktop worker launches Chrome on CDP port `9222` using the profile directory `~/.chrome-reflow`.
- Engine and runner configuration uses `REFLOW_CLOUD_URL`, `REFLOW_RUNNER_TOKEN`, and `REFLOW_TARGET_FOLDER`. Do not introduce alternative names for these.
- Supabase migrations live in `supabase/migrations/` and are prefixed with a sortable timestamp (`YYYYMMDDHHMMSS_description.sql`). Follow that pattern exactly if a migration is approved.
- The deployed control plane runs on Vercel.

---

## 11. Documentation

- The code is the source of truth. If a document in `docs/` contradicts the code, the code wins — follow the code and mention the drift in your final message.
- Do **not** update files under `docs/` or `docs/agent-context/` unless the task explicitly asks for it.
- Do not create new documentation files on your own initiative.
- Before editing `apps/web`, read `apps/web/AGENTS.md`.
- Check for nested `AGENTS.md` or `CLAUDE.md` in any package before changing it.

---

## 12. How to Report Back

When you finish, write a short plain-language summary. No code snippets, no diffs, no file-by-file logs, no test counts unless they matter. Assume the reader is the project owner, not a reviewer.

Cover exactly these five things:

1. **What I changed** — what the software does differently now, in ordinary words.
2. **Why the old version was not good** — the actual problem that existed.
3. **What is still not right** — anything you left unfinished, skipped, or are unsure about. Be specific and do not soften it.
4. **What you should do next** — the manual checks only a human can do: open a page, click a thing, run the worker, look at a screen.
5. **What I did not touch** — problems you noticed but deliberately left alone, so they do not get lost.

If you could not finish the task, lead with that. Never imply something works because you believe it should.

---

## 13. Honesty Standard

Do not claim a test passed, a command ran, or code changed without having actually seen it happen. If something was not verified, say it was not verified. Distinguish "I confirmed this" from "I expect this to be true".

A short honest report is worth more than a long confident one.
