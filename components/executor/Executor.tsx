'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useVersions } from '@/hooks/useVersions';
import { useDatasets } from '@/hooks/useDatasets';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DocumentViewerModal } from './DocumentViewerModal';
import { ExecutionEditor } from './ExecutionEditor';
import {
  GitCompare,
  Loader2,
  FileText,
  FolderOpen,
  Search,
  ChevronDown,
  ChevronRight,
  Plus,
} from 'lucide-react';

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

interface ViewerState {
  open: boolean;
  execution: string;
  radicado: string;
  documentType: string;
}

export function Executor() {
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [searchTerms, setSearchTerms] = useState<Record<string, string>>({});
  const [editorOpen, setEditorOpen] = useState(false);
  const [viewer, setViewer] = useState<ViewerState>({
    open: false,
    execution: '',
    radicado: '',
    documentType: '',
  });

  useEffect(() => {
    fetchHistory();
  }, []);

  const { versions } = useVersions();
  const { datasets } = useDatasets();

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/executions/history?limit=500');
      if (!res.ok) throw new Error('Failed to fetch execution history');
      const data: HistoryResponse = await res.json();
      setHistory(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading executions');
    } finally {
      setLoading(false);
    }
  };

  const toggleCard = (executionName: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(executionName)) {
        next.delete(executionName);
      } else {
        next.add(executionName);
      }
      return next;
    });
  };

  const getSearch = (executionName: string) => searchTerms[executionName] || '';

  const setSearch = (executionName: string, value: string) => {
    setSearchTerms((prev) => ({ ...prev, [executionName]: value }));
  };

  const openDocumentViewer = (
    execution: string,
    radicado: string,
    documentType: string
  ) => {
    setViewer({ open: true, execution, radicado, documentType });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando ejecuciones...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12 text-red-600">
        Error: {error}
      </div>
    );
  }

  if (!history || history.total === 0) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Ejecuciones</h1>
          </div>
          <Button onClick={() => setEditorOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva ejecución
          </Button>
        </div>
        <Card className="max-w-2xl">
          <CardContent className="space-y-4 pt-6 text-center text-muted-foreground">
            <p>
              No se encontraron ejecuciones en disco. Agrega carpetas de
              ejecución al directorio de volumen.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Ejecuciones</h1>
          <p className="text-muted-foreground">
            {history.total} ejecución{history.total !== 1 ? 'es' : ''} en disco
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/executor/compare">
            <Button variant="outline">
              <GitCompare className="mr-2 h-4 w-4" />
              Comparar
            </Button>
          </Link>
          <Button onClick={() => setEditorOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva ejecución
          </Button>
        </div>
      </div>

      {/* Execution cards */}
      <div className="space-y-4">
        {history.executions.map((exec) => {
          const isExpanded = expandedCards.has(exec.execution_name);
          const search = getSearch(exec.execution_name);
          const totalDocs = exec.radicados.reduce(
            (sum, r) => sum + r.documents.length,
            0
          );

          const filteredRadicados = search
            ? exec.radicados.filter((r) => {
                const term = search.toLowerCase();
                return (
                  r.folder.toLowerCase().includes(term) ||
                  r.nit.includes(term) ||
                  r.suffix.toLowerCase().includes(term)
                );
              })
            : exec.radicados;

          return (
            <Card key={exec.execution_name} className="overflow-hidden hover:bg-muted/50 transition-colors cursor-pointer">
              {/* Card header - clickable to expand/collapse */}
              <button
                type="button"
                onClick={() => toggleCard(exec.execution_name)}
                className="flex w-full items-center justify-between px-6 py-4 text-left"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <h3 className="text-lg font-semibold">
                      {exec.execution_name}
                    </h3>
                    <div className="flex gap-4 text-sm text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1">
                        <FolderOpen className="h-3.5 w-3.5" />
                        {exec.total_radicados} radicados
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5" />
                        {totalDocs} documentos
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {exec.type}
                      </Badge>
                    </div>
                  </div>
                </div>
              </button>

              {/* Expandable content */}
              {isExpanded && (
                <CardContent className="border-t border-border pt-4">
                  {/* Search within this execution */}
                  <div className="relative max-w-md mb-4">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    {/* Ghost suggestion text behind the input */}
                    {(() => {
                      const term = search.toLowerCase();
                      const suggestion = term
                        ? [...new Set(exec.radicados.flatMap((r) => [r.nit, r.suffix, r.seq]))]
                            .find((val) => val.toLowerCase().startsWith(term) && val.toLowerCase() !== term)
                        : undefined;
                      return (
                        <>
                          {suggestion && (
                            <span className="pointer-events-none absolute left-10 top-1/2 -translate-y-1/2 text-sm text-muted-foreground/40 font-normal select-none">
                              {search}{suggestion.slice(search.length)}
                              <span className="ml-2 text-xs text-muted-foreground/30">Tab</span>
                            </span>
                          )}
                          <input
                            type="text"
                            placeholder="Buscar por NIT, radicado o sufijo..."
                            value={search}
                            onChange={(e) =>
                              setSearch(exec.execution_name, e.target.value)
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Tab' && suggestion) {
                                e.preventDefault();
                                setSearch(exec.execution_name, suggestion);
                              }
                            }}
                            className="w-full rounded-md border border-input bg-background py-2 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-ring"
                          />
                        </>
                      );
                    })()}
                  </div>

                  <div className="text-sm text-muted-foreground mb-3">
                    Mostrando {filteredRadicados.length} de{' '}
                    {exec.total_radicados} radicados
                  </div>

                  <div className="max-h-[500px] overflow-y-auto rounded-md border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-20">Seq</TableHead>
                          <TableHead className="w-28">NIT</TableHead>
                          <TableHead className="w-36">Radicado</TableHead>
                          <TableHead className="w-20 text-center">Docs</TableHead>
                          <TableHead>Tipos de Documento</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRadicados.map((radicado) => {
                          const docTypes = radicado.documents.map((d) => {
                            const parts = d.replace(/\.json$/i, '').split('_');
                            return parts[1] || '?';
                          });
                          return (
                            <TableRow key={radicado.folder}>
                              <TableCell className="font-mono text-sm">
                                {radicado.seq}
                              </TableCell>
                              <TableCell className="font-mono text-sm">
                                {radicado.nit}
                              </TableCell>
                              <TableCell className="font-medium">
                                {radicado.suffix}
                              </TableCell>
                              <TableCell className="text-center">
                                {radicado.documents.length}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {docTypes.map((type, i) => (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={() =>
                                        openDocumentViewer(
                                          exec.execution_name,
                                          radicado.folder,
                                          type
                                        )
                                      }
                                      className="cursor-pointer"
                                    >
                                      <Badge
                                        variant="outline"
                                        className="text-xs hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
                                      >
                                        {type}
                                      </Badge>
                                    </button>
                                  ))}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Document Viewer Modal */}
      <DocumentViewerModal
        open={viewer.open}
        onOpenChange={(open) => setViewer((prev) => ({ ...prev, open }))}
        execution={viewer.execution}
        radicado={viewer.radicado}
        documentType={viewer.documentType}
      />

      {/* New Execution Editor Modal */}
      <ExecutionEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        execution={null}
        datasets={datasets}
        versions={versions}
        onSaved={() => {
          setEditorOpen(false);
          fetchHistory();
        }}
      />
    </div>
  );
}
