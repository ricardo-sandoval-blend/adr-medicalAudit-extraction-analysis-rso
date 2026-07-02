'use client';

import { useState } from 'react';
import { Radicado } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface MandatoryRadicadosProps {
  radicados: Radicado[];
  onChange: (radicados: Radicado[]) => void;
  prestadoras?: Array<{ nit: string; nombre: string }>;
}

export function MandatoryRadicados({
  radicados,
  onChange,
  prestadoras = [],
}: MandatoryRadicadosProps) {
  const [selectedPrestadora, setSelectedPrestadora] = useState<string>('');
  const [numeroInput, setNumeroInput] = useState<string>('');

  const handleAdd = () => {
    if (!selectedPrestadora || !numeroInput) return;

    const prestadora = prestadoras.find(
      (p) => p.nit === selectedPrestadora
    );
    if (!prestadora) return;

    const newRadicado: Radicado = {
      numero: numeroInput,
      nit: prestadora.nit,
      prestadora: prestadora.nombre,
    };

    // Check if already exists
    const exists = radicados.some(
      (r) =>
        r.numero === numeroInput && r.nit === prestadora.nit
    );
    if (!exists) {
      onChange([...radicados, newRadicado]);
      setNumeroInput('');
      setSelectedPrestadora('');
    }
  };

  const handleRemove = (index: number) => {
    onChange(radicados.filter((_, i) => i !== index));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mandatory Radicados</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex gap-2">
            <Select value={selectedPrestadora} onValueChange={setSelectedPrestadora}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select provider..." />
              </SelectTrigger>
              <SelectContent>
                {prestadoras.map((p) => (
                  <SelectItem key={p.nit} value={p.nit}>
                    {p.nombre} ({p.nit})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="Radicado number (e.g., 000930)"
              value={numeroInput}
              onChange={(e) => setNumeroInput(e.target.value)}
              className="flex-1"
            />

            <Button onClick={handleAdd} disabled={!selectedPrestadora || !numeroInput}>
              Add
            </Button>
          </div>
        </div>

        {radicados.length > 0 && (
          <div className="space-y-2 rounded-lg bg-muted p-3">
            {radicados.map((rad, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded bg-background p-2"
              >
                <span className="text-sm">
                  <strong>{rad.numero}</strong> - {rad.prestadora} ({rad.nit})
                </span>
                <button
                  onClick={() => handleRemove(idx)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="text-sm text-muted-foreground">
          {radicados.length} mandatory radicado(s) added
        </div>
      </CardContent>
    </Card>
  );
}
