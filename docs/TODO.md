# ReFlow — Prototype & Demo TODO

Updated: 2026-10-18 · Demo target: Mon 2026-10-19

Working rules: one branch per task; completed work merges into `main-refactor`
(the test copy). `main` stays untouched until explicit approval. Nothing counts
as done until it ran end-to-end or a test proves it.

## Demo story (client test)

1. Client installs the desktop worker from the landing page.
2. Record one task on a portal — table scrape, or field capture when the
   portal has no download button.
3. Run it → files appear in a folder on the PC **and** in the dashboard.
4. Lead with the pain: portals with no download button → table/card data
   becomes a spreadsheet.

## Now — capture table + loop logic (branch `fix/capture-table-loop-logic`)

Root cause fixed: recorded loop intent was stored under
`workflow_definition.metadata` (recorder output) but read from the top level
with a lowercase `'loop'` check — so recorded table scrapes pre-filled as
"Single run" and the engine had to guess the loop anchor.

- [x] Shared derivation module `apps/web/src/lib/workflows/loop-signals.ts` —
      reads recorder metadata, per-step loop flags, and
      `EXTRACT_TABLE` / `EXTRACT_TEXT` / `LOOP_START` extraction steps.
- [x] Challenge tests `apps/web/test/loop-signal-flow.challenge.mjs`
      (21 tests incl. adversarial + drift guard): 125/126 web suite green
      (only pre-existing red: `F-04.3`).
- [x] Workflow save normalizes loop flags to the top level
      (`POST` + `PATCH /api/v1/workflows`).
- [x] Run dispatch persists honest `mode` / `is_loop` / `loop_step_index`
      (`POST /api/v1/runs`).
- [x] Pre-flight dialog auto-detects recorded loops (opens in **Loop** mode
      with the recorded step preselected).
- [x] Removed decorative `item mode` / `paginate` toggles from the run dialog
      (they were sent but read by nothing).
- [x] Fixture: `tools/test-portal/cards.html` — 18 invoice cards with **no
      download button** for the capture-field scenario.
- [x] Live API smoke on the test project — 22/22 checks: save normalization,
      pre-flight dispatch, derived dispatch, no over-flagging, cleanup
      (`apps/web/test/loop-config.smoke.mjs`).
- [ ] Verify live on the fixture (below), then merge to `main-refactor`.

## E2E dry run (fixture portal)

- [ ] Start web + fixture (`npm run dev` in `apps/web`;
      `node tools/test-portal/server.js` at repo root).
- [ ] Signup → worker connected → record "Scrape Table" on the invoice list
      (3 pages; click **Next** while recording).
- [ ] Run from the dashboard: run row shows `mode=loop`,
      `loop_step_index` = the table step.
- [ ] CSV with 18 rows (Item_ID, Page, date/amount columns) → saved locally
      **and** downloadable from dashboard artifacts.
- [ ] Record "Capture Field" on `cards.html` → run → every card extracted
      into the spreadsheet (no downloads involved).
- [ ] Fix whatever the dry run breaks (inside this branch).

## Demo polish (P2)

- [ ] M-17 `refreshDashboard` never clears `isRefreshing` → refresh button
      spins forever (`DashboardContext.tsx:396-399`, `Header.tsx:61-66`).
- [ ] M-18 `StatusBadge` fake countdown in list usages
      (`StatusBadge.tsx:21-31`).
- [ ] M-19 workflows page opens `RunDetailsDrawer` with `id:''` when a
      workflow has no runs (`workflows/page.tsx:271-284`).
- [ ] M-20 runners page ignores `stopActiveRun` result → stop can fail
      silently (`runners/page.tsx:842-848`).
- [ ] First-run guidance for the client (guided checklist / coach marks).
- [ ] Final UI pass on the demo path: create → record → run → download.

## Delivery (P3)

- [ ] Vercel env check: `DESKTOP_*_DOWNLOAD_URL` + prod Supabase ref.
- [ ] Decide on a desktop installer rebuild before Monday — gates `C-05`,
      `C-03`, `H-10` fixes and anything engine-side (recorder/replay).
- [ ] One-page client test guide (install → record → run → download).
- [ ] Final clean smoke, then merge everything to `main-refactor`.

## Parked — post-Monday roadmap

- [ ] **Nested loops** (Company → all its invoices → next company) — engine
      loop stack with per-level state and filters, two anchors in the visual
      editor; ships with an installer rebuild.
- [ ] Click-to-choose table scraping (today "Scrape Table" auto-picks the
      primary table via `detectPrimaryTable()`).
- [ ] Record-time loop flagging for Capture-Field flows (today it is derived
      at save/dispatch time from the `EXTRACT_TEXT` step).
- [ ] Wire item-mode / pagination run options end-to-end (engine must consume
      them; UI was hidden for this prototype).
- [ ] Save-page-as-PDF / screenshots in the engine (post-demo,
      installer-dependent).
- [ ] Security hardening round for findings outside prototype scope
      (`C-03` credentials, `C-05` bridge auth, `H-10` bridge resilience).
