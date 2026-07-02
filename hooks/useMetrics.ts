'use client';

import { useState, useEffect } from 'react';
import { getMetrics, getDatasetMetrics } from '@/lib/api-client';
import { MetricsResponse } from '@/lib/types';

interface UseMetricsOptions {
  executionId?: string;
  datasetId?: string;
}

export function useMetrics(options?: UseMetricsOptions) {
  const [data, setData] = useState<MetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        let metrics: MetricsResponse;

        if (options?.executionId) {
          metrics = await getMetrics(options.executionId);
        } else if (options?.datasetId) {
          metrics = await getDatasetMetrics(options.datasetId);
        } else {
          throw new Error('Must provide executionId or datasetId');
        }

        setData(metrics);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to fetch metrics'
        );
      } finally {
        setLoading(false);
      }
    };

    if (options?.executionId || options?.datasetId) {
      fetchMetrics();
    }
  }, [options?.executionId, options?.datasetId]);

  return { data, loading, error };
}
