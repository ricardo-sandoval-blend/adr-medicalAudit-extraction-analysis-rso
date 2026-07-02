'use client';

import { useExecutions } from '@/hooks/useExecutions';
import { useOperationalStats } from '@/hooks/useOperationalStats';
import { useOperationalTimeseries } from '@/hooks/useOperationalTimeseries';
import { StatsCard } from './StatsCard';
import { ChangelogChangesChart } from './ChangelogChangesChart';
import { IssuesChart } from './IssuesChart';
import { RecentExecutions } from './RecentExecutions';
import { ClipboardList, CheckCircle2, PlayCircle } from 'lucide-react';

export function Dashboard() {
  const { executions, loading, error } = useExecutions({
    limit: 100,
  });
  const { stats, error: statsError } = useOperationalStats();
  const { data: timeseries, error: timeseriesError } =
    useOperationalTimeseries();

  if (error || statsError || timeseriesError) {
    return (
      <div className="flex h-screen items-center justify-center text-red-600">
        Error: {error || statsError || timeseriesError}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Rendimiento operativo: issues abiertos y cerrados, ejecuciones realizadas
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatsCard
          title="Issues Abiertos"
          value={stats?.issues.total ?? 0}
          icon={<ClipboardList className="h-5 w-5" />}
        />
        <StatsCard
          title="Issues Cerrados"
          value={stats?.issues.resolved ?? 0}
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <StatsCard
          title="Ejecuciones Realizadas"
          value={stats?.executions.total ?? 0}
          icon={<PlayCircle className="h-5 w-5" />}
        />
      </div>

      {/* Changelog changes per day */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">
          Cambios por Changelog
        </h2>
        <ChangelogChangesChart
          data={timeseries?.changelogChanges || []}
        />
      </div>

      {/* ClickUp issues per day */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">
          Issues Abiertos vs. Issues Cerrados
        </h2>
        <IssuesChart data={timeseries?.issues || []} />
      </div>

      {/* Recent Executions Table */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">
          Ejecuciones Recientes
        </h2>
        {loading ? (
          <div className="flex h-40 items-center justify-center text-muted-foreground">
            Loading...
          </div>
        ) : (
          <RecentExecutions executions={executions} limit={10} />
        )}
      </div>
    </div>
  );
}
