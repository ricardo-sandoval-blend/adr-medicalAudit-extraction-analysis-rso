'use client';

import { useState, useEffect } from 'react';
import { getVersions } from '@/lib/api-client';
import { Version } from '@/lib/types';

export function useVersions() {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVersions = async () => {
      try {
        setLoading(true);
        const data = await getVersions();
        setVersions(data.versions);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to fetch versions'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchVersions();
  }, []);

  return { versions, loading, error };
}
