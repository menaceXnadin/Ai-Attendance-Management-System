/**
 * Frame capture for face check-in and enrolment (docs/system/face-verification.md §10):
 * UNMIRRORED (exactly what the camera sees; the preview is only mirrored in CSS),
 * JPEG quality 0.85, longest side at most 640 px.
 */

export interface CapturedFrame {
  /** JPEG base64 without the `data:` prefix (what the API receives). */
  base64: string;
  /** Data URL, for thumbnails. */
  dataUrl: string;
  width: number;
  height: number;
  /** `performance.now()` at capture. */
  at: number;
  /** Browser yaw estimate at capture time (guidance only), if known. */
  yaw: number | null;
}

export const CAPTURE_MAX_SIDE = 640;
export const CAPTURE_JPEG_QUALITY = 0.85;

let scratch: HTMLCanvasElement | null = null;

export const captureFrame = (
  video: HTMLVideoElement | null,
  yaw: number | null = null,
  opts: { maxSide?: number; quality?: number } = {}
): CapturedFrame | null => {
  if (!video || !video.videoWidth || !video.videoHeight) return null;
  const maxSide = opts.maxSide ?? CAPTURE_MAX_SIDE;
  const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
  const width = Math.max(1, Math.round(video.videoWidth * scale));
  const height = Math.max(1, Math.round(video.videoHeight * scale));
  scratch = scratch ?? document.createElement('canvas');
  scratch.width = width;
  scratch.height = height;
  const ctx = scratch.getContext('2d');
  if (!ctx) return null;
  // No flip: the server's yaw sign convention assumes the unmirrored image.
  ctx.drawImage(video, 0, 0, width, height);
  const dataUrl = scratch.toDataURL('image/jpeg', opts.quality ?? CAPTURE_JPEG_QUALITY);
  const comma = dataUrl.indexOf(',');
  return { base64: comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl, dataUrl, width, height, at: performance.now(), yaw };
};

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
