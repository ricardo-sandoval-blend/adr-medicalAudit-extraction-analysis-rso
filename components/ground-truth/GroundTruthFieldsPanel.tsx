'use client';

import { useEffect, useState } from 'react';
import { deleteGroundTruthField, getGroundTruth, upsertGroundTruthField } from '@/lib/api-client';
import { useKeycloak } from '@/lib/keycloak';
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS, DocumentType } from '@/lib/config';
import { GroundTruthDocument, GroundTruthEntry } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';

interface GroundTruthFieldsPanelProps {
  datasetId: string;
  radicado: string;
  onChanged?: () => void;
}

interface EditingField {
  documentType: string;
  fieldPath: string;
  isNew: boolean;
}

function displayValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
}

function rawValue(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

// Direct editor for the ground truth of a radicado: for each document type,
// the fields fixed so far (field_path -> correct value/estado/observación).
// Ground truth lives purely at the radicado/field level here — no
// executions involved. A field can also be fixed while comparing two
// executions (Executor -> Comparar ejecuciones), which writes to this same
// storage; this panel is just the direct editor over it.
export function GroundTruthFieldsPanel({
  datasetId,
  radicado,
  onChanged,
}: GroundTruthFieldsPanelProps) {
  const { user } = useKeycloak();
  const [documents, setDocuments] = useState<Record<string, GroundTruthDocument>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingField | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getGroundTruth(datasetId, radicado);
        setDocuments(result.documents);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo cargar el ground truth');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [datasetId, radicado, refreshKey]);

  const documentTypes = Object.keys(documents).sort();

  const handleSave = async (
    documentType: string,
    fieldPath: string,
    valor: string,
    estado: string,
    observacion: string
  ) => {
    const key = `${documentType}.${fieldPath}`;
    setBusyKey(key);
    setError(null);
    try {
      await upsertGroundTruthField({
        datasetId,
        radicado,
        documentType,
        fieldPath,
        valor: valor === '' ? null : valor,
        estado: estado === '' ? null : estado,
        observacion: observacion === '' ? null : observacion,
        updatedBy: user?.email,
      });
      setEditing(null);
      setRefreshKey((k) => k + 1);
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el campo');
    } finally {
      setBusyKey(null);
    }
  };

  const handleDelete = async (documentType: string, fieldPath: string) => {
    const key = `${documentType}.${fieldPath}`;
    setBusyKey(key);
    setError(null);
    try {
      await deleteGroundTruthField({ datasetId, radicado, documentType, fieldPath });
      setRefreshKey((k) => k + 1);
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el campo');
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Campos de ground truth — {radicado}</CardTitle>
        <Button
          size="sm"
          onClick={() => setEditing({ documentType: DOCUMENT_TYPES[0], fieldPath: '', isNew: true })}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Agregar campo
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="rounded-lg bg-red-100 p-3 text-sm text-red-800 dark:bg-red-900 dark:text-red-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando...
          </div>
        ) : documentTypes.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Este radicado todavía no tiene campos de ground truth. Agrega el primero.
          </div>
        ) : (
          documentTypes.map((documentType) => {
            const doc = documents[documentType];
            const fieldPaths = Object.keys(doc).sort();
            return (
              <div key={documentType} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{documentType}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {DOCUMENT_TYPE_LABELS[documentType as DocumentType] ?? documentType}
                  </span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campo</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Observación</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fieldPaths.map((fieldPath) => {
                      const entry = doc[fieldPath];
                      const key = `${documentType}.${fieldPath}`;
                      return (
                        <TableRow key={fieldPath}>
                          <TableCell className="max-w-64 whitespace-normal font-mono text-xs">
                            {fieldPath}
                          </TableCell>
                          <TableCell className="whitespace-normal text-sm">
                            {displayValue(entry.valor)}
                          </TableCell>
                          <TableCell className="whitespace-normal text-sm">
                            {entry.estado || '—'}
                          </TableCell>
                          <TableCell className="max-w-64 whitespace-normal text-sm text-muted-foreground">
                            {entry.observacion || '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditing({ documentType, fieldPath, isNew: false })}
                                disabled={busyKey === key}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDelete(documentType, fieldPath)}
                                disabled={busyKey === key}
                              >
                                {busyKey === key ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            );
          })
        )}
      </CardContent>

      <GroundTruthFieldEditor
        editing={editing}
        entry={editing && !editing.isNew ? documents[editing.documentType]?.[editing.fieldPath] : undefined}
        saving={editing !== null && busyKey === `${editing.documentType}.${editing.fieldPath}`}
        existingFieldPaths={Object.values(documents).flatMap((doc) => Object.keys(doc))}
        onCancel={() => setEditing(null)}
        onSave={handleSave}
      />
    </Card>
  );
}

interface GroundTruthFieldEditorProps {
  editing: EditingField | null;
  entry: GroundTruthEntry | undefined;
  saving: boolean;
  existingFieldPaths: string[];
  onCancel: () => void;
  onSave: (
    documentType: string,
    fieldPath: string,
    valor: string,
    estado: string,
    observacion: string
  ) => void;
}

// Dialog to fix (create or edit) the correct value for one field, directly
// at the radicado level. When adding a new field, document type and field
// path are picked/typed here — there's no execution output to seed them
// from in this view.
function GroundTruthFieldEditor({
  editing,
  entry,
  saving,
  existingFieldPaths,
  onCancel,
  onSave,
}: GroundTruthFieldEditorProps) {
  const [documentType, setDocumentType] = useState(editing?.documentType || DOCUMENT_TYPES[0]);
  const [fieldPath, setFieldPath] = useState(editing?.fieldPath || '');
  const [valor, setValor] = useState(rawValue(entry?.valor));
  const [estado, setEstado] = useState(rawValue(entry?.estado));
  const [observacion, setObservacion] = useState(rawValue(entry?.observacion));

  useEffect(() => {
    const seed = () => {
      if (!editing) return;
      setDocumentType(editing.documentType);
      setFieldPath(editing.fieldPath);
      setValor(rawValue(entry?.valor));
      setEstado(rawValue(entry?.estado));
      setObservacion(rawValue(entry?.observacion));
    };
    seed();
    // Only re-seed when a different field is opened for editing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  if (!editing) return null;

  return (
    <Dialog
      open={editing !== null}
      onOpenChange={(v) => {
        if (!v) onCancel();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editing.isNew ? 'Agregar campo de ground truth' : 'Editar ground truth'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Documento</label>
            <Select value={documentType} onValueChange={setDocumentType} disabled={!editing.isNew}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t} · {DOCUMENT_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Campo</label>
            <div className="relative">
              {(() => {
                const term = fieldPath.toLowerCase();
                const suggestion = term && editing?.isNew
                  ? existingFieldPaths.find((p) => p.toLowerCase().startsWith(term) && p.toLowerCase() !== term)
                  : undefined;
                return (
                  <>
                    {suggestion && (
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground/40 select-none">
                        {fieldPath}{suggestion.slice(fieldPath.length)}
                        <span className="ml-2 text-muted-foreground/30">Tab</span>
                      </span>
                    )}
                    <input
                      type="text"
                      value={fieldPath}
                      onChange={(e) => setFieldPath(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Tab' && suggestion) {
                          e.preventDefault();
                          setFieldPath(suggestion);
                        }
                      }}
                      placeholder="paz_y_salvo_transporte.entidad_prestadora.nit"
                      disabled={!editing?.isNew}
                      className="w-full rounded-md border border-input bg-background py-2 px-3 text-xs font-mono outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                    />
                  </>
                );
              })()}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Valor correcto</label>
            <Input value={valor} onChange={(e) => setValor(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Estado</label>
            <div className="relative">
              {(() => {
                const estados = ['ENCONTRADO', 'NO_ENCONTRADO'];
                const term = estado.toUpperCase();
                const suggestion = term
                  ? estados.find((e) => e.startsWith(term) && e !== term)
                  : undefined;
                return (
                  <>
                    {suggestion && (
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground/40 select-none">
                        {estado}{suggestion.slice(estado.length)}
                        <span className="ml-2 text-xs text-muted-foreground/30">Tab</span>
                      </span>
                    )}
                    <input
                      type="text"
                      value={estado}
                      onChange={(e) => setEstado(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Tab' && suggestion) {
                          e.preventDefault();
                          setEstado(suggestion);
                        }
                      }}
                      placeholder="ENCONTRADO / NO_ENCONTRADO"
                      className="w-full rounded-md border border-input bg-background py-2 px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                  </>
                );
              })()}
            </div>
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
            onClick={() => onSave(documentType, fieldPath.trim(), valor, estado, observacion)}
            disabled={saving || !fieldPath.trim()}
          >
            {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
