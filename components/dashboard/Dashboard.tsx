'use client';

import { useEffect, useState } from 'react';
import { StatsCard } from './StatsCard';
import { ExtractionRateChart } from './ExtractionRateChart';
import { DocumentTypesTable } from './DocumentTypesTable';
import { ExecutionSelector } from './ExecutionSelector';
import {
  FileText,
  FolderOpen,
  BarChart3,
  Activity,
} from 'lucide-react';

interface FieldStats {
  total: number;
  encontrado: number;
  no_encontrado: number;
  con_valor: number;
  sin_valor: number;
}

interface DocumentTypeStats {
  type: string;
  label: string;
  count: number;
  fields: FieldStats;
}

interface ExecutionStats {
  execution_name: string;
  total_radicados: number;
  total_documents: number;
  document_types: DocumentTypeStats[];
  field_extraction_rate: number;
  nits: { nit: string; count: number }[];
}

interface AggregatedStats {
  total_executions: number;
  total_radicados: number;
  total_documents: number;
  field_extraction_rate: number;
  document_types: DocumentTypeStats[];
  executions: ExecutionStats[];
}

export function Dashboard() {
  const [stats, setStats] = useState<AggregatedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedExecution, setSelectedExecution] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const url = selectedExecution
          ? `/api/executions/stats?execution=${encodeURIComponent(selectedExecution)}`
          : '/api/executions/stats';
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch stats');
        const data = await res.json();

        // If fetching a single execution, wrap it to match the aggregated shape
        if (selectedExecution) {
          setStats({
            total_executions: 1,
            total_radicados: data.total_radicados,
            total_documents: data.total_documents,
            field_extraction_rate: data.field_extraction_rate,
            document_types: data.document_types,
            executions: [data],
          });
        } else {
          setStats(data);
        }
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error loading stats');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [selectedExecution]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        Cargando estadísticas de extracción...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center text-red-600">
        Error: {error}
      </div>
    );
  }

  if (!stats || stats.total_executions === 0) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        No se encontraron ejecuciones en disco.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Estadísticas de extracción desde archivos en disco
          </p>
        </div>
        <ExecutionSelector
          executions={stats.executions.map((e) => e.execution_name)}
          selected={selectedExecution}
          onSelect={setSelectedExecution}
        />
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard
          title="Ejecuciones"
          value={stats.total_executions}
          icon={<Activity className="h-5 w-5" />}
        />
        <StatsCard
          title="Radicados"
          value={stats.total_radicados}
          icon={<FolderOpen className="h-5 w-5" />}
        />
        <StatsCard
          title="Documentos"
          value={stats.total_documents}
          icon={<FileText className="h-5 w-5" />}
        />
        <StatsCard
          title="Tasa de Extracción"
          value={`${stats.field_extraction_rate}%`}
          icon={<BarChart3 className="h-5 w-5" />}
        />
      </div>

      {/* Extraction Rate per Document Type */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">
          Tasa de Extracción por Tipo de Documento
        </h2>
        <ExtractionRateChart documentTypes={stats.document_types} />
      </div>

      {/* Document Types Table */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">
          Detalle por Tipo de Documento
        </h2>
        <DocumentTypesTable documentTypes={stats.document_types} />
      </div>

      {/* Per-execution breakdown if viewing all */}
      {!selectedExecution && stats.executions.length > 1 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">
            Comparativa entre Ejecuciones
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {stats.executions.map((exec) => (
              <div
                key={exec.execution_name}
                className="rounded-lg border border-border bg-card p-6 hover:bg-muted/50 transition-colors"
              >
                <h3 className="font-semibold">{exec.execution_name}</h3>
                <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Radicados</p>
                    <p className="text-lg font-bold">{exec.total_radicados}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Documentos</p>
                    <p className="text-lg font-bold">{exec.total_documents}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Tasa Extracción</p>
                    <p className="text-lg font-bold">{exec.field_extraction_rate}%</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
