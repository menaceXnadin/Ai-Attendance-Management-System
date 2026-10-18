import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { History20Regular } from '@fluentui/react-icons';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { api, parseApiError } from '@/integrations/api/client';
import { RecordStatusBadge, formatDateTime, sourceLabel } from './shared';

const ACTION_LABEL: Record<string, string> = {
  create: 'Created',
  update: 'Changed',
  session_cancelled: 'Session cancelled',
  session_uncancelled: 'Session restored',
  session_submitted: 'Register submitted',
  finalize: 'Auto-finalized',
  legacy_backfill: 'Migrated',
  metrics_excluded: 'Excluded from metrics',
  metrics_included: 'Included in metrics',
  metrics_exclusion: 'Metrics exclusion changed',
};

export interface RecordAuditDialogProps {
  recordId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Shown in the dialog title, e.g. the student's name. */
  subject?: string;
}

/** Audit trail for one attendance record (`GET /attendance/records/{id}/audit`). */
const RecordAuditDialog: React.FC<RecordAuditDialogProps> = ({ recordId, open, onOpenChange, subject }) => {
  const query = useQuery({
    queryKey: ['attendance-record-audit', recordId],
    queryFn: () => api.records.getAudit(recordId as number),
    enabled: open && recordId !== null,
  });

  const entries = query.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-section-title">
            <History20Regular className="shrink-0 text-brand-foreground" aria-hidden />
            Record history
          </DialogTitle>
          <DialogDescription className="text-body text-text-muted">
            {subject ? `${subject} · ` : ''}Every change to this record — who made it, when and why. History is never deleted.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto">
          {query.isLoading ? (
            <LoadingState rows={3} columns={4} />
          ) : query.isError ? (
            <ErrorState
              title="Couldn't load history"
              message={parseApiError(query.error).message}
              onRetry={() => void query.refetch()}
            />
          ) : entries.length === 0 ? (
            <EmptyState
              icon={<History20Regular aria-hidden />}
              title="No changes recorded"
              description="This record has not been changed since it was created."
            />
          ) : (
            <ol className="divide-y divide-border-subtle overflow-hidden rounded-md border border-border-subtle">
              {entries.map((entry, index) => {
                const statusChanged = entry.old_status !== entry.new_status;
                const sourceChanged = entry.old_source !== entry.new_source;
                return (
                  <li key={`${entry.changed_at}-${index}`} className="flex flex-col gap-1.5 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{ACTION_LABEL[entry.action] ?? entry.action.replace(/_/g, ' ')}</Badge>
                        {(statusChanged || entry.new_status) && (
                          <span className="inline-flex items-center gap-1.5 text-caption text-text-muted">
                            {entry.old_status ? <RecordStatusBadge status={entry.old_status} /> : null}
                            {entry.old_status && statusChanged ? <span aria-hidden>→</span> : null}
                            {statusChanged || !entry.old_status ? <RecordStatusBadge status={entry.new_status} /> : null}
                          </span>
                        )}
                      </div>
                      <time className="text-caption tabular-nums text-text-muted" dateTime={entry.changed_at}>
                        {formatDateTime(entry.changed_at)}
                      </time>
                    </div>
                    <p className="text-caption text-text-secondary">
                      By{' '}
                      <span className="font-semibold text-text-primary">
                        {entry.changed_by_name || (entry.changed_by ? `User #${entry.changed_by}` : 'System')}
                      </span>
                      {sourceChanged && (entry.old_source || entry.new_source) ? (
                        <>
                          {' '}
                          · Source {entry.old_source ? `${sourceLabel(entry.old_source)} → ` : ''}
                          {sourceLabel(entry.new_source) || '—'}
                        </>
                      ) : null}
                    </p>
                    {entry.reason && (
                      <p className="rounded-sm bg-surface-subtle px-2 py-1 text-caption text-text-primary">
                        <span className="text-text-muted">Reason: </span>
                        {entry.reason}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RecordAuditDialog;
