'use client';

import { useEffect, useMemo, useState } from 'react';
import { useDatasets } from '@/hooks/useDatasets';
import { useDatasetRadicados } from '@/hooks/useDatasetRadicados';
import { getGroundTruthSets } from '@/lib/api-client';
import { GroundTruthSet } from '@/lib/types';
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
import { GroundTruthFieldsPanel } from './GroundTruthFieldsPanel';

// Top-level Ground Truth page: pick a dataset -> radicado, then define the
// correct value for each field directly (see GroundTruthFieldsPanel).
// Ground truth lives purely at the radicado/field level — executions are
// deliberately not part of this view. Fixing a field while comparing two
// executions happens instead under Executor -> Comparar ejecuciones, which
// writes to the same storage this page reads.
export function GroundTruthExplorer() {
  const { datasets, loading: datasetsLoading } = useDatasets();
  const [datasetId, setDatasetId] = useState<string | undefined>();
  const { radicados, loading: radicadosLoading } = useDatasetRadicados(datasetId);
  const [radicadoSearch, setRadicadoSearch] = useState('');
  const [radicadoFullId, setRadicadoFullId] = useState<string | undefined>();

  const [sets, setSets] = useState<GroundTruthSet[]>([]);
  const [setsLoading, setSetsLoading] = useState(true);
  const [setsRefreshKey, setSetsRefreshKey] = useState(0);
  // Set by jumpToSet() below; applied to radicadoFullId once the target
  // dataset's radicados finish loading (see the effect further down).
  const [pendingRadicadoId, setPendingRadicadoId] = useState<string | undefined>();

  useEffect(() => {
    const load = async () => {
      setSetsLoading(true);
      try {
        const data = await getGroundTruthSets();
        setSets(data);
      } catch {
        setSets([]);
      } finally {
        setSetsLoading(false);
      }
    };
    load();
  }, [setsRefreshKey]);

  // Reset the radicado selection whenever the dataset changes.
  useEffect(() => {
    const reset = () => {
      setRadicadoFullId(undefined);
      setRadicadoSearch('');
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

  const jumpToSet = (set: GroundTruthSet) => {
    setDatasetId(set.dataset_id);
    setPendingRadicadoId(set.radicado_full_id);
  };

  useEffect(() => {
    const apply = () => {
      if (!pendingRadicadoId || radicadosLoading) return;
      if (radicados.some((r) => r.full_id === pendingRadicadoId)) {
        setRadicadoFullId(pendingRadicadoId);
      }
      setPendingRadicadoId(undefined);
    };
    apply();
  }, [pendingRadicadoId, radicadosLoading, radicados]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Ground Truth</h1>
        <p className="text-muted-foreground">
          Define el valor correcto de cada campo por radicado, para poder medir futuras
          ejecuciones contra él.
        </p>
      </div>

      {!setsLoading && sets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Ground truth existente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {sets.map((set) => (
                <button
                  key={`${set.dataset_id}/${set.radicado_full_id}`}
                  type="button"
                  onClick={() => jumpToSet(set)}
                  className="rounded-lg border px-3 py-2 text-left text-xs hover:bg-muted"
                >
                  <div className="font-medium">{set.radicado_full_id}</div>
                  <div className="text-muted-foreground">
                    {set.dataset_id} · {set.field_count} campos · {set.document_types.join(', ')}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
                      onClick={() => setRadicadoFullId(r.full_id)}
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
        </CardContent>
      </Card>

      {datasetId && radicadoFullId && (
        <GroundTruthFieldsPanel
          datasetId={datasetId}
          radicado={radicadoFullId}
          onChanged={() => setSetsRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  );
}
