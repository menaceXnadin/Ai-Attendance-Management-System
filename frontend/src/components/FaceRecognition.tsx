/**
 * Student face check-in (docs/system/face-verification.md §6, §7, §10).
 *
 * 1. Load the public policy; on start create a single-use `checkin` challenge.
 * 2. Mirrored live preview: "Look at the camera" (MediaPipe waits for one centred face),
 *    then "Turn your head to your LEFT/RIGHT" with an arrow.
 * 3. Capture a burst of UNMIRRORED JPEG frames (≤ 640 px): ~2 frontal frames, then the
 *    most-turned frames from the head turn.
 * 4. ONE `mark-attendance` call with frames + challenge + presence code. The server decides
 *    identity, liveness, the session and present/late. No scores are ever shown.
 */
import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowClockwise20Regular,
  Dismiss20Regular,
  ScanPerson24Regular,
  ShieldLock20Regular,
  Video20Regular,
} from '@fluentui/react-icons';
import {
  api,
  getErrorDetailField,
  parseApiError,
  type FaceChallenge,
  type FaceCheckinResult,
} from '@/integrations/api/client';
import {
  checkinRejectionMessage,
  faceQualityHints,
  formatRetryCountdown,
  isRetryableCheckinCode,
} from '@/utils/timeRestrictions';
import { isFreshObservation, useRealFaceDetection, type FaceTrackingStatus } from '@/hooks/useRealFaceDetection';
import { GUIDE, prefetchFaceDetector, type FaceObservation } from '@/services/mediaPipeService';
import CameraStage, { StageBusy, type StageChip, type StageGuide, type StagePrompt } from '@/components/face/CameraStage';
import FaceMessage from '@/components/face/FaceMessage';
import PresenceCodeInput from '@/components/face/PresenceCodeInput';
import { isCompletePresenceCode, normalizePresenceCode } from '@/components/face/presenceCode';
import { captureFrame, sleep, type CapturedFrame } from '@/components/face/capture';
import { useCameraStream, waitForVideo } from '@/components/face/useCameraStream';
import { useFacePolicy } from '@/components/face/faceQueries';
import { cn } from '@/lib/utils';

interface FaceRecognitionProps {
  /** Class being checked in to (the server still picks the open session). */
  subjectId?: string | number | null;
  sessionId?: number | null;
  scheduleId?: number | null;
  /** Small label next to the title, e.g. the class time. */
  contextLabel?: string;
  /** Presence code from the QR link (`?code=`). */
  initialPresenceCode?: string | null;
  disabled?: boolean;
  /** Move focus into the component once it's ready (e.g. when opened inline from a list). */
  autoFocus?: boolean;
  /** Every server answer (success or rejection), e.g. to refresh today's classes. */
  onResult?: (result: FaceCheckinResult) => void;
  /** "Done" after a successful check-in (falls back to `onCancel`). */
  onDone?: () => void;
  onCancel?: () => void;
}

type Phase = 'intro' | 'starting' | 'align' | 'front' | 'turn' | 'verifying' | 'result';

interface Outcome {
  kind: 'success' | 'rejected' | 'error';
  code: string | null;
  title: string;
  message: string;
  hints: string[];
  retryable: boolean;
}

const TERMINAL_TITLES: Record<string, string> = {
  already_recorded: 'Already recorded',
  too_many_attempts: 'Check-in paused',
  window_closed: 'Check-in closed',
  session_cancelled: 'Class cancelled',
  no_registered_face: 'Face not registered',
  liveness_unavailable: 'Face check-in unavailable',
};

const ALIGN_HOLD_MS = 600;
const TIMED_ALIGN_MS = 2000;
const FRONT_GAP_MS = 260;
const TURN_SAMPLE_MS = 180;
const TURN_GUIDED_MAX_MS = 4500;
const TURN_TIMED_MS = 2600;
const TURN_HOLD_AFTER_DETECT_MS = 450;
const MAX_TURN_SAMPLES = 24;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const isAligned = (o: FaceObservation) =>
  o.faceCount === 1 && o.size === 'ok' && o.centered && (o.yaw === null || Math.abs(o.yaw) <= GUIDE.frontalMaxYaw);

