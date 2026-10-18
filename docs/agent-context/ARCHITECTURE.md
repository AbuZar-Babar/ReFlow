# ReFlow Architecture Context

## Status and Reliability
This document reflects the verified architecture on `main` following the completion of Phase 1 through Phase 3B refactors and security remediations. All code paths described herein have been verified with empirical unit, challenge, and end-to-end integration tests.

## Product Shape
ReFlow is a production hybrid browser-automation and RPA SaaS platform combining a Next.js 16 cloud control plane (`apps/web`), an Electron desktop worker (`apps/desktop`), and a shared Chrome DevTools Protocol (CDP)-based automation engine (`packages/engine`).

## Monorepo Layout
The monorepo uses npm workspaces:

- `apps/web`: Next.js 16 (Turbopack) web control plane and SaaS dashboard, visual workflow editing, live execution monitoring, outputs vault, and cloud API routes (`/api/v1/`).
- `apps/desktop`: Electron desktop worker and localhost HTTP bridge (`127.0.0.1:49152`) for interaction with local Chrome.
- `packages/engine`: Core CDP automation engine, recorder bridge, selector resolution, collection discovery, loop handling, and background runner daemon. (Legacy standalone Express server and SQLite DB were purged in Phase 3A).
- `supabase/`: PostgreSQL schema (`schema.sql`), migrations (`supabase/migrations/`), and Row-Level Security (RLS) policies.
- `docs/`: System documentation, architecture diagrams, and agent context files.
- `DESIGN.md`: UI design tokens and visual guidelines.

## AI Instruction Files
- Root `AGENTS.md` contains repository-wide collaboration, safety rules, and operational mode guidelines.
- `apps/web/AGENTS.md` contains Next.js 16 App Router-specific agent guidance.
- Context documents in `docs/agent-context/` are updated strictly when authorized by the user/task.

## Main Runtime Boundaries

### Web Control Plane (`apps/web`)
The Next.js application connects to Supabase for workflow management, run telemetry, and artifact metadata.
- **Privileged Context:** When `SUPABASE_SERVICE_ROLE_KEY` is present, `getServiceClient()` returns a service-role client. All server routes explicitly enforce organization ownership (`auth.context.orgId`) rather than relying solely on database RLS.
- **Session Auth Fallback:** When `SUPABASE_SERVICE_ROLE_KEY` is not configured in local development, browser session users utilize `serverSupabase` to ensure RLS compliance.
- **Dashboard Stability:** Organization membership lookups are decoupled from column queries, preventing `/onboarding` redirect loops on transient PostgREST cache reloads.
- **Guided Tours (`src/components/tour/`):** A client-side spotlight tour layer. `TourProvider` owns the active tour and step, keyboard control (Esc/←/→), and completion persistence (`wf_tour_done_<id>`); `TourOverlay` renders four dim panels around the target rect plus an anchored card; `tourSteps.ts` holds all copy as data. Steps resolve anchors via `data-tour="…"` attributes rather than CSS classes, and a challenge test cross-checks every declared target against the attributes present in `src/`. Because the workflow editor is a full-bleed route that bypasses `DashboardShell`, `TourProvider`/`TourOverlay` are mounted in both the shell and the `isWorkflowEditor` branch of `dashboard/layout.tsx`.
- **Theming (`src/app/globals.css`):** Palettes are CSS custom properties on `<html>` (`data-theme`, `data-mode`). A "Soft Theme Layer" redefines Tailwind's own palette variables (`--color-slate-*`, `--color-zinc-*`, `--color-gray-*`, `--color-neutral-*`) as one shared graphite ladder and maps the accent scales (`--color-cyan/blue/indigo/sky-*`) onto `var(--primary-color)` / `var(--accent-color)`. Since Tailwind v4 compiles utilities to `background-color: var(--color-slate-900)`, this rethemes every call site at once; it replaced a per-theme `!important` class-patch layer that left unlisted utilities on their original hue.

### Desktop Worker (`apps/desktop`)
The Electron process launches or attaches to local Chrome on CDP port `9222` with persistent user data directory `~/.chrome-reflow`.
- **Localhost HTTP Bridge:** Binds strictly to `127.0.0.1:49152`.
- **Origin Validation:** Origins are validated against the user's configured `cloudUrl` (e.g. `https://web-fawn-ten-55.vercel.app`), `http://localhost:*`, and `http://127.0.0.1:*`. Wildcard CORS reflection (`*.vercel.app`) has been eliminated.
- **Private Network Access (PNA):** Returns `Access-Control-Allow-Private-Network: true` on OPTIONS preflight for compliant browser contexts.

