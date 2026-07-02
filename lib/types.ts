// Radicado structure
export interface Radicado {
  numero: string; // e.g., '000930'
  nit: string; // e.g., '800149384'
  prestadora: string; // Healthcare provider name
  full_id?: string; // e.g., '000930_800149384_70563119'
}

// Execution criteria
export interface ExecutionCriteria {
  ips: string[];
  mandatory_radicados: Radicado[];
}

// Execution record
// status lifecycle: 'draft' (accumulating mandatory radicados, freely
// editable from the Executor) -> 'running' (started via "Iniciar") ->
// 'success' | 'failed'.
export interface Execution {
  id: string;
  dataset_id: string;
  created_at: string;
  completed_at?: string;
  status: 'draft' | 'pending' | 'running' | 'success' | 'failed';
  total_documents: number;
  successful_count: number;
  error_count: number;
  pdf_count: number;
  metrics: Record<string, number>;
  criteria: ExecutionCriteria;
  changelog_version?: string;
  version_id?: string;
  errors: string[];
  previous_execution_id?: string;
  created_by?: string;
}

// Execution metric (delta)
export interface ExecutionMetric {
  id: string;
  execution_id: string;
  metric_key: string;
  current_value: number;
  previous_value: number;
  delta: number;
  created_at: string;
}

// Structure version (deprecated/unused, superseded by Version below)
export interface StructureVersion {
  id: string;
  execution_id: string;
  version: string; // e.g., 'v1.0', 'v1.1'
  fields: Record<string, unknown>;
  previous_version_id?: string;
  created_at: string;
}

// Document change with description and affected fields
export interface DocumentChange {
  document_type: string;
  description: string;
  fields: string[];
}

// Version: a version draft, opened once per cycle. Its content is the set of
// bullets (see IncidentLink below) worked during the day; it can have many
// executions run against it, and is closed manually once a run measures
// well. Only one version should be 'open' (in draft) at a time.
export interface Version {
  id: string;
  version: string; // e.g., 'v1.0.0'
  status: 'open' | 'closed';
  created_at: string;
  closed_at?: string;
  created_by?: string; // email of who opened the version
}

// Version detail with its executions and incidents (GET /api/versions/[id])
export interface VersionDetail extends Version {
  executions: Execution[];
  incidents: IncidentLink[];
}

// Structure field change (legacy)
export interface FieldChange {
  type: 'added' | 'removed' | 'modified';
  field: string;
  old_value?: unknown;
  new_value?: unknown;
}

// Incident link: a "bullet" in the changelog — a ClickUp issue with its own
// lifecycle: opened with just document type + a plan + the issue link, then
// closed later (same day) with the resolution — what was actually
// implemented to solve it. Bullets are grouped by document_type when
// displayed.
export interface IncidentLink {
  id: string;
  version_id: string;
  clickup_id: string;
  clickup_url: string;
  title: string;
  document_type?: string;
  description?: string; // the plan: what will be worked on
  status: 'open' | 'closed';
  resolution?: string; // what was implemented to solve it, set on close
  created_at: string;
  created_by?: string; // email of who registered this bullet
  closed_at?: string;
  closed_by?: string; // email of who resolved this bullet
}

// Dataset info
export interface Dataset {
  id: string;
  name: string;
  path: string;
  pdf_count: number;
  total_size_mb: number;
  last_execution?: Execution;
}

// PDF info
export interface PDFFile {
  name: string;
  path: string;
  size_bytes: number;
  size_mb: number;
  created_at?: string;
  modified_at?: string;
  radicados?: string[];
  ip?: string;
}

// Request JSON structure (from dataset)
export interface RequestJsonEntry {
  numero: string;
  nit: string;
  prestadora: string;
  [key: string]: unknown;
}

// API request/response types
export interface ExecuteRequest {
  // If provided, promotes an existing 'draft' execution to 'running' instead
  // of creating a new one.
  execution_id?: string;
  dataset_id: string;
  pdf_paths: string[];
  criteria: ExecutionCriteria;
  sample_size: number;
  version_id: string;
}

// Body for creating/updating a draft execution (POST/PATCH /api/executions)
export interface DraftExecutionInput {
  version_id?: string;
  dataset_id?: string;
  status?: Execution['status'];
  total_documents?: number;
  pdf_count?: number;
  criteria?: ExecutionCriteria;
}

export interface ExecuteResponse {
  execution_id: string;
  status: 'pending' | 'running';
  message: string;
}

export interface MetricsResponse {
  execution_id: string;
  metrics: ExecutionMetric[];
  summary: {
    total_delta: number;
    improved_count: number;
    degraded_count: number;
  };
}

// Operational overview for the dashboard: issues filed/resolved
// (incident_links, all versions) and executions actually run.
export interface OperationalStats {
  issues: {
    total: number;
    resolved: number;
    open: number;
  };
  executions: {
    total: number;
  };
}

// Daily time series for the dashboard's line charts
export interface OperationalTimeseries {
  changelogChanges: Array<{ date: string; count: number }>;
  issues: Array<{ date: string; radicados: number; solucionados: number }>;
}

// Dashboard data
export interface DashboardStats {
  total_documents_delta: number;
  success_rate_delta: number;
  new_fields_count: number;
  error_count_delta: number;
  last_execution_date?: string;
  dataset_count: number;
}

// Changelog entry
export interface ChangelogEntry {
  version: StructureVersion;
  field_changes?: FieldChange[]; // Legacy
  document_changes?: DocumentChange[];
  metrics_snapshot: {
    total_documents: number;
    success_rate: number;
    error_count: number;
  };
  incidents: IncidentLink[];
}
