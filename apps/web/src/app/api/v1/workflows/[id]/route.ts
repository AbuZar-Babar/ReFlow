import { NextRequest, NextResponse } from 'next/server';
import { authenticateRunnerOrUser } from '@/lib/auth/runner-auth';
import { WorkflowDefinition } from '@/lib/types/database';
import { normalizeLoopFlags } from '@/lib/workflows/loop-signals';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteContext
) {
  const auth = await authenticateRunnerOrUser(request);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const { orgId, supabase } = auth.context;

  if (!id) {
    return NextResponse.json({ error: 'Missing workflow ID' }, { status: 400 });
  }

  const { data: workflow, error } = await supabase
    .from('wf_workflows')
    .select('*')
    .eq('id', id)
    .eq('org_id', orgId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!workflow) {
    return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
  }

  return NextResponse.json({ workflow });
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
) {
  const auth = await authenticateRunnerOrUser(request);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const { orgId, supabase } = auth.context;

  if (!id) {
    return NextResponse.json({ error: 'Missing workflow ID' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const {
      name,
      portal_url,
      workflow_definition,
      filter_rules,
      upload_to_cloud,
      target_folder,
    } = body;

    const { data: currentWf, error: fetchError } = await supabase
      .from('wf_workflows')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchError || !currentWf) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    if (currentWf.org_id !== orgId) {
      return NextResponse.json(
        { error: 'Unauthorized: Workflow belongs to a different organization' },
        { status: 403 }
      );
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updatePayload.name = name;
    if (portal_url !== undefined) updatePayload.portal_url = portal_url;
    if (filter_rules !== undefined) updatePayload.filter_rules = filter_rules;

    let updatedDefinition: WorkflowDefinition =
      typeof currentWf.workflow_definition === 'object' && currentWf.workflow_definition !== null
        ? { ...currentWf.workflow_definition }
        : {};
    let definitionModified = false;

    if (
      workflow_definition !== undefined &&
      typeof workflow_definition === 'object' &&
      workflow_definition !== null
    ) {
      updatedDefinition = { ...updatedDefinition, ...workflow_definition };
      definitionModified = true;
    }

    if (upload_to_cloud !== undefined) {
      updatedDefinition.upload_to_cloud = Boolean(upload_to_cloud);
      definitionModified = true;
    }

    if (target_folder !== undefined) {
      updatedDefinition.target_folder = String(target_folder);
      definitionModified = true;
    }

    if (definitionModified) {
      updatePayload.workflow_definition = normalizeLoopFlags(updatedDefinition);
    }

    const { data: updatedWorkflow, error: updateError } = await supabase
      .from('wf_workflows')
      .update(updatePayload)
      .eq('id', id)
      .eq('org_id', orgId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ workflow: updatedWorkflow }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid JSON body';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteContext
) {
  const auth = await authenticateRunnerOrUser(request);
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const { orgId, supabase } = auth.context;

  if (!id) {
    return NextResponse.json({ error: 'Missing workflow ID' }, { status: 400 });
  }

  try {
    const { data: existingWf, error: fetchError } = await supabase
      .from('wf_workflows')
      .select('id, name, org_id')
      .eq('id', id)
      .maybeSingle();

    if (fetchError || !existingWf) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    if (existingWf.org_id !== orgId) {
      return NextResponse.json(
        { error: 'Unauthorized: Workflow belongs to a different organization' },
        { status: 403 }
      );
    }

    // Guard: Prevent deletion if any run is currently active
    const { data: activeRuns, error: activeRunsError } = await supabase
      .from('wf_execution_runs')
      .select('id, status')
      .eq('workflow_id', id)
      .in('status', ['pending', 'running', 'requires_action']);

    if (activeRunsError) {
      return NextResponse.json({ error: activeRunsError.message }, { status: 500 });
    }

    if (activeRuns && activeRuns.length > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete workflow while an execution run is active. Please stop the run first.',
          active_run_id: activeRuns[0].id,
          active_run_status: activeRuns[0].status,
        },
        { status: 409 }
      );
    }

    // Cascade delete
    const { data: wfRuns } = await supabase
      .from('wf_execution_runs')
      .select('id')
      .eq('workflow_id', id);

    if (wfRuns && wfRuns.length > 0) {
      const runIds = wfRuns.map((r: { id: string }) => r.id);
      await supabase.from('wf_run_artifacts').delete().in('run_id', runIds);
      await supabase.from('wf_execution_runs').delete().eq('workflow_id', id);
    }

    const { error: deleteError } = await supabase
      .from('wf_workflows')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Workflow '${existingWf.name}' deleted successfully`,
      id,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
