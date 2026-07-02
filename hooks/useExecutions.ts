'use client';

import { useState, useEffect } from 'react';
import { getExecutions } from '@/lib/api-client';
import { Execution } from '@/lib/types';

interface UseExecutionsOptions {
  datasetId?: string;
  limit?: number;
  refetchInterval?: number;
}

export function useExecutions(options?: UseExecutionsOptions) {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchExecutions = async () => {
      try {
        setLoading(true);
        const data = await getExecutions(
          options?.datasetId,
          options?.limit || 50
        );
        setExecutions(data);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to fetch executions'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchExecutions();

    // Optional auto-refetch
    if (options?.refetchInterval) {
      const interval = setInterval(
        fetchExecutions,
        options.refetchInterval
      );
      return () => clearInterval(interval);
    }
  }, [options?.datasetId, options?.limit, options?.refetchInterval]);

  return { executions, loading, error };
}
