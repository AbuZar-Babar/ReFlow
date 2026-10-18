import { NextRequest, NextResponse } from 'next/server';
import { authenticateRunnerOrUser } from '@/lib/auth/runner-auth';

function contentDisposition(fileName: string): string {
  const safeName = fileName || 'artifact';
  const asciiFallback = safeName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(safeName)}`;
}

export async function GET(request: NextRequest) {
  const auth = await authenticateRunnerOrUser(request);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { orgId, supabase } = auth.context;
  const artifactId = request.nextUrl.searchParams.get('id');

  if (!artifactId) {
    return NextResponse.json({ error: 'Missing artifact id parameter' }, { status: 400 });
  }

  // Retrieve artifact
  const { data: artifact, error: artError } = await supabase
    .from('wf_run_artifacts')
    .select('*, wf_execution_runs(org_id)')
    .eq('id', artifactId)
    .maybeSingle();

  if (artError || !artifact) {
    return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });
  }

  const runOrgId = (artifact as unknown as { wf_execution_runs?: { org_id?: string } })?.wf_execution_runs?.org_id;
  if (runOrgId && runOrgId !== orgId) {
    return NextResponse.json(
      { error: 'Unauthorized: Artifact belongs to a different organization' },
      { status: 403 }
    );
  }

  const cloudPath = artifact.cloud_storage_path;
  if (!cloudPath) {
    return NextResponse.json(
      { error: 'Artifact is stored locally only and has not been synced to cloud storage' },
      { status: 404 }
    );
  }

  // Stream the real bytes from the private bucket. If the object is missing we
  // return an honest 404 — never a placeholder file pretending to be the artifact.
  const cleanStoragePath = cloudPath.replace(/^wf_artifacts\//, '');
  try {
    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from('wf_artifacts')
      .download(cleanStoragePath);

    if (downloadError || !fileBlob) {
      return NextResponse.json(
        {
          error: `Artifact file not found in cloud storage${downloadError?.message ? `: ${downloadError.message}` : ''}`,
        },
        { status: 404 }
      );
    }

    const buffer = Buffer.from(await fileBlob.arrayBuffer());
    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': fileBlob.type || 'application/octet-stream',
        'Content-Disposition': contentDisposition(artifact.file_name),
        'Content-Length': String(buffer.length),
      },
    });
  } catch (storageErr) {
    const message = storageErr instanceof Error ? storageErr.message : 'Storage download failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
