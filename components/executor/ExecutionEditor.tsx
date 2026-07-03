'use client';

import { useState, useMemo, useEffect, type DragEvent } from 'react';
import { useDatasetRadicados } from '@/hooks/useDatasetRadicados';
import { useKeycloak } from '@/lib/keycloak';
import { createExecution, updateExecution } from '@/lib/api-client';
import {
  Dataset,
  DatasetRadicado,
  Execution,
  RadicadoSelection,
  Version,
} from '@/lib/types';
import { DatasetSelector } from './DatasetSelector';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Loader2, Shuffle, X } from 'lucide-react';

interface ExecutionEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  execution: Execution | null; // null = creating a new planned execution
  datasets: Dataset[];
  versions: Version[];
  onSaved: () => void;
}

// Modal for configuring a single planned ('draft') execution: pick which
// version it counts against, pick a dataset, then drag radicados from the
// "Disponibles" column into "Para procesar" (or use the sampling button to
// auto-fill a stratified sample), and choose which documents (by 3-letter
// type code) to run for each one.
export function ExecutionEditor({
  open,
  onOpenChange,
  execution,
  datasets,
  versions,
  onSaved,
}: ExecutionEditorProps) {
  const [creating, setCreating] = useState(false);
  const [formRef, setFormRef] = useState<{ getName: () => string; getRadicados: () => string[] } | null>(null);

  const handleClose = async () => {
    // When closing, create the folder on disk if this is a new execution
    if (!execution && formRef) {
      const name = formRef.getName();
      const radicados = formRef.getRadicados();
      if (name) {
        setCreating(true);
        try {
          await fetch('/api/executions/create-folder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, radicados }),
          });
        } catch {
          // Best effort
        }
        setCreating(false);
      }
    }
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
      }}
    >
      <DialogContent className="flex max-h-[85vh] w-full flex-col overflow-y-auto sm:max-w-[39.2rem]">
        <DialogHeader>
          <DialogTitle>
            {execution ? 'Editar ejecución' : 'Nueva ejecución'}
          </DialogTitle>
        </DialogHeader>

        {open && (
          <ExecutionEditorForm
            key={execution?.id ?? 'new'}
            execution={execution}
            datasets={datasets}
            versions={versions}
            onFormRef={setFormRef}
          />
        )}

        <DialogFooter>
          <Button onClick={handleClose} disabled={creating}>
            {creating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creando...
              </>
            ) : (
              'Listo'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface FormProps {
  execution: Execution | null;
  datasets: Dataset[];
  versions: Version[];
  onFormRef: (ref: { getName: () => string; getRadicados: () => string[] } | null) => void;
}

function ExecutionEditorForm({ execution, datasets, versions, onFormRef }: FormProps) {
  const { user } = useKeycloak();
  const [executionId, setExecutionId] = useState(execution?.id);
  const [executionName, setExecutionName] = useState('');
  const [datasetId, setDatasetId] = useState(execution?.dataset_id);
  const [versionId, setVersionId] = useState(
    execution?.version_id ??
      versions.find((v) => v.status === 'open')?.id ??
      versions[0]?.id
  );
  const [selected, setSelected] = useState<RadicadoSelection[]>(
    execution?.criteria?.radicados || []
  );
  const [search, setSearch] = useState('');
  const [sampleDocTypes, setSampleDocTypes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragOverSide, setDragOverSide] = useState<'left' | 'right' | null>(null);

  // Expose getName/getRadicados to the parent so it can create the folder on disk
  useEffect(() => {
    onFormRef({
      getName: () => executionName.trim(),
      getRadicados: () => selected.map((r) => r.full_id),
    });
    return () => onFormRef(null);
  }, [executionName, selected, onFormRef]);

  const { radicados, loading: radicadosLoading } = useDatasetRadicados(datasetId);

  const dataset = datasets.find((d) => d.id === datasetId);
  const selectedIds = useMemo(
    () => new Set(selected.map((r) => r.full_id)),
    [selected]
  );
  const radicadoByFullId = useMemo(() => {
    const map = new Map<string, DatasetRadicado>();
    radicados.forEach((r) => map.set(r.full_id, r));
    return map;
  }, [radicados]);

  const available = useMemo(() => {
    const term = search.trim().toLowerCase();
    return radicados
      .filter((r) => !selectedIds.has(r.full_id))
      .filter(
        (r) =>
          !term ||
          r.full_id.toLowerCase().includes(term) ||
          r.numero.toLowerCase().includes(term) ||
          r.nit.toLowerCase().includes(term)
      );
  }, [radicados, selectedIds, search]);

  const distinctNits = useMemo(
    () => new Set(radicados.map((r) => r.nit)).size,
    [radicados]
  );
  const availableDocTypes = useMemo(() => {
    const types = new Set<string>();
    radicados.forEach((r) => r.documents.forEach((d) => types.add(d.type)));
    return Array.from(types).sort();
  }, [radicados]);
  const totalDocuments = selected.reduce((sum, r) => sum + r.documents.length, 0);

  // Creates the draft on first change, or patches it if it already exists.
  // Fire-and-forget from the caller's perspective: local state updates
  // immediately, persistence happens in the background.
  const persist = async (
    nextSelected: RadicadoSelection[],
    nextVersionId = versionId
  ) => {
    if (!datasetId || !nextVersionId) return;
    const totalDocs = nextSelected.reduce((sum, r) => sum + r.documents.length, 0);
    try {
      if (executionId) {
        await updateExecution(executionId, {
          dataset_id: datasetId,
          version_id: nextVersionId,
          criteria: { radicados: nextSelected },
          total_documents: totalDocs,
          pdf_count: totalDocs,
        });
      } else {
        const created = await createExecution({
          version_id: nextVersionId,
          dataset_id: datasetId,
          status: 'draft',
          criteria: { radicados: nextSelected },
          total_documents: totalDocs,
          pdf_count: totalDocs,
          created_by: user?.email || user?.name,
        });
        setExecutionId(created.id);
      }
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo guardar la ejecución'
      );
    }
  };

  const handleSelectDataset = (ds: Dataset) => {
    setDatasetId(ds.id);
    setSelected([]);
    persist([], versionId);
  };

  const handleVersionChange = (id: string) => {
    setVersionId(id);
    persist(selected, id);
  };

  const toSelection = (r: DatasetRadicado): RadicadoSelection => ({
    full_id: r.full_id,
    numero: r.numero,
    nit: r.nit,
    suffix: r.suffix,
    documents: [], // no documents active by default — must be toggled on explicitly
  });

  const addRadicado = (fullId: string) => {
    if (selectedIds.has(fullId)) return;
    const detail = radicadoByFullId.get(fullId);
    if (!detail) return;
    const next = [...selected, toSelection(detail)];
    setSelected(next);
    persist(next);
  };

  const removeRadicado = (fullId: string) => {
    const next = selected.filter((r) => r.full_id !== fullId);
    setSelected(next);
    persist(next);
  };

  const toggleDocument = (fullId: string, docType: string) => {
    const next = selected.map((r) => {
      if (r.full_id !== fullId) return r;
      const has = r.documents.includes(docType);
      return {
        ...r,
        documents: has
          ? r.documents.filter((d) => d !== docType)
          : [...r.documents, docType],
      };
    });
    setSelected(next);
    persist(next);
  };

  const toggleSampleDocType = (type: string) => {
    setSampleDocTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  // Fixed sampling behavior, not configurable: adds one random radicado for
  // every distinct NIT that doesn't already have a radicado selected. When
  // nothing is selected yet, this seeds the selection with one per NIT
  // across the whole dataset; run again later, it only fills in the gaps.
  // Whichever document types are toggled on above come pre-selected on each
  // sampled radicado (intersected with what that radicado actually has).
  const handleSample = () => {
    const representedNits = new Set(selected.map((r) => r.nit));
    const pool = radicados.filter(
      (r) => !selectedIds.has(r.full_id) && !representedNits.has(r.nit)
    );
    if (pool.length === 0) return;

    const byNit = new Map<string, DatasetRadicado[]>();
    for (const r of pool) {
      const group = byNit.get(r.nit) || [];
      group.push(r);
      byNit.set(r.nit, group);
    }

    const picked: DatasetRadicado[] = [];
    for (const group of byNit.values()) {
      picked.push(group[Math.floor(Math.random() * group.length)]);
    }

    const toSampledSelection = (r: DatasetRadicado): RadicadoSelection => ({
      full_id: r.full_id,
      numero: r.numero,
      nit: r.nit,
      suffix: r.suffix,
      documents: r.documents
        .map((d) => d.type)
        .filter((t) => sampleDocTypes.includes(t)),
    });

    const next = [...selected, ...picked.map(toSampledSelection)];
    setSelected(next);
    persist(next);
  };

  const allowDrop = (side: 'left' | 'right') => (e: DragEvent) => {
    e.preventDefault();
    setDragOverSide(side);
  };

  const handleDrop = (side: 'left' | 'right') => (e: DragEvent) => {
    e.preventDefault();
    setDragOverSide(null);
    const fullId = e.dataTransfer.getData('text/plain');
    if (!fullId) return;
    if (side === 'right') addRadicado(fullId);
    else removeRadicado(fullId);
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-100 p-3 text-sm text-red-800 dark:bg-red-900 dark:text-red-200">
          {error}
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium">Nombre de ejecución</label>
        <Input
          placeholder="ej: alpha0081-opus-236"
          value={executionName}
          onChange={(e) => setExecutionName(e.target.value)}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Versión</label>
        <Select value={versionId} onValueChange={handleVersionChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecciona una versión..." />
          </SelectTrigger>
          <SelectContent>
            {versions.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.version} {v.status === 'open' ? '· borrador' : '· cerrada'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!datasetId ? (
        <DatasetSelector onSelect={handleSelectDataset} selectedId={datasetId} />
      ) : (
        <>
          <div className="flex items-center justify-between rounded-lg bg-muted p-3">
            <span className="text-sm font-medium">
              Dataset: <span className="font-mono">{dataset?.name ?? datasetId}</span>
            </span>
            {selected.length === 0 && (
              <Button variant="ghost" size="sm" onClick={() => setDatasetId(undefined)}>
                Cambiar
              </Button>
            )}
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-40 flex-1">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Filtrar disponibles
                </label>
                <Input
                  placeholder="Número o NIT..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleSample}
                disabled={radicadosLoading}
              >
                <Shuffle className="mr-1.5 h-4 w-4" />
                Muestrear
              </Button>
            </div>

            {availableDocTypes.length > 0 && (
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Documentos a activar en la muestra
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {availableDocTypes.map((type) => (
                    <Badge
                      key={type}
                      variant={sampleDocTypes.includes(type) ? 'default' : 'outline'}
                      className="cursor-pointer select-none"
                      onClick={() => toggleSampleDocType(type)}
                    >
                      {type}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
          {distinctNits > 0 && (
            <p className="text-xs text-muted-foreground">
              Muestrear agrega 1 radicado al azar de cada uno de los {distinctNits}{' '}
              NITs del dataset que aún no tenga ninguno seleccionado, con los
              documentos elegidos arriba ya activados.
            </p>
          )}

          {radicadosLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando radicados del dataset...
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {/* Left: available radicados */}
              <div
                onDragOver={allowDrop('left')}
                onDragLeave={() => setDragOverSide(null)}
                onDrop={handleDrop('left')}
                className={`flex flex-col rounded-lg border ${
                  dragOverSide === 'left' ? 'border-primary bg-primary/5' : ''
                }`}
              >
                <div className="border-b bg-muted px-3 py-2 text-xs font-medium">
                  Disponibles ({available.length})
                </div>
                <div className="max-h-96 flex-1 space-y-1 overflow-auto p-2">
                  {available.length === 0 ? (
                    <div className="p-4 text-center text-xs text-muted-foreground">
                      Sin radicados disponibles
                    </div>
                  ) : (
                    available.map((r) => (
                      <div
                        key={r.full_id}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData('text/plain', r.full_id)}
                        onClick={() => addRadicado(r.full_id)}
                        className="flex cursor-grab items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-muted active:cursor-grabbing"
                      >
                        <span>
                          {r.numero} <span className="text-muted-foreground">({r.nit})</span>
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Right: radicados selected to process */}
              <div
                onDragOver={allowDrop('right')}
                onDragLeave={() => setDragOverSide(null)}
                onDrop={handleDrop('right')}
                className={`flex flex-col rounded-lg border ${
                  dragOverSide === 'right' ? 'border-primary bg-primary/5' : ''
                }`}
              >
                <div className="border-b bg-muted px-3 py-2 text-xs font-medium">
                  Para procesar ({selected.length} radicados · {totalDocuments} docs)
                </div>
                <div className="max-h-96 flex-1 space-y-2 overflow-auto p-2">
                  {selected.length === 0 ? (
                    <div className="p-4 text-center text-xs text-muted-foreground">
                      Arrastra radicados aquí, o haz clic en ellos a la izquierda
                    </div>
                  ) : (
                    selected.map((r) => {
                      const detail = radicadoByFullId.get(r.full_id);
                      return (
                        <div
                          key={r.full_id}
                          draggable
                          onDragStart={(e) => e.dataTransfer.setData('text/plain', r.full_id)}
                          className="cursor-grab rounded border p-2 active:cursor-grabbing"
                        >
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1 text-sm font-medium">
                              <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
                              {r.numero}{' '}
                              <span className="font-normal text-muted-foreground">
                                ({r.nit})
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() => removeRadicado(r.full_id)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {(detail?.documents ?? []).map((doc) => {
                              const checked = r.documents.includes(doc.type);
                              return (
                                <Badge
                                  key={doc.type}
                                  variant={checked ? 'default' : 'outline'}
                                  className="cursor-pointer select-none"
                                  onClick={() => toggleDocument(r.full_id, doc.type)}
                                >
                                  {doc.type}
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
