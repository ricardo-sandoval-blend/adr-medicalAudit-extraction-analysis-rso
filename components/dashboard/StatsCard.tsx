import { ArrowDown, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: number | string;
  unit?: string;
  delta?: number;
  deltaLabel?: string;
  icon?: React.ReactNode;
  className?: string;
  valueFormat?: (v: number | string) => string;
}

export function StatsCard({
  title,
  value,
  unit,
  delta,
  deltaLabel,
  icon,
  className,
  valueFormat,
}: StatsCardProps) {
  const isPositive = delta !== undefined && delta >= 0;
  const displayValue =
    valueFormat && typeof value === 'number'
      ? valueFormat(value)
      : value;

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card p-6 shadow-sm hover:bg-muted/50 transition-colors',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {title}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-3xl font-bold">{displayValue}</p>
            {unit && (
              <span className="text-sm text-muted-foreground">
                {unit}
              </span>
            )}
          </div>
          {delta !== undefined && (
            <div className="mt-2 flex items-center gap-1">
              {isPositive ? (
                <ArrowUp className="h-4 w-4 text-green-600" />
              ) : (
                <ArrowDown className="h-4 w-4 text-red-600" />
              )}
              <span
                className={cn(
                  'text-sm font-medium',
                  isPositive
                    ? 'text-green-600'
                    : 'text-red-600'
                )}
              >
                {isPositive ? '+' : ''}
                {delta}
              </span>
              {deltaLabel && (
                <span className="text-xs text-muted-foreground">
                  {deltaLabel}
                </span>
              )}
            </div>
          )}
        </div>
        {icon && (
          <div className="text-muted-foreground">{icon}</div>
        )}
      </div>
    </div>
  );
}
