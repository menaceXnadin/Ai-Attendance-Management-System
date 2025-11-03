// Centralized MediaPipe asset base.
// Hybrid setup: JS from node_modules, WASM assets from CDN by default.
// You can override via Vite env: VITE_MEDIAPIPE_ASSET_BASE=/mediapipe

export const mediapipeAssetBase =
  (import.meta as any).env?.VITE_MEDIAPIPE_ASSET_BASE ||
  'https://cdn.jsdelivr.net/npm/@mediapipe/face_detection@0.4.1646425229';

export const mediapipeLocateFile = (file: string) => `${mediapipeAssetBase}/${file}`;
