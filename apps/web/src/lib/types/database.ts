export type RunStatus =
  | 'pending'
  | 'running'
  | 'requires_action'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  plan_tier: 'starter' | 'pro' | 'business';
}

export interface OrganizationMember {
  id: string;
  org_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  created_at: string;
}

export interface HybridStoragePreferences {
  upload_to_cloud: boolean;
  target_folder: string;
}

export interface WorkflowDefinition {
  upload_to_cloud?: boolean;
  target_folder?: string;
  start_url?: string;
  steps?: unknown[];
  [key: string]: unknown;
}

export interface Workflow {
  id: string;
  org_id: string;
  name: string;
  portal_url: string;
  schema_version: string;
  workflow_definition: WorkflowDefinition;
  filter_rules: Record<string, unknown>;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExecutionRun {
  id: string;
  org_id: string;
  workflow_id: string;
  status: RunStatus;
  total_items_discovered: number;
  items_processed: number;
  items_downloaded: number;
  started_at: string;
  completed_at?: string | null;
  error_summary?: string | null;
  // Run-level execution config (persisted per run so concurrent runs of the
  // same workflow do not share settings through the workflow definition).
  mode?: string | null;
  is_loop?: boolean | null;
  loop_step_index?: number | null;
  loop_limit?: number | null;
  item_filter?: unknown;
}

export interface RunArtifact {
  id: string;
  run_id: string;
  file_name: string;
  file_size_bytes?: number | null;
  sha256_hash: string;
  item_metadata: Record<string, unknown>;
  cloud_storage_path?: string | null;
  synced_to_drive: boolean;
  created_at: string;
}

export interface CapturedAction {
  id?: string;
  index?: number;
  name?: string;
  elementName?: string;
  type: string;
  timestamp?: number;
  timeDeltaMs?: number;
  target?: {
    elementName?: string;
    friendlyName?: string;
    candidates?: Array<{ type: string; value: string }>;
    fingerprint?: {
      tagName?: string;
      id?: string;
      text?: string;
      type?: string;
      attributes?: Record<string, string>;
    };
  };
  value?: string;
  key?: string;
  url?: string;
  description?: string;
  [key: string]: unknown;
}

export interface WorkflowRecipe {
  metadata?: {
    recordingId?: string;
    name?: string;
    startUrl?: string;
    version?: string;
    isLoop?: boolean;
    mode?: string;
    startedAt?: string;
    completedAt?: string;
    [key: string]: unknown;
  };
  actions?: CapturedAction[];
  steps?: CapturedAction[];
  [key: string]: unknown;
}
