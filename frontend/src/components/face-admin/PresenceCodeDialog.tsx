import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowClockwise16Regular,
  Checkmark16Regular,
  Copy16Regular,
  ErrorCircle16Regular,
  FullScreenMaximize16Regular,
  FullScreenMinimize16Regular,
  Info16Regular,
  QrCode20Regular,
  QrCode24Regular,
  Speaker216Regular,
  Warning16Regular,
} from '@fluentui/react-icons';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Spinner } from '@/components/feedback/LoadingState';
import { MessageBar } from '@/components/attendance-admin/shared';
import { api, parseApiError, type PresenceCodeInfo } from '@/integrations/api/client';
import { cn } from '@/lib/utils';
import { formatClock } from './faceLabels';

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

/** Errors that won't fix themselves by retrying (docs/system/face-verification.md §9). */
const isFatalError = (err: unknown): boolean => {
  const { status } = parseApiError(err);
  return status === 403 || status === 404 || status === 409;
};

const fatalMessage = (err: unknown): { title: string; message: string } => {
  const info = parseApiError(err);
  if (info.code === 'not_today') {
    return {
      title: 'Not available today',
      message: 'Check-in codes are only shown on the day of the class.',
    };
  }
  if (info.code === 'session_cancelled') {
    return {
      title: 'This session is cancelled',
      message: 'Restore the session before showing a check-in code.',
    };
  }
  if (info.status === 403 || info.code === 'not_session_teacher') {
    return {
      title: 'Not your session',
      message: "Only the session's teacher or an administrator can show this check-in code.",
    };
  }
  if (info.status === 404) {
    return { title: 'Session not found', message: 'This class session no longer exists.' };
  }
  return { title: "Couldn't get the check-in code", message: info.message };
};

/** "123456" → ["123", "456"]; other lengths split in half. */
const splitCode = (code: string): [string, string] => {
  const half = Math.ceil(code.length / 2);
  return [code.slice(0, half), code.slice(half)];
};

const WINDOW_META: Record<string, { label: string; variant: 'success' | 'info' | 'secondary' }> = {
  open: { label: 'Check-in open', variant: 'success' },
  not_open: { label: 'Check-in not open yet', variant: 'info' },
  closed: { label: 'Check-in closed', variant: 'secondary' },
};

const windowDetail = (info: PresenceCodeInfo): string => {
  const { state, opens_at, closes_at } = info.window ?? { state: null, opens_at: null, closes_at: null };
  if (state === 'open' && closes_at) return `Closes at ${formatClock(closes_at)}`;
  if (state === 'not_open' && opens_at) return `Opens at ${formatClock(opens_at)}`;
  if (state === 'closed' && closes_at) return `Closed at ${formatClock(closes_at)}`;
  return '';
};

/* -------------------------------------------------------------------------- */
/* Countdown ring                                                              */
/* -------------------------------------------------------------------------- */

const CountdownRing: React.FC<{ remaining: number; period: number; size: number }> = ({ remaining, period, size }) => {
  const stroke = Math.max(3, Math.round(size / 12));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const fraction = period > 0 ? Math.min(1, Math.max(0, remaining / period)) : 0;
  const urgent = remaining <= 5;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} style={{ stroke: 'var(--border-subtle)' }} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - fraction)}
        style={{
          stroke: urgent ? 'var(--status-warning)' : 'var(--brand-foreground)',
          transition: 'stroke-dashoffset 250ms linear',
        }}
      />
    </svg>
  );
};

/* -------------------------------------------------------------------------- */
/* Live view (mounted only while the dialog is open)                           */
/* -------------------------------------------------------------------------- */

interface PresenceCodeViewProps {
  sessionId: number;
  sessionLabel?: string;
  isFullscreen: boolean;
  canFullscreen: boolean;
  onToggleFullscreen: () => void;
}

