'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Execution } from '@/lib/types';
import { format, differenceInSeconds } from 'date-fns';
import { cn } from '@/lib/utils';

interface RecentExecutionsProps {
  executions: Execution[];
  limit?: number;
}

export function RecentExecutions({
  executions,
  limit = 10,
}: RecentExecutionsProps) {
  const recent = executions.slice(0, limit);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'running':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDuration = (start: string, end?: string) => {
    if (!end) return 'En curso...';
    const seconds = differenceInSeconds(
      new Date(end),
      new Date(start)
    );
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m`;
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Dataset</TableHead>
            <TableHead>Documentos</TableHead>
            <TableHead>Tasa de Éxito</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Duración</TableHead>
            <TableHead>Fecha</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {recent.map((exec) => (
            <TableRow key={exec.id} className="hover:bg-muted/50">
              <TableCell className="font-medium">
                {exec.dataset_id}
              </TableCell>
              <TableCell>
                {exec.total_documents} (✓{exec.successful_count} ✗
                {exec.error_count})
              </TableCell>
              <TableCell>
                {exec.total_documents > 0
                  ? `${Math.round(
                      (exec.successful_count /
                        exec.total_documents) *
                        100
                    )}%`
                  : '—'}
              </TableCell>
              <TableCell>
                <Badge
                  className={cn(
                    'capitalize',
                    getStatusColor(exec.status)
                  )}
                >
                  {exec.status}
                </Badge>
              </TableCell>
              <TableCell>
                {formatDuration(
                  exec.created_at,
                  exec.completed_at
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {format(
                  new Date(exec.created_at),
                  'MMM dd, HH:mm'
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
