'use client';

import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useDatasets } from '@/hooks/useDatasets';
import { useDatasetRadicados } from '@/hooks/useDatasetRadicados';
import { useExecutions } from '@/hooks/useExecutions';
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS, DocumentType } from '@/lib/config';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { FieldDiffTable } from './FieldDiffTable';
import { GroundTruthScorePanel } from './GroundTruthScorePanel';

// Compares two executions of the same dataset/radicado/document field by
// field, and lets a reviewer fix the ground truth inline (FieldDiffTable),
// then measure any execution against it (GroundTruthScorePanel). This is
// the only place executions are involved in ground truth work — the Ground
// Truth section itself only edits radicado/field values directly.
export function ExecutionCompare() {
  const { datasets, loading: datasetsLoading } = useDatasets();
  const [datasetId, setDatasetId] = useState<string | undefined>();
  const { radicados, loading: radicadosLoading } = useDatasetRadicados(datasetId);
  const [radicadoSearch, setRadicadoSearch] = useState('');
  const [radicadoFullId, setRadicadoFullId] = useState<string | undefined>();
  const [documentType, setDocumentType] = useState<DocumentType | undefined>();
  const { executions, loading: executionsLoading } = useExecutions({
    datasetId,
    limit: 100,
  });
  const [executionAId, setExecutionAId] = useState<string | undefined>();
  const [executionBId, setExecutionBId] = useState<string | undefined>();

  // Reset downstream selections whenever the dataset changes.
  useEffect(() => {
    const reset = () => {
      setRadicadoFullId(undefined);
      setRadicadoSearch('');
      setDocumentType(undefined);
      setExecutionAId(undefined);
      setExecutionBId(undefined);
    };
    reset();
  }, [datasetId]);

  const filteredRadicados = useMemo(() => {
    const term = radicadoSearch.trim().toLowerCase();
    if (!term) return radicados;
    return radicados.filter(
      (r) =>
        r.full_id.toLowerCase().includes(term) ||
        r.numero.toLowerCase().includes(term) ||
        r.nit.toLowerCase().includes(term)
    );
  }, [radicados, radicadoSearch]);

  const radicado = radicados.find((r) => r.full_id === radicadoFullId);
  const availableTypes = radicado
    ? DOCUMENT_TYPES.filter((t) => radicado.documents.some((d) => d.type === t))
    : DOCUMENT_TYPES;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Comparar ejecuciones</h1>
        <p className="text-muted-foreground">
          Compara los campos extraídos por dos ejecuciones y fija el valor correcto
          (ground truth) directamente desde el diff.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Selección</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Dataset</label>
              <Select value={datasetId || ''} onValueChange={setDatasetId}>
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={datasetsLoading ? 'Cargando...' : 'Selecciona un dataset...'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {datasets.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Buscar radicado</label>
              <Input
                placeholder="Número o NIT..."
                value={radicadoSearch}
                onChange={(e) => setRadicadoSearch(e.target.value)}
                disabled={!datasetId}
              />
            </div>
          </div>

          {datasetId &&
            (radicadosLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando radicados...
              </div>
            ) : (
              <div className="max-h-48 overflow-auto rounded-lg border">
                {filteredRadicados.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Sin radicados
                  </div>
                ) : (
                  filteredRadicados.slice(0, 50).map((r) => (
                    <button
                      key={r.full_id}
                      type="button"
                      onClick={() => {
                        setRadicadoFullId(r.full_id);
                        setDocumentType(undefined);
                      }}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted ${
                        r.full_id === radicadoFullId ? 'bg-muted font-medium' : ''
                      }`}
                    >
                      <span>
                        {r.numero} <span className="text-muted-foreground">({r.nit})</span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {r.documents.length} docs
                      </span>
                    </button>
                  ))
                )}
              </div>
            ))}

          {radicado && (
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Documento</label>
                <Select
                  value={documentType || ''}
                  onValueChange={(v) => setDocumentType(v as DocumentType)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona un documento..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTypes.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t} · {DOCUMENT_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Ejecución A</label>
                <Select value={executionAId || ''} onValueChange={setExecutionAId}>
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={executionsLoading ? 'Cargando...' : 'Selecciona...'}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {executions.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {format(new Date(e.created_at), 'MMM dd, HH:mm')} · {e.status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Ejecución B (opcional)</label>
                <Select value={executionBId || ''} onValueChange={setExecutionBId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona..." />
                  </SelectTrigger>
                  <SelectContent>
                    {executions
                      .filter((e) => e.id !== executionAId)
                      .map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {format(new Date(e.created_at), 'MMM dd, HH:mm')} · {e.status}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {datasetId && radicadoFullId && documentType && executionAId && (
        <FieldDiffTable
          datasetId={datasetId}
          radicado={radicadoFullId}
          documentType={documentType}
          executionAId={executionAId}
          executionBId={executionBId}
        />
      )}

      {datasetId && radicadoFullId && executionAId && (
        <GroundTruthScorePanel
          datasetId={datasetId}
          radicado={radicadoFullId}
          executions={executions}
          defaultExecutionId={executionAId}
        />
      )}
    </div>
  );
}
