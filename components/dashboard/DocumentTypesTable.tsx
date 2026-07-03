'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface FieldStats {
  total: number;
  encontrado: number;
  no_encontrado: number;
  con_valor: number;
  sin_valor: number;
}

interface DocumentTypeStats {
  type: string;
  label: string;
  count: number;
  fields: FieldStats;
}

interface DocumentTypesTableProps {
  documentTypes: DocumentTypeStats[];
}

export function DocumentTypesTable({ documentTypes }: DocumentTypesTableProps) {
  if (documentTypes.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground">
        No hay datos disponibles
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Tipo Documento</TableHead>
            <TableHead className="text-right">Documentos</TableHead>
            <TableHead className="text-right">Campos Total</TableHead>
            <TableHead className="text-right">Con Valor</TableHead>
            <TableHead className="text-right">No Encontrado</TableHead>
            <TableHead className="text-right">Tasa Extracción</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documentTypes.map((dt) => {
            const rate = dt.fields.total > 0
              ? Math.round((dt.fields.con_valor / dt.fields.total) * 1000) / 10
              : 0;
            return (
              <TableRow key={dt.type}>
                <TableCell className="font-mono font-medium">{dt.type}</TableCell>
                <TableCell>{dt.label}</TableCell>
                <TableCell className="text-right">{dt.count}</TableCell>
                <TableCell className="text-right">{dt.fields.total}</TableCell>
                <TableCell className="text-right text-green-600">
                  {dt.fields.con_valor}
                </TableCell>
                <TableCell className="text-right text-red-600">
                  {dt.fields.no_encontrado}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {rate}%
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
