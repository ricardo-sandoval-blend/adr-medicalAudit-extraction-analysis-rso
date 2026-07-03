'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ExecutionSelectorProps {
  executions: string[];
  selected: string | null;
  onSelect: (value: string | null) => void;
}

export function ExecutionSelector({
  executions,
  selected,
  onSelect,
}: ExecutionSelectorProps) {
  return (
    <Select
      value={selected || '__all__'}
      onValueChange={(v) => onSelect(v === '__all__' ? null : v)}
    >
      <SelectTrigger className="w-[240px]">
        <SelectValue placeholder="Todas las ejecuciones" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">Todas las ejecuciones</SelectItem>
        {executions.map((name) => (
          <SelectItem key={name} value={name}>
            {name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
