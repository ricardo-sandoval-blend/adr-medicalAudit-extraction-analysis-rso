'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Radicado } from '@/lib/types';

interface SampleCalculatorProps {
  totalAvailable: number;
  onSampleChange: (size: number) => void;
  availableIPs?: string[];
  selectedIPs?: string[];
  onIPsChange?: (ips: string[]) => void;
  mandatoryRadicados?: Radicado[];
}

export function SampleCalculator({
  totalAvailable,
  onSampleChange,
  availableIPs = [],
  selectedIPs = [],
  onIPsChange,
  mandatoryRadicados = [],
}: SampleCalculatorProps) {
  const [sampleInput, setSampleInput] = useState<string>(
    totalAvailable.toString()
  );
  const [localSelectedIPs, setLocalSelectedIPs] = useState<string[]>(
    selectedIPs
  );

  const sampleSize = parseInt(sampleInput) || 0;

  useEffect(() => {
    onSampleChange(sampleSize);
  }, [sampleSize, onSampleChange]);

  useEffect(() => {
    if (onIPsChange) {
      onIPsChange(localSelectedIPs);
    }
  }, [localSelectedIPs, onIPsChange]);

  const handleIPToggle = (ip: string) => {
    setLocalSelectedIPs((prev) =>
      prev.includes(ip)
        ? prev.filter((i) => i !== ip)
        : [...prev, ip]
    );
  };

  // Estimate filtered count
  const ipFilteredCount = Math.round(
    (sampleSize * localSelectedIPs.length) / Math.max(availableIPs.length, 1)
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 2: Define Sample</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Sample size input */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Sample Size (out of {totalAvailable})
          </label>
          <Input
            type="number"
            min="1"
            max={totalAvailable}
            value={sampleInput}
            onChange={(e) => setSampleInput(e.target.value)}
          />
          <div className="text-xs text-muted-foreground">
            {sampleSize} / {totalAvailable} documents
          </div>
        </div>

        {/* IP Filter */}
        {availableIPs.length > 0 && (
          <div className="space-y-3">
            <label className="text-sm font-medium">
              Filter by IPs (must have records in ALL selected IPs)
            </label>
            <div className="flex flex-wrap gap-2">
              {availableIPs.map((ip) => (
                <Badge
                  key={ip}
                  variant={
                    localSelectedIPs.includes(ip)
                      ? 'default'
                      : 'outline'
                  }
                  className="cursor-pointer"
                  onClick={() => handleIPToggle(ip)}
                >
                  {ip}
                </Badge>
              ))}
            </div>
            {localSelectedIPs.length > 0 && (
              <div className="text-xs text-muted-foreground">
                Estimated after IP filter: ~{ipFilteredCount} documents
              </div>
            )}
          </div>
        )}

        {/* Mandatory Radicados Summary */}
        {mandatoryRadicados.length > 0 && (
          <div className="space-y-2 rounded-lg bg-blue-50 p-3 dark:bg-blue-950">
            <label className="text-sm font-medium">
              Mandatory Radicados
            </label>
            <div className="space-y-1">
              {mandatoryRadicados.map((rad, idx) => (
                <div key={idx} className="text-sm">
                  • {rad.numero} ({rad.prestadora})
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="rounded-lg bg-green-50 p-3 dark:bg-green-950">
          <p className="text-sm font-medium">
            Will process approximately <strong>{Math.min(sampleSize, ipFilteredCount || sampleSize)}</strong> documents
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
