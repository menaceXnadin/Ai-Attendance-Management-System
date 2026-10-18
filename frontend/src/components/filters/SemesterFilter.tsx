import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

type SemesterFilterProps = {
  value: number;
  onChange: (semester: number) => void;
  label?: string;
  min?: number;
  max?: number;
  className?: string;
};

/**
 * Simple reusable semester selector using existing UI components.
 * Defaults to 1..8 range and emits numeric value via onChange.
 */
const SemesterFilter: React.FC<SemesterFilterProps> = ({
  value,
  onChange,
  label = 'Semester',
  min = 1,
  max = 8,
  className,
}) => {
  const options = Array.from({ length: Math.max(0, max - min + 1) }, (_, i) => min + i);

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <Label htmlFor="semester-select">
        {label}
      </Label>
      <Select value={String(value)} onValueChange={(v) => onChange(parseInt(v))}>
        <SelectTrigger id="semester-select" className="w-[160px]">
          <SelectValue placeholder="Select semester" />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt} value={String(opt)}>
              Semester {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default SemesterFilter;
