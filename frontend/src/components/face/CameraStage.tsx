import * as React from 'react';
import { ArrowLeft48Filled, ArrowRight48Filled } from '@fluentui/react-icons';
import { cn } from '@/lib/utils';

export type StageGuide = 'idle' | 'searching' | 'aligned' | 'active' | 'problem';

export interface StagePrompt {
  title: string;
  detail?: string;
  /** Screen side to point at. The preview is mirrored, so the student's own left is screen-left. */
  arrow?: 'left' | 'right' | null;
}

export interface StageChip {
  label: string;
  tone: 'available' | 'away' | 'busy' | 'offline';
  pulse?: boolean;
}

interface CameraStageProps {
  /** Callback ref from `useCameraStream`. */
  videoRef: (el: HTMLVideoElement | null) => void;
  /** Frozen frame (unmirrored data URL) shown instead of the live video, e.g. while verifying. */
  still?: string | null;
  guide?: StageGuide;
  prompt?: StagePrompt | null;
  chip?: StageChip | null;
  progress?: { done: number; total: number; label: string } | null;
  /** Full-tile overlay (spinner, countdown...). */
  overlay?: React.ReactNode;
  /** Increment to flash the tile when a photo is taken. */
  flash?: number;
  promptRef?: React.Ref<HTMLDivElement>;
  className?: string;
}

const GUIDE_CLASS: Record<StageGuide, string> = {
  idle: 'border-white/40 border-dashed',
  searching: 'border-white/70 border-dashed',
  aligned: 'border-presence-available',
  active: 'border-brand-stroke',
  problem: 'border-presence-away',
};

const DOT_CLASS: Record<StageChip['tone'], string> = {
  available: 'bg-presence-available',
  away: 'bg-presence-away',
  busy: 'bg-presence-busy',
  offline: 'bg-presence-offline',
};

/**
 * Camera tile (dark in both themes, like a Teams video tile). The live preview is mirrored
 * so it behaves like a mirror; captured frames are not (see `capture.ts`).
 */
export const CameraStage: React.FC<CameraStageProps> = ({
  videoRef,
  still,
  guide = 'idle',
  prompt,
  chip,
  progress,
  overlay,
  flash = 0,
  promptRef,
  className,
}) => {
  const [flashing, setFlashing] = React.useState(false);
  React.useEffect(() => {
    if (!flash) return;
    setFlashing(true);
    const t = setTimeout(() => setFlashing(false), 140);
    return () => clearTimeout(t);
  }, [flash]);

  const arrow = prompt?.arrow;

  return (
    <div
      className={cn(
        'relative mx-auto aspect-[3/4] w-full max-w-[min(360px,45vh)] min-w-[240px] overflow-hidden rounded-lg bg-black text-white shadow',
        className
      )}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        aria-label="Camera preview"
        className={cn('h-full w-full -scale-x-100 object-cover', still ? 'invisible' : '')}
      />
      {still && (
        <img src={still} alt="" aria-hidden className="absolute inset-0 h-full w-full -scale-x-100 object-cover" />
      )}

      {/* Face guide */}
      <div className="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden>
        <div
          className={cn(
            'h-[58%] w-[66%] rounded-[50%] border-[3px] transition-colors duration-150 ease-fluent-standard',
            GUIDE_CLASS[guide]
          )}
        />
      </div>

      {/* Head-turn arrow on the side to turn towards (mirrored preview) */}
      {arrow && (
        <div
          className={cn(
            'pointer-events-none absolute top-1/2 grid h-16 w-16 -translate-y-1/2 animate-pulse place-items-center rounded-full bg-brand/90 text-brand-on shadow-lg',
            arrow === 'left' ? 'left-3' : 'right-3'
          )}
          aria-hidden
        >
          {arrow === 'left' ? <ArrowLeft48Filled /> : <ArrowRight48Filled />}
        </div>
      )}

      {chip && (
        <div className="pointer-events-none absolute left-3 top-3 z-10 inline-flex max-w-[calc(100%-6rem)] items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-caption-strong">
          <span className={cn('h-2 w-2 shrink-0 rounded-full', DOT_CLASS[chip.tone], chip.pulse && 'animate-pulse')} aria-hidden />
          <span className="truncate">{chip.label}</span>
        </div>
      )}

      {progress && progress.total > 0 && (
        <div
          className="pointer-events-none absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1.5"
          role="img"
          aria-label={progress.label}
        >
          {Array.from({ length: progress.total }).map((_, i) => (
            <span
              key={i}
              className={cn('h-1.5 w-1.5 rounded-full', i < progress.done ? 'bg-presence-available' : 'bg-white/40')}
            />
          ))}
        </div>
      )}

      {/* Prompt (announced politely to screen readers) */}
      <div
        ref={promptRef}
        tabIndex={-1}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={cn(
          'absolute inset-x-3 bottom-3 z-10 rounded-lg bg-black/75 px-3 py-2.5 text-center outline-none',
          !prompt && 'sr-only'
        )}
      >
        {prompt && (
          <>
            <p className="text-subheading">{prompt.title}</p>
            {prompt.detail && <p className="mt-0.5 text-caption text-white/80">{prompt.detail}</p>}
          </>
        )}
      </div>

      <div
        className={cn(
          'pointer-events-none absolute inset-0 z-20 bg-white transition-opacity duration-150',
          flashing ? 'opacity-40' : 'opacity-0'
        )}
        aria-hidden
      />

      {overlay && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/70 px-6 text-center">
          {overlay}
        </div>
      )}
    </div>
  );
};

/** Spinner + text for the stage overlay. */
export const StageBusy: React.FC<{ title: string; detail?: string }> = ({ title, detail }) => (
  <>
    <span className="h-10 w-10 animate-spin rounded-full border-[3px] border-white/25 border-t-brand-stroke" aria-hidden />
    <span className="text-subheading">{title}</span>
    {detail && <span className="text-caption text-white/75">{detail}</span>}
  </>
);

export default CameraStage;
