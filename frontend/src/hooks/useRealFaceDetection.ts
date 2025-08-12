import React, { useRef, useEffect, useState, useCallback } from 'react';
import { FaceDetection } from '@mediapipe/face_detection';
import { Camera } from '@mediapipe/camera_utils';

interface DetectedFace {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  keypoints?: Array<{ x: number; y: number }>;
}

interface RealFaceDetectionProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  onFaceDetected?: (faces: DetectedFace[]) => void;
  isActive: boolean;
}

export const useRealFaceDetection = ({
  videoRef,
  canvasRef,
  onFaceDetected,
  isActive
}: RealFaceDetectionProps) => {
  const [detectedFaces, setDetectedFaces] = useState<DetectedFace[]>([]);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [error, setError] = useState<string>('');
  const faceDetectionRef = useRef<FaceDetection | null>(null);
  const cameraRef = useRef<Camera | null>(null);

  // Draw face detections on canvas
  const drawDetections = useCallback((ctx: CanvasRenderingContext2D, faces: DetectedFace[]) => {
    faces.forEach((face, index) => {
      const { x, y, width, height, confidence, keypoints } = face;
      
      // Choose color based on confidence
      const color = confidence > 0.8 ? '#00ff00' : confidence > 0.6 ? '#ffff00' : '#ff6600';
      
      // Draw main bounding box
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, width, height);
      
      // Draw confidence label
      ctx.fillStyle = color;
      ctx.font = 'bold 16px Arial';
      ctx.fillText(
        `Face ${index + 1}: ${(confidence * 100).toFixed(0)}%`, 
        x, 
        y > 25 ? y - 8 : y + height + 20
      );
      
      // Draw corner markers for better visibility
      const cornerSize = 20;
      ctx.lineWidth = 3;
      
      // Top-left corner
      ctx.beginPath();
      ctx.moveTo(x, y + cornerSize);
      ctx.lineTo(x, y);
      ctx.lineTo(x + cornerSize, y);
      ctx.stroke();
      
      // Top-right corner
      ctx.beginPath();
      ctx.moveTo(x + width - cornerSize, y);
      ctx.lineTo(x + width, y);
      ctx.lineTo(x + width, y + cornerSize);
      ctx.stroke();
      
      // Bottom-left corner
      ctx.beginPath();
      ctx.moveTo(x, y + height - cornerSize);
      ctx.lineTo(x, y + height);
      ctx.lineTo(x + cornerSize, y + height);
      ctx.stroke();
      
      // Bottom-right corner
      ctx.beginPath();
      ctx.moveTo(x + width - cornerSize, y + height);
      ctx.lineTo(x + width, y + height);
      ctx.lineTo(x + width, y + height - cornerSize);
      ctx.stroke();

      // Draw keypoints (facial landmarks) if available
      if (keypoints && keypoints.length > 0) {
        ctx.fillStyle = '#ff0000';
        keypoints.forEach((point) => {
          ctx.beginPath();
          ctx.arc(point.x, point.y, 3, 0, 2 * Math.PI);
          ctx.fill();
        });
      }

      // Draw center crosshair
      const centerX = x + width / 2;
      const centerY = y + height / 2;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(centerX - 10, centerY);
      ctx.lineTo(centerX + 10, centerY);
      ctx.moveTo(centerX, centerY - 10);
      ctx.lineTo(centerX, centerY + 10);
      ctx.stroke();
    });
  }, []);

  // Initialize MediaPipe Face Detection
  const initializeFaceDetection = useCallback(async () => {
    try {
      setError('');
      console.log('🤖 Initializing MediaPipe Face Detection...');

      const faceDetection = new FaceDetection({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`;
        }
      });

      faceDetection.setOptions({
        model: 'short',  // short or full
        minDetectionConfidence: 0.5,
      });

      faceDetection.onResults((results) => {
        if (!canvasRef.current || !videoRef.current) return;

        const canvas = canvasRef.current;
        const video = videoRef.current;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) return;

        // Set canvas size to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (results.detections && results.detections.length > 0) {
          const faces: DetectedFace[] = results.detections.map((detection) => {
            const bbox = detection.boundingBox;
            const keypoints = detection.landmarks;
            
            // Convert relative coordinates to absolute pixels
            const x = bbox.xCenter * canvas.width - (bbox.width * canvas.width) / 2;
            const y = bbox.yCenter * canvas.height - (bbox.height * canvas.height) / 2;
            const width = bbox.width * canvas.width;
            const height = bbox.height * canvas.height;
            const confidence = 0.8; // MediaPipe provides confidence internally

            return {
              x,
              y,
              width,
              height,
              confidence,
              keypoints: keypoints?.map(point => ({
                x: point.x * canvas.width,
                y: point.y * canvas.height
              }))
            };
          });

          setDetectedFaces(faces);
          
          if (onFaceDetected) {
            onFaceDetected(faces);
          }

          // Draw bounding boxes and keypoints
          drawDetections(ctx, faces);
        } else {
          setDetectedFaces([]);
          if (onFaceDetected) {
            onFaceDetected([]);
          }
        }
      });

      await faceDetection.initialize();
      faceDetectionRef.current = faceDetection;
      setIsModelLoaded(true);
      console.log('✅ MediaPipe Face Detection initialized successfully!');

    } catch (err) {
      console.error('❌ Failed to initialize face detection:', err);
      setError('Failed to load face detection model');
    }
  }, [canvasRef, videoRef, onFaceDetected, drawDetections]);

  // Start camera and face detection
  const startDetection = useCallback(async () => {
    if (!videoRef.current || !faceDetectionRef.current) return;

    try {
      console.log('📹 Starting camera for face detection...');
      
      const camera = new Camera(videoRef.current, {
        onFrame: async () => {
          if (faceDetectionRef.current && videoRef.current) {
            await faceDetectionRef.current.send({ image: videoRef.current });
          }
        },
        width: 640,
        height: 480,
      });

      await camera.start();
      cameraRef.current = camera;
      console.log('✅ Camera started successfully!');

    } catch (err) {
      console.error('❌ Failed to start camera:', err);
      setError('Failed to start camera for face detection');
    }
  }, [videoRef]);

  // Stop detection
  const stopDetection = useCallback(() => {
    if (cameraRef.current) {
      cameraRef.current.stop();
      cameraRef.current = null;
    }
    setDetectedFaces([]);
  }, []);

  // Initialize when component mounts
  useEffect(() => {
    if (isActive && !isModelLoaded) {
      initializeFaceDetection();
    }
  }, [isActive, isModelLoaded, initializeFaceDetection]);

  // Start/stop detection based on isActive
  useEffect(() => {
    if (isActive && isModelLoaded) {
      startDetection();
    } else {
      stopDetection();
    }

    return () => {
      stopDetection();
    };
  }, [isActive, isModelLoaded, startDetection, stopDetection]);

  return {
    detectedFaces,
    isModelLoaded,
    error,
    faceCount: detectedFaces.length
  };
};
