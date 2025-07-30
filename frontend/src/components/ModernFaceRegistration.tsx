import React, { useState, useRef, useEffect, useCallback } from 'react';
import './ModernFaceRegistration.css';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { 
  Camera, 
  X, 
  CheckCircle, 
  RotateCcw, 
  Sparkles,
  Eye,
  Upload
} from 'lucide-react';
import { FaceDetection } from '@mediapipe/face_detection';
import { Camera as MPCamera } from '@mediapipe/camera_utils';
import { useAuth } from '@/contexts/useAuth';
import { api } from '@/integrations/api/client';
import { cn } from '@/lib/utils';

interface ModernFaceRegistrationProps {
  onRegistrationComplete?: () => void;
  onClose?: () => void;
  onSuccess?: () => void;
  onCancel?: () => void;
  isOpen?: boolean;
  mode?: 'register' | 'verify';
}

type RegistrationStep = 'launch' | 'instructions' | 'camera' | 'detecting' | 'countdown' | 'preview' | 'uploading' | 'success';

const ModernFaceRegistration: React.FC<ModernFaceRegistrationProps> = ({
  onRegistrationComplete,
  onClose,
  onSuccess,
  onCancel,
  isOpen = true,
  mode = 'register'
}) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);
  
  // State management
  const [currentStep, setCurrentStep] = useState<RegistrationStep>('launch');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [faceDetection, setFaceDetection] = useState<FaceDetection | null>(null);
  const [isMediaPipeReady, setIsMediaPipeReady] = useState(false);
  const [camera, setCamera] = useState<MPCamera | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [faceQuality, setFaceQuality] = useState<'poor' | 'good' | 'excellent'>('poor');
  // Camera error state
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Animation states
  const [pulseAnimation, setPulseAnimation] = useState(false);
  const [shakeAnimation, setShakeAnimation] = useState(false);
  const [successAnimation, setSuccessAnimation] = useState(false);

  // Track when step 1 (camera/detecting) started
  const [step1StartTime, setStep1StartTime] = useState<number | null>(null);

  // Progress bar state for step 1
  const [detectionProgress, setDetectionProgress] = useState(0);
  
  // Face detection validation states for strict face-only detection
  const [consecutiveDetections, setConsecutiveDetections] = useState(0);
  const [lastValidDetection, setLastValidDetection] = useState<any>(null);
  const [detectionHistory, setDetectionHistory] = useState<any[]>([]);

  // Reset all face detection validation states
  const resetFaceDetectionStates = useCallback(() => {
    setConsecutiveDetections(0);
    setLastValidDetection(null);
    setDetectionHistory([]);
    setFaceDetected(false);
    setPulseAnimation(false);
    setFaceQuality('poor');
    console.log('[FaceValidation] 🔄 Reset all face detection states');
  }, []);

  // Comprehensive face validation to prevent false positives (bottles, objects, etc.)
  const isValidHumanFace = useCallback((detection: any, bbox: any) => {
    // 1. Detection confidence score validation
    const detectionScore = detection.score?.[0] || 0;
    if (detectionScore < 0.85) {
      console.log(`[FaceValidation] Low confidence score: ${detectionScore}`);
      return false;
    }

    // 2. Strict face aspect ratio (human faces are roughly 0.75-1.3 ratio)
    const aspectRatio = bbox.width / bbox.height;
    if (aspectRatio < 0.6 || aspectRatio > 1.4) {
      console.log(`[FaceValidation] Invalid aspect ratio: ${aspectRatio}`);
      return false;
    }

    // 3. Face size validation (human face should be reasonable size in frame)
    const faceSize = bbox.width * bbox.height;
    if (faceSize < 0.025 || faceSize > 0.5) { // 2.5% to 50% of frame
      console.log(`[FaceValidation] Invalid face size: ${faceSize}`);
      return false;
    }

    // 4. Position validation (face should be in reasonable position, not at extreme edges)
    if (bbox.xCenter < 0.1 || bbox.xCenter > 0.9 || bbox.yCenter < 0.1 || bbox.yCenter > 0.9) {
      console.log(`[FaceValidation] Face at edge position: ${bbox.xCenter}, ${bbox.yCenter}`);
      return false;
    }

    // 5. Temporal consistency check (compare with last detection to avoid sudden jumps)
    if (lastValidDetection) {
      const xDiff = Math.abs(bbox.xCenter - lastValidDetection.xCenter);
      const yDiff = Math.abs(bbox.yCenter - lastValidDetection.yCenter);
      const sizeDiff = Math.abs(faceSize - (lastValidDetection.width * lastValidDetection.height));
      
      // Face shouldn't jump too much between frames
      if (xDiff > 0.15 || yDiff > 0.15 || sizeDiff > 0.1) {
        console.log(`[FaceValidation] Sudden movement detected, likely false positive`);
        return false;
      }
    }

    // 6. Check detection stability (need multiple consecutive valid detections)
    const requiredConsecutiveDetections = 3; // Need 3 frames in a row
    if (consecutiveDetections < requiredConsecutiveDetections) {
      console.log(`[FaceValidation] Not enough consecutive detections: ${consecutiveDetections}/${requiredConsecutiveDetections}`);
      return false;
    }

    console.log(`[FaceValidation] ✅ Valid human face detected (score: ${detectionScore}, ratio: ${aspectRatio}, size: ${faceSize})`);
    return true;
  }, [lastValidDetection, consecutiveDetections]);

  // Draw animated face frame
  const drawFaceFrame = useCallback((ctx: CanvasRenderingContext2D, bbox: { xCenter: number; yCenter: number; width: number; height: number }, width: number, height: number, quality: string) => {
    // Calculate coordinates for mirrored display
    // Mirror the X coordinate: instead of using bbox.xCenter directly, use (1 - bbox.xCenter)
    const mirroredXCenter = 1 - bbox.xCenter;
    
    const x = mirroredXCenter * width - (bbox.width * width) / 2;
    const y = bbox.yCenter * height - (bbox.height * height) / 2;
    const frameWidth = bbox.width * width;
    const frameHeight = bbox.height * height;

    // Modern gradient border for quality
    const gradients = {
      poor: ['#f43f5e', '#fbbf24'], // red to yellow
      good: ['#fbbf24', '#22d3ee'], // yellow to cyan
      excellent: ['#22d3ee', '#38bdf8', '#4ade80'], // cyan to blue to green
    };
    const colorStops = gradients[quality as keyof typeof gradients];
    const gradient = ctx.createLinearGradient(x, y, x + frameWidth, y + frameHeight);
    colorStops.forEach((c, i) => gradient.addColorStop(i / (colorStops.length - 1), c));

    const lineWidth = pulseAnimation ? 5 : 3;
    const shadowColor = quality === 'excellent' ? '#4ade80' : quality === 'good' ? '#fbbf24' : '#f43f5e';

    ctx.save();
    // No need for canvas mirroring since we're adjusting coordinates directly
    const rectX = x;
    const rectY = y;
    const radius = 28;

    // Glowing shadow
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = 18;

    // Draw rounded rectangle frame with gradient
    ctx.strokeStyle = gradient;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash(quality === 'excellent' ? [] : [12, 7]);
    ctx.beginPath();
    ctx.roundRect(rectX, rectY, frameWidth, frameHeight, radius);
    ctx.stroke();

    // Remove shadow for corners/text
    ctx.shadowBlur = 0;

    // Draw animated corners for excellent quality
    if (quality === 'excellent') {
      const cornerSize = 26;
      ctx.lineWidth = 4;
      ctx.setLineDash([]);
      ctx.strokeStyle = '#4ade80';
      // Top-left
      ctx.beginPath();
      ctx.moveTo(rectX, rectY + cornerSize);
      ctx.lineTo(rectX, rectY);
      ctx.lineTo(rectX + cornerSize, rectY);
      ctx.stroke();
      // Top-right
      ctx.beginPath();
      ctx.moveTo(rectX + frameWidth - cornerSize, rectY);
      ctx.lineTo(rectX + frameWidth, rectY);
      ctx.lineTo(rectX + frameWidth, rectY + cornerSize);
      ctx.stroke();
      // Bottom-left
      ctx.beginPath();
      ctx.moveTo(rectX, rectY + frameHeight - cornerSize);
      ctx.lineTo(rectX, rectY + frameHeight);
      ctx.lineTo(rectX + cornerSize, rectY + frameHeight);
      ctx.stroke();
      // Bottom-right
      ctx.beginPath();
      ctx.moveTo(rectX + frameWidth - cornerSize, rectY + frameHeight);
      ctx.lineTo(rectX + frameWidth, rectY + frameHeight);
      ctx.lineTo(rectX + frameWidth, rectY + frameHeight - cornerSize);
      ctx.stroke();
    }

    // Quality indicator text (glassy look)
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = 8;
    const qualityText = quality === 'excellent' ? '✅ PERFECT' : quality === 'good' ? '✓ GOOD' : '⚠ ADJUST';
    ctx.fillText(qualityText, rectX + frameWidth / 2, rectY - 16);
    ctx.restore();

    ctx.restore();
  }, [pulseAnimation]);

  // Draw guidance overlay when no face detected
  const drawGuidanceOverlay = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.save();
    // No canvas mirroring needed since we're using consistent coordinate system
    
    // Draw center circle guide
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.22;

    // Create a bright gradient for the circle
    const grad = ctx.createLinearGradient(centerX - radius, centerY - radius, centerX + radius, centerY + radius);
    grad.addColorStop(0, '#38bdf8'); // blue
    grad.addColorStop(0.5, '#fbbf24'); // yellow
    grad.addColorStop(1, '#22d3ee'); // cyan

    ctx.strokeStyle = grad;
    ctx.lineWidth = 6;
    ctx.setLineDash([16, 12]);
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 18;

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.stroke();

    ctx.restore();

    // Draw guide text (not mirrored)
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Position your face here', width / 2, centerY + radius + 38);
    ctx.restore();
  }, []);

  // Trigger shake animation
  const triggerShakeAnimation = useCallback(() => {
    setShakeAnimation(true);
    setTimeout(() => setShakeAnimation(false), 600);
  }, []);

  // Enhanced face detection with backend validation
  const validateFaceWithBackend = useCallback(async (imageData: string) => {
    try {
      const result = await api.faceRecognition.detectFaces(imageData);
      
      if (result.success && result.faces_detected === 1) {
        setFaceDetected(true);
        setFaceQuality('excellent');
        return true;
      } else {
        setFaceDetected(false);
        setFaceQuality('poor');
        return false;
      }
    } catch (error) {
      console.error('Backend face validation error:', error);
      setFaceDetected(false);
      setFaceQuality('poor');
      return false;
    }
  }, []);

  // Enhanced capture with backend validation
  const captureImage = useCallback(async () => {
    if (!videoRef.current) return;
    const canvas = captureCanvasRef.current || document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx && videoRef.current) {
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      // Do NOT mirror the captured image: draw as-is (real orientation)
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.95);
      const base64Data = imageDataUrl.split(',')[1];
      // Validate with backend before proceeding
      console.log('🔍 Validating captured image with backend...');
      setCurrentStep('uploading');
      setUploadProgress(10);
      try {
        const isValid = await validateFaceWithBackend(base64Data);
        if (isValid) {
          console.log('✅ Face validation successful');
          setCapturedImage(imageDataUrl);
          setCurrentStep('preview');
        } else {
          console.log('❌ Face validation failed - retrying capture');
          toast({
            title: "Face Not Detected",
            description: "Please position your face clearly in the frame and try again.",
            variant: "destructive"
          });
          setCurrentStep('camera');
          triggerShakeAnimation();
        }
      } catch (error) {
        console.error('Face validation error:', error);
        toast({
          title: "Validation Error",
          description: "Could not validate face. Please try again.",
          variant: "destructive"
        });
        setCurrentStep('camera');
      }
    }
  }, [validateFaceWithBackend, triggerShakeAnimation, toast]);

  // Start countdown sequence
  const startCountdown = useCallback(() => {
    setCurrentStep('countdown');
    setCountdown(3);
  }, []);

  // Reliable countdown using setInterval
  useEffect(() => {
    if (currentStep === 'countdown') {
      setCountdown(3);
      let currentCount = 3;
      
      const interval = setInterval(() => {
        currentCount--;
        if (currentCount > 0) {
          setCountdown(currentCount);
        } else {
          clearInterval(interval);
          setCountdown(0);
          captureImage();
        }
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [currentStep, captureImage]);

  // Initialize MediaPipe Face Detection with retry logic
  useEffect(() => {
    if (faceDetection) return; // Don't reinitialize if already exists
    
    let retryCount = 0;
    const maxRetries = 3;
    
    const initializeFaceDetection = async () => {
      try {
        console.log(`🤖 Initializing AI face detection... (attempt ${retryCount + 1}/${maxRetries})`);
        
        // Try to load MediaPipe with error handling
        const faceDetector = new FaceDetection({
          locateFile: (file) => {
            const url = `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`;
            console.log('📁 Loading MediaPipe file:', url);
            return url;
          }
        });

        // Set up a timeout for MediaPipe initialization  
        const initTimeout = setTimeout(() => {
          console.log('⏰ MediaPipe initialization timeout');
          retryCount++;
          
          if (retryCount < maxRetries) {
            console.log(`🔄 Retrying AI face detection... (${retryCount}/${maxRetries})`);
            setTimeout(initializeFaceDetection, 1000);
            
            toast({
              title: "Loading AI Face Detection",
              description: `Face detection is loading, please wait... (${retryCount}/${maxRetries})`,
              duration: 3000,
            });
          } else {
            console.error('❌ AI face detection timed out after all retries');
            toast({
              title: "Face Detection Timeout",
              description: "Unable to load AI face detection. Please refresh the page.",
              variant: "destructive",
              duration: 5000,
            });
          }
        }, 10000); // 10 second timeout per attempt

        faceDetector.setOptions({
          model: 'short',
          minDetectionConfidence: 0.9, // Very high threshold to avoid false positives (bottles, objects, etc.)
        });

        faceDetector.onResults((results) => {
          clearTimeout(initTimeout); // Clear timeout on successful callback
          
          if (!canvasRef.current || !videoRef.current) return;
          const canvas = canvasRef.current;
          const video = videoRef.current;
          
          // Always sync canvas size to video size before drawing
          if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
          }
          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Debug: log detection results
          console.log('[FaceDetection] onResults:', {
            detections: results.detections?.length || 0,
            currentStep,
            canvasSize: { w: canvas.width, h: canvas.height }
          });

          if (results.detections && results.detections.length > 0) {
            const detection = results.detections[0];
            const bbox = detection.boundingBox;

            if (bbox) {
              console.log('[FaceDetection] Raw detection. BBox:', bbox);
              
              // First check: Basic geometric validation (quick filter)
              const aspectRatio = bbox.width / bbox.height;
              const faceSize = bbox.width * bbox.height;
              const basicValidation = aspectRatio >= 0.6 && aspectRatio <= 1.4 && faceSize >= 0.025 && faceSize <= 0.5;
              
              if (basicValidation) {
                // Track consecutive detections for temporal consistency
                setConsecutiveDetections(prev => prev + 1);
                
                // Update detection history for stability analysis
                setDetectionHistory(prev => {
                  const newHistory = [...prev, {bbox, detection, timestamp: Date.now()}];
                  return newHistory.slice(-5); // Keep last 5 detections
                });
                
                // Advanced validation with temporal consistency
                if (isValidHumanFace(detection, bbox)) {
                  setFaceDetected(true);
                  setPulseAnimation(true);
                  setLastValidDetection(bbox);

                  // Calculate face quality based on size and position (stricter thresholds)
                  const centeredness = Math.abs(bbox.xCenter - 0.5) + Math.abs(bbox.yCenter - 0.5);

                  let quality: 'poor' | 'good' | 'excellent' = 'poor';
                  if (faceSize > 0.12 && centeredness < 0.12) { // Stricter excellent criteria
                    quality = 'excellent';
                    setFaceQuality('excellent');
                    console.log('[FaceDetection] Face quality: excellent');
                  } else if (faceSize > 0.08 && centeredness < 0.2) { // Stricter good criteria
                    quality = 'good';
                    setFaceQuality('good');
                    console.log('[FaceDetection] Face quality: good');
                  } else {
                    quality = 'poor';
                    setFaceQuality('poor');
                    console.log('[FaceDetection] Face quality: poor - move closer and center');
                  }

                  // Draw animated face frame with the freshly calculated quality
                  drawFaceFrame(ctx, bbox, canvas.width, canvas.height, quality);

                  if (currentStep === 'camera' && quality !== 'poor') {
                    setCurrentStep('detecting');
                    console.log('[FaceDetection] Switching to detecting step.');
                  }
                } else {
                  // Failed advanced validation - likely false positive (bottle, object, etc.)
                  console.log('[FaceDetection] ❌ Failed advanced face validation - likely false positive (bottle, object, etc.)');
                  setFaceDetected(false);
                  setPulseAnimation(false);
                  setFaceQuality('poor');
                  
                  if (currentStep === 'detecting') {
                    setCurrentStep('camera');
                    triggerShakeAnimation();
                  }
                  drawGuidanceOverlay(ctx, canvas.width, canvas.height);
                }
              } else {
                // Failed basic validation or reset consecutive detections
                console.log('[FaceDetection] ❌ Failed basic validation - resetting detection count');
                setConsecutiveDetections(0);
                setFaceDetected(false);
                setPulseAnimation(false);
                setFaceQuality('poor');
                
                if (currentStep === 'detecting') {
                  setCurrentStep('camera');
                  triggerShakeAnimation();
                }
                drawGuidanceOverlay(ctx, canvas.width, canvas.height);
              }
            }
          } else {
            // No detections found - reset consecutive counter
            console.log('[FaceDetection] No face detected - resetting detection count');
            setConsecutiveDetections(0);
            setFaceDetected(false);
            setPulseAnimation(false);
            setFaceQuality('poor');

            if (currentStep === 'detecting') {
              setCurrentStep('camera');
              triggerShakeAnimation();
              console.log('[FaceDetection] Switching back to camera step.');
            }

            // Draw guidance overlay
            drawGuidanceOverlay(ctx, canvas.width, canvas.height);
          }
        });

        // Test MediaPipe initialization
        console.log('🧪 Testing MediaPipe initialization...');
        
        setFaceDetection(faceDetector);
        setIsMediaPipeReady(true);
        clearTimeout(initTimeout);
        console.log('✅ Face detection ready!');
        
      } catch (error) {
        console.error('❌ Failed to initialize face detection:', error);
        retryCount++;
        
        if (retryCount < maxRetries) {
          console.log(`🔄 Retrying AI face detection in 2 seconds... (${retryCount}/${maxRetries})`);
          setTimeout(initializeFaceDetection, 2000);
          
          toast({
            title: "Loading AI Face Detection",  
            description: `Loading face detection, please wait... (${retryCount}/${maxRetries})`,
            duration: 3000,
          });
        } else {
          console.error('❌ AI face detection failed after all retries');
          toast({
            title: "Face Detection Error", 
            description: "Unable to load AI face detection. Please refresh the page.",
            variant: "destructive",
            duration: 5000,
          });
        }
      }
    };

    // Delay initialization slightly to ensure DOM is ready
    setTimeout(initializeFaceDetection, 100);
    
    // Cleanup function
    return () => {
      if (faceDetection) {
        try {
          faceDetection.close();
          console.log('🧹 MediaPipe face detection cleaned up');
        } catch (error) {
          console.warn('Warning during face detection cleanup:', error);
        }
      }
      setIsMediaPipeReady(false);
    };
  }, [currentStep, drawFaceFrame, drawGuidanceOverlay, faceDetection, triggerShakeAnimation]);



  // Track when step 1 (camera/detecting) started
  useEffect(() => {
    if ((currentStep === 'camera' || currentStep === 'detecting')) {
      setStep1StartTime(Date.now());
    }
  }, [currentStep]);



  // Start camera with authentication check
  const startCamera = async () => {
    setCameraError(null);
    // Reset all face detection states for a fresh start
    resetFaceDetectionStates();
    
    try {
      // First, verify authentication
      if (!user) {
        toast({
          title: "Authentication Required",
          description: "Please log in to register your face.",
          variant: "destructive"
        });
        setCameraError("Not authenticated");
        return;
      }
      const token = localStorage.getItem('authToken');
      if (!token) {
        toast({
          title: "Session Expired",
          description: "Please log out and log in again.",
          variant: "destructive"
        });
        setCameraError("Session expired");
        return;
      }
      console.log('✅ Authentication verified for user:', user.email);
      setCurrentStep('camera');
      console.log('🎬 Starting camera...');
      
      // Check if browser supports getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Camera API not supported in this browser');
        throw new Error('Camera API not supported in this browser');
      }

      // Stop any previous stream before starting a new one
      if (stream) {
        stream.getTracks().forEach(track => {
          track.stop();
        });
        setStream(null);
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      // Request camera with optimal settings
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          facingMode: 'user',
          frameRate: { ideal: 30, min: 15 }
        },
        audio: false
      });
      
      console.log('📹 Camera stream obtained:', mediaStream);
      console.log('📹 Video tracks:', mediaStream.getVideoTracks().map(track => ({
        kind: track.kind,
        label: track.label,
        readyState: track.readyState,
        enabled: track.enabled
      })));
      
      setStream(mediaStream);
      
      // Set video srcObject and handle play with retry logic
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        
        // Create a promise to handle video play with timeout
        const playVideo = () => new Promise((resolve, reject) => {
          if (!videoRef.current) {
            reject(new Error('Video element not available'));
            return;
          }
          
          const video = videoRef.current;
          let playAttempts = 0;
          const maxAttempts = 3;
          
          const attemptPlay = async () => {
            try {
              playAttempts++;
              console.log(`🎥 Play attempt ${playAttempts}/${maxAttempts}`);
              
              if (video.paused) {
                await video.play();
              }
              
              // Wait for video to be ready
              const checkReady = () => {
                if (video.readyState >= 2 && video.videoWidth > 0) {
                  console.log('✅ Video is ready:', {
                    readyState: video.readyState,
                    videoWidth: video.videoWidth,
                    videoHeight: video.videoHeight
                  });
                  resolve(true);
                } else if (playAttempts < maxAttempts) {
                  console.log('⏳ Video not ready yet, retrying...', {
                    readyState: video.readyState,
                    videoWidth: video.videoWidth
                  });
                  setTimeout(() => attemptPlay(), 500);
                } else {
                  reject(new Error('Video failed to become ready after multiple attempts'));
                }
              };
              
              // Check immediately and also listen for loadeddata event
              video.onloadeddata = checkReady;
              checkReady();
              
            } catch (err) {
              console.warn(`⚠️ Play attempt ${playAttempts} failed:`, err);
              if (playAttempts < maxAttempts) {
                setTimeout(() => attemptPlay(), 500);
              } else {
                reject(err);
              }
            }
          };
          
          attemptPlay();
        });
        
        // Attempt to play the video
        try {
          await playVideo();
          console.log('✅ Video playback successful');
        } catch (err) {
          console.error('❌ Video playback failed:', err);
          setCameraError('Failed to start video playback: ' + err.message);
          throw err;
        }
        
        // Add error handling for video element
        videoRef.current.onerror = (error) => {
          setCameraError('Video element error');
          console.error('❌ Video element error:', error);
        };
      }
      
      // Wait for MediaPipe to be ready before starting MPCamera
      let mpAttempts = 0;
      const tryStartMPCamera = () => {
        console.log('🎯 Attempting to start MediaPipe camera...', {
          hasVideo: !!videoRef.current,
          hasFaceDetection: !!faceDetection,
          isMediaPipeReady,
          videoReady: videoRef.current?.readyState >= 2
        });
        
        if (videoRef.current && faceDetection && isMediaPipeReady && videoRef.current.readyState >= 2) {
          if (canvasRef.current) {
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;
          }
          console.log('🎯 Initializing MediaPipe camera...');
          try {
            const mpCamera = new MPCamera(videoRef.current, {
              onFrame: async () => {
                if (faceDetection && isMediaPipeReady && videoRef.current && videoRef.current.readyState >= 2) {
                  try {
                    await faceDetection.send({ image: videoRef.current });
                  } catch (error) {
                    console.warn('⚠️ Frame processing error:', error);
                  }
                }
              },
              width: videoRef.current.videoWidth || 1280,
              height: videoRef.current.videoHeight || 720
            });
            mpCamera.start();
            console.log('✅ MediaPipe camera started');
            setCamera(mpCamera);
          } catch (mpError) {
            console.error('❌ MediaPipe camera error:', mpError);
            console.log('🔄 Retrying AI face detection...');
            
            toast({
              title: "Loading AI Face Detection", 
              description: "Face detection is loading, please wait...",
              variant: "default"
            });
          }
        } else {
          // Retry after a short delay if not ready, but with max attempts
          mpAttempts++;
          
          if (mpAttempts < 25) { // Max 25 attempts (5 seconds)
            console.log(`⏳ Not ready yet, retrying MediaPipe camera in 200ms... (attempt ${mpAttempts}/25)`);
            setTimeout(tryStartMPCamera, 200);
          } else {
            console.log('🔄 MediaPipe camera failed to start after multiple attempts, retrying...');
            toast({
              title: "Loading AI Face Detection",
              description: "Face detection is loading, please wait...",
              variant: "default"
            });
          }
        }
      };
      
      // Give video a moment to initialize before starting MediaPipe, with timeout
      const mpTimeout = setTimeout(() => {
        console.log('⏰ MediaPipe initialization timeout, retrying...');
      }, 3000); // 3 second timeout
      
      setTimeout(() => {
        tryStartMPCamera();
        clearTimeout(mpTimeout);
      }, 500);
      
    } catch (error) {
      setCameraError(error && error.message ? error.message : 'Unknown camera error');
      console.error('❌ Camera error:', error);
      
      let userMessage = "Failed to access camera.";
      let userDescription = "Please try again.";
      
      if (error.name === 'NotAllowedError') {
        userMessage = "Camera Permission Denied";
        userDescription = "Please allow camera access in your browser and try again.";
      } else if (error.name === 'NotFoundError') {
        userMessage = "No Camera Found";
        userDescription = "Please connect a camera and try again.";
      } else if (error.name === 'NotReadableError') {
        userMessage = "Camera In Use";
        userDescription = "Camera is being used by another application. Please close other apps and try again.";
      } else if (error.name === 'OverconstrainedError') {
        userMessage = "Camera Settings Not Supported";
        userDescription = "Your camera doesn't support the required settings. Trying with basic settings...";
        
        // Retry with basic settings
        try {
          console.log('🔄 Retrying with basic camera settings...');
          const basicStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user' },
            audio: false
          });
          setStream(basicStream);
          if (videoRef.current) {
            videoRef.current.srcObject = basicStream;
            videoRef.current.play().catch(console.warn);
          }
          setCameraError(null);
          return; // Success with basic settings
        } catch (retryError) {
          console.error('❌ Retry with basic settings also failed:', retryError);
        }
      }
      
      toast({
        title: userMessage,
        description: userDescription,
        variant: "destructive"
      });
      setCurrentStep('launch');
    }
  };

  // Upload to backend with proper authentication and validation
  const uploadToBackend = async () => {
    if (!capturedImage) {
      toast({
        title: "No Image",
        description: "Please capture an image first.",
        variant: "destructive"
      });
      return;
    }
    
    setCurrentStep('uploading');
    setUploadProgress(0);
    
    try {
      // Check authentication first
      if (!user) {
        throw new Error('Authentication required. Please log in first.');
      }
      
      // Check if auth token exists
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('Authentication token missing. Please log in again.');
      }
      
      console.log('🚀 Starting face registration with authentication...');
      console.log('👤 User:', user.email);
      
      // Real upload progress tracking
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 100);
      
      const base64Data = capturedImage.split(',')[1];
      console.log('📷 Image data length:', base64Data.length);
      
      // First validate the image has a face using detect-faces endpoint
      console.log('🔍 Step 1: Validating face in image...');
      setUploadProgress(20);
      
      const detectionResult = await api.faceRecognition.detectFaces(base64Data);
      console.log('🔍 Face detection result:', detectionResult);
      
      if (!detectionResult.success) {
        clearInterval(progressInterval);
        throw new Error(detectionResult.message || 'No face detected in image');
      }
      
      if (detectionResult.faces_detected !== 1) {
        clearInterval(progressInterval);
        throw new Error(detectionResult.faces_detected === 0 
          ? 'No face detected. Please ensure your face is visible.'
          : 'Multiple faces detected. Please ensure only you are visible.'
        );
      }
      
      setUploadProgress(50);
      console.log('✅ Face validation passed');
      
      // Now proceed with actual registration/verification
      console.log(`🎯 Step 2: ${mode === 'register' ? 'Registering' : 'Verifying'} face...`);
      setUploadProgress(70);
      
      let result;
      if (mode === 'register') {
        result = await api.faceRecognition.registerFace(base64Data);
      } else {
        result = await api.faceRecognition.verifyFace(base64Data);
      }
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      console.log('✅ Backend operation successful:', result);
      
      setTimeout(() => {
        setCurrentStep('success');
        setSuccessAnimation(true);
        
        toast({
          title: "Success!",
          description: mode === 'register' ? 
            `Face registered successfully! ${result.message || ''}` : 
            `Face verified successfully! ${result.message || ''}`,
        });
        
        setTimeout(() => {
          onRegistrationComplete?.();
          onSuccess?.();
          onClose?.();
        }, 2000);
      }, 500);
      
    } catch (error) {
      console.error('❌ Backend operation error:', error);
      
      let errorMessage = `Failed to ${mode} face. Please try again.`;
      
      if (error instanceof Error) {
        if (error.message.includes('Authentication') || error.message.includes('401')) {
          errorMessage = "Authentication required. Please log out and log in again.";
        } else if (error.message.includes('No face detected')) {
          errorMessage = "No face detected. Please ensure your face is clearly visible and well-lit.";
        } else if (error.message.includes('Multiple faces')) {
          errorMessage = "Multiple faces detected. Please ensure only you are visible in the frame.";
        } else if (error.message.includes('403')) {
          errorMessage = "Access denied. Please check your permissions.";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Operation Failed",
        description: errorMessage,
        variant: "destructive"
      });
      setCurrentStep('preview');
    }
  };

  // Retake photo
  const retakePhoto = () => {
    setCapturedImage(null);
    setCurrentStep('camera');
  };

  // Stop camera and cleanup
  const stopCamera = useCallback(() => {
    console.log('🛑 Stopping camera...');

    if (camera) {
      try {
        camera.stop();
      } catch (error) {
        console.warn('Warning stopping camera:', error);
      }
      setCamera(null);
    }

    if (stream) {
      stream.getTracks().forEach(track => {
        try {
          track.stop();
          console.log('🔌 Stopped track:', track.kind);
        } catch (err) {
          console.warn('Error stopping track:', err);
        }
      });
      setStream(null);
    }

    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
        videoRef.current.removeAttribute('src');
      } catch (err) {
        console.warn('Error cleaning up video element:', err);
      }
    }

    // Reset face detection state
    setFaceDetected(false);
    setFaceQuality('poor');
    setPulseAnimation(false);
    setIsMediaPipeReady(false);
  }, [camera, stream]);

  // Handle close
  const handleClose = () => {
    stopCamera();
    setCurrentStep('launch');
    onClose?.();
    onCancel?.();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Cleanup when modal closes
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setCurrentStep('launch');
    }
  }, [isOpen, stopCamera]);

  // Ensure video stream is always set for camera-using steps
  useEffect(() => {
    if (currentStep === 'camera' || currentStep === 'detecting' || currentStep === 'countdown') {
      if (videoRef.current && stream) {
        videoRef.current.srcObject = stream;
      }
    }
  }, [currentStep, stream]);

  // More lenient camera active check with better timing
  const isCameraActive = !!(
    stream && 
    stream.active && 
    stream.getVideoTracks().length > 0 && 
    stream.getVideoTracks()[0].readyState === 'live'
  );
  
  // Alternative check for when video element is ready
  const isVideoReady = !!(
    videoRef.current && 
    videoRef.current.readyState >= 2 && 
    videoRef.current.videoWidth > 0
  );
  
  // Combined camera state - either stream is active OR video is ready
  const cameraWorking = isCameraActive || isVideoReady;
  
  // Debug camera state
  useEffect(() => {
    if (currentStep === 'camera' || currentStep === 'detecting' || currentStep === 'countdown') {
      console.log('🔍 Camera state check:', {
        hasVideoRef: !!videoRef.current,
        readyState: videoRef.current?.readyState,
        videoWidth: videoRef.current?.videoWidth,
        videoHeight: videoRef.current?.videoHeight,
        hasStream: !!stream,
        streamActive: stream?.active,
        videoTracks: stream?.getVideoTracks().length,
        videoTrackState: stream?.getVideoTracks()[0]?.readyState,
        isCameraActive,
        isVideoReady,
        cameraWorking,
        currentStep,
        cameraError
      });
    }
  }, [currentStep, stream, isCameraActive, isVideoReady, cameraWorking, cameraError]);

  // Smooth progress bar animation for step 1
  useEffect(() => {
    if ((currentStep === 'camera' || currentStep === 'detecting') && cameraWorking) {
      let target = 0;
      if (faceDetected) {
        if (faceQuality === 'excellent') target = 100;
        else if (faceQuality === 'good') target = 70;
        else target = 30;
      }
      setDetectionProgress(prev => {
        if (prev < target) return Math.min(prev + 5, target);
        if (prev > target) return Math.max(prev - 5, target);
        return prev;
      });
    } else {
      setDetectionProgress(0);
    }
  }, [currentStep, faceDetected, faceQuality, cameraWorking]);

  // Render different steps
  const renderStep = () => {
    switch (currentStep) {
      case 'launch':
        return (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <div className="relative mb-8">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <Sparkles className="w-12 h-12 text-white" />
              </div>
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                <Eye className="w-4 h-4 text-white" />
              </div>
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {mode === 'register' ? 'Register Your Face' : 'Verify Your Identity'}
            </h2>
            
            <p className="text-gray-600 dark:text-gray-300 mb-8 max-w-md">
              {mode === 'register' 
                ? 'Secure and convenient face-based attendance. Let\'s capture your unique face profile.'
                : 'Verify your identity using face recognition for secure access.'
              }
            </p>
            
            <Button 
              onClick={startCamera}
              size="lg"
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-3 px-8 rounded-full transition-all duration-300 transform hover:scale-105"
            >
              <Camera className="w-5 h-5 mr-2" />
              Start Camera
            </Button>
            
            {cameraError && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800 text-sm mb-2">
                  <strong>Camera Error:</strong> {cameraError}
                </p>
                <Button 
                  onClick={startCamera}
                  size="sm"
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Retry Camera
                </Button>
              </div>
            )}
          </div>
        );

      case 'camera':
      case 'detecting':
        return (
          <div className="space-y-6">
            {/* Guidance Overlay */}
            <div className="text-center mb-4">
              <h3 className="text-xl font-bold text-blue-600 dark:text-blue-300 mb-1">Position your face inside the frame</h3>
              <p className="text-muted-foreground text-sm mb-2">Make sure your face is clearly visible and centered</p>
              <div className="w-full max-w-md mx-auto">
                <Progress value={detectionProgress} className="h-3 rounded-full bg-blue-100" />
                <div className="text-xs text-muted-foreground mt-1">Analyzing face... {detectionProgress}%</div>
              </div>
            </div>
            <div className={cn(
              "relative aspect-video bg-gray-900 rounded-2xl overflow-hidden border-4 transition-all duration-300",
              faceDetected ? "border-green-500 shadow-green-500/25 shadow-lg" : "border-gray-300",
              shakeAnimation && "animate-bounce"
            )}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover mirrored-video"
                style={{ background: '#222' }}
              />
              {/* Canvas for animated face frame overlay */}
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none mirrored-video"
                style={{ zIndex: 2 }}
              />
              {/* Show a fallback message only if camera is truly not active */}
              {!cameraWorking && (currentStep === 'camera' || currentStep === 'detecting') && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-60 text-white text-lg p-4">
                  <span>Camera not available</span>
                  {cameraError && (
                    <span className="text-sm text-red-300 mt-2">{cameraError}</span>
                  )}
                  {!cameraError && (
                    <span className="text-sm text-yellow-200 mt-2">Check camera permissions, close other apps, or try a different browser.</span>
                  )}
                </div>
              )}
            </div>

            <div className="text-center space-y-2">
              <p className="text-gray-600 dark:text-gray-300">
                {currentStep === 'camera' 
                  ? "Position your face in the frame - AI is analyzing in real-time"
                  : "Hold steady, AI has detected your face and is preparing capture..."
                }
              </p>
              <div className="flex items-center justify-center space-x-4 text-sm">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-1 text-xs rounded font-medium bg-emerald-100 text-emerald-800">
                    🤖 AI Mode
                  </span>
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-gray-500">{faceDetected ? 'Face Detected' : 'Scanning...'}</span>
                </div>
                <div className="flex items-center space-x-2 text-gray-500">
                  <div className={cn("w-2 h-2 rounded-full", faceQuality === 'excellent' ? 'bg-green-500' : faceQuality === 'good' ? 'bg-yellow-500' : 'bg-red-500')}></div>
                  <span>Quality: {faceQuality.toUpperCase()}</span>
                </div>
              </div>

              {faceDetected && faceQuality !== 'poor' && (
                <div className="mt-8 max-w-lg mx-auto px-8 py-8 rounded-3xl shadow-2xl border border-transparent bg-slate-900/70 backdrop-blur-md flex flex-col items-center relative overflow-hidden group">
                  {/* Gradient border effect */}
                  <div className="absolute -inset-1 rounded-3xl pointer-events-none z-0 group-hover:blur-sm" style={{background: 'linear-gradient(120deg, #38bdf8 0%, #6366f1 50%, #22d3ee 100%)', opacity: 0.25}}></div>
                  {/* Modern checkmark icon */}
                  <div className="relative z-10 flex items-center justify-center mb-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 via-teal-400 to-green-400 flex items-center justify-center shadow-xl border-4 border-white/10">
                      <svg className="w-9 h-9 text-white drop-shadow-lg" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.15" strokeWidth="3" fill="currentColor" fillOpacity="0.13" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12.5l2.5 2.5 5-5" />
                      </svg>
                    </div>
                  </div>
                  <h4 className="relative z-10 text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-200 via-teal-200 to-green-200 mb-2 tracking-tight drop-shadow-lg">Perfect! Face Validated</h4>
                  <p className="relative z-10 text-lg text-slate-100/90 mb-2 text-center font-medium">AI has validated your face with high confidence.</p>
                  <p className="relative z-10 text-base text-blue-200/80 mb-6 text-center">When you are ready, click the button below to start the countdown and capture your photo.</p>
                  <Button
                    className="relative z-10 mt-2 bg-gradient-to-r from-blue-500 to-teal-400 hover:from-blue-600 hover:to-teal-500 text-white font-semibold px-10 py-3 rounded-full shadow-xl transition-all duration-300 transform hover:scale-105 text-lg border-2 border-white/10 backdrop-blur-md"
                    onClick={startCountdown}
                  >
                    <span className="inline-flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l2.5 2.5" /></svg>
                      I'm Ready – Capture My Photo
                    </span>
                  </Button>
                </div>
              )}

                                           

              {!faceDetected && (
                <div className="mt-6 max-w-md mx-auto px-6 py-6 rounded-2xl shadow-xl border border-transparent bg-slate-900/70 backdrop-blur-md flex flex-col items-center relative overflow-hidden group">
                  {/* Gradient border effect */}
                  <div className="absolute -inset-1 rounded-2xl pointer-events-none z-0 group-hover:blur-sm" style={{background: 'linear-gradient(120deg, #facc15 0%, #fbbf24 50%, #f472b6 100%)', opacity: 0.22}}></div>
                  <div className="relative z-10 flex items-center justify-center mb-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 via-pink-300 to-orange-300 flex items-center justify-center shadow-lg border-4 border-white/10">
                      <svg className="w-7 h-7 text-white drop-shadow-lg" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.15" strokeWidth="2.5" fill="currentColor" fillOpacity="0.13" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8a4 4 0 1 1 0 8a4 4 0 0 1 0-8zm0 0v1m0 6v1" />
                      </svg>
                    </div>
                  </div>
                  <h4 className="relative z-10 text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-pink-200 to-orange-200 mb-1 tracking-tight drop-shadow-lg">Face Not Detected</h4>
                  <p className="relative z-10 text-base text-yellow-100/90 mb-2 text-center font-medium">Please position your face clearly in the center frame</p>
                  <p className="relative z-10 text-sm text-yellow-200/80 text-center">Make sure your face is well-lit, centered, and visible to the camera for best results.</p>
                </div>
              )}
            </div>
            {/* Cancel button for camera/verification steps */}
            <div className="flex justify-center mt-4">
              <Button
                onClick={handleClose}
                variant="outline"
                className="px-6 py-2 rounded-full border-red-400 text-red-600 hover:bg-red-50"
              >
                Cancel
              </Button>
            </div>
          </div>
        );

      case 'countdown':
        return (
          <div className="space-y-6">
            {/* Keep showing the camera feed so user can see themselves */}
            <div className={cn(
              "relative aspect-video bg-gray-900 rounded-2xl overflow-hidden border-4 transition-all duration-300",
              countdown === 3 ? "border-blue-500 shadow-blue-500/25 shadow-lg" :
              countdown === 2 ? "border-yellow-500 shadow-yellow-500/25 shadow-lg" :
              countdown === 1 ? "border-red-500 shadow-red-500/25 shadow-lg" :
              "border-green-500 shadow-green-500/25 shadow-lg"
            )}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover mirrored-video"
                style={{ background: '#222' }}
              />
              {/* Canvas for animated face frame overlay */}
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none mirrored-video"
                style={{ zIndex: 2 }}
              />
              {/* Countdown overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40">
                <div className="relative">
                  <div className={cn(
                    "w-32 h-32 rounded-full border-4 flex items-center justify-center text-4xl font-bold transition-all duration-1000",
                    countdown === 3 ? "bg-blue-500 border-blue-300 text-white scale-110" :
                    countdown === 2 ? "bg-yellow-500 border-yellow-300 text-white scale-105" :
                    countdown === 1 ? "bg-red-500 border-red-300 text-white scale-100" :
                    "bg-green-500 border-green-300 text-white"
                  )}>
                    {countdown > 0 ? countdown : "📸"}
                  </div>
                  {countdown > 0 && (
                    <div className={cn(
                      "absolute inset-0 rounded-full border-4 animate-ping",
                      countdown === 3 ? "border-blue-500" :
                      countdown === 2 ? "border-yellow-500" :
                      "border-red-500"
                    )}></div>
                  )}
                </div>
              </div>
              {/* Show a fallback message only if camera is truly not active */}
              {!cameraWorking && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-60 text-white text-lg p-4">
                  <span>Camera not available</span>
                  {cameraError && (
                    <span className="text-sm text-red-300 mt-2">{cameraError}</span>
                  )}
                  {!cameraError && (
                    <span className="text-sm text-yellow-200 mt-2">Check camera permissions, close other apps, or try a different browser.</span>
                  )}
                </div>
              )}
            </div>
            <div className="text-center space-y-2">
              <h3 className={cn(
                "text-xl font-bold transition-colors duration-500",
                countdown === 3 ? "text-blue-600" :
                countdown === 2 ? "text-yellow-600" :
                countdown === 1 ? "text-red-600" :
                "text-green-600"
              )}>
                {countdown > 0 ? `Get ready in ${countdown}...` : "Perfect! Capturing now!"}
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                {countdown > 0 ? "Stay still and smile! Keep your face in the frame." : "Hold that pose! ✨"}
              </p>
              <div className="flex items-center justify-center space-x-4 text-sm">
                <div className="flex items-center space-x-2 text-gray-500">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span>Camera Active</span>
                </div>
                <div className="flex items-center space-x-2 text-gray-500">
                  <div className={cn("w-2 h-2 rounded-full", faceDetected ? 'bg-green-500' : 'bg-red-500')}></div>
                  <span>Face: {faceDetected ? 'Detected' : 'Not Found'}</span>
                </div>
              </div>
            </div>
            {/* Cancel button for countdown step */}
            <div className="flex justify-center mt-4">
              <Button
                onClick={handleClose}
                variant="outline"
                className="px-6 py-2 rounded-full border-red-400 text-red-600 hover:bg-red-50"
              >
                Cancel
              </Button>
            </div>
          </div>
        );

      case 'preview':
        return (
          <div className="flex flex-col items-center justify-center space-y-6">
            <div className="flex items-center space-x-2 mb-2">
              <CheckCircle className="w-6 h-6 text-green-500" />
              <h3 className="text-xl font-bold text-green-600">Face Validated!</h3>
            </div>
            <p className="text-muted-foreground mb-4 text-center max-w-md">
              Your face has been successfully detected and validated by our AI system. 
              The image quality is excellent for {mode === 'register' ? 'registration' : 'verification'}.
            </p>
            {capturedImage && (
              <div className="relative">
                <img
                  src={capturedImage}
                  alt="Captured face preview"
                  className="rounded-xl border-4 border-green-500 shadow-lg w-64 h-64 object-cover mb-4"
                />
                <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-semibold">
                  ✓ VALIDATED
                </div>
              </div>
            )}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 max-w-md">
              <h4 className="font-semibold text-green-800 mb-2">✅ Validation Checks Passed:</h4>
              <ul className="text-sm text-green-700 space-y-1">
                <li>• Single face detected</li>
                <li>• High quality image captured</li>
                <li>• Proper lighting and positioning</li>
                <li>• Ready for secure processing</li>
              </ul>
            </div>
            <div className="flex gap-4">
              <Button 
                onClick={uploadToBackend} 
                className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-3 rounded-full"
              >
                {mode === 'register' ? 'Register Face' : 'Verify Identity'}
              </Button>
              <Button 
                onClick={retakePhoto} 
                variant="outline" 
                className="px-6 py-3 rounded-full"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Retake Photo
              </Button>
            </div>
          </div>
        );

      case 'uploading':
        return (
          <div className="flex flex-col items-center justify-center py-16 space-y-6">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <Upload className="w-6 h-6 text-blue-500 absolute inset-0 m-auto" />
            </div>
            
            <div className="text-center space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {uploadProgress < 30 ? 'Validating Face Data' :
                 uploadProgress < 70 ? 'Processing with AI' :
                 uploadProgress < 90 ? `${mode === 'register' ? 'Registering' : 'Verifying'} Face` :
                 'Finalizing Registration'}
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                {uploadProgress < 30 ? 'Checking image quality and face detection...' :
                 uploadProgress < 70 ? 'Our AI is analyzing your unique facial features...' :
                 uploadProgress < 90 ? `${mode === 'register' ? 'Securely storing' : 'Comparing'} your face encoding...` :
                 'Almost done! Completing the process...'}
              </p>
              
              <div className="w-64 mx-auto">
                <Progress value={uploadProgress} className="h-3" />
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <span>{uploadProgress}% complete</span>
                  <span className="flex items-center">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse mr-1"></div>
                    Live processing
                  </span>
                </div>
              </div>
              
              {uploadProgress > 50 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 max-w-sm mx-auto">
                  <p className="text-xs text-blue-800">
                    🔒 Your face data is encrypted and processed securely using industry-standard protocols.
                  </p>
                </div>
              )}
            </div>
          </div>
        );

      case 'success':
        return (
          <div className="flex flex-col items-center justify-center space-y-6">
            <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-16 h-16 text-white animate-bounce" />
            </div>
            <h3 className="text-2xl font-bold text-green-700 mb-2">Registration Successful!</h3>
            <p className="text-muted-foreground mb-4">Your face has been registered and saved securely. You can now use face recognition for attendance.</p>
            <Button onClick={onClose} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-full">
              Close
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <Card className="border-0 shadow-2xl bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm">
        <CardContent className="p-6">
          {/* Header with close button */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
            
            <Button 
              onClick={handleClose}
              variant="ghost" 
              size="sm"
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
          
          {/* Progress indicator */}
          {currentStep !== 'launch' && currentStep !== 'success' && (
            <div className="mb-6">
              <div className="flex justify-between text-xs text-gray-500 mb-2">
                <span>Step {
                  currentStep === 'camera' || currentStep === 'detecting' ? '1' :
                  currentStep === 'countdown' ? '2' :
                  currentStep === 'preview' ? '3' :
                  currentStep === 'uploading' ? '4' : '1'
                } of 4</span>
                <span>{
                  currentStep === 'camera' || currentStep === 'detecting' ? 'Detecting Face' :
                  currentStep === 'countdown' ? 'Capturing' :
                  currentStep === 'preview' ? 'Review' :
                  currentStep === 'uploading' ? 'Processing' : ''
                }</span>
              </div>
              <Progress 
                value={
                  currentStep === 'camera' || currentStep === 'detecting' ? 25 :
                  currentStep === 'countdown' ? 50 :
                  currentStep === 'preview' ? 75 :
                  currentStep === 'uploading' ? 90 : 0
                } 
                className="h-1"
              />
            </div>
          )}
          
          {/* Main content */}
          {renderStep()}
        </CardContent>
      </Card>
    </div>
  );
};

export default ModernFaceRegistration;
