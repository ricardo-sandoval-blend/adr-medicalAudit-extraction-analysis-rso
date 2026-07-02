'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { CreateVersionModal } from './CreateVersionModal';
import { ChangelogTimeline, VersionEntry } from './ChangelogTimeline';
import { getVersions, getVersionDetails } from '@/lib/api-client';

export function Changelog() {
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const loadVersions = async () => {
      try {
        setLoading(true);
        const { versions: list } = await getVersions();

        const withDetails = await Promise.all(
          list.map(async (v) => {
            try {
              const detail = await getVersionDetails(v.id);
              return {
                ...v,
                incidents: detail.incidents,
                executions: detail.executions,
              };
            } catch {
              return { ...v, incidents: [], executions: [] };
            }
          })
        );

        setVersions(withDetails);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load changelog'
        );
      } finally {
        setLoading(false);
      }
    };

    loadVersions();
  }, [refreshKey]);

  const refresh = () => setRefreshKey((k) => k + 1);
  const hasOpenVersion = versions.some((v) => v.status === 'open');

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Changelog</h1>
          <p className="text-muted-foreground">
            Extractor version history and incidents
          </p>
        </div>
        <CreateVersionModal
          hasOpenVersion={hasOpenVersion}
          onVersionCreated={refresh}
        />
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading changelog...
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-lg bg-red-100 p-4 text-red-800 dark:bg-red-900 dark:text-red-200">
          {error}
        </div>
      )}

      {/* Timeline */}
      {!loading && versions.length === 0 && (
        <div className="text-center text-muted-foreground py-12">
          No versions yet. Create the first version.
        </div>
      )}

      {!loading && versions.length > 0 && (
        <div className="max-w-4xl">
          <ChangelogTimeline versions={versions} onChanged={refresh} />
        </div>
      )}
    </div>
  );
}
