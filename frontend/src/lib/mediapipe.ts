/**
 * MediaPipe asset locations (in-browser face guidance only; the server decides).
 *
 * The app uses `@mediapipe/tasks-vision` (FaceDetector, BlazeFace short range). Its WASM
 * runtime and the model are served locally from `public/mediapipe/`, so check-in works
 * offline and on locked-down networks:
 *
 *   public/mediapipe/tasks/   vision_wasm_internal.{js,wasm} + vision_wasm_nosimd_internal.{js,wasm}
 *                             (copied from node_modules/@mediapipe/tasks-vision/wasm/)
 *   public/mediapipe/models/  blaze_face_short_range.tflite
 *                             (https://storage.googleapis.com/mediapipe-models/face_detector/
 *                              blaze_face_short_range/float16/1/blaze_face_short_range.tflite)
 *
 * The WASM files MUST match the installed package version. After upgrading
 * `@mediapipe/tasks-vision`, re-copy them:
 *   cp node_modules/@mediapipe/tasks-vision/wasm/* public/mediapipe/tasks/
 *
 * `VITE_MEDIAPIPE_ASSET_BASE` overrides the base folder (it must contain the same
 * `tasks/` and `models/` layout), e.g. a CDN mirror.
 */

const envBase = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
  ?.VITE_MEDIAPIPE_ASSET_BASE;

export const mediapipeAssetBase = (envBase || '/mediapipe').replace(/\/+$/, '');

/** Folder holding the tasks-vision WASM loader + binary (SIMD and non-SIMD builds). */
export const mediapipeWasmBase = `${mediapipeAssetBase}/tasks`;

/** BlazeFace short-range face detector model. */
export const faceDetectorModelUrl = `${mediapipeAssetBase}/models/blaze_face_short_range.tflite`;
