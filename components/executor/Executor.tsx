'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useVersions } from '@/hooks/useVersions';
import { useDatasets } from '@/hooks/useDatasets';
import { useDraftExecutions } from '@/hooks/useDraftExecutions';
import { ExecutionEditor } from './ExecutionEditor';
import { ExecutionStatus } from './ExecutionStatus';
import {
  executeExtraction,
  deleteExecution,
  getDatasetRadicados,
} from '@/lib/api-client';
import { Execution } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { format } from 'date-fns';
import { GitCompare, Loader2, Pencil, Trash2, Play, Plus } from 'lucide-react';

export function Executor() {
  const { versions, loading: versionsLoading } = useVersions();
  const { datasets } = useDatasets();
  const { executions, loading: executionsLoading, refetch } = useDraftExecutions();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Execution | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runningExecutionId, setRunningExecutionId] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const versionsById = new Map(versions.map((v) => [v.id, v]));

  const openNew = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  const openEdit = (execution: Execution) => {
    setEditing(execution);
    setEditorOpen(true);
  };

  const handleDelete = async (execution: Execution) => {
    if (!confirm(`¿Eliminar la ejecución en planeación de "${execution.dataset_id}"?`)) {
      return;
    }
    setDeletingId(execution.id);
    setError(null);
    try {
      await deleteExecution(execution.id);
      refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la ejecución');
    } finally {
      setDeletingId(null);
    }
  };

  const handleRun = async (execution: Execution) => {
    const radicados = execution.criteria?.radicados || [];
    if (radicados.length === 0) {
      setError('Agrega al menos un radicado antes de iniciar');
      return;
    }
    if (!radicados.some((r) => r.documents.length > 0)) {
      setError('Activa al menos un documento en algún radicado antes de iniciar');
      return;
    }
    if (!execution.version_id) {
      setError('Selecciona una versión antes de iniciar');
      return;
    }

    setRunningId(execution.id);
    setError(null);
    try {
      // Resolve the selected document codes to real PDF paths on disk.
      const datasetRadicados = await getDatasetRadicados(execution.dataset_id, undefined, 500);
      const byFullId = new Map(datasetRadicados.map((r) => [r.full_id, r]));
      const pdfPaths: string[] = [];
      for (const sel of radicados) {
        const detail = byFullId.get(sel.full_id);
        if (!detail) continue;
        for (const doc of detail.documents) {
          if (sel.documents.includes(doc.type)) pdfPaths.push(doc.path);
        }
      }

      const response = await executeExtraction({
        execution_id: execution.id,
        dataset_id: execution.dataset_id,
        pdf_paths: pdfPaths,
        criteria: execution.criteria,
        sample_size: pdfPaths.length,
        version_id: execution.version_id,
      });

      setFinished(false);
      setRunningExecutionId(response.execution_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar la ejecución');
    } finally {
      setRunningId(null);
    }
  };

  const handleStatusChange = (execution: Execution) => {
    setFinished(execution.status === 'success' || execution.status === 'failed');
  };

  const handleBackToPlanning = () => {
    setRunningExecutionId(null);
    setFinished(false);
    refetch();
  };

  if (versionsLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando versiones...
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Ejecuciones</h1>
        </div>
        <Card className="max-w-2xl">
          <CardContent className="space-y-4 pt-6 text-center text-muted-foreground">
            <p>
              Todavía no existe ninguna versión. Crea una desde Changelog
              para poder asociarle ejecuciones.
            </p>
            <a href="/changelog">
              <Button>Ir a Changelog</Button>
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (runningExecutionId) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Ejecución en curso</h1>
        </div>
        <ExecutionStatus
          executionId={runningExecutionId}
          onStatusChange={handleStatusChange}
        />
        {finished && (
          <Button onClick={handleBackToPlanning}>Volver a planeación</Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Ejecuciones</h1>
          <p className="text-muted-foreground">
            Planifica y lanza extracciones por radicado
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/executor/compare">
            <Button variant="outline">
              <GitCompare className="mr-2 h-4 w-4" />
              Comparar ejecuciones
            </Button>
          </Link>
          <Button onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva ejecución
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-100 p-4 text-red-800 dark:bg-red-900 dark:text-red-200">
          {error}
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          {executionsLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando ejecuciones...
            </div>
          ) : executions.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No hay ejecuciones en planeación. Crea una para empezar.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dataset</TableHead>
                  <TableHead>Versión</TableHead>
                  <TableHead>Radicados</TableHead>
                  <TableHead>Documentos</TableHead>
                  <TableHead>Creado por</TableHead>
                  <TableHead>Creado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {executions.map((execution) => {
                  const radicados = execution.criteria?.radicados || [];
                  const docCount = radicados.reduce(
                    (sum, r) => sum + r.documents.length,
                    0
                  );
                  const executionVersion = execution.version_id
                    ? versionsById.get(execution.version_id)
                    : undefined;
                  return (
                    <TableRow key={execution.id}>
                      <TableCell className="font-medium">
                        {execution.dataset_id}
                      </TableCell>
                      <TableCell>
                        {executionVersion ? (
                          <span className="font-mono text-sm">
                            {executionVersion.version}
                            {executionVersion.status === 'open' && (
                              <span className="ml-1 text-xs text-muted-foreground">
                                (borrador)
                              </span>
                            )}
                          </span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>{radicados.length}</TableCell>
                      <TableCell>{docCount}</TableCell>
                      <TableCell>{execution.created_by || '—'}</TableCell>
                      <TableCell>
                        {format(new Date(execution.created_at), 'MMM dd, HH:mm')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(execution)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(execution)}
                            disabled={deletingId === execution.id}
                          >
                            {deletingId === execution.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleRun(execution)}
                            disabled={runningId === execution.id || docCount === 0}
                          >
                            {runningId === execution.id ? (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Play className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            Iniciar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ExecutionEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        execution={editing}
        datasets={datasets}
        versions={versions}
        onSaved={refetch}
      />
    </div>
  );
}
