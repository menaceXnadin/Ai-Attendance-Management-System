import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
    <div className={className}>
      <Label htmlFor="semester-select" className="text-slate-300 mb-1 block">
        {label}
      </Label>
      <Select value={String(value)} onValueChange={(v) => onChange(parseInt(v))}>
        <SelectTrigger id="semester-select" className="w-[160px] bg-slate-800/60 border-slate-700 text-slate-200">
          <SelectValue placeholder="Select semester" />
        </SelectTrigger>
        <SelectContent className="bg-slate-900 border-slate-700 text-slate-200">
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
