'use client';

import { useState, useEffect } from 'react';
import { getCurrentVersion } from '@/lib/api-client';
import { Version } from '@/lib/types';

// The single open version draft, shared by Executor and Changelog so both
// screens stay in sync on what's currently being worked.
export function useCurrentVersion() {
  const [version, setVersion] = useState<Version | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const fetchCurrentVersion = async () => {
      try {
        setLoading(true);
        const data = await getCurrentVersion();
        setVersion(data.version);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to fetch current version'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentVersion();
  }, [refreshKey]);

  const refresh = () => setRefreshKey((k) => k + 1);

  return { version, loading, error, refresh };
}
