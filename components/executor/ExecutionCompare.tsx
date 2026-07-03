'use client';

import { useEffect, useMemo, useState } from 'react';
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS, DocumentType } from '@/lib/config';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

interface RadicadoEntry {
  folder: string;
  seq: string;
  nit: string;
  suffix: string;
  documents: string[];
}

interface ExecutionRunMetadata {
  execution_name: string;
  radicados: RadicadoEntry[];
  total_radicados: number;
  type: 'total' | 'sample';
}

interface HistoryResponse {
  total: number;
  executions: ExecutionRunMetadata[];
}

interface JsonDocumentResponse {
  execution: string;
  radicado: string;
  type: string;
  filename: string;
  data: Record<string, unknown>;
}

// Compares two executions field by field for a specific radicado and document type.
// Executions are loaded from the filesystem (same source as the Executor cards).
export function ExecutionCompare() {
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [executionA, setExecutionA] = useState<string>('');
  const [executionB, setExecutionB] = useState<string>('');
  const [radicadoSearch, setRadicadoSearch] = useState('');
  const [selectedRadicado, setSelectedRadicado] = useState<string>('');
  const [documentType, setDocumentType] = useState<string>('');

  const [jsonA, setJsonA] = useState<Record<string, unknown> | null>(null);
  const [jsonB, setJsonB] = useState<Record<string, unknown> | null>(null);
  const [loadingJson, setLoadingJson] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch('/api/executions/history?limit=500');
        if (!res.ok) throw new Error('Failed');
        const data: HistoryResponse = await res.json();
        setHistory(data);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  // Reset downstream when execution A changes
  useEffect(() => {
    setSelectedRadicado('');
    setDocumentType('');
    setJsonA(null);
    setJsonB(null);
  }, [executionA]);

  useEffect(() => {
    setDocumentType('');
    setJsonA(null);
    setJsonB(null);
  }, [selectedRadicado]);

  // Find common radicados between the two executions
  const execDataA = history?.executions.find((e) => e.execution_name === executionA);
  const execDataB = history?.executions.find((e) => e.execution_name === executionB);

  const commonRadicados = useMemo(() => {
    if (!execDataA) return [];
    if (!execDataB) return execDataA.radicados;
    const bFolders = new Set(execDataB.radicados.map((r) => r.folder));
    return execDataA.radicados.filter((r) => bFolders.has(r.folder));
  }, [execDataA, execDataB]);

  const filteredRadicados = useMemo(() => {
    const term = radicadoSearch.trim().toLowerCase();
    if (!term) return commonRadicados;
    return commonRadicados.filter(
      (r) =>
        r.folder.toLowerCase().includes(term) ||
        r.nit.includes(term) ||
        r.suffix.toLowerCase().includes(term)
    );
  }, [commonRadicados, radicadoSearch]);

  const selectedRadicadoData = commonRadicados.find((r) => r.folder === selectedRadicado);

  // Get document types available for this radicado in execution A
  const availableDocTypes = useMemo(() => {
    if (!selectedRadicadoData) return [];
    return selectedRadicadoData.documents
      .map((d) => {
        const parts = d.replace(/\.json$/i, '').split('_');
        return parts[1] || '';
      })
      .filter(Boolean)
      .sort();
  }, [selectedRadicadoData]);

  // Fetch JSONs when all selections are made
  useEffect(() => {
    if (!executionA || !selectedRadicado || !documentType) return;

    const fetchJsons = async () => {
      setLoadingJson(true);
      try {
        const paramsA = new URLSearchParams({
          execution: executionA,
          radicado: selectedRadicado,
          type: documentType,
        });
        const resA = await fetch(`/api/documents/json?${paramsA}`);
        if (resA.ok) {
          const data: JsonDocumentResponse = await resA.json();
          setJsonA(data.data);
        } else {
          setJsonA(null);
        }

        if (executionB) {
          const paramsB = new URLSearchParams({
            execution: executionB,
            radicado: selectedRadicado,
            type: documentType,
          });
          const resB = await fetch(`/api/documents/json?${paramsB}`);
          if (resB.ok) {
            const data: JsonDocumentResponse = await resB.json();
            setJsonB(data.data);
          } else {
            setJsonB(null);
          }
        } else {
          setJsonB(null);
        }
      } catch {
        setJsonA(null);
        setJsonB(null);
      } finally {
        setLoadingJson(false);
      }
    };

    fetchJsons();
  }, [executionA, executionB, selectedRadicado, documentType]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando ejecuciones...
      </div>
    );
  }

  const executionNames = history?.executions.map((e) => e.execution_name) || [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Comparar ejecuciones</h1>
        <p className="text-muted-foreground">
          Compara los campos extraídos por dos ejecuciones campo a campo para un
          radicado y tipo de documento específico.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Selección</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Ejecución A</label>
              <Select value={executionA} onValueChange={setExecutionA}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona ejecución A..." />
                </SelectTrigger>
                <SelectContent>
                  {executionNames
                    .filter((name) => name !== executionB)
                    .map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Ejecución B</label>
              <Select value={executionB} onValueChange={setExecutionB}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona ejecución B..." />
                </SelectTrigger>
                <SelectContent>
                  {executionNames
                    .filter((name) => name !== executionA)
                    .map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {executionA && (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium">Buscar radicado</label>
                <Input
                  placeholder="NIT, radicado o sufijo..."
                  value={radicadoSearch}
                  onChange={(e) => setRadicadoSearch(e.target.value)}
                />
              </div>

              <div className="max-h-48 overflow-auto rounded-lg border">
                {filteredRadicados.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Sin radicados {executionB ? 'en común' : ''}
                  </div>
                ) : (
                  filteredRadicados.slice(0, 50).map((r) => (
                    <button
                      key={r.folder}
                      type="button"
                      onClick={() => setSelectedRadicado(r.folder)}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted ${
                        r.folder === selectedRadicado ? 'bg-muted font-medium' : ''
                      }`}
                    >
                      <span>
                        {r.seq}{' '}
                        <span className="text-muted-foreground">
                          {r.nit} · {r.suffix}
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {r.documents.length} docs
                      </span>
                    </button>
                  ))
                )}
              </div>
            </>
          )}

          {selectedRadicado && (
            <div>
              <label className="mb-1 block text-sm font-medium">Tipo de Documento</label>
              <Select value={documentType} onValueChange={setDocumentType}>
                <SelectTrigger className="w-full max-w-xs">
                  <SelectValue placeholder="Selecciona tipo..." />
                </SelectTrigger>
                <SelectContent>
                  {availableDocTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t} {(DOCUMENT_TYPE_LABELS as Record<string, string>)[t] ? `· ${(DOCUMENT_TYPE_LABELS as Record<string, string>)[t]}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comparison view */}
      {documentType && (loadingJson ? (
        <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando documentos...
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Execution A JSON */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {executionA}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {selectedRadicado} · {documentType}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {jsonA ? (
                <pre className="max-h-[600px] overflow-auto rounded-md bg-muted p-4 text-xs font-mono whitespace-pre-wrap break-words">
                  {JSON.stringify(jsonA, null, 2)}
                </pre>
              ) : (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Documento no encontrado en esta ejecución
                </div>
              )}
            </CardContent>
          </Card>

          {/* Execution B JSON */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {executionB || '(sin seleccionar)'}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {selectedRadicado} · {documentType}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {executionB ? (
                jsonB ? (
                  <pre className="max-h-[600px] overflow-auto rounded-md bg-muted p-4 text-xs font-mono whitespace-pre-wrap break-words">
                    {JSON.stringify(jsonB, null, 2)}
                  </pre>
                ) : (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    Documento no encontrado en esta ejecución
                  </div>
                )
              ) : (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Selecciona una ejecución B para comparar
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );
}
