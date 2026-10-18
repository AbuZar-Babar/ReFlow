# ReFlow Current State

## Status
Refactoring and security remediation phases 1 through 3B have been completed and verified on `main`. All findings from the initial targeted source audit (F-01, F-02, F-04) have been remediated with empirical unit and challenge test coverage. Monorepo dependencies, legacy standalone components in `packages/engine`, and orphaned landing pages have been purged. Vercel deployment and live Desktop Runner connectivity have been verified end-to-end.

## Product direction
ReFlow is a production-ready SaaS platform for hybrid browser automation and RPA. The platform integrates a Next.js 16 cloud control plane (`apps/web`), an Electron desktop worker (`apps/desktop`), and a shared Chrome DevTools Protocol (CDP) automation engine (`packages/engine`).

## Implemented & Verified Capabilities
- Browser workflow recording and replay using direct Chrome DevTools Protocol (CDP port 9222) with persistent profile `~/.chrome-reflow`.
- Multi-attribute element fingerprinting, stable ID extraction, and heuristic self-healing selector resolution.
- Table and repeated-item discovery, loop confidence scoring, and item-relative action generalization.
- Visual workflow editor powered by Drawflow, with preflight execution inspection and runtime column filtering.
- Electron desktop worker with Private Network Access (PNA) localhost bridge (`127.0.0.1:49152`).
- Real-time execution telemetry and 90-second Human-in-the-Loop (HITL) 2FA recovery flow.
- SHA-256 cryptographic artifact deduplication, categorized disk organization, and optional Supabase Storage sync.
- Supabase-backed tenant isolation and Row-Level Security (RLS) policies across all workflow, run, and artifact tables.

## Audit Findings Status & Remediations

### F-01 — Runner tokens are not validated as secrets
**Status: Resolved (2026-10-16)**

**Remediation:**
- Upgraded runner authentication in `apps/web/src/lib/auth/runner-auth.ts` from prefix-only `ps_live_<org_id>` matching to canonical high-entropy cryptographic tokens: `rf_live_<16hex_org>_<32hex_secret>`.
- Inbound tokens are SHA-256 hashed and compared in constant time (`crypto.timingSafeEqual`) against the `runner_token_hash` column on `public.wf_organizations`.
- Unknown or malformed tokens return `401 Unauthorized` without performing table-wide scans or rogue organization auto-creation.
- Added comprehensive negative security tests in `apps/web/test/security-tenant-auth.challenge.mjs` verifying rejection of legacy `ps_live_` tokens, secret-less tokens, and invalid hashes.

### F-02 — Run creation trusts request-supplied organization IDs and does not bind workflow ownership
**Status: Resolved (2026-10-16)**

**Remediation:**
- In `apps/web/src/app/api/v1/runs/route.ts`, run insertion derives tenant scope strictly from `auth.context.orgId`. Request body overrides (`body.org_id` / `body.orgId`) are strictly prohibited and ignored.
- Workflow lookups enforce `.eq('org_id', orgId)` and return `404 Not Found` if the workflow does not belong to the authenticated organization (auto-stub creation was eliminated).
- Similar strict tenant scoping enforced across `POST /api/v1/workflows` and `GET /api/v1/runners`.
- Added SSRF protection to `GET /api/v1/runners/diagnostics`: requires authentication and restricts bridge probing strictly to localhost loopback interfaces (`127.0.0.1`, `localhost`, `::1`) on the registered runner port `49152`.

### F-03 — Desktop bridge state-changing endpoints have no request authentication
**Status: Hardened / In Progress (2026-10-16)**

**Remediation & Current Posture:**
- In `apps/desktop/src/main/http-bridge.js`, wildcard CORS (`*.vercel.app`) was eliminated. Allowed origins are strictly restricted to the user-configured `cloudUrl` (e.g. `https://web-fawn-ten-55.vercel.app`), `http://localhost:*`, and `http://127.0.0.1:*`.
- Deprecated dead routes (`POST /record/reset`) were removed, and Private Network Access (PNA) preflight headers (`Access-Control-Allow-Private-Network: true`) are validated.
- Optional future hardening: Local inter-process command token verification on loopback port `49152` remains a non-blocking defense-in-depth candidate for future multi-user OS environments.

### F-04 — Runner heartbeat data is stored in the Stripe subscription field
**Status: Resolved (2026-10-16)**

**Remediation:**
- Decoupled runner pairing and telemetry from `stripe_subscription_id` by executing database migration `20261016000000_add_runner_metadata_and_token_hash.sql`.
- Added dedicated `runner_metadata` (`jsonb` default `'{}'::jsonb`) and `runner_token_hash` (`text`) columns to `public.wf_organizations`.
- Migrated all read/write paths in `runner-auth.ts`, `api/v1/runners/route.ts`, `DashboardContext.tsx`, `runners/page.tsx`, and `settings/page.tsx` to use `runner_metadata`.
- Legacy JSON data in `stripe_subscription_id` was migrated into `runner_metadata`, restoring the column strictly for Stripe billing IDs.

## Monorepo Architecture Refactor (Phase 3A Legacy Purge)
- **Elimination of Legacy Standalone Server in `packages/engine`**: Purged deprecated SQLite database (`db.js`), redundant Express/HTTP dashboard controllers (`/src/dashboard/`), and standalone auth controllers (`/src/auth/`). All web dashboard and SaaS operations now centrally live in Next.js (`apps/web`).
- **Orphaned landing components in `apps/web`**: `FeatureTabSwitcher`, `HeroProductShowcase`, `ProductDemoSimulator`, `RobotMascot`, `ScrollProductShowcase`, and `VideoDemoModal` remain in `apps/web/src/components/landing/` but are not imported by any route; they are dead-code candidates for removal.
- **Standardized Environment Variables**: Standardized strictly on `REFLOW_CLOUD_URL`, `REFLOW_RUNNER_TOKEN`, and `REFLOW_TARGET_FOLDER` across engine CLI and runner daemon.

## Test Suites

Per-workspace commands:

- **`apps/web`**: `npm test --prefix apps/web` — challenge tests (`test/*.challenge.mjs`), including `security-tenant-auth.challenge.mjs`.
- **`packages/engine`**: `npm test --prefix packages/engine` — replay, table expansion, date handling, selector resolution, and HITL 2FA.
- **`apps/desktop`**: `npm test --prefix apps/desktop` — bridge lifecycle, origin restrictions, and PNA headers.
- **Build**: `npm run build --prefix apps/web`.
- **End-to-end**: the desktop worker has been paired against a deployed cloud control plane using a canonical `rf_live_` runner token.

## Next Actions
1. Maintain documentation integrity as features evolve.
2. Consider adding optional local command authentication token on loopback bridge port `49152` (F-03 future hardening).
3. Remove or wire up the orphaned landing components listed above.
4. Expand workflow template library in `apps/web` with new pre-built RPA recipes.