const alignmentHint = (o: FaceObservation | null, status: FaceTrackingStatus): string => {
  if (status === 'unavailable') return 'Keep your face inside the oval.';
  if (status !== 'ready') return 'Getting the camera ready…';
  if (!o || o.faceCount === 0) return "We can't see your face yet — centre it in the oval.";
  if (o.faceCount > 1) return 'Make sure only you are in the frame.';
  if (o.size === 'small') return 'Move a little closer.';
  if (o.size === 'large') return 'Move back a little.';
  if (!o.centered) return 'Centre your face in the oval.';
  if (o.yaw !== null && Math.abs(o.yaw) > GUIDE.frontalMaxYaw) return 'Look straight at the camera.';
  return 'Perfect — hold still…';
};

/** Most-turned frames (in the requested direction), in capture order. */
const pickTurnFrames = (samples: CapturedFrame[], sign: number, count: number): CapturedFrame[] => {
  if (samples.length <= count) return samples;
  if (!samples.some((s) => s.yaw !== null)) {
    // No guidance: evenly spaced frames after the reaction time.
    const pool = samples.slice(Math.floor(samples.length * 0.35));
    if (pool.length <= count) return pool;
    return Array.from({ length: count }, (_, i) => pool[Math.floor(((i + 1) * pool.length) / (count + 1))]);
  }
  return samples
    .map((f, i) => ({ f, i, s: f.yaw === null ? -Infinity : f.yaw * sign }))
    .sort((a, b) => b.s - a.s)
    .slice(0, count)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.f);
};

