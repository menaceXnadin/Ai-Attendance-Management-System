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
  mirror?: boolean;
}

export const useRealFaceDetection = ({
  videoRef,
  canvasRef,
  onFaceDetected,
  isActive,
  mirror = false
}: RealFaceDetectionProps) => {
  const [detectedFaces, setDetectedFaces] = useState<DetectedFace[]>([]);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [error, setError] = useState<string>('');
  const faceDetectionRef = useRef<FaceDetection | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  const isInitializingRef = useRef(false);
  const initAttemptsRef = useRef(0);
  const dprRef = useRef<number>(1);
  const canvasSizeRef = useRef<{ w: number; h: number } | null>(null);
  const isRunningRef = useRef(false);
  const facesCountRef = useRef(0);

  // Ensure canvas matches displayed video size
  const ensureCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return { displayW: 480, displayH: 640 };

    const displayW = video.clientWidth || video.videoWidth || 480;
    const displayH = video.clientHeight || video.videoHeight || 640;
    const prev = canvasSizeRef.current;
    const dpr = window.devicePixelRatio || 1;

    if (!prev || prev.w !== displayW || prev.h !== displayH || dprRef.current !== dpr) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        dprRef.current = dpr;
        canvas.width = Math.max(1, Math.floor(displayW * dpr));
        canvas.height = Math.max(1, Math.floor(displayH * dpr));
        canvas.style.width = `${displayW}px`;
        canvas.style.height = `${displayH}px`;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
        canvasSizeRef.current = { w: displayW, h: displayH };
      }
    }
    return { displayW, displayH };
  }, [canvasRef, videoRef]);

  // Draw face detections on canvas
  const drawDetections = useCallback((ctx: CanvasRenderingContext2D, faces: DetectedFace[]) => {
    faces.forEach((face, index) => {
      const x = face.x;
      const y = face.y;
      const width = face.width;
      const height = face.height;
      const confidence = face.confidence;

      // Choose color based on confidence
      const color = confidence > 0.8 ? '#00ff00' : confidence > 0.6 ? '#ffff00' : '#ff6600';

      // Draw main bounding box
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, width, height);

      // Draw confidence label
      ctx.save();
      ctx.fillStyle = color;
      ctx.font = 'bold 16px Arial';
      const labelX = x;
      const labelY = y > 25 ? y - 8 : y + height + 20;
      ctx.fillText(`Face ${index + 1}: ${(confidence * 100).toFixed(0)}%`, labelX, labelY);
      ctx.restore();

      // Draw corner markers
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

      if (isInitializingRef.current || faceDetectionRef.current) {
        console.log('⏭️ Face detection already initializing or initialized');
        return;
      }
      isInitializingRef.current = true;

      const faceDetection = new FaceDetection({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`
      });

      faceDetection.setOptions({
        model: 'short',
        minDetectionConfidence: 0.5,
      });

      faceDetection.onResults((results) => {
        // Check if we're still active and initialized
        if (!faceDetectionRef.current || !isRunningRef.current) return;
        if (!canvasRef.current || !videoRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { displayW, displayH } = ensureCanvasSize();
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (results.detections && results.detections.length > 0) {
          console.log('🔍 MediaPipe detected', results.detections.length, 'faces');
          
          const faces: DetectedFace[] = results.detections.map((detection) => {
            // detection typings from MediaPipe may not expose `score` in the shipped types.
            // Use a local narrow type to safely access score without using `any`.
            const det = detection as unknown as {
              boundingBox: { xCenter: number; yCenter: number; width: number; height: number };
              score?: number[];
              keypoints?: Array<{ x: number; y: number }>;
            };

            const bbox = det.boundingBox;
            const x = bbox.xCenter * displayW - (bbox.width * displayW) / 2;
            const y = bbox.yCenter * displayH - (bbox.height * displayH) / 2;
            const width = bbox.width * displayW;
            const height = bbox.height * displayH;
            const confidence = (Array.isArray(det.score) && typeof det.score[0] === 'number') ? det.score[0] : 0.8;
            return { x, y, width, height, confidence };
          });

          const outFaces = faces.map(f => {
            if (!mirror || !ctx.canvas) return f;
            const cw = ctx.canvas.width / (window.devicePixelRatio || 1);
            return { ...f, x: cw - (f.x + f.width) } as DetectedFace;
          });

          if (facesCountRef.current !== outFaces.length || outFaces.length > 0) {
            setDetectedFaces(outFaces);
            facesCountRef.current = outFaces.length;
            if (onFaceDetected && isRunningRef.current) {
              console.log('📞 Calling onFaceDetected with', outFaces.length, 'faces');
              onFaceDetected(outFaces);
            }
          }

          drawDetections(ctx, outFaces);
        } else {
          if (facesCountRef.current > 0) {
            console.log('🔍 No faces detected, clearing previous detections');
            setDetectedFaces([]);
            facesCountRef.current = 0;
            if (onFaceDetected && isRunningRef.current) {
              onFaceDetected([]);
            }
          }
        }
      });

      await faceDetection.initialize();
      
      // Double-check we haven't been cancelled during initialization
      if (isInitializingRef.current) {
        faceDetectionRef.current = faceDetection;
        initAttemptsRef.current = 0;
        setIsModelLoaded(true);
        console.log('✅ MediaPipe Face Detection initialized successfully!');
      } else {
        // We were cancelled, clean up
        try {
          type ClosableFaceDetection = { close?: () => void };
          const closable = faceDetection as unknown as ClosableFaceDetection;
          if (closable.close) closable.close();
        } catch (e) {
          console.warn('Error closing cancelled face detection:', e);
        }
      }

    } catch (err) {
      console.error('❌ Failed to initialize face detection:', err);
      setError('Failed to load MediaPipe face detection model');
      
      if (initAttemptsRef.current < 2) {
        initAttemptsRef.current += 1;
        setTimeout(() => {
          if (isInitializingRef.current) {
            isInitializingRef.current = false;
            initializeFaceDetection();
          }
        }, 1000);
        return;
      }
    }
    finally {
      isInitializingRef.current = false;
    }
  }, [canvasRef, videoRef, onFaceDetected, drawDetections, mirror, ensureCanvasSize]);

  // Start camera and face detection
  const startDetection = useCallback(async () => {
    if (!videoRef.current) return;
    if (isRunningRef.current) return;
    if (!faceDetectionRef.current) return;

    try {
      console.log('📹 Starting camera for face detection...');
      
      // Stop any existing camera first
      if (cameraRef.current) {
        try {
          cameraRef.current.stop();
        } catch (e) {
          console.warn('Error stopping existing camera:', e);
        }
        cameraRef.current = null;
      }
      
      const camera = new Camera(videoRef.current, {
        onFrame: async () => {
          const fd = faceDetectionRef.current;
          if (fd && videoRef.current && isRunningRef.current) {
            try {
              // Check if video is ready
              if (videoRef.current.readyState >= 2 && videoRef.current.videoWidth > 0) {
                await fd.send({ image: videoRef.current });
              }
            } catch (e) {
              // Ignore if closed or stopped
              if (isRunningRef.current) {
                console.warn('Face detection send error:', e);
              }
            }
          }
        },
        width: 480,
        height: 640,
      });

      await camera.start();
      cameraRef.current = camera;
      console.log('✅ Camera started successfully!');
      isRunningRef.current = true;

    } catch (err) {
      console.error('❌ Failed to start camera:', err);
      setError('Failed to start camera for face detection');
      isRunningRef.current = false;
    }
  }, [videoRef]);

  // Stop detection
  const stopDetection = useCallback(() => {
    const somethingRunning = isRunningRef.current || !!cameraRef.current;
    if (!somethingRunning) return;

    console.log('🛑 Stopping face detection...');
    isRunningRef.current = false;

    if (cameraRef.current) {
      try {
        cameraRef.current.stop();
      } catch (err) {
        console.warn('Camera stop error:', err);
      }
      cameraRef.current = null;
    }

    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    
    // Clear face detections
    if (facesCountRef.current > 0) {
      setDetectedFaces([]);
      facesCountRef.current = 0;
    }
  }, [canvasRef]);

  // Cleanup function
  const destroyDetection = useCallback(() => {
    console.log('🧹 Destroying face detection resources...');
    
    // Stop initialization if in progress
    isInitializingRef.current = false;
    isRunningRef.current = false;
    
    if (cameraRef.current) {
      try {
        cameraRef.current.stop();
      } catch (err) {
        console.warn('Camera stop error:', err);
      }
      cameraRef.current = null;
    }
    
    type Closable = { close?: () => void };
    const maybeClosable: Closable | null = faceDetectionRef.current as unknown as Closable | null;
    if (maybeClosable && typeof maybeClosable.close === 'function') {

      try {
        maybeClosable.close();
      } catch (err) {
        console.warn('MediaPipe close error:', err);
      }
    }
    faceDetectionRef.current = null;
    setIsModelLoaded(false);
    
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    
    if (facesCountRef.current > 0) {
      setDetectedFaces([]);
      facesCountRef.current = 0;
    }
  }, [canvasRef]);

  // Initialize when component mounts
  useEffect(() => {
    if (isActive && !isModelLoaded) {
      initializeFaceDetection();
    }
  }, [isActive, isModelLoaded, initializeFaceDetection]);

  // Start/stop detection based on isActive
  useEffect(() => {
    if (isActive && isModelLoaded) {
      // Small delay to ensure video element is ready
      const startTimeout = setTimeout(() => {
        startDetection();
      }, 100);
      
      return () => {
        clearTimeout(startTimeout);
        stopDetection();
      };
    } else {
      stopDetection();
    }
  }, [isActive, isModelLoaded, startDetection, stopDetection]);

  // On unmount, fully destroy resources
  useEffect(() => {
    return () => {
      destroyDetection();
    };
  }, [destroyDetection]);

  return {
    detectedFaces,
    isModelLoaded,
    error,
    faceCount: detectedFaces.length
  };
};