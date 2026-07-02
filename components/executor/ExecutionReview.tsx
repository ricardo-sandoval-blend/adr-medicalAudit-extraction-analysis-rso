'use client';

import { Dataset, Radicado } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ExecutionReviewProps {
  dataset: Dataset;
  sampleSize: number;
  selectedPDFCount: number;
  selectedIPs: string[];
  mandatoryRadicados: Radicado[];
  changelogVersion: string;
}

export function ExecutionReview({
  dataset,
  sampleSize,
  selectedPDFCount,
  selectedIPs,
  mandatoryRadicados,
  changelogVersion,
}: ExecutionReviewProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Review & Launch</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex justify-between border-b pb-3">
            <span className="text-sm font-medium">Dataset</span>
            <span className="text-sm">{dataset.name}</span>
          </div>

          <div className="flex justify-between border-b pb-3">
            <span className="text-sm font-medium">Sample Size</span>
            <span className="text-sm">{sampleSize} documents</span>
          </div>

          <div className="flex justify-between border-b pb-3">
            <span className="text-sm font-medium">PDFs Selected</span>
            <span className="text-sm">{selectedPDFCount} files</span>
          </div>

          <div className="flex justify-between border-b pb-3">
            <span className="text-sm font-medium">Changelog Version</span>
            <span className="text-sm">{changelogVersion}</span>
          </div>

          {selectedIPs.length > 0 && (
            <div className="flex justify-between border-b pb-3">
              <span className="text-sm font-medium">IP Filter</span>
              <div className="flex gap-1">
                {selectedIPs.map((ip) => (
                  <Badge key={ip} variant="outline" className="text-xs">
                    {ip}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {mandatoryRadicados.length > 0 && (
            <div className="space-y-2 border-b pb-3">
              <span className="text-sm font-medium">
                Mandatory Radicados ({mandatoryRadicados.length})
              </span>
              <div className="space-y-1">
                {mandatoryRadicados.map((rad, idx) => (
                  <div key={idx} className="text-xs text-muted-foreground">
                    • {rad.numero} - {rad.prestadora}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-950">
          <p className="text-sm font-medium">
            Ready to process <strong>{sampleSize}</strong> documents from{' '}
            <strong>{dataset.name}</strong>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
