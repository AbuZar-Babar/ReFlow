import { NextRequest, NextResponse } from 'next/server';
import { authenticateRunnerOrUser } from '@/lib/auth/runner-auth';

export async function GET(request: NextRequest) {
  const auth = await authenticateRunnerOrUser(request);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { orgId, supabase } = auth.context;
  const runId = request.nextUrl.searchParams.get('run_id');

  if (runId) {
    // Verify run belongs to the caller's organization
    const { data: run, error: runError } = await supabase
      .from('wf_execution_runs')
      .select('id, org_id')
      .eq('id', runId)
      .maybeSingle();

    if (runError || !run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    if (run.org_id !== orgId) {
      return NextResponse.json(
        { error: 'Unauthorized: Run belongs to a different organization' },
        { status: 403 }
      );
    }

    const { data: artifacts, error } = await supabase
      .from('wf_run_artifacts')
      .select('*')
      .eq('run_id', runId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ artifacts: artifacts || [] });
  }

  // Retrieve all artifacts belonging to runs in this organization
  const { data: runs, error: runsError } = await supabase
    .from('wf_execution_runs')
    .select('id')
    .eq('org_id', orgId);

  if (runsError) {
    return NextResponse.json({ error: runsError.message }, { status: 500 });
  }

  const runIds = runs?.map((r) => r.id) || [];
  if (runIds.length === 0) {
    return NextResponse.json({ artifacts: [] });
  }

  const { data: artifacts, error: artifactsError } = await supabase
    .from('wf_run_artifacts')
    .select('*')
    .in('run_id', runIds)
    .order('created_at', { ascending: false });

  if (artifactsError) {
    return NextResponse.json({ error: artifactsError.message }, { status: 500 });
  }

  return NextResponse.json({ artifacts: artifacts || [] });
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRunnerOrUser(request);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { orgId, supabase } = auth.context;

  try {
    const body = await request.json();
    const {
      run_id,
      file_name,
      file_size_bytes,
      sha256_hash,
      cloud_storage_path,
      item_metadata,
      synced_to_drive,
    } = body;

    if (!run_id || !file_name || !sha256_hash) {
      return NextResponse.json(
        { error: 'Missing required fields: run_id, file_name, sha256_hash' },
        { status: 400 }
      );
    }

    // Verify run belongs to the caller's organization
    const { data: run, error: runError } = await supabase
      .from('wf_execution_runs')
      .select('id, org_id')
      .eq('id', run_id)
      .maybeSingle();

    if (runError || !run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    if (run.org_id !== orgId) {
      return NextResponse.json(
        { error: 'Unauthorized: Run belongs to a different organization' },
        { status: 403 }
      );
    }

    // Canonical storage layout is wf_artifacts/<org_id>/<run_id>/<file_name>.
    // Older runner builds may send a path without the org prefix (which would
    // 404 on download), so normalize anything that does not match.
    const canonicalCloudPath = `wf_artifacts/${orgId}/${run_id}/${file_name}`;

    let finalCloudStoragePath = cloud_storage_path || null;
    if (finalCloudStoragePath && !finalCloudStoragePath.startsWith(`wf_artifacts/${orgId}/`)) {
      finalCloudStoragePath = canonicalCloudPath;
    }

    if (body.file_data) {
      const buffer = Buffer.from(body.file_data, 'base64');
      const uploadPath = `${orgId}/${run_id}/${file_name}`;
      const { error: uploadErr } = await supabase.storage
        .from('wf_artifacts')
        .upload(uploadPath, buffer, {
          contentType: 'application/octet-stream',
          upsert: true,
        });
      if (uploadErr) {
        // Keep the artifact visible as local-only instead of claiming a cloud
        // copy that was never stored.
        finalCloudStoragePath = null;
      } else {
        finalCloudStoragePath = `wf_artifacts/${uploadPath}`;
      }
    }

    const { data: newArtifact, error: insertError } = await supabase
      .from('wf_run_artifacts')
      .upsert(
        {
          run_id,
          file_name,
          file_size_bytes: file_size_bytes !== undefined ? Number(file_size_bytes) : null,
          sha256_hash,
          cloud_storage_path: finalCloudStoragePath,
          item_metadata: {
            ...(typeof item_metadata === 'object' && item_metadata !== null ? item_metadata : {}),
            ...(body.storage_path ? { storage_path: body.storage_path } : {}),
          },
          synced_to_drive: synced_to_drive !== undefined ? Boolean(synced_to_drive) : false,
        },
        { onConflict: 'run_id,sha256_hash' }
      )
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ artifact: newArtifact }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid JSON body';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
