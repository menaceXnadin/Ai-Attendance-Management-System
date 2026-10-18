/**
 * Student face enrolment (docs/system/face-verification.md §8, §10).
 *
 * Consent → single-use `enrolment` challenge (when a head turn is required) → guided capture
 * of front → turned left → turned right (MediaPipe auto-captures after a short hold, with a
 * manual "Capture now" fallback) → ONE `register-face-multi` call with ALL images.
 * The server verifies quality, poses, liveness and duplicates.
 */
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  ArrowClockwise20Regular,
  Camera20Regular,
  CheckmarkCircle48Filled,
  Dismiss20Regular,
  Lightbulb20Regular,
  ScanPerson24Regular,
  ShieldLock20Regular,
  Video20Regular,
} from '@fluentui/react-icons';
import { api, parseApiError, type FaceEnrollResult } from '@/integrations/api/client';
import { isFreshObservation, useRealFaceDetection, type FaceTrackingStatus } from '@/hooks/useRealFaceDetection';
import { GUIDE, prefetchFaceDetector, type FaceObservation } from '@/services/mediaPipeService';
import CameraStage, { StageBusy, type StageChip, type StageGuide, type StagePrompt } from '@/components/face/CameraStage';
import FaceMessage from '@/components/face/FaceMessage';
import { captureFrame, sleep, type CapturedFrame } from '@/components/face/capture';
import { useCameraStream, waitForVideo } from '@/components/face/useCameraStream';
import { useFacePolicy } from '@/components/face/faceQueries';
import { describeEnrolmentError, type EnrolmentErrorView, type EnrolPose } from '@/components/face/enrolmentMessages';
import { cn } from '@/lib/utils';

interface FaceRegistrationProps {
  /** An administrator reset this student's face registration. */
  resetByAdmin?: boolean;
  /** "Done" after a successful enrolment. */
  onSuccess?: (result: FaceEnrollResult) => void;
  onCancel?: () => void;
  /** The server said the state changed (already enrolled / locked): re-read it. */
  onStateChanged?: () => void;
}

type Phase = 'consent' | 'starting' | 'capture' | 'submitting' | 'success' | 'error';

interface PoseFrame extends CapturedFrame {
  pose: EnrolPose;
}

const POSE_META: Record<EnrolPose, { short: string; title: string; arrow: 'left' | 'right' | null }> = {
  front: { short: 'Straight', title: 'Look straight at the camera', arrow: null },
  left: { short: 'Left', title: 'Turn your head to your LEFT', arrow: 'left' },
  right: { short: 'Right', title: 'Turn your head to your RIGHT', arrow: 'right' },
};

const HOLD_MS = 700;
/** Turned poses are captured sooner, before the student keeps turning towards a profile. */
const TURN_HOLD_MS = 350;
const TIMED_POSE_MS = 3000;
const BURST_GAP_MS = 280;
const MAX_IMAGES = 8;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const poseOk = (o: FaceObservation, pose: EnrolPose): boolean => {
  if (o.faceCount !== 1 || o.size === 'small' || o.size === 'large') return false;
  if (pose === 'front') return o.centered && (o.yaw === null || Math.abs(o.yaw) <= GUIDE.frontalMaxYaw);
  if (o.yaw === null || Math.abs(o.offsetX) > 0.25) return false;
  const s = pose === 'left' ? o.yaw : -o.yaw;
  return s >= GUIDE.turnMinYaw && s <= GUIDE.turnMaxYaw;
};

