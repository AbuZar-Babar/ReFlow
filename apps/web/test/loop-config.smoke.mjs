/**
 * Manual HTTP-level smoke test for loop config save/dispatch (prototype fix).
 *
 * Runs the real route handlers on a local dev server with runner-token auth:
 *   1. POST /api/v1/workflows  (recorded table recipe, metadata.isLoop)
 *      -> the SAVED definition is normalized to top-level isLoop/mode/loopStepIndex
 *   2. POST /api/v1/runs (pre-flight shaped body)
 *      -> the run row says loop + the recorded step index
 *   3. POST /api/v1/workflows (cards recipe: EXTRACT_TEXT, no recorder loop flag)
 *      -> still saved as a loop (extraction step is the signal)
 *   4. POST /api/v1/runs with NO explicit mode keys (dispatch fallback)
 *      -> run row still says loop with the extraction step index
 *   5. POST /api/v1/runs for a plain click/type workflow
 *      -> run stays single (no over-flagging)
 *   6. cleanup -> all created runs + workflows deleted
 *
 * Test runs are created with status 'completed' so a live desktop worker can
 * never claim them. Tokens are never printed.
 *
 * Requirements: `npm run dev` running on port 3000 and at least one org with a
 * runner token on file (connect the desktop worker once).
 *
 * Usage (from apps/web):  node test/loop-config.smoke.mjs
 * This is NOT part of `npm test` (glob only picks *.challenge.mjs).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const BASE = process.env.CHECK_BASE || 'http://127.0.0.1:3000';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env.local');

function loadEnv(file) {
  const env = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = loadEnv(envPath);
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Find an org with a runner token on file. Tokens are never printed.
const { data: orgs, error: orgErr } = await service
  .from('wf_organizations')
  .select('id, runner_metadata');
const candidate = (orgs || []).find((o) => o.runner_metadata && o.runner_metadata.token);

if (orgErr || !candidate) {
  console.error(
    'No org with a runner token found:',
    orgErr?.message || 'connect the desktop worker once, then rerun'
  );
  process.exit(1);
}
const token = candidate.runner_metadata.token;
const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

// Wait for the dev server
let up = false;
for (let i = 0; i < 60 && !up; i++) {
  try {
    const r = await fetch(`${BASE}/api/v1/runs?status=pending`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    up = Boolean(r.status);
  } catch {
    await new Promise((res) => setTimeout(res, 1000));
  }
}
if (!up) {
  console.error('dev server not reachable at', BASE);
  process.exit(1);
}

const tag = Date.now();
const createdWorkflowIds = [];
const createdRunIds = [];
const failures = [];
const check = (label, ok, detail = '') => {
  console.log(`   ${ok ? 'OK  ' : 'FAIL'} ${label}${detail ? ` | ${detail}` : ''}`);
  if (!ok) failures.push(label);
};

async function createWorkflow(name, workflow_definition) {
  const res = await fetch(`${BASE}/api/v1/workflows`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      name,
      portal_url: 'http://127.0.0.1:8090/',
      workflow_definition,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (res.status === 201 && json.workflow?.id) createdWorkflowIds.push(json.workflow.id);
  return { status: res.status, json };
}

async function dispatchRun(workflow_id, body) {
  const res = await fetch(`${BASE}/api/v1/runs`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      workflow_id,
      status: 'completed', // never claimable by a live worker
      total_items_discovered: 0,
      ...body,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (res.status === 201 && json.run?.id) createdRunIds.push(json.run.id);
  return { status: res.status, json };
}

async function fetchRunRow(runId) {
  const { data } = await service
    .from('wf_execution_runs')
    .select('mode, is_loop, loop_step_index')
    .eq('id', runId)
    .maybeSingle();
  return data;
}

async function fetchWorkflowDef(workflowId) {
  const { data } = await service
    .from('wf_workflows')
    .select('workflow_definition')
    .eq('id', workflowId)
    .maybeSingle();
  return data?.workflow_definition;
}

try {
  // -------------------------------------------------------------------------
  console.log('\n1. Recorded table scrape -> saved definition is normalized');
  const tableRecipe = {
    metadata: {
      name: `__loop_smoke_table_${tag}`,
      startUrl: 'http://127.0.0.1:8090/',
      isLoop: true,
      loopStepIndex: 2,
      loopConfidence: 1,
      patternType: 'table_extract',
      mode: 'LOOP',
    },
    steps: [
      { type: 'NAVIGATE', url: 'http://127.0.0.1:8090/' },
      { type: 'CLICK', elementName: 'Next' },
      { type: 'EXTRACT_TABLE', fieldName: 'Full_Table_Export' },
    ],
  };
  const tableWf = await createWorkflow(`__loop_smoke_table_${tag}`, tableRecipe);
  const tableWfId = tableWf.json.workflow?.id;
  const tableDef = tableWfId ? await fetchWorkflowDef(tableWfId) : null;
  check('workflow created', tableWf.status === 201);
  check('saved isLoop promoted to top level', tableDef?.isLoop === true);
  check('saved mode normalized to lower-case loop', tableDef?.mode === 'loop');
  check('saved loopStepIndex preserved', tableDef?.loopStepIndex === 2);
  check('recorder metadata preserved', tableDef?.metadata?.isLoop === true);

  // -------------------------------------------------------------------------
  console.log('\n2. Pre-flight dispatch (explicit loop config) -> honest run row');
  const tableRun = await dispatchRun(tableWfId, {
    mode: 'loop',
    isLoop: true,
    loopStepIndex: 2,
    loopLimit: null,
    itemFilter: null,
  });
  const tableRunRow = tableRun.json.run?.id ? await fetchRunRow(tableRun.json.run.id) : null;
  check('run created', tableRun.status === 201);
  check('run row is_loop', tableRunRow?.is_loop === true);
  check('run row mode', tableRunRow?.mode === 'loop');
  check('run row loop_step_index', tableRunRow?.loop_step_index === 2);

  // -------------------------------------------------------------------------
  console.log('\n3. Cards recipe (EXTRACT_TEXT, no recorder loop flag) -> saved as loop');
  const cardRecipe = {
    metadata: { name: `__loop_smoke_cards_${tag}`, startUrl: 'http://127.0.0.1:8090/cards.html', isLoop: false, loopStepIndex: null, mode: 'STANDARD' },
    steps: [
      { type: 'NAVIGATE', url: 'http://127.0.0.1:8090/cards.html' },
      { type: 'CLICK', elementName: 'Capture Field' },
      { type: 'EXTRACT_TEXT', fieldName: 'Amount' },
    ],
  };
  const cardWf = await createWorkflow(`__loop_smoke_cards_${tag}`, cardRecipe);
  const cardWfId = cardWf.json.workflow?.id;
  const cardDef = cardWfId ? await fetchWorkflowDef(cardWfId) : null;
  check('workflow created', cardWf.status === 201);
  check('extraction step promotes isLoop on save', cardDef?.isLoop === true);
  check('extraction step index promoted', cardDef?.loopStepIndex === 2);

  // -------------------------------------------------------------------------
  console.log('\n4. Dispatch WITHOUT explicit mode keys -> derived from the definition');
  const cardRun = await dispatchRun(cardWfId, {});
  const cardRunRow = cardRun.json.run?.id ? await fetchRunRow(cardRun.json.run.id) : null;
  check('run created', cardRun.status === 201);
  check('run row is_loop derived', cardRunRow?.is_loop === true);
  check('run row loop_step_index derived', cardRunRow?.loop_step_index === 2);

  // -------------------------------------------------------------------------
  console.log('\n5. Plain click/type workflow -> stays single (no over-flagging)');
  const plainWf = await createWorkflow(`__loop_smoke_plain_${tag}`, {
    metadata: { name: `__loop_smoke_plain_${tag}`, mode: 'STANDARD' },
    steps: [
      { type: 'NAVIGATE', url: 'http://127.0.0.1:8090/' },
      { type: 'CLICK', elementName: 'Download PDF' },
    ],
  });
  const plainWfId = plainWf.json.workflow?.id;
  const plainRun = await dispatchRun(plainWfId, {});
  const plainRunRow = plainRun.json.run?.id ? await fetchRunRow(plainRun.json.run.id) : null;
  check('run row stays single', plainRunRow?.is_loop === false && plainRunRow?.mode === 'single');
  check('no loop index invented', plainRunRow?.loop_step_index === null);

  // -------------------------------------------------------------------------
  console.log('\n6. Cleanup');
  if (createdRunIds.length) await service.from('wf_execution_runs').delete().in('id', createdRunIds);
  if (createdWorkflowIds.length) await service.from('wf_workflows').delete().in('id', createdWorkflowIds);
  const { data: leftoverRuns } = await service.from('wf_execution_runs').select('id').in('id', createdRunIds);
  const { data: leftoverWfs } = await service.from('wf_workflows').select('id').in('id', createdWorkflowIds);
  check('runs removed', (leftoverRuns || []).length === 0);
  check('workflows removed', (leftoverWfs || []).length === 0);
} catch (err) {
  failures.push(`unexpected error: ${err.message}`);
  console.error('unexpected error:', err);
} finally {
  console.log('\nRESULT:', failures.length === 0 ? 'PASS' : `CHECK ABOVE (${failures.length} failed)`);
  process.exit(failures.length === 0 ? 0 : 1);
}
