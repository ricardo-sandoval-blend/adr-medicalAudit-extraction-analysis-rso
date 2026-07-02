'use client';

import { useState, useEffect } from 'react';
import { getOperationalTimeseries } from '@/lib/api-client';
import { OperationalTimeseries } from '@/lib/types';

export function useOperationalTimeseries() {
  const [data, setData] = useState<OperationalTimeseries | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTimeseries = async () => {
      try {
        setLoading(true);
        const result = await getOperationalTimeseries();
        setData(result);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to fetch operational timeseries'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchTimeseries();
  }, []);

  return { data, loading, error };
}
