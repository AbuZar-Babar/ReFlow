import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8').replace(/\r\n/g, '\n');

const uploadRoute = read('../src/app/api/v1/artifacts/upload/route.ts');
const artifactsRoute = read('../src/app/api/v1/artifacts/route.ts');
const downloadRoute = read('../src/app/api/v1/artifacts/download/route.ts');
const runsRoute = read('../src/app/api/v1/runs/route.ts');
const migration = read('../../../supabase/migrations/20261018130000_prototype_artifact_storage_and_run_config.sql');

describe('Prototype C-06/C-07: artifact storage honesty + run config persistence', () => {

  describe('1. Upload route reports storage failures honestly', () => {
    test('fails with 502 when the storage upload errors (no fabricated success)', () => {
      assert.ok(uploadRoute.includes("from('wf_artifacts')"), 'must target the wf_artifacts bucket');
      assert.ok(uploadRoute.includes('status: 502'), 'storage failure must return 502');
      assert.ok(!uploadRoute.includes('uploaded_to_storage: uploadSuccess'), 'must not report fabricated success');
      assert.ok(!uploadRoute.includes("console.warn('Supabase storage upload error'"), 'must not swallow storage errors');
    });

    test('upserts the artifact record keyed on run_id + sha256_hash', () => {
      assert.ok(uploadRoute.includes("onConflict: 'run_id,sha256_hash'"), 'artifact upsert must use the unique key');
    });
  });

  describe('2. Download route serves real bytes or an honest 404', () => {
    test('never fabricates placeholder downloads', () => {
      assert.ok(!downloadRoute.includes('fallbackText'), 'fake fallback payload must be removed');
      assert.ok(
        downloadRoute.includes("request.nextUrl.searchParams.get('id')"),
        'download route must query searchParams id'
      );
    });

    test('returns 404 when the object is missing from storage', () => {
      assert.ok(downloadRoute.includes('status: 404'), 'missing storage object must 404');
      assert.ok(downloadRoute.includes("filename*=UTF-8''"), 'Content-Disposition must be RFC 5987 encoded');
    });
  });

  describe('3. Registration route is idempotent and canonical', () => {
    test('uploads real bytes when file_data is provided and upserts on the unique key', () => {
      assert.ok(artifactsRoute.includes("onConflict: 'run_id,sha256_hash'"), 'registration must upsert, not blind insert');
      assert.ok(artifactsRoute.includes("from('wf_artifacts')"), 'must upload file_data into the bucket');
    });

    test('normalizes legacy cloud paths to wf_artifacts/<org>/...', () => {
      assert.ok(artifactsRoute.includes('canonicalCloudPath'), 'must normalize the cloud storage path');
    });
  });

  describe('4. Run-level execution config is persisted (C-07)', () => {
    test('POST /runs stores mode/isLoop/loop settings on the run row', () => {
      assert.ok(runsRoute.includes('is_loop: isLoop'), 'must persist is_loop');
      assert.ok(runsRoute.includes('loop_step_index: loopStepIndex'), 'must persist loop_step_index');
      assert.ok(runsRoute.includes('loop_limit: loopLimit'), 'must persist loop_limit');
      assert.ok(runsRoute.includes('item_filter: itemFilter'), 'must persist item_filter');
    });
  });

  describe('5. Migration provisions the bucket, unique index and columns', () => {
    test('creates a private bucket, the (run_id, sha256_hash) unique index and run config columns', () => {
      assert.ok(migration.includes("'wf_artifacts', 'wf_artifacts', false"), 'must create a private bucket');
      assert.ok(migration.includes('uq_wf_run_artifacts_run_sha256'), 'must create the unique index');
      assert.ok(migration.includes('ADD COLUMN IF NOT EXISTS mode'), 'must add run config columns');
    });
  });
});
