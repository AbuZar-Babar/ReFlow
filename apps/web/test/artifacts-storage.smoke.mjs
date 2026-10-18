/**
 * Manual smoke test for the artifact storage chain (prototype C-06).
 *
 * Verifies against the live Supabase project referenced by apps/web/.env.local:
 *   1. service-role upload + download roundtrip through the wf_artifacts bucket
 *   2. the bucket is NOT readable with the anon key (private bucket)
 *   3. cleanup of the temporary object
 *
 * Usage (from apps/web):  node test/artifacts-storage.smoke.mjs
 * This is NOT part of `npm test` (glob only picks *.challenge.mjs).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

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

if (!fs.existsSync(envPath)) {
  console.error('Missing apps/web/.env.local');
  process.exit(1);
}

const env = loadEnv(envPath);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !serviceKey || !anonKey) {
  console.error('Missing Supabase env values in apps/web/.env.local');
  process.exit(1);
}

const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

// 1. Anchor the object path to a real run (canonical layout org/run/file)
const { data: runs, error: runErr } = await service
  .from('wf_execution_runs')
  .select('id, org_id')
  .limit(1);

const run = runs?.[0];
if (runErr || !run) {
  console.error('No run row available to anchor the smoke test:', runErr?.message || 'none');
  process.exit(1);
}

const objectPath = `${run.org_id}/${run.id}/__storage_smoke_test__.pdf`;
const payload = Buffer.from('%PDF-1.4\n% ReFlow storage smoke test\n%%EOF\n', 'latin1');

console.log(`object: wf_artifacts/${objectPath}`);

// 2. Service-role upload -> download roundtrip
const up = await service.storage.from('wf_artifacts').upload(objectPath, payload, {
  contentType: 'application/pdf',
  upsert: true,
});
console.log('service upload:  ', up.error ? `FAIL ${up.error.message}` : 'OK');

const down = await service.storage.from('wf_artifacts').download(objectPath);
if (down.error || !down.data) {
  console.log('service download: FAIL', down.error?.message || 'no data');
} else {
  const bytes = Buffer.from(await down.data.arrayBuffer());
  console.log('service download: OK', bytes.equals(payload) ? '(bytes match)' : '(BYTES MISMATCH)');
}

// 3. The private bucket must reject anon reads
const anonDown = await anon.storage.from('wf_artifacts').download(objectPath);
console.log('anon download:   ', anonDown.error ? `denied OK (${anonDown.error.message})` : 'FAIL — anon could read the object!');

// 4. Cleanup
const rm = await service.storage.from('wf_artifacts').remove([objectPath]);
console.log('cleanup:         ', rm.error ? `FAIL ${rm.error.message}` : 'OK');
