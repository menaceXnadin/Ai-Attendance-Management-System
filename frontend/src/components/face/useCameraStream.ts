import { useCallback, useEffect, useRef, useState } from 'react';

export type CameraState = 'idle' | 'starting' | 'live' | 'error';

export interface CameraStartResult {
  ok: boolean;
  /** Plain-language reason; null on success or when superseded by stop()/start(). */
  error: string | null;
}

const CONSTRAINTS: MediaStreamConstraints = {
  video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
  audio: false,
};

const INSECURE_MESSAGE =
  'Camera access needs a secure connection. Open AttendAI over https (or on this computer via localhost) and try again.';

/** Plain-language reason a camera couldn't start. */
export const cameraErrorMessage = (err: unknown): string => {
  const name = (err as { name?: string } | null)?.name ?? '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera access was blocked. Allow camera access for this site in your browser settings, then try again.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return 'No camera was found on this device.';
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return 'Your camera is being used by another app. Close it and try again.';
    default:
      return "Couldn't start the camera. Check that it's connected and try again.";
  }
};

/**
 * Front-camera stream (`facingMode: 'user'`) for face capture. `videoRef` is a callback
 * ref for the preview `<video>`; the stream is connected whenever the element mounts.
 * The stream is always released on unmount.
 */
export const useCameraStream = () => {
  const videoEl = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startIdRef = useRef(0);
  const [state, setState] = useState<CameraState>('idle');
  const [error, setError] = useState<string | null>(null);

  const attach = (el: HTMLVideoElement | null) => {
    const stream = streamRef.current;
    if (!el || !stream) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    el.muted = true;
    el.play().catch(() => undefined);
  };

  const videoRef = useCallback((el: HTMLVideoElement | null) => {
    videoEl.current = el;
    attach(el);
  }, []);

  const release = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoEl.current) videoEl.current.srcObject = null;
  };

  const stop = useCallback(() => {
    startIdRef.current += 1;
    release();
    setState('idle');
  }, []);

  const start = useCallback(async (): Promise<CameraStartResult> => {
    const id = ++startIdRef.current;
    release();
    setError(null);
    setState('starting');
    if (typeof window !== 'undefined' && (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)) {
      setError(INSECURE_MESSAGE);
      setState('error');
      return { ok: false, error: INSECURE_MESSAGE };
    }
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(CONSTRAINTS);
      } catch (err) {
        if ((err as { name?: string })?.name !== 'OverconstrainedError') throw err;
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      if (id !== startIdRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return { ok: false, error: null };
      }
      streamRef.current = stream;
      attach(videoEl.current);
      setState('live');
      return { ok: true, error: null };
    } catch (err) {
      if (id !== startIdRef.current) return { ok: false, error: null };
      const message = cameraErrorMessage(err);
      setError(message);
      setState('error');
      return { ok: false, error: message };
    }
  }, []);

  useEffect(
    () => () => {
      startIdRef.current += 1;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    },
    []
  );

  return { videoRef, videoEl, state, error, start, stop };
};

/** Resolves true once the video has real frames, false after `timeoutMs`. */
export const waitForVideo = (getVideo: () => HTMLVideoElement | null, timeoutMs = 6000): Promise<boolean> =>
  new Promise((resolve) => {
    const t0 = performance.now();
    const check = () => {
      const v = getVideo();
      if (v && v.videoWidth > 0 && v.readyState >= 2) return resolve(true);
      if (performance.now() - t0 > timeoutMs) return resolve(false);
      setTimeout(check, 100);
    };
    check();
  });
