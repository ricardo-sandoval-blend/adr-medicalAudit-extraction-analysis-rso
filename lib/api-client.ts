import {
  Dataset,
  DatasetRadicado,
  Execution,
  ExecuteRequest,
  ExecuteResponse,
  DraftExecutionInput,
  MetricsResponse,
  Version,
  VersionDetail,
  IncidentLink,
  OperationalStats,
  OperationalTimeseries,
  ExecutionFieldsResponse,
  GroundTruthEntry,
  GroundTruthRadicado,
  GroundTruthScoreResponse,
  GroundTruthSet,
} from './types';

const API_BASE = '/api';

async function fetchAPI<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(
      `API Error: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

// Datasets
export async function getDatasets(): Promise<Dataset[]> {
  return fetchAPI<Dataset[]>('/datasets');
}

export async function getDataset(datasetId: string): Promise<Dataset> {
  return fetchAPI<Dataset>(`/datasets/${datasetId}`);
}

// Lists the radicados (folders) found inside a dataset, each with its PDF
// documents. Used by the execution editor to search radicados and pick
// which documents to run for each one.
export async function getDatasetRadicados(
  datasetId: string,
  search?: string,
  limit: number = 100
): Promise<DatasetRadicado[]> {
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  params.append('limit', limit.toString());
  return fetchAPI<DatasetRadicado[]>(
    `/datasets/${datasetId}/radicados?${params}`
  );
}

// Executions
export async function getExecutions(
  datasetId?: string,
  limit: number = 50
): Promise<Execution[]> {
  const params = new URLSearchParams();
  if (datasetId) params.append('datasetId', datasetId);
  params.append('limit', limit.toString());

  return fetchAPI<Execution[]>(`/executions?${params}`);
}

export async function getExecution(executionId: string): Promise<Execution> {
  return fetchAPI<Execution>(`/executions/${executionId}`);
}

// Lists executions currently in planning ('draft' status) — the rows shown
// in the Executor's planning table. Several drafts can coexist, each
// tracking its own dataset, target version, and radicados. Pass versionId
// to scope to a single version; omit it to list drafts across all versions.
export async function getDraftExecutions(
  versionId?: string
): Promise<Execution[]> {
  const params = new URLSearchParams({ status: 'draft', limit: '100' });
  if (versionId) params.append('versionId', versionId);
  return fetchAPI<Execution[]>(`/executions?${params}`);
}

export async function createExecution(
  input: DraftExecutionInput & { dataset_id: string }
): Promise<Execution> {
  return fetchAPI<Execution>('/executions', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateExecution(
  executionId: string,
  input: DraftExecutionInput
): Promise<Execution> {
  return fetchAPI<Execution>(`/executions/${executionId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

// Removes a planned ('draft') execution from the planning table.
export async function deleteExecution(
  executionId: string
): Promise<{ success: boolean }> {
  return fetchAPI<{ success: boolean }>(`/executions/${executionId}`, {
    method: 'DELETE',
  });
}

// Execute
export async function executeExtraction(
  request: ExecuteRequest
): Promise<ExecuteResponse> {
  return fetchAPI<ExecuteResponse>('/execute', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function getExecutionStatus(
  executionId: string
): Promise<Execution> {
  return fetchAPI<Execution>(`/execute?id=${executionId}`);
}

// Metrics
export async function getMetrics(
  executionId: string
): Promise<MetricsResponse> {
  return fetchAPI<MetricsResponse>(
    `/metrics?executionId=${encodeURIComponent(executionId)}`
  );
}

export async function getDatasetMetrics(
  datasetId: string
): Promise<MetricsResponse> {
  return fetchAPI<MetricsResponse>(
    `/metrics?datasetId=${encodeURIComponent(datasetId)}`
  );
}

// Versions
export async function getVersions(): Promise<{
  versions: Version[];
  total: number;
}> {
  return fetchAPI<{ versions: Version[]; total: number }>('/versions');
}

export async function getCurrentVersion(): Promise<{
  version: Version | null;
}> {
  return fetchAPI<{ version: Version | null }>('/versions/current');
}

export interface VersionBulletInput {
  clickup_url: string;
  title?: string;
  document_type?: string;
  description?: string;
}

export async function createVersion(input: {
  version: string;
  created_by?: string;
  bullets?: VersionBulletInput[];
}): Promise<{ success: boolean; message: string; version: Version }> {
  return fetchAPI('/versions', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getVersionDetails(
  versionId: string
): Promise<VersionDetail> {
  return fetchAPI<VersionDetail>(`/versions/${versionId}`);
}

export async function closeVersion(versionId: string): Promise<Version> {
  return fetchAPI<Version>(`/versions/${versionId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'closed' }),
  });
}

// Operational stats
export async function getOperationalStats(): Promise<OperationalStats> {
  return fetchAPI<OperationalStats>('/stats/overview');
}

export async function getOperationalTimeseries(): Promise<OperationalTimeseries> {
  return fetchAPI<OperationalTimeseries>('/stats/timeseries');
}

// Incidents ("bullets")
// Opens a bullet against a version: a ClickUp issue + the plan (document
// type + description), stamped with who registered it. No resolution yet —
// that's added later via closeIncident().
export async function addIncident(input: {
  versionId: string;
  clickupUrl: string;
  title: string;
  documentType?: string;
  description?: string;
  createdBy?: string;
}): Promise<IncidentLink> {
  return fetchAPI<IncidentLink>(`/changelog`, {
    method: 'POST',
    body: JSON.stringify({
      version_id: input.versionId,
      clickup_url: input.clickupUrl,
      title: input.title,
      document_type: input.documentType,
      description: input.description,
      created_by: input.createdBy,
    }),
  });
}

// Closes a bullet with its resolution — what was actually implemented to
// solve the ClickUp issue.
export async function closeIncident(
  incidentId: string,
  input: { resolution: string; closedBy?: string }
): Promise<IncidentLink> {
  return fetchAPI<IncidentLink>(`/incidents/${incidentId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      resolution: input.resolution,
      closed_by: input.closedBy,
    }),
  });
}

// Rolls back a previously closed bullet — the implemented change had to be
// undone. Only allowed while the bullet is 'closed'; records who reverted it
// and why.
export async function rollbackIncident(
  incidentId: string,
  input: { reason: string; revertedBy?: string }
): Promise<IncidentLink> {
  return fetchAPI<IncidentLink>(`/incidents/${incidentId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: 'reverted',
      revert_reason: input.reason,
      reverted_by: input.revertedBy,
    }),
  });
}

export async function removeIncident(
  incidentId: string
): Promise<{ success: boolean }> {
  return fetchAPI<{ success: boolean }>(
    `/incidents/${incidentId}`,
    { method: 'DELETE' }
  );
}

// Ground truth
// Lists every radicado with at least one ground-truth field defined, for
// the management view.
export async function getGroundTruthSets(): Promise<GroundTruthSet[]> {
  return fetchAPI<GroundTruthSet[]>('/ground-truth');
}

// Reads the ground truth defined so far for one radicado (every document
// type that has fields fixed).
export async function getGroundTruth(
  datasetId: string,
  radicado: string
): Promise<GroundTruthRadicado> {
  const params = new URLSearchParams({ dataset_id: datasetId, radicado });
  return fetchAPI<GroundTruthRadicado>(`/ground-truth?${params}`);
}

// Fixes (creates or overwrites) the correct value for one field — the
// "desempate" recorded while reviewing a diff between two executions.
export async function upsertGroundTruthField(input: {
  datasetId: string;
  radicado: string;
  documentType: string;
  fieldPath: string;
  valor: unknown;
  estado?: string | null;
  observacion?: string | null;
  updatedBy?: string;
}): Promise<GroundTruthEntry> {
  return fetchAPI<GroundTruthEntry>('/ground-truth/field', {
    method: 'POST',
    body: JSON.stringify({
      dataset_id: input.datasetId,
      radicado: input.radicado,
      document_type: input.documentType,
      field_path: input.fieldPath,
      valor: input.valor,
      estado: input.estado,
      observacion: input.observacion,
      updated_by: input.updatedBy,
    }),
  });
}

export async function deleteGroundTruthField(input: {
  datasetId: string;
  radicado: string;
  documentType: string;
  fieldPath: string;
}): Promise<{ success: boolean }> {
  const params = new URLSearchParams({
    dataset_id: input.datasetId,
    radicado: input.radicado,
    document_type: input.documentType,
    field_path: input.fieldPath,
  });
  return fetchAPI<{ success: boolean }>(`/ground-truth/field?${params}`, {
    method: 'DELETE',
  });
}

// The flattened extracted fields of one document, as produced by a given
// execution (reads the on-disk extraction output — see lib/extraction.ts).
export async function getExecutionFields(
  executionId: string,
  radicado: string,
  documentType: string
): Promise<ExecutionFieldsResponse> {
  const params = new URLSearchParams({ radicado, type: documentType });
  return fetchAPI<ExecutionFieldsResponse>(
    `/executions/${executionId}/fields?${params}`
  );
}

// Measures one execution's extracted values against the ground truth fixed
// for a radicado — the "desempate" scoring.
export async function scoreExecutionAgainstGroundTruth(
  datasetId: string,
  radicado: string,
  executionId: string
): Promise<GroundTruthScoreResponse> {
  const params = new URLSearchParams({
    dataset_id: datasetId,
    radicado,
    execution_id: executionId,
  });
  return fetchAPI<GroundTruthScoreResponse>(`/ground-truth/score?${params}`);
}

// Polling helper
export async function pollExecutionStatus(
  executionId: string,
  interval: number = 2000,
  maxAttempts: number = 300
): Promise<Execution> {
  for (let i = 0; i < maxAttempts; i++) {
    const execution = await getExecutionStatus(executionId);

    if (
      execution.status === 'success' ||
      execution.status === 'failed'
    ) {
      return execution;
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error('Execution polling timeout');
}
