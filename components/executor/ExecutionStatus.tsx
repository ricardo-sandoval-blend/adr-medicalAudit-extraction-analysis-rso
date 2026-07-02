'use client';

import { useState, useEffect } from 'react';
import { getExecutionStatus } from '@/lib/api-client';
import { Execution } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

interface ExecutionStatusProps {
  executionId: string;
  onStatusChange?: (execution: Execution) => void;
}

export function ExecutionStatus({
  executionId,
  onStatusChange,
}: ExecutionStatusProps) {
  const [execution, setExecution] = useState<Execution | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const exec = await getExecutionStatus(executionId);
        setExecution(exec);
        onStatusChange?.(exec);

        // Continue polling if still running
        if (
          exec.status === 'pending' ||
          exec.status === 'running'
        ) {
          const timer = setTimeout(checkStatus, 2000);
          return () => clearTimeout(timer);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Error fetching status'
        );
      }
    };

    checkStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [executionId]);

  if (!execution) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading execution status...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Execution Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Status</span>
          <Badge
            variant={
              execution.status === 'success'
                ? 'default'
                : execution.status === 'failed'
                  ? 'destructive'
                  : 'secondary'
            }
          >
            {execution.status.toUpperCase()}
            {execution.status === 'running' && (
              <Loader2 className="ml-2 h-3 w-3 animate-spin" />
            )}
          </Badge>
        </div>

        <div className="space-y-2 rounded-lg bg-muted p-3">
          <div className="flex justify-between text-sm">
            <span>Documents</span>
            <span>{execution.total_documents}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Successful</span>
            <span className="text-green-600">{execution.successful_count}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Errors</span>
            <span className="text-red-600">{execution.error_count}</span>
          </div>
        </div>

        {execution.errors && execution.errors.length > 0 && (
          <div className="space-y-2">
            <span className="text-sm font-medium">Errors</span>
            <div className="max-h-40 space-y-1 overflow-auto rounded bg-red-50 p-2 dark:bg-red-950">
              {execution.errors.map((err, idx) => (
                <div key={idx} className="text-xs text-red-700 dark:text-red-200">
                  {err}
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-100 p-3 text-red-800 dark:bg-red-900 dark:text-red-200">
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