const PresenceCodeView: React.FC<PresenceCodeViewProps> = ({
  sessionId,
  sessionLabel,
  isFullscreen,
  canFullscreen,
  onToggleFullscreen,
}) => {
  const query = useQuery({
    queryKey: ['presence-code', sessionId],
    queryFn: () => api.sessions.getPresenceCode(sessionId),
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: true,
    // Safety net: one refresh per rotation period even if the expiry timer below misfires.
    refetchInterval: (q) => {
      if (q.state.status === 'error' && isFatalError(q.state.error)) return false;
      return Math.max(10, q.state.data?.period_seconds ?? 30) * 1000;
    },
    retry: (count, err) => !isFatalError(err) && count < 2,
  });

  const { data, dataUpdatedAt, refetch } = query;

  // Refresh exactly when the server says the code expires (+ a small buffer to land in the next step).
  useEffect(() => {
    if (!data) return;
    const elapsed = Date.now() - dataUpdatedAt;
    const delay = Math.max(1000, data.expires_in_seconds * 1000 - elapsed + 300);
    const timer = window.setTimeout(() => void refetch(), delay);
    return () => window.clearTimeout(timer);
  }, [data, dataUpdatedAt, refetch]);

  // Local clock only drives the countdown display.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  const period = data?.period_seconds ?? 30;
  const remaining = data ? Math.max(0, data.expires_in_seconds - (now - dataUpdatedAt) / 1000) : 0;
  const remainingWhole = Math.ceil(remaining);

  const checkinUrl = useMemo(
    () => (data ? `${window.location.origin}${data.checkin_path.startsWith('/') ? '' : '/'}${data.checkin_path}` : ''),
    [data]
  );

  // Screen-reader announcement only on request (no aria-live updates on every rotation).
  const [announcement, setAnnouncement] = useState('');
  useEffect(() => setAnnouncement(''), [data?.code]);
  const spokenCode = data ? data.code.split('').join(' ') : '';
  const announce = () => {
    if (!data) return;
    setAnnouncement('');
    window.setTimeout(
      () => setAnnouncement(`Check-in code ${spokenCode}. Valid for about ${remainingWhole} more seconds.`),
      50
    );
  };

  // Copy link with inline feedback (toasts are hidden while the dialog is full screen).
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  useEffect(() => {
    if (copyState === 'idle') return;
    const timer = window.setTimeout(() => setCopyState('idle'), 2000);
    return () => window.clearTimeout(timer);
  }, [copyState]);
  const copyLink = async () => {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(checkinUrl);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  };

  const fatal = query.isError && isFatalError(query.error);
  const subject = data?.subject_name || sessionLabel || 'Class session';
  const time =
    data?.start_time || data?.end_time ? `${formatClock(data?.start_time)}–${formatClock(data?.end_time)}` : '';
  const windowMeta = data?.window?.state ? WINDOW_META[data.window.state] : undefined;
  const windowText = data ? windowDetail(data) : '';
  const [groupA, groupB] = data ? splitCode(data.code) : ['', ''];

  return (
    <div className={cn('flex min-h-0 flex-col', isFullscreen && 'h-full')}>
      {/* Header */}
      <header className="flex items-start gap-3 border-b border-border-subtle px-6 py-4 pr-14">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-brand-subtle text-brand-foreground">
          <QrCode24Regular aria-hidden />
        </span>
        <div className="min-w-0">
          <DialogTitle className={cn(isFullscreen ? 'text-title-2' : 'text-section-title')}>Check-in code</DialogTitle>
          <DialogDescription className={cn('text-text-secondary', isFullscreen ? 'text-subheading' : 'text-body')}>
            {subject}
            {time ? ` · ${time}` : ''}
          </DialogDescription>
        </div>
      </header>

      {/* Body */}
      <div
        className={cn(
          'flex flex-1 flex-col items-center justify-center gap-6 px-6 py-6 md:flex-row md:gap-10',
          isFullscreen && 'gap-10 md:gap-16'
        )}
      >
        {query.isLoading ? (
          <Spinner size="lg" label="Getting the check-in code…" className="py-16" />
        ) : fatal ? (
          <div className="w-full max-w-lg py-10 text-center" role="alert">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-status-error-subtle text-status-error">
              <ErrorCircle16Regular className="size-6" aria-hidden />
            </div>
            <h3 className="text-subheading text-text-primary">{fatalMessage(query.error).title}</h3>
            <p className="mt-1 text-body text-text-muted">{fatalMessage(query.error).message}</p>
          </div>
        ) : !data ? (
          <div className="w-full max-w-lg py-10 text-center" role="alert">
            <h3 className="text-subheading text-text-primary">Couldn't get the check-in code</h3>
            <p className="mt-1 text-body text-text-muted">
              {query.isError ? parseApiError(query.error).message : 'Please try again.'}
            </p>
            <Button variant="outline" className="mt-5" onClick={() => void refetch()}>
              <ArrowClockwise16Regular aria-hidden />
              Try again
            </Button>
          </div>
        ) : (
          <>
            {/* QR: always dark modules on a light tile so phones can scan it in dark mode too. */}
            <figure
              className={cn(
                'shrink-0 overflow-hidden rounded-xl shadow-md ring-1 ring-border-subtle',
                isFullscreen ? 'w-[min(62vh,44vw)]' : 'w-[min(18rem,70vw)] md:w-72'
              )}
            >
              <QRCodeSVG
                value={checkinUrl}
                size={512}
                level="M"
                marginSize={4}
                bgColor="#FFFFFF"
                fgColor="#000000"
                title="QR code: opens face check-in for this class with the current code"
                className="block h-auto w-full"
              />
            </figure>

            <div className={cn('flex min-w-0 flex-col items-center gap-4 md:items-start', isFullscreen && 'gap-6')}>
              <p className={cn('text-text-secondary', isFullscreen ? 'text-section-title' : 'text-body-strong')}>
                Scan the QR code, or enter this code
              </p>

              {/* Digits: visual only; screen readers get the spaced version or the on-demand announcement. */}
              <div
                key={data.code}
                className="flex animate-fade-in-up items-baseline gap-[0.35em] font-mono font-semibold leading-none tracking-[0.12em] text-text-primary tabular-nums"
                style={{ fontSize: isFullscreen ? 'clamp(4rem, 11vw, 11rem)' : 'clamp(2.75rem, 8vw, 5rem)' }}
                aria-hidden
              >
                <span>{groupA}</span>
                <span>{groupB}</span>
              </div>
              <span className="sr-only">Current check-in code: {spokenCode}</span>

              <div className="flex items-center gap-3" role="timer" aria-label={`New code in ${remainingWhole} seconds`}>
                <CountdownRing remaining={remaining} period={period} size={isFullscreen ? 56 : 36} />
                <div aria-hidden>
                  <p
                    className={cn(
                      'tabular-nums text-text-primary',
                      isFullscreen ? 'text-section-title' : 'text-body-strong'
                    )}
                  >
                    {remaining > 0 ? `New code in ${remainingWhole}s` : 'Refreshing…'}
                  </p>
                  <p className={cn('text-text-muted', isFullscreen ? 'text-body' : 'text-caption')}>
                    Codes change every {period} seconds
                  </p>
                </div>
              </div>

              {(windowMeta || windowText) && (
                <div className="flex flex-wrap items-center gap-2">
                  {windowMeta && (
                    <Badge variant={windowMeta.variant} shape="pill" className={cn(isFullscreen && 'px-3 py-1 text-body-strong')}>
                      {windowMeta.label}
                    </Badge>
                  )}
                  {windowText && (
                    <span className={cn('tabular-nums text-text-secondary', isFullscreen ? 'text-subheading' : 'text-body')}>
                      {windowText}
                    </span>
                  )}
                </div>
              )}

              {!data.required && (
                <MessageBar tone="info" icon={<Info16Regular />} className="max-w-md">
                  Code not required right now — students can check in without it.
                </MessageBar>
              )}

              {query.isError && (
                <MessageBar
                  tone="warning"
                  role="alert"
                  icon={<Warning16Regular />}
                  className="max-w-md"
                  actions={
                    <Button variant="outline" size="sm" onClick={() => void refetch()}>
                      Retry
                    </Button>
                  }
                >
                  Couldn't refresh the code. The one shown may have expired.
                </MessageBar>
              )}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="flex flex-col gap-3 border-t border-border-subtle bg-surface-subtle px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-caption text-text-muted">
          Students open <span className="font-semibold text-text-secondary">Mark attendance</span> on their phone and
          verify their face. The code proves they are in the room.
        </p>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button variant="subtle" size="sm" onClick={announce} disabled={!data || fatal} title="Announce the current code to screen readers">
            <Speaker216Regular aria-hidden />
            Announce code
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void copyLink()}
            disabled={!data || fatal}
            title={checkinUrl ? `${checkinUrl} (expires with the code)` : undefined}
          >
            {copyState === 'copied' ? <Checkmark16Regular aria-hidden /> : <Copy16Regular aria-hidden />}
            {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? "Couldn't copy" : 'Copy link'}
          </Button>
          {canFullscreen && (
            <Button variant="outline" size="sm" onClick={onToggleFullscreen} aria-pressed={isFullscreen}>
              {isFullscreen ? <FullScreenMinimize16Regular aria-hidden /> : <FullScreenMaximize16Regular aria-hidden />}
              {isFullscreen ? 'Exit full screen' : 'Full screen'}
            </Button>
          )}
        </div>
      </footer>

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
      <div aria-live="polite" className="sr-only">
        {copyState === 'copied' ? 'Check-in link copied' : copyState === 'failed' ? "Couldn't copy the link" : ''}
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Dialog                                                                      */
/* -------------------------------------------------------------------------- */

export interface PresenceCodeDialogProps {
  sessionId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Heading shown before the server returns the subject name. */
  sessionLabel?: string;
}

/**
 * Projector view of a session's rotating proof-of-presence code
 * (`GET /attendance/sessions/{id}/presence-code`, docs/system/face-verification.md §9):
 * a QR deep link plus large digits that refresh when `expires_in_seconds` runs out.
 * Nothing is fetched while the dialog is closed.
 */
const PresenceCodeDialog: React.FC<PresenceCodeDialogProps> = ({ sessionId, open, onOpenChange, sessionLabel }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const canFullscreen = typeof document !== 'undefined' && !!document.fullscreenEnabled;

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!contentRef.current && document.fullscreenElement === contentRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const exitFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  };

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    } else {
      void contentRef.current?.requestFullscreen?.().catch(() => undefined);
    }
  }, []);

  const handleOpenChange = (next: boolean) => {
    if (!next) exitFullscreen();
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        ref={contentRef}
        // Esc while full screen only leaves full screen; a second Esc closes the dialog.
        onEscapeKeyDown={(e) => {
          if (document.fullscreenElement) e.preventDefault();
        }}
        className={cn(
          'flex max-h-[calc(100dvh-2rem)] max-w-5xl flex-col gap-0 overflow-y-auto p-0',
          isFullscreen && 'max-h-none rounded-none border-0'
        )}
      >
        <PresenceCodeView
          sessionId={sessionId}
          sessionLabel={sessionLabel}
          isFullscreen={isFullscreen}
          canFullscreen={canFullscreen}
          onToggleFullscreen={toggleFullscreen}
        />
      </DialogContent>
    </Dialog>
  );
};

export default PresenceCodeDialog;

/* -------------------------------------------------------------------------- */
/* Trigger button                                                              */
/* -------------------------------------------------------------------------- */

export interface PresenceCodeButtonProps {
  sessionId: number;
  sessionLabel?: string;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  className?: string;
}

/** "Show check-in code" button that owns its PresenceCodeDialog. */
export const PresenceCodeButton: React.FC<PresenceCodeButtonProps> = ({
  sessionId,
  sessionLabel,
  variant = 'outline',
  size = 'sm',
  className,
}) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={() => setOpen(true)} aria-haspopup="dialog">
        <QrCode20Regular aria-hidden />
        Show check-in code
      </Button>
      <PresenceCodeDialog sessionId={sessionId} sessionLabel={sessionLabel} open={open} onOpenChange={setOpen} />
    </>
  );
};
