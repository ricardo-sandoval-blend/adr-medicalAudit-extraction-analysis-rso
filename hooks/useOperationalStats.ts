'use client';

import { useState, useEffect } from 'react';
import { getOperationalStats } from '@/lib/api-client';
import { OperationalStats } from '@/lib/types';

export function useOperationalStats() {
  const [stats, setStats] = useState<OperationalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const data = await getOperationalStats();
        setStats(data);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to fetch operational stats'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return { stats, loading, error };
}
