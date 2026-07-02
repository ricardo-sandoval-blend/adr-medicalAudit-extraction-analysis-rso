'use client';

import { useState, useEffect } from 'react';
import { getDraftExecutions } from '@/lib/api-client';
import { Execution } from '@/lib/types';

// The executions currently in planning ('draft' status) — the rows shown in
// the Executor's planning table. Pass versionId to scope to a single
// version; omit it to list drafts across every version.
export function useDraftExecutions(versionId?: string) {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const fetchDrafts = async () => {
      try {
        setLoading(true);
        const data = await getDraftExecutions(versionId);
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

    fetchDrafts();
  }, [versionId, refreshKey]);

  const refetch = () => setRefreshKey((k) => k + 1);

  return { executions, loading, error, refetch };
}
