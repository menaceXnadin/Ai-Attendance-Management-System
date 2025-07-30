// Quick fix for MediaPipe model loading performance
// Add this to your Vite config to enable better caching

export default {
  // ...existing config
  
  // Optimize MediaPipe model caching
  optimizeDeps: {
    include: ['@mediapipe/face_detection', '@mediapipe/camera_utils']
  },
  
  // Add cache headers for MediaPipe models
  server: {
    headers: {
      'Cache-Control': 'public, max-age=31536000' // Cache for 1 year
    }
  },
  
  // Preload MediaPipe models
  define: {
    'process.env.MEDIAPIPE_CDN': JSON.stringify('https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/')
  }
}
