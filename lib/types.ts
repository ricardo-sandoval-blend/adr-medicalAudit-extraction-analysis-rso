// A document found inside a radicado folder in a dataset (PDF only). `type`
// is the 3-letter document code (matches DOCUMENT_TYPES in lib/config.ts),
// taken from the filename prefix, e.g. 'ADM_800149384_700678828.pdf' -> 'ADM'.
export interface RadicadoDocument {
  type: string;
  filename: string;
  path: string;
}

// A radicado as found on disk inside a dataset: one folder per radicado,
// named '{numero}_{nit}_{suffix}', containing its documents.
export interface DatasetRadicado {
  full_id: string; // dataset folder name, e.g. '000930_800149384_70563119'
  numero: string;
  nit: string;
  suffix: string;
  documents: RadicadoDocument[]; // PDFs only, filtered to known DOCUMENT_TYPES
}

// A radicado chosen for an execution, with which of its documents to run
// (by 3-letter type code, e.g. ['ADM', 'FAC']).
export interface RadicadoSelection {
  full_id: string;
  numero: string;
  nit: string;
  suffix?: string;
  documents: string[];
}

// Execution criteria
export interface ExecutionCriteria {
  ips?: string[];
  radicados: RadicadoSelection[];
}

// Execution record
// status lifecycle: 'draft' (a planned execution being configured in the
// Executor's planning table — radicados/documents freely editable) ->
// 'running' (started via "Iniciar") -> 'success' | 'failed'. Many drafts can
// exist at once per version, each tracking its own dataset + radicados.
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
// implemented to solve it. A closed bullet can later be rolled back
// (status='reverted') if the implemented change had to be undone, recording
// who reverted it and why. Bullets are grouped by document_type when
// displayed.
export interface IncidentLink {
  id: string;
  version_id: string;
  clickup_id: string;
  clickup_url: string;
  title: string;
  document_type?: string;
  description?: string; // the plan: what will be worked on
  status: 'open' | 'closed' | 'reverted';
  resolution?: string; // what was implemented to solve it, set on close
  created_at: string;
  created_by?: string; // email of who registered this bullet
  closed_at?: string;
  closed_by?: string; // email of who resolved this bullet
  reverted_at?: string;
  reverted_by?: string; // email of who rolled this bullet back
  revert_reason?: string; // why the implemented change was rolled back
}

// Dataset info
export interface Dataset {
  id: string;
  name: string;
  path: string;
  pdf_count: number;
  total_size_mb: number;
  radicado_count?: number;
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
  created_by?: string;
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

// ---------------------------------------------------------------------------
// Ground truth
// ---------------------------------------------------------------------------

// A single extracted leaf value, as read from a document's extraction JSON
// (executions/<date>/<numero_nit>/<seq>_<TYPE>_<nit>_<suffix>.json) or from a
// ground-truth field file. Every leaf field in the extraction JSON has this
// shape.
export interface ExtractionLeaf {
  valor: unknown;
  estado?: string | null;
  observacion?: string | null;
}

// A document's extraction, flattened to `field_path -> leaf` (dot-separated
// path, e.g. 'paz_y_salvo_transporte.entidad_prestadora.nit'). Produced by
// lib/extraction.ts#flattenExtraction; ground-truth field files use the same
// path space so the two can be compared key by key.
export type ExtractionFieldMap = Record<string, ExtractionLeaf>;

// Response of GET /api/executions/[id]/fields — the flattened fields of one
// document of one radicado, as produced by a given execution. `found` is
// false when no matching file exists on disk for that execution/radicado/
// document (today's executions are mocked and don't write real extraction
// output — see lib/extraction.ts).
export interface ExecutionFieldsResponse {
  execution_id: string;
  radicado: string;
  document_type: string;
  found: boolean;
  fields: ExtractionFieldMap;
}

// A ground truth entry: the correct value for one field, fixed by a
// reviewer while comparing two executions ("desempate"). Stored as JSON on
// disk (not in the DB) under
// ground-truth/<dataset_id>/<radicado_full_id>/<document_type>.json, keyed
// by field_path.
export interface GroundTruthEntry {
  valor: unknown;
  estado?: string | null;
  observacion?: string | null;
  updated_by?: string;
  updated_at: string;
}

// Contents of one ground-truth document file: field_path -> entry.
export type GroundTruthDocument = Record<string, GroundTruthEntry>;

// Response of GET /api/ground-truth?dataset_id=&radicado= — every
// ground-truth document defined so far for a radicado, keyed by document
// type.
export interface GroundTruthRadicado {
  dataset_id: string;
  radicado_full_id: string;
  documents: Record<string, GroundTruthDocument>;
}

// One row of GET /api/ground-truth (no filters) — a summary of each
// radicado that has at least one ground-truth field defined.
export interface GroundTruthSet {
  dataset_id: string;
  radicado_full_id: string;
  document_types: string[];
  field_count: number;
}

// One field's comparison in GET /api/ground-truth/score.
export interface GroundTruthScoreField {
  document_type: string;
  field_path: string;
  expected: { valor: unknown; estado?: string | null };
  actual: { valor: unknown; estado?: string | null } | null;
  match: boolean;
}

// Response of GET /api/ground-truth/score — how one execution's extracted
// values measure up against the ground truth fixed for a radicado.
export interface GroundTruthScoreResponse {
  execution_id: string;
  dataset_id: string;
  radicado_full_id: string;
  fields: GroundTruthScoreField[];
  summary: {
    total: number;
    matched: number;
    accuracy: number; // percentage, 0-100
  };
}
