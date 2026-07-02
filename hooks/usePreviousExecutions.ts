'use client';

import { useState, useEffect } from 'react';

interface ExecutionMetadata {
  date: string;
  radicado: string;
  nit: string;
  type: 'total' | 'sample';
}

interface UsePreviousExecutionsOptions {
  type?: 'total' | 'sample';
  limit?: number;
}

export function usePreviousExecutions(
  options?: UsePreviousExecutionsOptions
) {
  const [executions, setExecutions] = useState<ExecutionMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchExecutions = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (options?.type) params.append('type', options.type);
        if (options?.limit) params.append('limit', options.limit.toString());

        const response = await fetch(
          `/api/executions/history?${params}`
        );

        if (!response.ok) throw new Error('Failed to fetch');

        const data = await response.json();
        setExecutions(data.executions || []);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to fetch previous executions'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchExecutions();
  }, [options?.type, options?.limit]);

  return { executions, loading, error };
}
