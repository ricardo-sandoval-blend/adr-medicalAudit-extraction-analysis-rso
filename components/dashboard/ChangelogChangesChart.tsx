'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';

interface ChangelogChangesChartProps {
  data: Array<{ date: string; count: number }>;
}

// `date` arrives as a plain 'YYYY-MM-DD' string; parse it as local calendar
// components instead of `new Date(string)` to avoid a UTC-vs-local day shift.
function formatDay(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return format(new Date(year, month - 1, day), 'MMM dd');
}

export function ChangelogChangesChart({ data }: ChangelogChangesChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground">
        No hay changelogs cerrados todavía
      </div>
    );
  }

  const chartData = data.map((d) => ({
    date: formatDay(d.date),
    count: d.count,
  }));

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Line
            type="monotone"
            dataKey="count"
            stroke="#3b82f6"
            name="Cambios por changelog"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