### Automation Engine (`packages/engine`)
Modular CDP automation library:
- **`recorder/`**: Injected event capture, keystroke buffering, and element fingerprinting.
- **`shared/`**: Weighted selector resolution (`selector-resolver.js`), loop detection, and condition evaluation.
- **`replay/`**: Human mouse trajectory generation (`human-mouse.js`), loop orchestration, datepicker injection, and artifact download tracking.
- **`runner/`**: Background daemon polling `/api/v1/runs?status=pending`, claiming runs, and uploading vaulted artifacts.

## Audit Findings Status & Architectural Posture

### F-01 — Runner Token Authentication & Hash Verification
**Status: Resolved (2026-10-16)**
- **File:** `apps/web/src/lib/auth/runner-auth.ts`
- **Architecture:** Upgraded from legacy prefix-only `ps_live_` matching to high-entropy tokens formatted as `rf_live_<16hex_org>_<32hex_secret>`.
- **Validation:** Inbound tokens are SHA-256 hashed and verified in constant time (`crypto.timingSafeEqual`) against the `runner_token_hash` column on `public.wf_organizations`.
- **Lookup Integrity:** Table-wide organization scanning and unauthenticated rogue organization auto-creation have been eliminated.

### F-02 — Tenant Isolation & Run Scoping
**Status: Resolved (2026-10-16)**
- **Files:** `apps/web/src/app/api/v1/runs/route.ts`, `apps/web/src/app/api/v1/workflows/route.ts`, `apps/web/src/app/api/v1/runners/route.ts`, `apps/web/src/app/api/v1/runners/diagnostics/route.ts`
- **Architecture:** All execution runs, workflow updates, and runner listings derive tenant scope strictly from the verified `auth.context.orgId`. Request body overrides (`body.org_id` / `body.orgId`) are ignored.
- **Cross-Tenant Guard:** Workflow queries enforce `.eq('org_id', orgId)` and return `404 Not Found` if the workflow belongs to another tenant.
- **Diagnostics SSRF Lockdown:** Probing via `/api/v1/runners/diagnostics` requires authentication and is restricted to loopback destinations (`127.0.0.1`, `localhost`, `::1`) on the desktop runner port `49152`.

### F-03 — Desktop Bridge Command Authentication
**Status: Hardened / In Progress (2026-10-16)**
- **File:** `apps/desktop/src/main/http-bridge.js`
- **Architecture:** Wildcard CORS (`*.vercel.app`) was removed; allowed origins are strictly checked against `configManager.get().cloudUrl`, `http://localhost:*`, and `http://127.0.0.1:*`.
- **Future Hardening:** A local per-session or installation token mechanism on loopback port `49152` remains a non-blocking defense-in-depth consideration.

### F-04 — Runner Metadata Decoupling
**Status: Resolved (2026-10-16)**
- **Files:** `apps/web/src/lib/auth/runner-auth.ts`, `apps/web/src/app/api/v1/runners/route.ts`, `supabase/schema.sql`, `supabase/migrations/20261016000000_add_runner_metadata_and_token_hash.sql`
- **Architecture:** Runner pairing tokens, version strings, hostname, and heartbeat timestamps are stored in the dedicated `runner_metadata` JSONB column on `public.wf_organizations`. `stripe_subscription_id` is restored strictly for billing customer data.

## Security and Data Boundaries Preserved
- Service-role Supabase access is treated as privileged; tenant membership is validated in application routes.
- Organization IDs and UUID prefixes are never treated as bearer credentials.
- All workflows, execution runs, and artifacts are strictly scoped to the authenticated tenant.
- Billing identifiers are completely decoupled from runner telemetry.

## Test Suites Across the Monorepo
- **`apps/web`**: `npm test --prefix apps/web`
- **`apps/web` Build**: `npm run build --prefix apps/web`
- **`packages/engine`**: `npm test --prefix packages/engine`
- **`apps/desktop`**: `npm test --prefix apps/desktop`
