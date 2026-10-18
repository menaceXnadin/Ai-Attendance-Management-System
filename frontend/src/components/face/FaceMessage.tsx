import * as React from 'react';
import {
  CheckmarkCircle20Filled,
  ErrorCircle20Filled,
  Info20Regular,
  Warning20Filled,
} from '@fluentui/react-icons';
import { cn } from '@/lib/utils';

export type FaceMessageTone = 'info' | 'success' | 'warning' | 'error';

const TONE: Record<FaceMessageTone, { box: string; icon: string; Icon: React.ElementType }> = {
  info: { box: 'border-status-info-border bg-status-info-subtle', icon: 'text-status-info', Icon: Info20Regular },
  success: { box: 'border-status-success-border bg-status-success-subtle', icon: 'text-status-success', Icon: CheckmarkCircle20Filled },
  warning: { box: 'border-status-warning-border bg-status-warning-subtle', icon: 'text-status-warning', Icon: Warning20Filled },
  error: { box: 'border-status-error-border bg-status-error-subtle', icon: 'text-status-error', Icon: ErrorCircle20Filled },
};

interface FaceMessageProps {
  tone: FaceMessageTone;
  title?: React.ReactNode;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  /** Defaults to `alert` for errors, `status` otherwise. Pass `none` for static text. */
  role?: 'alert' | 'status' | 'none';
  titleRef?: React.Ref<HTMLParagraphElement>;
}

/** Fluent message bar used across the face screens. */
export const FaceMessage: React.FC<FaceMessageProps> = ({ tone, title, children, actions, icon, className, role, titleRef }) => {
  const t = TONE[tone];
  const r = role ?? (tone === 'error' ? 'alert' : 'status');
  return (
    <div
      role={r === 'none' ? undefined : r}
      className={cn('flex flex-col gap-3 rounded-md border px-3 py-2.5 sm:flex-row sm:items-start', t.box, className)}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <span className={cn('mt-0.5 shrink-0', t.icon)} aria-hidden>
          {icon ?? <t.Icon />}
        </span>
        <div className="min-w-0 flex-1 text-body text-text-primary">
          {title && (
            <p ref={titleRef} tabIndex={titleRef ? -1 : undefined} className="text-body-strong text-text-primary outline-none">
              {title}
            </p>
          )}
          {children && <div className={cn('text-text-secondary', title ? 'mt-0.5' : '')}>{children}</div>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
    </div>
  );
};

export default FaceMessage;
