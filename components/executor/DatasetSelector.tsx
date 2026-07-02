'use client';

import { useDatasets } from '@/hooks/useDatasets';
import { Dataset } from '@/lib/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';

interface DatasetSelectorProps {
  onSelect: (dataset: Dataset) => void;
  selectedId?: string;
}

export function DatasetSelector({
  onSelect,
  selectedId,
}: DatasetSelectorProps) {
  const { datasets, loading, error } = useDatasets();

  const selected = datasets.find((d) => d.id === selectedId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 1: Select Dataset</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded bg-red-100 p-3 text-red-800">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-muted-foreground">Loading datasets...</div>
        ) : (
          <>
            <Select value={selectedId || ''} onValueChange={(id) => {
              const ds = datasets.find((d) => d.id === id);
              if (ds) onSelect(ds);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select a dataset..." />
              </SelectTrigger>
              <SelectContent>
                {datasets.map((ds) => (
                  <SelectItem key={ds.id} value={ds.id}>
                    {ds.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selected && (
              <div className="space-y-2 rounded-lg bg-muted p-4">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">PDFs:</span>
                  <span className="text-sm">{selected.pdf_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Size:</span>
                  <span className="text-sm">{selected.total_size_mb} MB</span>
                </div>
                {selected.last_execution && (
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Last Execution:</span>
                    <span className="text-sm">
                      {format(
                        new Date(selected.last_execution.created_at),
                        'MMM dd, HH:mm'
                      )}
                    </span>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
