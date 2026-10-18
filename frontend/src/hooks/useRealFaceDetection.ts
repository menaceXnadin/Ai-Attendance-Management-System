import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { FaceDetector } from '@mediapipe/tasks-vision';
import { detectFaceInVideo, loadFaceDetector, type FaceObservation } from '@/services/mediaPipeService';

export type FaceTrackingStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

interface UseRealFaceDetectionOptions {
  /** The (mirrored-in-CSS) camera preview. Detection runs on the raw, unmirrored frame. */
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  /** Run the detection loop only while true. */
  active: boolean;
  /** Minimum time between detections (ms). */
  intervalMs?: number;
}

export interface UseRealFaceDetectionReturn {
  status: FaceTrackingStatus;
  /** Latest observation for rendering (throttled). */
  observation: FaceObservation | null;
  /** Latest observation, updated every detection (for timing-sensitive logic). */
  observationRef: MutableRefObject<FaceObservation | null>;
}

const STALE_AFTER_MS = 600;

/** True when the observation is recent enough to act on. */
export const isFreshObservation = (obs: FaceObservation | null | undefined): obs is FaceObservation =>
  !!obs && performance.now() - obs.timestamp < STALE_AFTER_MS;

const bucket = (o: FaceObservation | null) =>
  o
    ? `${o.faceCount}|${o.size}|${o.centered ? 1 : 0}|${o.yaw === null ? 'n' : Math.round(o.yaw * 20)}`
    : 'none';

/**
 * Live face guidance from MediaPipe (framing + rough head turn). If the detector can't
 * load, `status` becomes `unavailable` and callers fall back to timed prompts — the server
 * still checks everything.
 */
export const useRealFaceDetection = ({
  videoRef,
  active,
  intervalMs = 90,
}: UseRealFaceDetectionOptions): UseRealFaceDetectionReturn => {
  const [status, setStatus] = useState<FaceTrackingStatus>('idle');
  const [observation, setObservation] = useState<FaceObservation | null>(null);
  const observationRef = useRef<FaceObservation | null>(null);

  useEffect(() => {
    if (!active) {
      observationRef.current = null;
      setObservation(null);
      setStatus((s) => (s === 'unavailable' ? s : 'idle'));
      return;
    }

    let cancelled = false;
    let raf = 0;
    let detector: FaceDetector | null = null;
    let lastRun = 0;
    let lastVideoTime = -1;
    let lastPublish = 0;
    let lastBucket = '';
    let consecutiveErrors = 0;

    const loop = () => {
      if (cancelled) return;
      raf = requestAnimationFrame(loop);
      const video = videoRef.current;
      const now = performance.now();
      if (!detector || !video || now - lastRun < intervalMs) return;
      if (video.currentTime === lastVideoTime) return;
      lastRun = now;
      lastVideoTime = video.currentTime;
      try {
        const obs = detectFaceInVideo(detector, video);
        consecutiveErrors = 0;
        if (!obs) return;
        observationRef.current = obs;
        const b = bucket(obs);
        if (b !== lastBucket || now - lastPublish > 250) {
          lastBucket = b;
          lastPublish = now;
          setObservation(obs);
        }
      } catch (err) {
        consecutiveErrors += 1;
        if (consecutiveErrors > 8) {
          console.warn('Face guidance stopped after repeated errors:', err);
          cancelled = true;
          cancelAnimationFrame(raf);
          observationRef.current = null;
          setObservation(null);
          setStatus('unavailable');
        }
      }
    };

    setStatus('loading');
    loadFaceDetector()
      .then((d) => {
        if (cancelled) return;
        detector = d;
        setStatus('ready');
        raf = requestAnimationFrame(loop);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('Face guidance unavailable (MediaPipe failed to load):', err);
        setStatus('unavailable');
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [active, intervalMs, videoRef]);

  return { status, observation, observationRef };
};

export type { FaceObservation };
