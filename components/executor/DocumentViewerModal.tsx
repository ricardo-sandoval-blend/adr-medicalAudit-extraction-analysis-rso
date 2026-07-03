'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, FileWarning } from 'lucide-react';

interface DocumentViewerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  execution: string;
  radicado: string;
  documentType: string;
}

export function DocumentViewerModal({
  open,
  onOpenChange,
  execution,
  radicado,
  documentType,
}: DocumentViewerModalProps) {
  const [jsonData, setJsonData] = useState<unknown>(null);
  const [jsonLoading, setJsonLoading] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState(false);

  useEffect(() => {
    if (!open) return;

    // Build PDF URL and verify it exists
    const pdfParams = new URLSearchParams({ radicado, type: documentType });
    const url = `/api/documents/pdf?${pdfParams.toString()}`;
    setPdfError(false);

    // Check if PDF exists before showing iframe
    fetch(url, { method: 'HEAD' }).then((res) => {
      if (res.ok) {
        setPdfUrl(url);
      } else {
        setPdfUrl(null);
        setPdfError(true);
      }
    }).catch(() => {
      setPdfUrl(null);
      setPdfError(true);
    });

    // Fetch JSON
    const fetchJson = async () => {
      setJsonLoading(true);
      setJsonError(null);
      try {
        const params = new URLSearchParams({
          execution,
          radicado,
          type: documentType,
        });
        const res = await fetch(`/api/documents/json?${params.toString()}`);
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'No se encontró el JSON');
        }
        const data = await res.json();
        setJsonData(data.data);
      } catch (err) {
        setJsonError(err instanceof Error ? err.message : 'Error cargando JSON');
        setJsonData(null);
      } finally {
        setJsonLoading(false);
      }
    };

    fetchJson();
  }, [open, execution, radicado, documentType]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[95vw] h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {documentType} — {radicado}
            <span className="ml-3 text-sm font-normal text-muted-foreground">
              ({execution})
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 gap-4 overflow-hidden min-h-0">
          {/* Left panel: PDF viewer */}
          <div className="flex-1 flex flex-col rounded-lg border border-border overflow-hidden">
            <div className="border-b border-border bg-muted/50 px-4 py-2 text-sm font-medium">
              PDF del Documento
            </div>
            <div className="flex-1 relative">
              {pdfError ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
                  <FileWarning className="h-12 w-12" />
                  <p className="text-sm">PDF no disponible</p>
                  <p className="text-xs">
                    El archivo PDF no se encontró en la carpeta datasets.
                  </p>
                </div>
              ) : pdfUrl ? (
                <iframe
                  src={pdfUrl}
                  className="w-full h-full"
                  title={`PDF ${documentType} - ${radicado}`}
                  onError={() => setPdfError(true)}
                />
              ) : null}
            </div>
          </div>

          {/* Right panel: JSON structured view */}
          <div className="flex-1 flex flex-col rounded-lg border border-border overflow-hidden">
            <div className="border-b border-border bg-muted/50 px-4 py-2 text-sm font-medium">
              JSON Estructurado
            </div>
            <div className="flex-1 overflow-auto p-4">
              {jsonLoading ? (
                <div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando...
                </div>
              ) : jsonError ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                  <FileWarning className="h-8 w-8" />
                  <p className="text-sm">{jsonError}</p>
                </div>
              ) : jsonData ? (
                <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                  {JSON.stringify(jsonData, null, 2)}
                </pre>
              ) : null}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
