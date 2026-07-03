'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

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

interface ExtractionRateChartProps {
  documentTypes: DocumentTypeStats[];
}

export function ExtractionRateChart({ documentTypes }: ExtractionRateChartProps) {
  if (documentTypes.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground">
        No hay datos de extracción disponibles
      </div>
    );
  }

  const chartData = documentTypes.map((dt) => {
    const rate = dt.fields.total > 0
      ? Math.round((dt.fields.con_valor / dt.fields.total) * 1000) / 10
      : 0;
    const noEncontrado = dt.fields.total > 0
      ? Math.round((dt.fields.no_encontrado / dt.fields.total) * 1000) / 10
      : 0;
    return {
      name: dt.type,
      label: dt.label,
      'Con Valor': rate,
      'No Encontrado': noEncontrado,
      documentos: dt.count,
    };
  });

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={chartData} margin={{ bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis unit="%" domain={[0, 100]} />
          <Tooltip
            formatter={(value) => [`${value}%`]}
            labelFormatter={(label) => {
              const item = chartData.find((d) => d.name === String(label));
              return item ? `${item.label} (${item.documentos} docs)` : String(label);
            }}
          />
          <Legend />
          <Bar dataKey="Con Valor" fill="#22c55e" stackId="a" />
          <Bar dataKey="No Encontrado" fill="#ef4444" stackId="a" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
