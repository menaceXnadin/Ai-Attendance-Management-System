/**
 * In-browser face guidance (MediaPipe Tasks `FaceDetector`, BlazeFace short range).
 *
 * This only helps the student frame their face and follow the head-turn prompt. It never
 * decides anything: identity, liveness and pose are verified on the server
 * (docs/system/face-verification.md §1, §7, §8).
 *
 * The detector is created once (lazily, on first use) and shared by the check-in and
 * enrolment screens. `@mediapipe/tasks-vision` is imported dynamically so it stays out of
 * the main bundle. Assets are served locally (see `lib/mediapipe.ts`).
 */
import type { Detection, FaceDetector } from '@mediapipe/tasks-vision';
import { faceDetectorModelUrl, mediapipeWasmBase } from '@/lib/mediapipe';

export interface NormalizedBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type FaceSize = 'none' | 'small' | 'ok' | 'large';

export interface FaceObservation {
  /** Faces at least a quarter the size of the largest one (tiny background faces are ignored). */
  faceCount: number;
  /** Largest face, normalised to the unmirrored video frame. */
  box: NormalizedBox | null;
  /** Detector confidence of the largest face (0–1). */
  score: number;
  /**
   * Head-turn proxy, same convention as the server (`face_math.yaw_from_kps`):
   * `(nose.x − eye_mid.x) / eye_distance` on the unmirrored frame.
   * `> 0` = turned to the student's own left, `< 0` = their right, ≈ 0 frontal.
   * `null` when the keypoints are missing.
   */
  yaw: number | null;
  /** Face centre minus frame centre, as a fraction of the frame (−0.5 … 0.5). */
  offsetX: number;
  offsetY: number;
  size: FaceSize;
  /** Face centre close enough to the frame centre. */
  centered: boolean;
  /** `performance.now()` when the frame was analysed. */
  timestamp: number;
}

/** Guidance thresholds (the server applies its own policy). */
export const GUIDE = {
  /** |yaw| at or below this counts as "looking at the camera". */
  frontalMaxYaw: 0.1,
  /** Signed yaw at or above this counts as a clear head turn (server minimum is lower). */
  turnMinYaw: 0.22,
  /**
   * Signed yaw above this is "too far" (close to a side profile). The server rejects
   * near-profile frames (`max_turn_yaw`), so photos are only taken inside
   * [turnMinYaw, turnMaxYaw]; ~0.35 is the sweet spot (a 25-40° turn).
   */
  turnMaxYaw: 0.6,
  turnTargetYaw: 0.35,
  /** Signed yaw below this means the student clearly did not turn at all. */
  noTurnYaw: 0.08,
  /** Face height as a fraction of the frame height. */
  minFaceHeight: 0.24,
  maxFaceHeight: 0.8,
  maxOffsetX: 0.12,
  maxOffsetY: 0.16,
} as const;

let detectorPromise: Promise<FaceDetector> | null = null;
let lastTimestamp = 0;

/** Loads (once) and returns the shared face detector. Rejects if the assets can't load. */
export const loadFaceDetector = (): Promise<FaceDetector> => {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision');
      const fileset = await FilesetResolver.forVisionTasks(mediapipeWasmBase);
      return FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: faceDetectorModelUrl, delegate: 'CPU' },
        runningMode: 'VIDEO',
        minDetectionConfidence: 0.5,
      });
    })().catch((err) => {
      detectorPromise = null; // allow a later retry
      throw err;
    });
  }
  return detectorPromise;
};

/** Starts downloading the detector in the background (errors are ignored here). */
export const prefetchFaceDetector = (): void => {
  loadFaceDetector().catch(() => undefined);
};

const area = (d: Detection) => (d.boundingBox ? d.boundingBox.width * d.boundingBox.height : 0);

/** Pure: turns raw detections into guidance values. */
export const analyzeDetections = (
  detections: Detection[],
  frameWidth: number,
  frameHeight: number,
  timestamp: number
): FaceObservation => {
  const faces = detections.filter((d) => d.boundingBox && (d.categories?.[0]?.score ?? 1) >= 0.5);
  if (faces.length === 0 || frameWidth <= 0 || frameHeight <= 0) {
    return { faceCount: 0, box: null, score: 0, yaw: null, offsetX: 0, offsetY: 0, size: 'none', centered: false, timestamp };
  }
  const sorted = [...faces].sort((a, b) => area(b) - area(a));
  const main = sorted[0];
  const mainArea = area(main);
  const faceCount = sorted.filter((d) => area(d) >= mainArea * 0.25).length;

  const bb = main.boundingBox!;
  const box: NormalizedBox = {
    x: bb.originX / frameWidth,
    y: bb.originY / frameHeight,
    width: bb.width / frameWidth,
    height: bb.height / frameHeight,
  };
  const offsetX = box.x + box.width / 2 - 0.5;
  const offsetY = box.y + box.height / 2 - 0.5;
  const size: FaceSize =
    box.height < GUIDE.minFaceHeight ? 'small' : box.height > GUIDE.maxFaceHeight ? 'large' : 'ok';

  // BlazeFace keypoints: 0/1 = eyes, 2 = nose tip (normalised). The sign of the
  // ratio does not depend on which eye is which.
  let yaw: number | null = null;
  const kp = main.keypoints ?? [];
  if (kp.length >= 3) {
    const eyeDist = Math.abs(kp[1].x - kp[0].x) * frameWidth;
    if (eyeDist > 1) {
      const eyeMidX = ((kp[0].x + kp[1].x) / 2) * frameWidth;
      yaw = (kp[2].x * frameWidth - eyeMidX) / eyeDist;
    }
  }

  return {
    faceCount,
    box,
    score: main.categories?.[0]?.score ?? 0,
    yaw,
    offsetX,
    offsetY,
    size,
    centered: Math.abs(offsetX) <= GUIDE.maxOffsetX && Math.abs(offsetY) <= GUIDE.maxOffsetY,
    timestamp,
  };
};

/** Runs the detector on the current video frame. Returns null if the video isn't ready. */
export const detectFaceInVideo = (detector: FaceDetector, video: HTMLVideoElement): FaceObservation | null => {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h || video.readyState < 2) return null;
  // VIDEO mode needs strictly increasing timestamps across every caller of the shared detector.
  const ts = Math.max(performance.now(), lastTimestamp + 1);
  lastTimestamp = ts;
  const result = detector.detectForVideo(video, ts);
  return analyzeDetections(result.detections ?? [], w, h, performance.now());
};