const FaceRecognition = ({
  subjectId,
  sessionId,
  scheduleId,
  contextLabel,
  initialPresenceCode,
  disabled,
  autoFocus,
  onResult,
  onDone,
  onCancel,
}: FaceRecognitionProps) => {
  const policyQuery = useFacePolicy();
  const policy = policyQuery.data;
  const requireTurn = policy?.require_head_turn ?? true;
  const requireCode = policy?.require_presence_code ?? false;

  const camera = useCameraStream();
  const [phase, setPhase] = useState<Phase>('intro');
  const [code, setCode] = useState(() => normalizePresenceCode(initialPresenceCode));
  const [codeFromLink, setCodeFromLink] = useState(() => isCompletePresenceCode(normalizePresenceCode(initialPresenceCode)));
  const [codeError, setCodeError] = useState<string | null>(null);
  const [action, setAction] = useState<FaceChallenge['action'] | null>(null);
  const [captured, setCaptured] = useState(0);
  const [toCapture, setToCapture] = useState(0);
  const [flash, setFlash] = useState(0);
  const [still, setStill] = useState<string | null>(null);
  const [turnFeedback, setTurnFeedback] = useState<'waiting' | 'more' | 'done'>('waiting');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [retryLeft, setRetryLeft] = useState(0);

  const runRef = useRef(0);
  const challengeRef = useRef<{ challenge: FaceChallenge; receivedAt: number } | null>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const promptRef = useRef<HTMLDivElement>(null);
  const resultTitleRef = useRef<HTMLParagraphElement>(null);
  const startButtonRef = useRef<HTMLButtonElement>(null);
  const autoFocusedRef = useRef(false);

  const tracking = useRealFaceDetection({
    videoRef: camera.videoEl,
    active: phase === 'starting' || phase === 'align' || phase === 'front' || phase === 'turn',
  });
  const trackingStatusRef = useRef<FaceTrackingStatus>(tracking.status);
  useEffect(() => {
    trackingStatusRef.current = tracking.status;
  }, [tracking.status]);

  // Download the detector while the student reads the instructions.
  useEffect(() => {
    prefetchFaceDetector();
  }, []);

  // A new QR link (e.g. the page's ?code= changed) replaces the code.
  useEffect(() => {
    const next = normalizePresenceCode(initialPresenceCode);
    if (isCompletePresenceCode(next)) {
      setCode(next);
      setCodeFromLink(true);
      setCodeError(null);
    }
  }, [initialPresenceCode]);

  // Stop async loops on unmount (the camera hook releases the stream).
  useEffect(
    () => () => {
      runRef.current += 1;
    },
    []
  );

  useEffect(() => {
    if (phase === 'result') resultTitleRef.current?.focus();
    if (phase === 'intro' && codeError) codeInputRef.current?.focus();
  }, [phase, codeError]);

  useEffect(() => {
    if (!autoFocus || autoFocusedRef.current || !policy || phase !== 'intro') return;
    autoFocusedRef.current = true;
    if (policy.require_presence_code && !isCompletePresenceCode(code)) codeInputRef.current?.focus();
    else startButtonRef.current?.focus();
  }, [autoFocus, policy, phase, code]);

  useEffect(() => {
    if (retryLeft <= 0) return;
    const t = setTimeout(() => setRetryLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [retryLeft]);

  const fetchChallenge = useCallback(
    () =>
      api.faceRecognition.createChallenge({
        purpose: 'checkin',
        sessionId: sessionId ?? null,
        subjectId: subjectId ?? null,
        scheduleId: scheduleId ?? null,
      }),
    [sessionId, subjectId, scheduleId]
  );

  const showOutcome = useCallback(
    (next: Outcome, retryAfter?: number | null) => {
      runRef.current += 1;
      camera.stop();
      setOutcome(next);
      setRetryLeft(next.code === 'too_many_attempts' ? Math.max(1, Math.ceil(retryAfter ?? 60)) : 0);
      setPhase('result');
    },
    [camera]
  );

  const backToCode = useCallback(
    (message: string) => {
      runRef.current += 1;
      camera.stop();
      setStill(null);
      setCode('');
      setCodeFromLink(false);
      setCodeError(message);
      setOutcome(null);
      setPhase('intro');
    },
    [camera]
  );

  const rejection = useCallback(
    (codeValue: string | null, serverMessage?: string | null, extra: Partial<Outcome> = {}): Outcome => ({
      kind: 'rejected',
      code: codeValue,
      title: (codeValue && TERMINAL_TITLES[codeValue]) || "We couldn't check you in",
      message: checkinRejectionMessage(codeValue, serverMessage),
      hints: [],
      retryable: isRetryableCheckinCode(codeValue),
      ...extra,
    }),
    []
  );

  const failFromError = useCallback(
    (err: unknown) => {
      const info = parseApiError(err);
      if (info.code === 'presence_code_invalid' || info.code === 'presence_code_required') {
        backToCode(checkinRejectionMessage(info.code));
        return;
      }
      if (info.code) {
        showOutcome(rejection(info.code, info.message), getErrorDetailField<number>(info, 'retry_after_seconds'));
        return;
      }
      showOutcome({
        kind: 'error',
        code: null,
        title: "We couldn't check you in",
        message:
          info.status && info.message && info.message !== 'Request failed'
            ? info.message
            : "Couldn't reach the server. Check your connection and try again.",
        hints: [],
        retryable: true,
      });
    },
    [backToCode, rejection, showOutcome]
  );

  const handleResult = useCallback(
    (result: FaceCheckinResult) => {
      if (result.success) {
        const late = result.status === 'late';
        showOutcome({
          kind: 'success',
          code: null,
          title: late ? "You're checked in (late)" : "You're checked in",
          message: late ? 'Your attendance was recorded as late.' : 'Your attendance was recorded as present.',
          hints: [],
          retryable: false,
        });
        return;
      }
      const c = result.code ?? null;
      if (c === 'presence_code_invalid' || c === 'presence_code_required') {
        backToCode(checkinRejectionMessage(c));
        return;
      }
      showOutcome(
        rejection(c, result.message, {
          message: checkinRejectionMessage(c, result.message, result.current_status),
          hints: faceQualityHints(result.quality_issues),
        }),
        result.retry_after_seconds
      );
    },
    [backToCode, rejection, showOutcome]
  );

  /** Burst capture → submit. Runs once the face is aligned (or after the timed fallback). */
  const runCapture = async (run: number) => {
    if (!policy) return;
    const video = () => camera.videoEl.current;
    const alive = () => run === runRef.current;

    let ch = challengeRef.current;
    if (requireTurn) {
      const ttlMs = (ch?.challenge.ttl_seconds ?? 0) * 1000;
      if (!ch || performance.now() - ch.receivedAt > ttlMs - 15000) {
        try {
          const fresh = await fetchChallenge();
          ch = { challenge: fresh, receivedAt: performance.now() };
          challengeRef.current = ch;
          setAction(fresh.action);
        } catch (err) {
          if (alive()) failFromError(err);
          return;
        }
        if (!alive()) return;
      }
    }

    const framesMin = ch?.challenge.frames_min ?? policy.frames_min;
    const framesMax = Math.max(1, ch?.challenge.frames_max ?? policy.frames_max);
    const frontTarget = requireTurn
      ? clamp(Math.min(2, framesMax - 1), 1, framesMax)
      : clamp(Math.max(2, framesMin), 1, framesMax);
    const turnBudget = framesMax - frontTarget;
    const turnTarget = requireTurn ? clamp(Math.max(framesMin - frontTarget, Math.min(4, turnBudget)), 1, Math.max(1, turnBudget)) : 0;
    setToCapture(frontTarget + turnTarget);
    setCaptured(0);
    setPhase('front');

    const front: CapturedFrame[] = [];
    for (let i = 0; i < frontTarget; i++) {
      const obs = tracking.observationRef.current;
      const frame = captureFrame(video(), isFreshObservation(obs) ? obs.yaw : null);
      if (frame) {
        front.push(frame);
        setCaptured((n) => n + 1);
        setFlash((n) => n + 1);
      }
      await sleep(FRONT_GAP_MS);
      if (!alive()) return;
    }
    if (front.length === 0) {
      showOutcome({
        kind: 'error',
        code: null,
        title: "We couldn't check you in",
        message: 'The camera stopped sending video. Please try again.',
        hints: [],
        retryable: true,
      });
      return;
    }

    let turnFrames: CapturedFrame[] = [];
    if (requireTurn && ch) {
      const sign = ch.challenge.action === 'turn_right' ? -1 : 1;
      const guided = trackingStatusRef.current === 'ready';
      setTurnFeedback('waiting');
      setPhase('turn');
      const samples: CapturedFrame[] = [];
      const t0 = performance.now();
      let detectedAt: number | null = null;
      let best = -Infinity;
      while (alive()) {
        const obs = tracking.observationRef.current;
        const yaw = isFreshObservation(obs) ? obs.yaw : null;
        const frame = captureFrame(video(), yaw);
        if (frame) {
          samples.push(frame);
          if (samples.length > MAX_TURN_SAMPLES) {
            // Drop the least-turned sample to bound memory.
            const score = (f: CapturedFrame) => (f.yaw === null ? -Infinity : f.yaw * sign);
            let worst = 0;
            samples.forEach((f, i) => {
              if (score(f) < score(samples[worst])) worst = i;
            });
            samples.splice(worst, 1);
          }
        }
        if (yaw !== null) {
          const s = yaw * sign;
          best = Math.max(best, s);
          if (s >= GUIDE.turnMinYaw && detectedAt === null) {
            detectedAt = performance.now();
            setTurnFeedback('done');
          } else if (s >= GUIDE.noTurnYaw && detectedAt === null) {
            setTurnFeedback('more');
          }
        }
        const now = performance.now();
        if (detectedAt !== null && now - detectedAt >= TURN_HOLD_AFTER_DETECT_MS) break;
        if (now - t0 >= (guided ? TURN_GUIDED_MAX_MS : TURN_TIMED_MS)) break;
        await sleep(TURN_SAMPLE_MS);
      }
      if (!alive()) return;
      if (guided && best > -Infinity && best < GUIDE.noTurnYaw) {
        // Clearly no head turn: don't spend a server attempt on it.
        const dir = sign > 0 ? 'left' : 'right';
        showOutcome({
          kind: 'rejected',
          code: null,
          title: "We didn't see your head turn",
          message: `When the arrow appears, turn your head to your ${dir} and hold it for a moment.`,
          hints: [],
          retryable: true,
        });
        return;
      }
      turnFrames = pickTurnFrames(samples, sign, turnTarget);
      setCaptured(front.length + turnFrames.length);
    }

    setStill(front[0].dataUrl);
    camera.stop();
    setPhase('verifying');
    try {
      const result = await api.faceRecognition.markAttendance(
        [...front, ...turnFrames].map((f) => f.base64),
        {
          subjectId: subjectId ?? undefined,
          sessionId: sessionId ?? null,
          scheduleId: scheduleId ?? null,
          challengeId: ch?.challenge.challenge_id ?? null,
          presenceCode: requireCode ? code : null,
        }
      );
      if (!alive()) return;
      challengeRef.current = null; // single use
      onResult?.(result);
      handleResult(result);
    } catch (err) {
      if (!alive()) return;
      challengeRef.current = null;
      failFromError(err);
    }
  };
  // The align loop always calls the latest closure (current code, policy, class).
  const runCaptureRef = useRef(runCapture);
  useEffect(() => {
    runCaptureRef.current = runCapture;
  });

  // Step 1: wait for one centred, frontal face (or a short timed fallback without guidance).
  useEffect(() => {
    if (phase !== 'align') return;
    const run = runRef.current;
    const t0 = performance.now();
    let alignedSince: number | null = null;
    const timer = setInterval(() => {
      if (run !== runRef.current) return;
      const now = performance.now();
      const status = trackingStatusRef.current;
      const timed = status === 'unavailable' || (status === 'loading' && now - t0 > 8000);
      if (status === 'ready') {
        const obs = tracking.observationRef.current;
        if (isFreshObservation(obs) && isAligned(obs)) {
          alignedSince = alignedSince ?? now;
          if (now - alignedSince >= ALIGN_HOLD_MS) {
            clearInterval(timer);
            void runCaptureRef.current(run);
          }
        } else {
          alignedSince = null;
        }
      } else if (timed && now - t0 >= TIMED_ALIGN_MS) {
        clearInterval(timer);
        void runCaptureRef.current(run);
      }
    }, 100);
    return () => clearInterval(timer);
  }, [phase, tracking.observationRef]);

  const begin = async () => {
    if (!policy || disabled) return;
    if (requireCode && !isCompletePresenceCode(code)) {
      setCodeError('Enter the 6-digit code shown in class.');
      codeInputRef.current?.focus();
      return;
    }
    const run = ++runRef.current;
    setCodeError(null);
    setOutcome(null);
    setStill(null);
    setCaptured(0);
    setToCapture(0);
    setAction(null);
    setTurnFeedback('waiting');
    challengeRef.current = null;
    setPhase('starting');

    const challengePromise = requireTurn
      ? fetchChallenge().then(
          (c) => ({ ok: true as const, c }),
          (e: unknown) => ({ ok: false as const, e })
        )
      : Promise.resolve(null);
    const cam = await camera.start();
    const ch = await challengePromise;
    if (run !== runRef.current) return;
    if (!cam.ok) {
      showOutcome({
        kind: 'error',
        code: null,
        title: "The camera didn't start",
        message: cam.error ?? "Couldn't start the camera.",
        hints: [],
        retryable: true,
      });
      return;
    }
    if (ch && !ch.ok) {
      failFromError(ch.e);
      return;
    }
    if (ch?.ok) {
      challengeRef.current = { challenge: ch.c, receivedAt: performance.now() };
      setAction(ch.c.action);
    }
    const ready = await waitForVideo(() => camera.videoEl.current);
    if (run !== runRef.current) return;
    if (!ready) {
      showOutcome({
        kind: 'error',
        code: null,
        title: "The camera didn't start",
        message: "The camera didn't send any video. Close other apps using it and try again.",
        hints: [],
        retryable: true,
      });
      return;
    }
    setPhase('align');
    promptRef.current?.focus();
  };

  const cancelCamera = () => {
    runRef.current += 1;
    camera.stop();
    setStill(null);
    setPhase('intro');
    onCancel?.();
  };

  // ---------------------------------------------------------------- render helpers
  const obs = tracking.observation;
  const dirWord = action === 'turn_right' ? 'RIGHT' : 'LEFT';
  const inCamera = phase === 'starting' || phase === 'align' || phase === 'front' || phase === 'turn' || phase === 'verifying';

  let prompt: StagePrompt | null = null;
  let guide: StageGuide = 'idle';
  let chip: StageChip | null = null;
  let overlay: React.ReactNode = null;
  if (phase === 'starting') {
    overlay = <StageBusy title="Starting camera…" detail="Allow camera access if your browser asks." />;
  } else if (phase === 'align') {
    const aligned = !!obs && isAligned(obs);
    prompt = { title: 'Look at the camera', detail: alignmentHint(obs, tracking.status) };
    guide = tracking.status !== 'ready' ? 'searching' : aligned ? 'aligned' : obs && obs.faceCount > 0 ? 'problem' : 'searching';
    chip =
      tracking.status === 'loading'
        ? { label: 'Loading face guide', tone: 'away', pulse: true }
        : tracking.status === 'unavailable'
          ? { label: 'Camera on', tone: 'available' }
          : obs && obs.faceCount > 0
            ? { label: obs.faceCount > 1 ? 'Several faces' : 'Face found', tone: obs.faceCount > 1 ? 'busy' : 'available' }
            : { label: 'No face yet', tone: 'offline' };
  } else if (phase === 'front') {
    prompt = { title: 'Hold still', detail: 'Taking photos…' };
    guide = 'active';
    chip = { label: 'Capturing', tone: 'busy', pulse: true };
  } else if (phase === 'turn') {
    prompt = {
      title: `Turn your head to your ${dirWord}`,
      detail:
        turnFeedback === 'done'
          ? 'Great — hold it there'
          : turnFeedback === 'more'
            ? 'A little more…'
            : 'Follow the arrow, keep your face in view',
      arrow: action === 'turn_right' ? 'right' : 'left',
    };
    guide = turnFeedback === 'done' ? 'aligned' : 'active';
    chip = { label: 'Capturing', tone: 'busy', pulse: true };
  } else if (phase === 'verifying') {
    overlay = <StageBusy title="Checking…" detail="Verifying it's you and recording your attendance." />;
  }

  const progress =
    (phase === 'front' || phase === 'turn') && toCapture > 0
      ? { done: Math.min(captured, toCapture), total: toCapture, label: `${Math.min(captured, toCapture)} of ${toCapture} photos taken` }
      : null;

  const stepIndex = phase === 'turn' ? 1 : 0;
  const steps = requireTurn ? ['Look at the camera', 'Turn your head'] : ['Look at the camera'];

  return (
    <Card className="overflow-hidden border-border-subtle bg-surface-default shadow">
      <CardHeader className="space-y-0 border-b border-border-subtle px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-brand-subtle text-brand-foreground">
            <ScanPerson24Regular aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="flex flex-wrap items-center gap-2 text-subheading text-text-primary">
              Face check-in
              {contextLabel && (
                <span className="rounded-md border border-border-subtle bg-surface-subtle px-2 py-0.5 text-caption text-text-secondary">
                  {contextLabel}
                </span>
              )}
            </CardTitle>
            <CardDescription className="mt-0.5 text-caption text-text-muted">
              {requireTurn
                ? 'Look at the camera, then turn your head when the arrow appears.'
                : 'Look at the camera while a few photos are taken.'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4 sm:p-5">
        {policyQuery.isLoading ? (
          <div className="flex items-center justify-center gap-3 py-10 text-body text-text-secondary" role="status">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-subtle border-t-brand" aria-hidden />
            Loading check-in settings…
          </div>
        ) : policyQuery.isError || !policy ? (
          <FaceMessage
            tone="error"
            title="Couldn't load check-in settings"
            actions={
              <Button size="sm" variant="outline" onClick={() => void policyQuery.refetch()}>
                <ArrowClockwise20Regular aria-hidden />
                Retry
              </Button>
            }
          >
            Face check-in stays closed until the settings load.
          </FaceMessage>
        ) : phase === 'intro' ? (
          <div className="space-y-5">
            {requireCode && (
              <PresenceCodeInput
                ref={codeInputRef}
                value={code}
                onChange={(v) => {
                  setCode(v);
                  setCodeFromLink(false);
                  if (codeError && isCompletePresenceCode(v)) setCodeError(null);
                }}
                error={codeError}
                periodSeconds={policy.presence_code_period_seconds}
                fromLink={codeFromLink}
                disabled={disabled}
                onSubmit={() => void begin()}
              />
            )}
            {!requireCode && codeError && <FaceMessage tone="error">{codeError}</FaceMessage>}

            <ol className="space-y-3" aria-label="How face check-in works">
              {[
                { t: 'Find good light', d: 'Face a light source and remove sunglasses, masks or hats.' },
                { t: 'Look at the camera', d: 'Keep your face inside the oval while the first photos are taken.' },
                ...(requireTurn
                  ? [{ t: 'Turn your head when asked', d: 'An arrow shows which way. Turn, then hold for a moment.' }]
                  : []),
              ].map((s, i) => (
                <li key={s.t} className="flex items-start gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-subtle text-caption-strong tabular-nums text-brand-foreground">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-body-strong text-text-primary">{s.t}</p>
                    <p className="text-caption text-text-muted">{s.d}</p>
                  </div>
                </li>
              ))}
            </ol>

            <p className="flex items-start gap-2 text-caption text-text-muted">
              <ShieldLock20Regular className="shrink-0 text-text-muted" aria-hidden />
              The photos are only used to confirm it's you and are not stored.
            </p>

            <div className="flex flex-col-reverse gap-2 border-t border-border-subtle pt-4 sm:flex-row sm:justify-end">
              {onCancel && (
                <Button variant="ghost" onClick={onCancel} className="text-text-secondary">
                  <Dismiss20Regular aria-hidden />
                  Cancel
                </Button>
              )}
              <Button ref={startButtonRef} onClick={() => void begin()} disabled={disabled} className="sm:min-w-[160px]">
                <Video20Regular aria-hidden />
                Start camera
              </Button>
            </div>
          </div>
        ) : inCamera ? (
          <div className="space-y-4">
            <CameraStage
              videoRef={camera.videoRef}
              still={phase === 'verifying' ? still : null}
              guide={guide}
              prompt={prompt}
              chip={chip}
              progress={progress}
              overlay={overlay}
              flash={flash}
              promptRef={promptRef}
            />
            {phase !== 'starting' && phase !== 'verifying' && (
              <ol className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1" aria-label="Check-in steps">
                {steps.map((label, i) => {
                  const state = i < stepIndex ? 'done' : i === stepIndex ? 'current' : 'upcoming';
                  return (
                    <li key={label} className="flex items-center gap-2" aria-current={state === 'current' ? 'step' : undefined}>
                      <span
                        className={cn(
                          'grid h-5 w-5 place-items-center rounded-full text-caption-strong tabular-nums',
                          state === 'current' && 'bg-brand text-brand-on',
                          state === 'done' && 'bg-status-success-subtle text-status-success',
                          state === 'upcoming' && 'border border-border-default text-text-muted'
                        )}
                      >
                        {i + 1}
                      </span>
                      <span className={cn('text-caption', state === 'current' ? 'text-text-primary' : 'text-text-muted')}>{label}</span>
                    </li>
                  );
                })}
              </ol>
            )}
            {phase !== 'verifying' && (
              <div className="flex justify-center">
                <Button variant="outline" onClick={cancelCamera}>
                  <Dismiss20Regular aria-hidden />
                  Cancel
                </Button>
              </div>
            )}
          </div>
        ) : outcome ? (
          <div className="space-y-4">
            <FaceMessage
              tone={
                outcome.kind === 'success'
                  ? 'success'
                  : outcome.code === 'already_recorded'
                    ? 'info'
                    : outcome.retryable || outcome.code === 'too_many_attempts'
                      ? 'warning'
                      : 'error'
              }
              role={outcome.kind === 'success' || outcome.code === 'already_recorded' ? 'status' : 'alert'}
              title={outcome.title}
              titleRef={resultTitleRef}
            >
              <p>{outcome.message}</p>
              {outcome.hints.length > 0 && (
                <ul className="mt-1.5 list-disc space-y-0.5 pl-5 marker:text-text-muted">
                  {outcome.hints.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              )}
              {outcome.code === 'too_many_attempts' && (
                <p className="mt-1 tabular-nums">
                  {retryLeft > 0 ? (
                    <>
                      You can try again in <span aria-hidden>{formatRetryCountdown(retryLeft)}</span>
                      <span className="sr-only">a few minutes</span>.
                    </>
                  ) : (
                    'You can try again now.'
                  )}
                </p>
              )}
              {outcome.code === 'no_registered_face' && (
                <p className="mt-1">
                  <Link to="/face-registration" className="text-brand-foreground underline-offset-2 hover:underline">
                    Register your face
                  </Link>
                </p>
              )}
            </FaceMessage>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {outcome.kind === 'success' ? (
                (onDone || onCancel) && <Button onClick={onDone ?? onCancel}>Done</Button>
              ) : (
                <>
                  {onCancel && (
                    <Button variant="ghost" onClick={onCancel} className="text-text-secondary">
                      Close
                    </Button>
                  )}
                  {(outcome.retryable || outcome.code === 'too_many_attempts') && (
                    <Button onClick={() => void begin()} disabled={disabled || (outcome.code === 'too_many_attempts' && retryLeft > 0)}>
                      <ArrowClockwise20Regular aria-hidden />
                      Try again
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default FaceRecognition;
