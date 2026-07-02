'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { scoreExecutionAgainstGroundTruth } from '@/lib/api-client';
import { Execution, GroundTruthScoreResponse } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';

interface GroundTruthScorePanelProps {
  datasetId: string;
  radicado: string;
  executions: Execution[];
  defaultExecutionId?: string;
}

function displayValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
}

// Measures one execution's extracted values against the ground truth fixed
// for a radicado (defined directly in the Ground Truth section, or fixed
// inline from a diff via FieldDiffTable) — the "desempate" applied to score
// a (possibly later) execution field by field.
export function GroundTruthScorePanel({
  datasetId,
  radicado,
  executions,
  defaultExecutionId,
}: GroundTruthScorePanelProps) {
  const [executionId, setExecutionId] = useState(defaultExecutionId || '');
  const [score, setScore] = useState<GroundTruthScoreResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setExecutionId(defaultExecutionId || '');
    sync();
  }, [defaultExecutionId]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!executionId) {
        setScore(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const result = await scoreExecutionAgainstGroundTruth(datasetId, radicado, executionId);
        if (!cancelled) setScore(result);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudo calcular el score');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [datasetId, radicado, executionId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Medición contra ground truth</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-w-xs">
          <label className="mb-1 block text-sm font-medium">Ejecución a medir</label>
          <Select value={executionId} onValueChange={setExecutionId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecciona una ejecución..." />
            </SelectTrigger>
            <SelectContent>
              {executions.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {format(new Date(e.created_at), 'MMM dd, HH:mm')} · {e.status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {error && (
          <div className="rounded-lg bg-red-100 p-3 text-sm text-red-800 dark:bg-red-900 dark:text-red-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Calculando...
          </div>
        ) : !score ? (
          <div className="py-4 text-center text-sm text-muted-foreground">
            Selecciona una ejecución para medirla contra el ground truth.
          </div>
        ) : score.summary.total === 0 ? (
          <div className="py-4 text-center text-sm text-muted-foreground">
            Este radicado todavía no tiene ningún campo de ground truth definido.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-6 rounded-lg bg-muted p-4">
              <div>
                <div className="text-2xl font-bold">{score.summary.accuracy}%</div>
                <div className="text-xs text-muted-foreground">Precisión</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{score.summary.matched}</div>
                <div className="text-xs text-muted-foreground">Coinciden</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">
                  {score.summary.total - score.summary.matched}
                </div>
                <div className="text-xs text-muted-foreground">Difieren</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{score.summary.total}</div>
                <div className="text-xs text-muted-foreground">Total campos GT</div>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Documento</TableHead>
                  <TableHead>Campo</TableHead>
                  <TableHead>Esperado</TableHead>
                  <TableHead>Obtenido</TableHead>
                  <TableHead>Resultado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {score.fields.map((f) => (
                  <TableRow key={`${f.document_type}.${f.field_path}`}>
                    <TableCell>
                      <Badge variant="outline">{f.document_type}</Badge>
                    </TableCell>
                    <TableCell className="max-w-64 whitespace-normal font-mono text-xs">
                      {f.field_path}
                    </TableCell>
                    <TableCell className="whitespace-normal text-sm">
                      {displayValue(f.expected.valor)}
                    </TableCell>
                    <TableCell className="whitespace-normal text-sm">
                      {f.actual === null ? 'Sin datos' : displayValue(f.actual.valor)}
                    </TableCell>
                    <TableCell>
                      {f.match ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}
