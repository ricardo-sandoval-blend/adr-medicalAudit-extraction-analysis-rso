-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Version table: a version draft, opened once per cycle. Its content is the
-- set of bullets (see incident_links below) worked during the day; it can
-- have many executions run against it, and is closed manually once a run
-- measures well. Only one version should be 'open' (in draft) at a time
-- (enforced by the partial unique index below; the application also checks
-- this on create).
CREATE TABLE versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  version VARCHAR(50) NOT NULL UNIQUE,
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP,
  created_by VARCHAR(255) -- email of who opened the version
);

CREATE INDEX idx_versions_status ON versions(status);
CREATE INDEX idx_versions_created_at ON versions(created_at DESC);
CREATE UNIQUE INDEX idx_versions_single_open ON versions ((status)) WHERE status = 'open';

-- Execution table
-- status lifecycle: 'draft' (accumulating mandatory radicados, freely editable)
-- -> 'running' (started, extraction in progress) -> 'success' | 'failed'.
CREATE TABLE executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dataset_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'running', 'success', 'failed')),
  total_documents INTEGER DEFAULT 0,
  successful_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  pdf_count INTEGER DEFAULT 0,
  metrics JSONB DEFAULT '{}',
  criteria JSONB DEFAULT '{}',
  changelog_version VARCHAR(50),
  version_id UUID REFERENCES versions(id) ON DELETE SET NULL,
  errors TEXT[] DEFAULT ARRAY[]::TEXT[],
  previous_execution_id UUID REFERENCES executions(id) ON DELETE SET NULL,
  created_by VARCHAR(255),
  CONSTRAINT dataset_timestamp_unique UNIQUE (dataset_id, created_at)
);

CREATE INDEX idx_executions_dataset ON executions(dataset_id);
CREATE INDEX idx_executions_created_at ON executions(created_at DESC);
CREATE INDEX idx_executions_status ON executions(status);
CREATE INDEX idx_executions_version ON executions(version_id);

-- ExecutionMetric table (delta tracking)
CREATE TABLE execution_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  execution_id UUID NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
  metric_key VARCHAR(255) NOT NULL,
  current_value NUMERIC(15, 4),
  previous_value NUMERIC(15, 4),
  delta NUMERIC(15, 4),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT execution_metric_unique UNIQUE (execution_id, metric_key)
);

CREATE INDEX idx_execution_metrics_execution ON execution_metrics(execution_id);
CREATE INDEX idx_execution_metrics_metric_key ON execution_metrics(metric_key);

-- StructureVersion table
-- Deprecated / unused: superseded by the `versions` table above. Kept for
-- backward compatibility; nothing reads or writes to it anymore.
CREATE TABLE structure_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  execution_id UUID NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
  version VARCHAR(50) NOT NULL,
  fields JSONB DEFAULT '{}',
  previous_version_id UUID REFERENCES structure_versions(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT version_unique UNIQUE (execution_id, version)
);

CREATE INDEX idx_structure_versions_execution ON structure_versions(execution_id);
CREATE INDEX idx_structure_versions_version ON structure_versions(version);

-- IncidentLink table: a "bullet" in the changelog — a ClickUp issue worked
-- during the day. Has its own lifecycle independent of the version draft's:
-- opened with just document type + a plan ("voy a trabajar en esto") + the
-- issue link, then closed later (same day, once resolved) with the
-- resolution — what was actually implemented to solve it. version_id points
-- at the first-class `versions` table (a version draft). Bullets are grouped
-- by document_type when displayed.
CREATE TABLE incident_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  version_id UUID NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
  clickup_id VARCHAR(255) NOT NULL,
  clickup_url VARCHAR(2048),
  title VARCHAR(1024),
  document_type VARCHAR(50),
  description TEXT, -- the plan: what will be worked on
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  resolution TEXT, -- what was implemented to solve it, set on close
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(255), -- email of who registered this bullet
  closed_at TIMESTAMP,
  closed_by VARCHAR(255), -- email of who resolved this bullet
  CONSTRAINT incident_unique UNIQUE (version_id, clickup_id)
);

CREATE INDEX idx_incident_links_version ON incident_links(version_id);
CREATE INDEX idx_incident_links_clickup_id ON incident_links(clickup_id);

-- View for recent executions with metrics
CREATE VIEW execution_summary AS
SELECT
  e.id,
  e.dataset_id,
  e.created_at,
  e.completed_at,
  e.status,
  e.total_documents,
  e.successful_count,
  e.error_count,
  e.pdf_count,
  ROUND(
    CASE
      WHEN e.total_documents = 0 THEN 0
      ELSE (e.successful_count::NUMERIC / e.total_documents * 100)
    END,
    2
  ) AS success_rate,
  e.previous_execution_id,
  EXTRACT(EPOCH FROM (e.completed_at - e.created_at)) AS duration_seconds
FROM executions e
WHERE e.status IN ('success', 'failed');
