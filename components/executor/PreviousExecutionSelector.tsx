'use client';

import { useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ExecutionMetadata {
  date: string;
  radicado: string;
  nit: string;
  type: 'total' | 'sample';
}

interface PreviousExecutionSelectorProps {
  executionType: 'total' | 'sample';
  onSelect: (execution: ExecutionMetadata | null) => void;
  selectedExecution?: ExecutionMetadata | null;
}

export function PreviousExecutionSelector({
  executionType,
  onSelect,
  selectedExecution,
}: PreviousExecutionSelectorProps) {
  const [executions, setExecutions] = useState<ExecutionMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchExecutions = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/executions/history?type=${executionType}&limit=20`
        );
        if (!response.ok) throw new Error('Failed to fetch');

        const data = await response.json();
        setExecutions(data.executions || []);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to fetch executions'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchExecutions();
  }, [executionType]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Compare Against Previous Execution (Optional)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          Select a previous <Badge>{executionType}</Badge> execution to compare metrics
        </div>

        {error && (
          <div className="rounded bg-red-100 p-2 text-xs text-red-800">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-muted-foreground text-sm">
            Loading executions...
          </div>
        ) : executions.length === 0 ? (
          <div className="text-muted-foreground text-sm">
            No previous {executionType} executions found
          </div>
        ) : (
          <Select
            value={
              selectedExecution
                ? `${selectedExecution.date}_${selectedExecution.radicado}`
                : ''
            }
            onValueChange={(value) => {
              if (!value) {
                onSelect(null);
              } else {
                const exec = executions.find(
                  (e) => `${e.date}_${e.radicado}` === value
                );
                if (exec) onSelect(exec);
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select execution to compare..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">None (first execution)</SelectItem>
              {executions.map((exec) => (
                <SelectItem
                  key={`${exec.date}_${exec.radicado}`}
                  value={`${exec.date}_${exec.radicado}`}
                >
                  {exec.date} - Radicado {exec.radicado} ({exec.nit})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {selectedExecution && (
          <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-950">
            <p className="text-xs font-medium">
              Comparing against:
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {selectedExecution.date} - Radicado {selectedExecution.radicado}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
