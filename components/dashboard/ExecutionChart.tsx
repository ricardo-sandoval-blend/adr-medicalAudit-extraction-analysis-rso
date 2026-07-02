'use client';

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Execution } from '@/lib/types';
import { format } from 'date-fns';

interface ExecutionChartProps {
  executions: Execution[];
  type?: 'line' | 'bar';
  metric?: 'documents' | 'success_rate' | 'errors';
}

export function ExecutionChart({
  executions,
  type = 'line',
  metric = 'documents',
}: ExecutionChartProps) {
  if (executions.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground">
        No execution data available
      </div>
    );
  }

  // Prepare data
  const data = executions
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() -
        new Date(b.created_at).getTime()
    )
    .map((exec) => ({
      timestamp: format(new Date(exec.created_at), 'MMM dd'),
      documents: exec.total_documents,
      success_rate: exec.total_documents
        ? Math.round(
            (exec.successful_count / exec.total_documents) * 100
          )
        : 0,
      errors: exec.error_count,
      dataset: exec.dataset_id,
    }));

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <ResponsiveContainer width="100%" height={300}>
        {type === 'line' ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" />
            <YAxis />
            <Tooltip />
            <Legend />
            {metric === 'documents' && (
              <Line
                type="monotone"
                dataKey="documents"
                stroke="#3b82f6"
                name="Documents Processed"
              />
            )}
            {metric === 'success_rate' && (
              <Line
                type="monotone"
                dataKey="success_rate"
                stroke="#10b981"
                name="Success Rate %"
              />
            )}
            {metric === 'errors' && (
              <Line
                type="monotone"
                dataKey="errors"
                stroke="#ef4444"
                name="Errors"
              />
            )}
          </LineChart>
        ) : (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" />
            <YAxis />
            <Tooltip />
            <Legend />
            {metric === 'documents' && (
              <Bar dataKey="documents" fill="#3b82f6" />
            )}
            {metric === 'success_rate' && (
              <Bar dataKey="success_rate" fill="#10b981" />
            )}
            {metric === 'errors' && (
              <Bar dataKey="errors" fill="#ef4444" />
            )}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
