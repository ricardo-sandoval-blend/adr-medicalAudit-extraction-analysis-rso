import {
  Dataset,
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

// Finds the 'draft' execution accumulated during the day for a given open
// version (radicados added from the Executor), or null if none exists yet.
export async function getDraftExecution(
  versionId: string
): Promise<Execution | null> {
  const params = new URLSearchParams({
    versionId,
    status: 'draft',
    limit: '1',
  });
  const executions = await fetchAPI<Execution[]>(`/executions?${params}`);
  return executions[0] || null;
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

export async function removeIncident(
  incidentId: string
): Promise<{ success: boolean }> {
  return fetchAPI<{ success: boolean }>(
    `/incidents/${incidentId}`,
    { method: 'DELETE' }
  );
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
