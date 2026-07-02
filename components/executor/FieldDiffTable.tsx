'use client';

import { useEffect, useState } from 'react';
import {
  deleteGroundTruthField,
  getExecutionFields,
  getGroundTruth,
  upsertGroundTruthField,
} from '@/lib/api-client';
import { useKeycloak } from '@/lib/keycloak';
import { ExtractionFieldMap, GroundTruthDocument } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Target, Trash2 } from 'lucide-react';

interface FieldDiffTableProps {
  datasetId: string;
  radicado: string;
  documentType: string;
  executionAId: string;
  executionBId?: string;
  onChanged?: () => void;
}

// Renders '—' for empty values, distinct from `rawValue` (used to seed the
// fix-GT form, where an empty input should stay empty).
function displayValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
}

function rawValue(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

// Compares two executions' extracted fields for one document, field by
// field, and lets a reviewer fix the correct value ("ground truth") for any
// field right from the diff — the "desempate" that future executions get
// measured against (see GroundTruthScorePanel). The ground truth this writes
// to is the same radicado/field-level storage managed directly from the
// Ground Truth section (components/ground-truth/GroundTruthFieldsPanel).
export function FieldDiffTable({
  datasetId,
  radicado,
  documentType,
  executionAId,
  executionBId,
  onChanged,
}: FieldDiffTableProps) {
  const { user } = useKeycloak();
  const [fieldsA, setFieldsA] = useState<ExtractionFieldMap>({});
  const [fieldsB, setFieldsB] = useState<ExtractionFieldMap>({});
  const [foundA, setFoundA] = useState(true);
  const [foundB, setFoundB] = useState(true);
  const [gtDoc, setGtDoc] = useState<GroundTruthDocument>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [savingField, setSavingField] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [a, b, gt] = await Promise.all([
          getExecutionFields(executionAId, radicado, documentType),
          executionBId
            ? getExecutionFields(executionBId, radicado, documentType)
            : Promise.resolve(null),
          getGroundTruth(datasetId, radicado),
        ]);
        if (cancelled) return;
        setFieldsA(a.fields);
        setFoundA(a.found);
        setFieldsB(b?.fields ?? {});
        setFoundB(b?.found ?? true);
        setGtDoc(gt.documents[documentType] ?? {});
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'No se pudieron cargar los campos'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [datasetId, radicado, documentType, executionAId, executionBId]);

  const fieldPaths = Array.from(
    new Set([...Object.keys(fieldsA), ...Object.keys(fieldsB), ...Object.keys(gtDoc)])
  ).sort();

  const handleSave = async (
    fieldPath: string,
    valor: string,
    estado: string,
    observacion: string
  ) => {
    setSavingField(fieldPath);
    setError(null);
    try {
      const entry = await upsertGroundTruthField({
        datasetId,
        radicado,
        documentType,
        fieldPath,
        valor: valor === '' ? null : valor,
        estado: estado === '' ? null : estado,
        observacion: observacion === '' ? null : observacion,
        updatedBy: user?.email,
      });
      setGtDoc((prev) => ({ ...prev, [fieldPath]: entry }));
      setEditingField(null);
      onChanged?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo guardar el ground truth'
      );
    } finally {
      setSavingField(null);
    }
  };

  const handleDelete = async (fieldPath: string) => {
    setSavingField(fieldPath);
    setError(null);
    try {
      await deleteGroundTruthField({ datasetId, radicado, documentType, fieldPath });
      setGtDoc((prev) => {
        const next = { ...prev };
        delete next[fieldPath];
        return next;
      });
      onChanged?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo eliminar el ground truth'
      );
    } finally {
      setSavingField(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Diff de campos — {documentType}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-100 p-3 text-sm text-red-800 dark:bg-red-900 dark:text-red-200">
            {error}
          </div>
        )}
        {!loading && !foundA && (
          <div className="rounded-lg bg-amber-100 p-3 text-sm text-amber-800 dark:bg-amber-900 dark:text-amber-200">
            No se encontró salida de extracción en disco para la ejecución A en este radicado/documento.
          </div>
        )}
        {!loading && executionBId && !foundB && (
          <div className="rounded-lg bg-amber-100 p-3 text-sm text-amber-800 dark:bg-amber-900 dark:text-amber-200">
            No se encontró salida de extracción en disco para la ejecución B en este radicado/documento.
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando campos...
          </div>
        ) : fieldPaths.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No hay campos para comparar.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campo</TableHead>
                <TableHead>Ejecución A</TableHead>
                {executionBId && <TableHead>Ejecución B</TableHead>}
                <TableHead>Ground truth</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fieldPaths.map((fieldPath) => {
                const a = fieldsA[fieldPath];
                const b = fieldsB[fieldPath];
                const gt = gtDoc[fieldPath];
                const differs = Boolean(
                  executionBId && displayValue(a?.valor) !== displayValue(b?.valor)
                );
                return (
                  <TableRow
                    key={fieldPath}
                    className={differs ? 'bg-amber-50 dark:bg-amber-950/40' : ''}
                  >
                    <TableCell className="max-w-64 whitespace-normal font-mono text-xs">
                      {fieldPath}
                    </TableCell>
                    <TableCell className="whitespace-normal text-sm">
                      {displayValue(a?.valor)}
                      {a?.estado && (
                        <div className="text-xs text-muted-foreground">{a.estado}</div>
                      )}
                    </TableCell>
                    {executionBId && (
                      <TableCell className="whitespace-normal text-sm">
                        {displayValue(b?.valor)}
                        {b?.estado && (
                          <div className="text-xs text-muted-foreground">{b.estado}</div>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="whitespace-normal text-sm">
                      {gt ? (
                        <div>
                          <Badge variant="secondary">{displayValue(gt.valor)}</Badge>
                          {gt.estado && (
                            <div className="mt-1 text-xs text-muted-foreground">{gt.estado}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin definir</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingField(fieldPath)}
                          disabled={savingField === fieldPath}
                        >
                          {savingField === fieldPath ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Target className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        {gt && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(fieldPath)}
                            disabled={savingField === fieldPath}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <GroundTruthFieldDialog
        open={editingField !== null}
        fieldPath={editingField}
        initialValor={
          editingField
            ? rawValue(
                gtDoc[editingField]?.valor ??
                  fieldsA[editingField]?.valor ??
                  fieldsB[editingField]?.valor
              )
            : ''
        }
        initialEstado={
          editingField
            ? rawValue(
                gtDoc[editingField]?.estado ??
                  fieldsA[editingField]?.estado ??
                  fieldsB[editingField]?.estado
              )
            : ''
        }
        initialObservacion={editingField ? rawValue(gtDoc[editingField]?.observacion) : ''}
        saving={editingField !== null && savingField === editingField}
        onCancel={() => setEditingField(null)}
        onSave={handleSave}
      />
    </Card>
  );
}

interface GroundTruthFieldDialogProps {
  open: boolean;
  fieldPath: string | null;
  initialValor: string;
  initialEstado: string;
  initialObservacion: string;
  saving: boolean;
  onCancel: () => void;
  onSave: (fieldPath: string, valor: string, estado: string, observacion: string) => void;
}

// Dialog used to fix the correct value ("desempate") for a single field
// while reviewing a diff — pre-filled from whichever value is already
// available (existing GT, else execution A, else execution B), editable
// before saving.
function GroundTruthFieldDialog({
  open,
  fieldPath,
  initialValor,
  initialEstado,
  initialObservacion,
  saving,
  onCancel,
  onSave,
}: GroundTruthFieldDialogProps) {
  const [valor, setValor] = useState(initialValor);
  const [estado, setEstado] = useState(initialEstado);
  const [observacion, setObservacion] = useState(initialObservacion);

  useEffect(() => {
    const seed = () => {
      if (!open) return;
      setValor(initialValor);
      setEstado(initialEstado);
      setObservacion(initialObservacion);
    };
    seed();
    // Only re-seed when a new field is opened for editing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fieldPath]);

  if (!fieldPath) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onCancel();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fijar ground truth</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Campo
            </label>
            <div className="font-mono text-xs">{fieldPath}</div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Valor correcto</label>
            <Input value={valor} onChange={(e) => setValor(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Estado</label>
            <Input
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              placeholder="ENCONTRADO / NO_ENCONTRADO"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Observación</label>
            <Input
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              placeholder="Por qué es el valor correcto..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={() => onSave(fieldPath, valor, estado, observacion)}
            disabled={saving}
          >
            {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
