'use client';

import { useState, useEffect } from 'react';
import { getDatasets } from '@/lib/api-client';
import { Dataset } from '@/lib/types';

export function useDatasets() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDatasets = async () => {
      try {
        setLoading(true);
        const data = await getDatasets();
        setDatasets(data);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to fetch datasets'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchDatasets();
  }, []);

  return { datasets, loading, error };
}
