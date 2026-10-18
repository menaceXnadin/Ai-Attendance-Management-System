import React, { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { DataUsage16Regular, ErrorCircle16Regular } from '@fluentui/react-icons';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { api, parseApiError } from '@/integrations/api/client';
import { useToast } from '@/hooks/use-toast';
import { MessageBar } from './shared';

export interface MetricsExclusionDialogProps {
  recordId: number | null;
  /** Current state of the record; the dialog proposes the opposite. */
  excluded: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
  subject?: string;
}

/**
 * Admin toggle for `attendance_records.excluded_from_metrics`
 * (`PATCH /attendance/records/{id}/metrics-exclusion`, reason required, audited).
 * The record itself is never deleted or changed.
 */
const MetricsExclusionDialog: React.FC<MetricsExclusionDialogProps> = ({
  recordId,
  excluded,
  open,
  onOpenChange,
  onDone,
  subject,
}) => {
  const { toast } = useToast();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const target = !excluded;

  useEffect(() => {
    if (open) {
      setReason('');
      setError(null);
    }
  }, [open, recordId]);

  const mutation = useMutation({
    mutationFn: () => api.records.setMetricsExclusion(recordId as number, target, reason.trim()),
    onSuccess: () => {
      toast({
        title: target ? 'Record excluded from metrics' : 'Record included in metrics',
        description: 'The change was saved and written to the record history.',
      });
      onOpenChange(false);
      onDone?.();
    },
    onError: (err) => setError(parseApiError(err).message),
  });

  const submit = () => {
    if (!reason.trim()) {
      setError('A reason is required.');
      return;
    }
    setError(null);
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-section-title">
            <DataUsage16Regular className="size-5 shrink-0 text-brand-foreground" aria-hidden />
            {target ? 'Exclude from metrics' : 'Include in metrics'}
          </DialogTitle>
          <DialogDescription className="text-body text-text-muted">
            {subject ? `${subject} · ` : ''}
            {target
              ? 'The record stays in the register and history but no longer counts toward percentages or eligibility.'
              : 'The record will count toward percentages and eligibility again.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1">
          <label htmlFor="metrics-exclusion-reason" className="text-body-strong text-text-primary">
            Reason <span className="text-status-error">*</span>
          </label>
          <Textarea
            id="metrics-exclusion-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={target ? 'e.g. Recorded for a class that did not take place' : 'e.g. Exclusion applied by mistake'}
            aria-invalid={Boolean(error && !reason.trim())}
          />
          <p className="text-caption text-text-muted">Saved in the record's audit trail.</p>
        </div>

        {error && (
          <MessageBar tone="error" role="alert" icon={<ErrorCircle16Regular />}>
            {error}
          </MessageBar>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={mutation.isPending || recordId === null}>
            {mutation.isPending ? 'Saving…' : target ? 'Exclude record' : 'Include record'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MetricsExclusionDialog;
