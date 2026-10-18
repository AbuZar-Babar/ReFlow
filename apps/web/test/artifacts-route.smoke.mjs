/**
 * Manual HTTP-level smoke test for the artifact routes (prototype C-06).
 *
 * Runs the real route handlers on a local dev server with runner-token auth:
 *   1. POST /api/v1/artifacts/upload   -> bytes stored, artifact row written
 *   2. POST /api/v1/artifacts          -> the daemon's follow-up call must NOT
 *                                         create a duplicate row (upsert key)
 *   3. GET  /api/v1/artifacts/download -> byte-exact payload + honest headers
 *   4. no token                        -> 401
 *   5. cleanup                         -> storage object + DB row removed
 *
 * Requirements: `npm run dev` running on port 3000 and at least one org with a
 * runner token on file (connect the desktop worker once).
 *
 * Usage (from apps/web):  node test/artifacts-route.smoke.mjs
 * This is NOT part of `npm test` (glob only picks *.challenge.mjs).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
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

// Find an org with a runner token on file (the desktop worker stores it on
// heartbeat) and at least one run to anchor the test. Tokens are never printed.
const { data: orgs, error: orgErr } = await service
  .from('wf_organizations')
  .select('id, runner_metadata');
const candidates = (orgs || [])
  .filter((o) => o.runner_metadata && o.runner_metadata.token)
  .sort(
    (a, b) =>
      Number(Boolean(b.runner_metadata.hostname)) - Number(Boolean(a.runner_metadata.hostname))
  );

let orgId = null;
let token = null;
let run = null;
for (const o of candidates) {
  const { data: runs } = await service
    .from('wf_execution_runs')
    .select('id')
    .eq('org_id', o.id)
    .limit(1);
  if (runs?.[0]) {
    orgId = o.id;
    token = o.runner_metadata.token;
    run = runs[0];
    break;
  }
}

if (orgErr || !orgId) {
  console.error(
    'No org with a runner token and a run found:',
    orgErr?.message || 'connect the desktop worker once, then rerun'
  );
  process.exit(1);
}

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

const fileName = `__route_smoke_${Date.now()}.pdf`;
const payload = Buffer.from('%PDF-1.4\n% route smoke test\n%%EOF\n', 'latin1');
const sha = crypto.createHash('sha256').update(payload).digest('hex');
const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

// 1. Upload through the route (runner token auth)
const upRes = await fetch(`${BASE}/api/v1/artifacts/upload`, {
  method: 'POST',
  headers: auth,
  body: JSON.stringify({
    run_id: run.id,
    file_name: fileName,
    file_size_bytes: payload.length,
    sha256_hash: sha,
    file_data: payload.toString('base64'),
    storage_path: '/tmp/route-smoke.pdf',
  }),
});
const upJson = await upRes.json().catch(() => ({}));
console.log('1. upload   :', upRes.status, '| uploaded_to_storage:', upJson.uploaded_to_storage, '|', upJson.cloud_storage_path);

// 2. Register (the daemon's follow-up call) must not create a duplicate row
const regRes = await fetch(`${BASE}/api/v1/artifacts`, {
  method: 'POST',
  headers: auth,
  body: JSON.stringify({
    run_id: run.id,
    file_name: fileName,
    file_size_bytes: payload.length,
    sha256_hash: sha,
    cloud_storage_path: upJson.cloud_storage_path,
    storage_path: '/tmp/route-smoke.pdf',
    item_metadata: { source: 'desktop-runner' },
  }),
});
const regJson = await regRes.json().catch(() => ({}));
const { data: rows2 } = await service
  .from('wf_run_artifacts')
  .select('id, cloud_storage_path')
  .eq('run_id', run.id)
  .eq('sha256_hash', sha);
console.log('2. register :', regRes.status, '| rows for hash:', rows2?.length, '|', rows2?.[0]?.cloud_storage_path);

// 3. Download through the route
const artifactId = rows2?.[0]?.id;
let dlOk = false;
if (artifactId) {
  const dlRes = await fetch(`${BASE}/api/v1/artifacts/download?id=${artifactId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const bytes = Buffer.from(await dlRes.arrayBuffer());
  dlOk = dlRes.status === 200 && bytes.equals(payload);
  console.log('3. download :', dlRes.status, '|', dlOk ? 'bytes match' : 'MISMATCH', '|', dlRes.headers.get('content-disposition'));
} else {
  console.log('3. download : skipped (no row)');
}

// 4. Without a token the route must reject
const anonRes = await fetch(`${BASE}/api/v1/artifacts/download?id=${artifactId || 'x'}`);
console.log('4. no token :', anonRes.status, anonRes.status === 401 ? '(rejected OK)' : '(UNEXPECTED)');

// 5. Cleanup: storage object + DB row
await service.storage.from('wf_artifacts').remove([`${orgId}/${run.id}/${fileName}`]);
if (artifactId) await service.from('wf_run_artifacts').delete().eq('id', artifactId);
console.log('5. cleanup  : object + row removed');

const pass = upRes.status === 201 && upJson.uploaded_to_storage === true && rows2?.length === 1 && dlOk && anonRes.status === 401;
console.log('RESULT:', pass ? 'PASS' : 'CHECK ABOVE');
process.exit(pass ? 0 : 1);
