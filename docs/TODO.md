# ReFlow — Prototype & Demo TODO

Updated: 2026-10-19 · Demo target: Mon 2026-10-19

Working rules: one branch per task. Completed work merges into `main`, which is
the deployed trunk (Vercel auto-deploys `main` → `web-fawn-ten-55`). Pushes to
`main` require explicit approval each time. Nothing counts as done until it ran
end-to-end or a test proves it.

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

## Done — 2026-10-19 (pushed to `main`, live on Vercel)

- [x] **M-17** `refreshDashboard` clears `isRefreshing` in a `finally` block.
- [x] **M-18** `StatusBadge` no longer invents a countdown.
- [x] **M-19** No-run drawer shows an honest empty state instead of dead controls.
- [x] **M-20** Runners page awaits `stopActiveRun` and surfaces failure.
- [x] **First-run guidance** — `SetupChecklist` on Home, `getting-started` page,
      and guide links from the three empty states.
- [x] **Guided tour engine** — five tours (dashboard, workflows, canvas, runners,
      artifacts) with `data-tour` anchors, spotlight overlay, keyboard control,
      and a `?` launcher in the header. Canvas tour covers the visual editor.
- [x] **Theme consistency** — neutral-first palette layer replaces the per-theme
      `!important` class patches; six softened palettes.
- [x] **Landing page** — dead macOS download removed, mobile scroll-story fixed,
      claims aligned with the product, honest audience band added.
- [x] **Deployed** — `main` pushed and verified on `web-fawn-ten-55.vercel.app`.

## Demo polish (P2)

- [ ] Visually verify the five tours in a browser (spotlight geometry, card
      placement on the editor canvas). Only source assertions and build output
      have been checked so far.
- [ ] Bring light mode onto the neutral surface ladder (dark mode is done).
- [ ] Final UI pass on the demo path: create → record → run → download.

## Delivery (P3)

- [ ] Vercel env check: `DESKTOP_*_DOWNLOAD_URL` + prod Supabase ref.
- [x] Decide on a desktop installer rebuild before Monday — **not happening**;
      Windows-only `.exe`, no `.dmg`, and the landing page now says so.
- [ ] One-page client test guide (install → record → run → download). The
      in-app `/dashboard/getting-started` page covers this, but there is no
      printable/handout version.
- [ ] Final clean smoke, then confirm `main` is the deployment of record.

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
