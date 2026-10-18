import * as React from 'react';
import { Key20Regular } from '@fluentui/react-icons';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { normalizePresenceCode, PRESENCE_CODE_LENGTH } from './presenceCode';

interface PresenceCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  disabled?: boolean;
  /** Rotation period, for the hint text. */
  periodSeconds?: number;
  /** True when the code came from the QR link. */
  fromLink?: boolean;
  onSubmit?: () => void;
}

/** 6-digit classroom check-in code (docs/system/face-verification.md §9). */
export const PresenceCodeInput = React.forwardRef<HTMLInputElement, PresenceCodeInputProps>(
  ({ value, onChange, error, disabled, periodSeconds, fromLink, onSubmit }, ref) => {
    const id = React.useId();
    const hintId = `${id}-hint`;
    const errorId = `${id}-error`;
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id} className="flex items-center gap-1.5 text-label text-text-primary">
          <Key20Regular className="shrink-0 text-text-muted" aria-hidden />
          Check-in code
        </Label>
        <Input
          ref={ref}
          id={id}
          value={value}
          onChange={(e) => onChange(normalizePresenceCode(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && onSubmit) {
              e.preventDefault();
              onSubmit();
            }
          }}
          disabled={disabled}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={PRESENCE_CODE_LENGTH}
          placeholder="000000"
          aria-invalid={!!error}
          aria-describedby={error ? `${errorId} ${hintId}` : hintId}
          className={cn(
            'h-12 max-w-[220px] text-center font-mono text-page-title tabular-nums tracking-[0.35em] placeholder:text-text-disabled',
            error && 'border-status-error focus-visible:ring-status-error'
          )}
        />
        {error && (
          <p id={errorId} className="text-caption text-status-error" role="alert">
            {error}
          </p>
        )}
        <p id={hintId} className="text-caption text-text-muted">
          {fromLink
            ? 'Filled in from the class QR code. Codes change often — if check-in says it expired, enter the code on the screen.'
            : `Enter the 6-digit code shown in class${periodSeconds ? ` (it changes every ${periodSeconds} seconds)` : ''}.`}
        </p>
      </div>
    );
  }
);
PresenceCodeInput.displayName = 'PresenceCodeInput';

export default PresenceCodeInput;