const poseHint = (o: FaceObservation | null, pose: EnrolPose, status: FaceTrackingStatus): string => {
  if (status === 'loading') return 'Getting the camera ready…';
  if (status !== 'ready') return pose === 'front' ? 'Keep your face inside the oval.' : 'Keep your eyes on the screen.';
  if (!o || o.faceCount === 0) return "We can't see your face — keep it inside the oval.";
  if (o.faceCount > 1) return 'Make sure only you are in the frame.';
  if (o.size === 'small') return 'Move a little closer.';
  if (o.size === 'large') return 'Move back a little.';
  if (pose === 'front') {
    if (!o.centered) return 'Centre your face in the oval.';
    if (o.yaw !== null && Math.abs(o.yaw) > GUIDE.frontalMaxYaw) return 'Look straight at the camera.';
    return 'Perfect — hold still…';
  }
  const s = o.yaw === null ? 0 : o.yaw * (pose === 'left' ? 1 : -1);
  if (s < GUIDE.noTurnYaw) return 'Turn slowly, keep your eyes on the screen.';
  if (s < GUIDE.turnMinYaw) return 'A little more…';
  if (s > GUIDE.turnMaxYaw) return 'Not that far — turn back a little, about halfway.';
  return 'Great — hold it there…';
};

const FaceRegistration: React.FC<FaceRegistrationProps> = ({ resetByAdmin, onSuccess, onCancel, onStateChanged }) => {
  const policyQuery = useFacePolicy();
  const policy = policyQuery.data;
  const requireTurn = policy?.require_head_turn ?? true;

  const camera = useCameraStream();
  const [phase, setPhase] = useState<Phase>('consent');
  const [consent, setConsent] = useState(false);
  const [poses, setPoses] = useState<EnrolPose[]>(['front', 'left', 'right']);
  const [counts, setCounts] = useState<number[]>([2, 2, 2]);
  const [poseIndex, setPoseIndex] = useState(0);
  const [frames, setFrames] = useState<PoseFrame[]>([]);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(0);
  const [poseStartedAt, setPoseStartedAt] = useState(0);
  const [now, setNow] = useState(() => performance.now());
  const [manualHint, setManualHint] = useState<string | null>(null);
  const [error, setError] = useState<EnrolmentErrorView | null>(null);
  const [result, setResult] = useState<FaceEnrollResult | null>(null);

  const runRef = useRef(0);
  const busyRef = useRef(false);
  const framesRef = useRef<PoseFrame[]>([]);
  const challengeIdRef = useRef<string | null>(null);
  const promptRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLParagraphElement>(null);

  const tracking = useRealFaceDetection({
    videoRef: camera.videoEl,
    active: phase === 'starting' || phase === 'capture',
  });
  const trackingStatusRef = useRef<FaceTrackingStatus>(tracking.status);
  useEffect(() => {
    trackingStatusRef.current = tracking.status;
  }, [tracking.status]);

  useEffect(() => {
    prefetchFaceDetector();
    return () => {
      runRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (phase === 'error' || phase === 'success') resultRef.current?.focus();
  }, [phase]);

  const totalTarget = counts.reduce((a, b) => a + b, 0);
  const pose = poses[Math.min(poseIndex, poses.length - 1)];

  const fail = (view: EnrolmentErrorView) => {
    runRef.current += 1;
    busyRef.current = false;
    setBusy(false);
    camera.stop();
    setError(view);
    setPhase('error');
    if (view.refreshState) onStateChanged?.();
  };

  const submit = async (run: number) => {
    const all = framesRef.current;
    setPhase('submitting');
    camera.stop();
    try {
      const res = await api.faceRecognition.enroll(
        all.map((f) => f.base64),
        { consent: true, challengeId: challengeIdRef.current }
      );
      if (run !== runRef.current) return;
      challengeIdRef.current = null;
      setResult(res);
      setPhase('success');
    } catch (err) {
      if (run !== runRef.current) return;
      challengeIdRef.current = null; // consumed whatever the outcome
      const view = describeEnrolmentError(parseApiError(err), all.map((f) => f.pose));
      if (view.needsConsent) {
        setConsent(false);
        setError(view);
        setPhase('consent');
        return;
      }
      fail(view);
    }
  };

  /** Captures this pose's frames, then moves on (or submits after the last pose). */
  const captureBurst = async (run: number, index: number) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setManualHint(null);
    const p = poses[index];
    for (let i = 0; i < counts[index]; i++) {
      let obs = tracking.observationRef.current;
      // Guided: wait (briefly) until the pose is back in range, e.g. after turning too far.
      for (let waited = 0; waited < 1500 && isFreshObservation(obs) && !poseOk(obs, p); waited += 100) {
        await sleep(100);
        if (run !== runRef.current) return;
        obs = tracking.observationRef.current;
      }
      const frame = captureFrame(camera.videoEl.current, isFreshObservation(obs) ? obs.yaw : null);
      if (frame) {
        framesRef.current = [...framesRef.current, { ...frame, pose: p }].slice(0, MAX_IMAGES);
        setFrames(framesRef.current);
        setFlash((n) => n + 1);
      }
      await sleep(BURST_GAP_MS);
      if (run !== runRef.current) return;
    }
    busyRef.current = false;
    setBusy(false);
    if (!framesRef.current.some((f) => f.pose === p)) {
      fail({
        code: null,
        title: "The camera didn't take any photos",
        message: 'The camera stopped sending video. Please try again.',
        details: [],
        retryable: true,
        needsConsent: false,
        refreshState: false,
      });
      return;
    }
    if (index + 1 < poses.length) {
      setPoseIndex(index + 1);
      setPoseStartedAt(performance.now());
    } else {
      void submit(run);
    }
  };
  const captureBurstRef = useRef(captureBurst);
  useEffect(() => {
    captureBurstRef.current = captureBurst;
  });

  // Auto-capture each pose after a short steady hold (or a timed countdown without guidance).
  useEffect(() => {
    if (phase !== 'capture') return;
    const run = runRef.current;
    const t0 = performance.now();
    let holdSince: number | null = null;
    const timer = setInterval(() => {
      if (run !== runRef.current || busyRef.current) return;
      const tNow = performance.now();
      setNow(tNow);
      const status = trackingStatusRef.current;
      if (status === 'ready') {
        const obs = tracking.observationRef.current;
        if (isFreshObservation(obs) && poseOk(obs, poses[poseIndex])) {
          holdSince = holdSince ?? tNow;
          if (tNow - holdSince >= (poses[poseIndex] === 'front' ? HOLD_MS : TURN_HOLD_MS)) {
            holdSince = null;
            void captureBurstRef.current(run, poseIndex);
          }
        } else {
          holdSince = null;
        }
      } else if (status === 'unavailable' || (status === 'loading' && tNow - t0 > 8000)) {
        if (tNow - t0 >= TIMED_POSE_MS) void captureBurstRef.current(run, poseIndex);
      }
    }, 100);
    return () => clearInterval(timer);
  }, [phase, poseIndex, poses, tracking.observationRef]);

  const start = async () => {
    if (!policy || !consent) return;
    const run = ++runRef.current;
    const plan: EnrolPose[] = requireTurn ? ['front', 'left', 'right'] : ['front'];
    const target = clamp(Math.max(policy.enrolment_min_images, requireTurn ? 6 : 3), policy.enrolment_min_images, MAX_IMAGES);
    const base = Math.floor(target / plan.length);
    const rem = target % plan.length;
    setPoses(plan);
    setCounts(plan.map((_, i) => base + (i === 0 ? rem : 0)));
    setPoseIndex(0);
    framesRef.current = [];
    setFrames([]);
    setError(null);
    setResult(null);
    setManualHint(null);
    busyRef.current = false;
    setBusy(false);
    challengeIdRef.current = null;
    setPhase('starting');

    const challengePromise = requireTurn
      ? api.faceRecognition.createChallenge({ purpose: 'enrolment' }).then(
          (c) => ({ ok: true as const, id: c.challenge_id }),
          (e: unknown) => ({ ok: false as const, e })
        )
      : Promise.resolve(null);
    const cam = await camera.start();
    const ch = await challengePromise;
    if (run !== runRef.current) return;
    if (!cam.ok) {
      fail({
        code: null,
        title: "The camera didn't start",
        message: cam.error ?? "Couldn't start the camera.",
        details: [],
        retryable: true,
        needsConsent: false,
        refreshState: false,
      });
      return;
    }
    if (ch && !ch.ok) {
      fail(describeEnrolmentError(parseApiError(ch.e)));
      return;
    }
    challengeIdRef.current = ch?.ok ? ch.id : null;
    const ready = await waitForVideo(() => camera.videoEl.current);
    if (run !== runRef.current) return;
    if (!ready) {
      fail({
        code: null,
        title: "The camera didn't start",
        message: "The camera didn't send any video. Close other apps using it and try again.",
        details: [],
        retryable: true,
        needsConsent: false,
        refreshState: false,
      });
      return;
    }
    setPoseStartedAt(performance.now());
    setPhase('capture');
    promptRef.current?.focus();
  };

  const manualCapture = () => {
    if (phase !== 'capture' || busyRef.current) return;
    const obs = tracking.observationRef.current;
    if (tracking.status === 'ready' && isFreshObservation(obs)) {
      if (obs.faceCount === 0) {
        setManualHint("We can't see your face. Keep it inside the oval, then capture.");
        return;
      }
      if (obs.faceCount > 1) {
        setManualHint('More than one face is in view. Make sure only you are in the frame.');
        return;
      }
    }
    void captureBurst(runRef.current, poseIndex);
  };

  const cancel = () => {
    runRef.current += 1;
    busyRef.current = false;
    camera.stop();
    setBusy(false);
    setPhase('consent');
    onCancel?.();
  };

  // ---------------------------------------------------------------- render
  const obs = tracking.observation;
  const thumbs = poses.map((p) => frames.find((f) => f.pose === p) ?? null);
  const timed = tracking.status === 'unavailable';
  const struggling = phase === 'capture' && now - poseStartedAt > 6000;

  let prompt: StagePrompt | null = null;
  let guide: StageGuide = 'idle';
  let chip: StageChip | null = null;
  let overlay: React.ReactNode = null;
  if (phase === 'starting') {
    overlay = <StageBusy title="Starting camera…" detail="Allow camera access if your browser asks." />;
  } else if (phase === 'capture') {
    const meta = POSE_META[pose];
    const countdown = timed ? Math.max(1, Math.ceil((TIMED_POSE_MS - (now - poseStartedAt)) / 1000)) : null;
    prompt = {
      title: meta.title,
      detail: busy ? 'Taking photos — hold still' : countdown ? `Photo in ${countdown}…` : poseHint(obs, pose, tracking.status),
      arrow: meta.arrow,
    };
    const ok = !!obs && poseOk(obs, pose);
    guide = busy ? 'active' : tracking.status !== 'ready' ? 'searching' : ok ? 'aligned' : obs && obs.faceCount > 0 ? 'problem' : 'searching';
    chip = busy
      ? { label: 'Capturing', tone: 'busy', pulse: true }
      : tracking.status === 'loading'
        ? { label: 'Loading face guide', tone: 'away', pulse: true }
        : timed
          ? { label: 'Camera on', tone: 'available' }
          : obs && obs.faceCount > 0
            ? { label: obs.faceCount > 1 ? 'Several faces' : 'Face found', tone: obs.faceCount > 1 ? 'busy' : 'available' }
            : { label: 'No face yet', tone: 'offline' };
  }

  const poseStrip = (
    <ol className="grid grid-cols-3 gap-2" aria-label="Photos to take">
      {poses.map((p, i) => {
        const thumb = thumbs[i];
        const state = thumb ? 'done' : phase === 'capture' && i === poseIndex ? 'current' : 'upcoming';
        return (
          <li key={p} aria-current={state === 'current' ? 'step' : undefined} className="min-w-0">
            <div
              className={cn(
                'relative aspect-[3/4] overflow-hidden rounded-md border bg-surface-subtle',
                state === 'current' ? 'border-brand-stroke' : 'border-border-subtle'
              )}
            >
              {thumb ? (
                <img src={thumb.dataUrl} alt={`Photo ${POSE_META[p].short.toLowerCase()}`} className="h-full w-full -scale-x-100 object-cover" />
              ) : (
                <span className="grid h-full w-full place-items-center text-caption tabular-nums text-text-muted">{i + 1}</span>
              )}
            </div>
            <p className={cn('mt-1 truncate text-center text-caption', state === 'current' ? 'text-text-primary' : 'text-text-muted')}>
              {POSE_META[p].short}
              {state === 'done' && <span className="sr-only"> (taken)</span>}
            </p>
          </li>
        );
      })}
    </ol>
  );

  return (
    <Card className="mx-auto w-full max-w-2xl overflow-hidden border-border-subtle bg-surface-default shadow">
      <CardHeader className="space-y-0 border-b border-border-subtle px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-brand-subtle text-brand-foreground">
              <ScanPerson24Regular aria-hidden />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-subheading text-text-primary">Register your face</CardTitle>
              <CardDescription className="mt-0.5 text-caption text-text-muted">
                {requireTurn ? 'Three quick photos: straight, turned left, turned right.' : 'A few quick photos looking at the camera.'}
              </CardDescription>
            </div>
          </div>
          {onCancel && phase !== 'submitting' && (
            <Button variant="ghost" size="icon-sm" onClick={cancel} aria-label="Close face registration" className="text-text-secondary">
              <Dismiss20Regular aria-hidden />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4 sm:p-5">
        {policyQuery.isLoading ? (
          <div className="flex items-center justify-center gap-3 py-10 text-body text-text-secondary" role="status">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-subtle border-t-brand" aria-hidden />
            Loading registration settings…
          </div>
        ) : policyQuery.isError || !policy ? (
          <FaceMessage
            tone="error"
            title="Couldn't load registration settings"
            actions={
              <Button size="sm" variant="outline" onClick={() => void policyQuery.refetch()}>
                <ArrowClockwise20Regular aria-hidden />
                Retry
              </Button>
            }
          >
            Try again in a moment.
          </FaceMessage>
        ) : phase === 'consent' ? (
          <div className="space-y-5">
            {resetByAdmin && (
              <FaceMessage tone="info" role="none" title="Your face registration was reset">
                An administrator reset your face registration. Register again to use face check-in.
              </FaceMessage>
            )}
            {error?.needsConsent && <FaceMessage tone="warning">{error.message}</FaceMessage>}

            <section aria-labelledby="face-consent-heading" className="space-y-3">
              <h3 id="face-consent-heading" className="flex items-center gap-2 text-body-strong text-text-primary">
                <ShieldLock20Regular className="shrink-0 text-brand-foreground" aria-hidden />
                How your face data is used
              </h3>
              <ul className="space-y-2 text-body text-text-secondary">
                <li>
                  <span className="text-body-strong text-text-primary">What we keep: </span>
                  a numeric face template (a list of numbers that describes your face). Your photos are not stored.
                </li>
                <li>
                  <span className="text-body-strong text-text-primary">What it's for: </span>
                  only to confirm it's you when you check in to class.
                </li>
                <li>
                  <span className="text-body-strong text-text-primary">Your choice: </span>
                  you can delete your face data at any time on this page.
                </li>
              </ul>
            </section>

            <div className="rounded-md border border-border-subtle bg-surface-subtle px-3 py-2.5">
              <p className="flex items-center gap-2 text-caption-strong text-text-secondary">
                <Lightbulb20Regular className="shrink-0 text-text-muted" aria-hidden />
                For the best result
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-8 text-caption text-text-secondary marker:text-text-muted">
                <li>Face a light source; avoid a bright window behind you.</li>
                <li>Remove sunglasses, masks or hats.</li>
                <li>Make sure only you are in view.</li>
              </ul>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox id="face-consent" checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
              <Label htmlFor="face-consent" className="text-body text-text-primary">
                I agree to AttendAI storing a face template of me, used only for attendance check-in.
              </Label>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-border-subtle pt-4 sm:flex-row sm:justify-end">
              {onCancel && (
                <Button variant="ghost" onClick={cancel} className="text-text-secondary">
                  Cancel
                </Button>
              )}
              <Button onClick={() => void start()} disabled={!consent} className="sm:min-w-[160px]">
                <Video20Regular aria-hidden />
                Start camera
              </Button>
            </div>
          </div>
        ) : phase === 'starting' || phase === 'capture' ? (
          <div className="space-y-4">
            <CameraStage
              videoRef={camera.videoRef}
              guide={guide}
              prompt={prompt}
              chip={chip}
              overlay={overlay}
              flash={flash}
              promptRef={promptRef}
              progress={
                phase === 'capture'
                  ? { done: frames.length, total: totalTarget, label: `${frames.length} of ${totalTarget} photos taken` }
                  : null
              }
            />
            <div className="mx-auto w-full max-w-[360px] space-y-3">
              {poseStrip}
              {manualHint && (
                <p className="text-center text-caption text-status-warning" role="alert">
                  {manualHint}
                </p>
              )}
              {phase === 'capture' && struggling && !busy && !manualHint && (
                <p className="text-center text-caption text-text-muted">
                  Having trouble? Get into position and press <span className="text-text-primary">Capture now</span>.
                </p>
              )}
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="outline" onClick={cancel}>
                  <Dismiss20Regular aria-hidden />
                  Cancel
                </Button>
                <Button onClick={manualCapture} disabled={phase !== 'capture' || busy} variant={struggling ? 'default' : 'secondary'}>
                  <Camera20Regular aria-hidden />
                  Capture now
                </Button>
              </div>
            </div>
          </div>
        ) : phase === 'submitting' ? (
          <div className="space-y-4">
            <div className="mx-auto w-full max-w-[360px]">{poseStrip}</div>
            <div className="flex items-center justify-center gap-3 py-2 text-body text-text-secondary" role="status">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-subtle border-t-brand" aria-hidden />
              Checking your photos and registering your face…
            </div>
          </div>
        ) : phase === 'success' ? (
          <div className="flex flex-col items-center py-4 text-center" role="status">
            <div className="mb-3 grid h-16 w-16 place-items-center rounded-full bg-status-success-subtle text-status-success">
              <CheckmarkCircle48Filled aria-hidden />
            </div>
            <p ref={resultRef} tabIndex={-1} className="text-section-title text-text-primary outline-none">
              Your face is registered
            </p>
            <p className="mt-1 max-w-md text-body text-text-muted">You can now check in to your classes with your face.</p>
            {onSuccess && result && (
              <Button className="mt-5" onClick={() => onSuccess(result)}>
                Done
              </Button>
            )}
          </div>
        ) : phase === 'error' && error ? (
          <div className="space-y-4">
            <FaceMessage tone={error.refreshState ? 'info' : 'error'} title={error.title} titleRef={resultRef}>
              <p>{error.message}</p>
              {error.details.length > 0 && (
                <ul className="mt-1.5 list-disc space-y-0.5 pl-5 marker:text-text-muted">
                  {error.details.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              )}
            </FaceMessage>
            {frames.length > 0 && <div className="mx-auto w-full max-w-[360px]">{poseStrip}</div>}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {onCancel && (
                <Button variant="ghost" onClick={cancel} className="text-text-secondary">
                  Close
                </Button>
              )}
              {error.retryable && (
                <Button onClick={() => void start()}>
                  <ArrowClockwise20Regular aria-hidden />
                  Try again
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default FaceRegistration;
