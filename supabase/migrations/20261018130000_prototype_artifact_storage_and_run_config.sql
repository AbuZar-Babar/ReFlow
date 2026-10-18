-- ============================================================================
-- Prototype readiness: artifact storage + run-level execution config
-- ============================================================================
-- The cloud artifact upload path was non-functional: no storage bucket existed
-- and the upload route still reported success. These changes make the C-06
-- chain work end to end:
--
-- 1. Create the private `wf_artifacts` storage bucket. The web API accesses it
--    through the service role only (no storage policies => no anon or
--    authenticated access to objects).
-- 2. Enforce one artifact row per (run_id, sha256_hash). The upload route
--    upserts with `onConflict: 'run_id,sha256_hash'`, which requires this
--    unique index, and the desktop runner registers each file exactly once.
-- 3. Add run-level execution config so two runs of the same workflow can no
--    longer overwrite each other's settings through
--    wf_workflows.workflow_definition. The desktop runner already reads
--    run.mode / run.is_loop / run.loop_step_index / run.loop_limit /
--    run.item_filter when those values are present on the run row.
-- ============================================================================

-- 1. Storage bucket ----------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('wf_artifacts', 'wf_artifacts', false, 52428800)
ON CONFLICT (id) DO NOTHING;

-- 2. Artifact uniqueness -----------------------------------------------------
-- Deduplicate first (keep the most recent row per run + hash) so the index can
-- be created on databases that already contain duplicate registrations.
DELETE FROM public.wf_run_artifacts a
USING public.wf_run_artifacts b
WHERE a.run_id = b.run_id
  AND a.sha256_hash = b.sha256_hash
  AND a.id <> b.id
  AND (COALESCE(a.created_at, '-infinity'::timestamptz), a.id)
    < (COALESCE(b.created_at, '-infinity'::timestamptz), b.id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_wf_run_artifacts_run_sha256
    ON public.wf_run_artifacts (run_id, sha256_hash);

-- 3. Run-level execution config ----------------------------------------------
ALTER TABLE public.wf_execution_runs
    ADD COLUMN IF NOT EXISTS mode TEXT,
    ADD COLUMN IF NOT EXISTS is_loop BOOLEAN,
    ADD COLUMN IF NOT EXISTS loop_step_index INTEGER,
    ADD COLUMN IF NOT EXISTS loop_limit INTEGER,
    ADD COLUMN IF NOT EXISTS item_filter JSONB;

COMMENT ON COLUMN public.wf_execution_runs.mode IS 'Execution mode for this run: single | loop';
COMMENT ON COLUMN public.wf_execution_runs.is_loop IS 'Whether this run iterates over discovered items';
COMMENT ON COLUMN public.wf_execution_runs.loop_step_index IS 'Step index used as the loop anchor';
COMMENT ON COLUMN public.wf_execution_runs.loop_limit IS 'Max items to process in this run';
COMMENT ON COLUMN public.wf_execution_runs.item_filter IS 'Item filter rules applied during item selection';
