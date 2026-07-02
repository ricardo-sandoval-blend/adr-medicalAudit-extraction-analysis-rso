'use client';

import { useState, useEffect } from 'react';
import { getDatasetRadicados } from '@/lib/api-client';
import { DatasetRadicado } from '@/lib/types';

// Loads every radicado (and its PDF documents) found inside a dataset
// folder. Used by the execution editor so users can search/pick radicados
// and choose which of their documents to run — filtering happens client
// side since a dataset typically has at most a few hundred radicados.
export function useDatasetRadicados(datasetId: string | undefined) {
  const [radicados, setRadicados] = useState<DatasetRadicado[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!datasetId) {
        setRadicados([]);
        return;
      }
      try {
        setLoading(true);
        const data = await getDatasetRadicados(datasetId, undefined, 500);
        if (!cancelled) {
          setRadicados(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to fetch radicados'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [datasetId]);

  return { radicados, loading, error };
}
