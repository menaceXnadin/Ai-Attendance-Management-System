import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Camera, Upload, CheckCircle, X, AlertTriangle, User, Loader2, Users, Brain, Timer, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/integrations/api/client';
import { useRealFaceDetection } from '@/hooks/useRealFaceDetection';

interface DetectedFace {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

interface FaceRegistrationProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  isOpen: boolean;
}

const FaceRegistration: React.FC<FaceRegistrationProps> = ({
  onSuccess,
  onCancel,
  isOpen
}) => {
  const [isActive, setIsActive] = useState(false);
  const [mirrorPreview, setMirrorPreview] = useState(true);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [currentStep, setCurrentStep] = useState<'capture' | 'preview' | 'success'>('capture');
  const [registrationResult, setRegistrationResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  
  // Manual capture states
  const [currentCapture, setCurrentCapture] = useState(0);
  const [instructions, setInstructions] = useState("Position your face in the center");
  const [qualityScore, setQualityScore] = useState(0);
  const [showManualCapture, setShowManualCapture] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const readinessHistoryRef = useRef<number[]>([]);
  const manualCaptureTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Stabilizers and UI smoothing
  const lastInstructionRef = useRef<string>("");
  const instructionCooldownRef = useRef<number>(0);
  const qualityUpdateCooldownRef = useRef<number>(0);
  const smoothCenterRef = useRef<{ x: number; y: number; area: number } | null>(null);
  const { toast } = useToast();

  // Debounced instruction setter to prevent flicker/blinking
  const setInstructionStable = useCallback((next: string) => {
    const now = performance.now();
    // Only change instruction if different and cooldown elapsed
    const prev = lastInstructionRef.current;
    const meaningfulChange = next !== prev && !(prev && next && prev.startsWith("Move") && next.startsWith("Move"));
    if (!meaningfulChange && instructionCooldownRef.current > now) return;

    lastInstructionRef.current = next;
    instructionCooldownRef.current = now + 800; // Increased to 800ms cooldown for more stability
    setInstructions(next);
  }, []);
  
  // Use real face detection
  const { 
    detectedFaces, 
    isModelLoaded, 
    error: faceDetectionError, 
    faceCount 
  } = useRealFaceDetection({
    videoRef,
    canvasRef: overlayCanvasRef,
    onFaceDetected: (faces) => {
      console.log('👤 Face detection callback:', faces.length, 'faces detected');
      analyzeFaceQuality(faces);
    },
    isActive: isActive && currentStep === 'capture',
    mirror: mirrorPreview
  });

  // Register faces function
  const registerFaces = useCallback(async () => {
    if (capturedImages.length === 0) return;
    
    setIsProcessing(true);
    
    try {
      // First, verify the face image quality
      const verificationResult = await api.faceRecognition.verifyFace(capturedImages[0]);
      
      if (!verificationResult.valid) {
        toast({
          title: "Image Quality Issue",
          description: verificationResult.message,
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      // Register the face with multiple images for better accuracy
      const result = await api.faceRecognition.registerFace(capturedImages[0]);
      
      setRegistrationResult(result);
      
      if (result.success) {
        setCurrentStep('success');
        toast({
          title: "Registration Successful",
          description: result.message,
        });
        
        // Call success callback after a short delay
        setTimeout(() => {
          if (onSuccess) onSuccess();
        }, 2000);
      } else {
        toast({
          title: "Registration Failed",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Registration error:', error);
      toast({
        title: "Registration Error",
        description: "An error occurred during registration. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [capturedImages, toast, onSuccess]);

  // Capture current frame into image and advance progress
  const captureImage = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    
    // Hard stop - don't capture more than 3 images
    if (currentCapture >= 3) {
      console.log('🛑 CAPTURE BLOCKED: Already have', currentCapture, 'images');
      return;
    }
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    if (!context || video.videoWidth === 0 || video.videoHeight === 0) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const newCaptureCount = currentCapture + 1;
    console.log('📸 CAPTURE:', { currentCapture, newCaptureCount, totalImages: capturedImages.length + 1 });
    
    setCapturedImages(prev => [...prev, dataUrl]);
    setCurrentCapture(newCaptureCount);
    
    toast({
      title: `Image ${newCaptureCount} Captured!`,
      description: newCaptureCount < 3 ? 
        `Captured ${newCaptureCount} of 3. Continue capturing or capture manually.` :
        "All images captured! Processing...",
    });

    if (newCaptureCount >= 3) {
      // All images captured, complete registration
      console.log('✅ ALL IMAGES CAPTURED - Starting registration...');
      setCurrentStep('preview');
    }
  }, [currentCapture, toast, capturedImages.length]);

  // Manual capture for backup
  const captureManually = useCallback(() => {
    if (currentCapture >= 3) {
      toast({
        title: "Capture Complete",
        description: "All 3 images have already been captured.",
        variant: "default",
      });
      return;
    }

    // Check if face is detected for better user experience
    if (faceCount === 0) {
      toast({
        title: "No Face Detected",
        description: "Please ensure your face is visible in the camera before capturing.",
        variant: "destructive",
      });
      return;
    }

    if (faceCount > 1) {
      toast({
        title: "Multiple Faces Detected",
        description: "Please ensure only your face is visible before capturing.",
        variant: "destructive",
      });
      return;
    }

    // Perform the capture
    console.log('📸 MANUAL CAPTURE: User initiated capture');
    captureImage();
    
    toast({
      title: "Manual Capture",
      description: `Image ${currentCapture + 1} captured manually!`,
    });
  }, [captureImage, currentCapture, faceCount, toast]);

  // Enhanced face quality analysis - Industry standard
  const analyzeFaceQuality = useCallback((faces: DetectedFace[]) => {
    console.log('🔍 Analyzing face quality:', faces.length, 'faces');
    
    if (faces.length === 0) {
      setInstructionStable("Move closer - no face detected");
      setQualityScore(0);
      return;
    }
    if (faces.length > 1) {
      setInstructionStable("Multiple faces detected - ensure only you are visible");
      setQualityScore(0);
      return;
    }
    const face = faces[0];
    const video = videoRef.current;
    const overlay = overlayCanvasRef.current;
    // Use overlay/display size so normalization matches the coordinates emitted by the detection hook
    const w = overlay?.width || video?.clientWidth || video?.videoWidth || 640;
    const h = overlay?.height || video?.clientHeight || video?.videoHeight || 480;

    // Convert to normalized [0..1] for stable scoring
    // Smooth normalized values with EMA to avoid jitter
    const nx = face.x / w;
    const ny = face.y / h;
    const nwidth = face.width / w;
    const nheight = face.height / h;
    const centerX = nx + nwidth / 2;
    const centerY = ny + nheight / 2;
    const area = nwidth * nheight;
    const alpha = 0.25; // smoothing factor
    if (!smoothCenterRef.current) {
      smoothCenterRef.current = { x: centerX, y: centerY, area };
    } else {
      smoothCenterRef.current = {
        x: smoothCenterRef.current.x * (1 - alpha) + centerX * alpha,
        y: smoothCenterRef.current.y * (1 - alpha) + centerY * alpha,
        area: smoothCenterRef.current.area * (1 - alpha) + area * alpha,
      };
    }
    const sCenterX = smoothCenterRef.current.x;
    const sCenterY = smoothCenterRef.current.y;
    const sArea = smoothCenterRef.current.area;

    let score = 50; // Start with base score instead of 0
    let instruction = "";
    
    // Use smoothed area for stability
    const faceArea = sArea; // normalized area
    console.log('🔍 Face Quality Debug:', {
      faceArea: faceArea.toFixed(4),
      centerX: sCenterX.toFixed(3),
      centerY: sCenterY.toFixed(3),
      confidence: face.confidence.toFixed(3)
    });
    
    if (faceArea > 0.32) { instruction = "Move back - too close to camera"; score -= 30; }
    else if (faceArea < 0.055) { instruction = "Move closer to camera"; score -= 20; }
    else if (faceArea >= 0.11 && faceArea <= 0.26) { score += 30; } else { score += 15; }

    const horizontalOffset = Math.abs(sCenterX - 0.5);
    const verticalOffset = Math.abs(sCenterY - 0.5);
    if (horizontalOffset > 0.25) { instruction = "Move to center horizontally"; score -= 20; }
    else if (verticalOffset > 0.25) { instruction = "Move to center vertically"; score -= 20; }
    else if (horizontalOffset < 0.17 && verticalOffset < 0.17) { score += 25; } else { score += 10; }

    if (face.confidence > 0.9) { score += 25; }
    else if (face.confidence > 0.75) { score += 15; }
    else if (face.confidence < 0.6) { instruction = "Improve lighting - face not clear enough"; score -= 25; }

    const qCurrent = score;
    readinessHistoryRef.current.push(qCurrent);
    if (readinessHistoryRef.current.length > 8) readinessHistoryRef.current.shift();
    const qAvg = readinessHistoryRef.current.reduce((a, b) => a + b, 0) / readinessHistoryRef.current.length;

    const qFinal = Math.max(0, Math.min(100, score));
    
    // Throttle quality score updates to reduce re-renders
    const now = performance.now();
    if (now > qualityUpdateCooldownRef.current) {
      setQualityScore(qFinal);
      qualityUpdateCooldownRef.current = now + 200; // Update at most every 200ms
    }
    
    setInstructionStable(instruction || "Hold still and look at the camera");

    console.log('📊 Quality Analysis:', {
      score: qFinal,
      historyLength: readinessHistoryRef.current.length,
      facesInCallback: faces.length,
      faceCountState: faceCount,
      currentCapture: currentCapture,
      isActive: isActive,
      qAvg: qAvg.toFixed(1),
      qCurrent: qCurrent
    });

    // Show manual capture after 5 seconds if auto-capture hasn't worked
    if (!manualCaptureTimeoutRef.current && cameraReady && isModelLoaded) {
      manualCaptureTimeoutRef.current = setTimeout(() => {
        setShowManualCapture(true);
        console.log('⏰ Manual capture option is now available');
        toast({
          title: "Manual Capture Available",
          description: "You can now manually capture your photos using the button below.",
          variant: "default",
        });
      }, 5000); // Reduced from 10000 to 5000ms (5 seconds)
    }
  }, [setInstructionStable, cameraReady, isModelLoaded, faceCount, isActive, toast, currentCapture]);

  

  // Camera setup - Let MediaPipe handle the camera
  const checkCameraReady = useCallback(() => {
    const video = videoRef.current;
    const ready = !!(video && video.readyState >= 3 && video.videoWidth > 0);
    setCameraReady(prev => (prev !== ready ? ready : prev));
    // Only influence instructions when camera is not yet ready
    if (!ready) {
      setInstructionStable("Camera is starting up...");
    } else if (qualityScore === 0) {
      setInstructionStable("Position your face in the center of the frame");
    }
  }, [qualityScore, setInstructionStable]);

  // Monitor camera readiness without creating our own stream
  useEffect(() => {
    if (!isActive) return;

    const checkReady = () => {
      checkCameraReady();
      animationRef.current = requestAnimationFrame(checkReady);
    };
    
    // Start checking after a brief delay to let MediaPipe initialize
    const startCheckingTimeout = setTimeout(() => {
      checkReady();
    }, 500);

    return () => {
      const animationId = animationRef.current;
      
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      if (manualCaptureTimeoutRef.current) {
        clearTimeout(manualCaptureTimeoutRef.current);
        manualCaptureTimeoutRef.current = null;
      }
      clearTimeout(startCheckingTimeout);
    };
  }, [isActive, checkCameraReady, isOpen]);

  // Cleanup when component unmounts or modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsActive(false);
      setCapturedImages([]);
      setCurrentStep('capture');
      setRegistrationResult(null);
      setCameraReady(false);
      setCurrentCapture(0);
      setInstructions("Position your face in the center");
      setQualityScore(0);
      readinessHistoryRef.current = [];
      setShowManualCapture(false);
      if (manualCaptureTimeoutRef.current) {
        clearTimeout(manualCaptureTimeoutRef.current);
        manualCaptureTimeoutRef.current = null;
      }
    }
  }, [isOpen]);

  const retryCapture = () => {
    setCapturedImages([]);
    setCurrentStep('capture');
    setRegistrationResult(null);
    setCurrentCapture(0);
    setInstructions("Position your face in the center");
    setQualityScore(0);
    readinessHistoryRef.current = [];
    setShowManualCapture(false);
    if (manualCaptureTimeoutRef.current) {
      clearTimeout(manualCaptureTimeoutRef.current);
      manualCaptureTimeoutRef.current = null;
    }
    setIsActive(true);
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
  };

  if (!isOpen) return null;

  return (
    <Card className="w-full max-w-2xl mx-auto bg-slate-800/95 backdrop-blur-sm border border-slate-700/50 shadow-2xl">
      <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 border-b border-slate-700/50">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-white">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <User className="h-5 w-5 text-purple-400" />
            </div>
            Smart Face Registration
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleCancel} 
            className="text-slate-300 hover:text-white hover:bg-slate-700/50"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Modern progress indicators */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex space-x-3">
            <Badge 
              variant={currentStep === 'capture' ? 'default' : 'secondary'}
              className={currentStep === 'capture' 
                ? 'bg-purple-500 text-white hover:bg-purple-600' 
                : 'bg-slate-700 text-slate-300'
              }
            >
              1. Capture
            </Badge>
            <Badge 
              variant={currentStep === 'preview' ? 'default' : 'secondary'}
              className={currentStep === 'preview' 
                ? 'bg-purple-500 text-white hover:bg-purple-600' 
                : 'bg-slate-700 text-slate-300'
              }
            >
              2. Preview
            </Badge>
            <Badge 
              variant={currentStep === 'success' ? 'default' : 'secondary'}
              className={currentStep === 'success' 
                ? 'bg-purple-500 text-white hover:bg-purple-600' 
                : 'bg-slate-700 text-slate-300'
              }
            >
              3. Complete
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4 p-6 bg-slate-900/50">
        {currentStep === 'capture' && (
          <>
            {isActive ? (
              <div className="relative">
                <div className="relative overflow-hidden rounded-xl border-2 border-slate-600/50 shadow-2xl max-w-md mx-auto" style={{ aspectRatio: '3/4' }}>
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline
                    muted
                    className={`w-full h-full object-cover bg-slate-800 ${mirrorPreview ? 'transform -scale-x-100' : ''}`}
                  />
                  
                  {/* Face detection overlay canvas */}
                  <canvas
                    ref={overlayCanvasRef}
                    className="absolute top-0 left-0 w-full h-full pointer-events-none rounded-xl"
                  />
                  
                  {/* Modern overlay guides */}
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-4 left-4 w-8 h-8 border-l-2 border-t-2 border-purple-400 rounded-tl-lg"></div>
                    <div className="absolute top-4 right-4 w-8 h-8 border-r-2 border-t-2 border-purple-400 rounded-tr-lg"></div>
                    <div className="absolute bottom-4 left-4 w-8 h-8 border-l-2 border-b-2 border-purple-400 rounded-bl-lg"></div>
                    <div className="absolute bottom-4 right-4 w-8 h-8 border-r-2 border-b-2 border-purple-400 rounded-br-lg"></div>
                    
                    {/* Center guide */}
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                      <div className="w-32 h-40 border-2 border-dashed border-purple-400/60 rounded-lg"></div>
                    </div>
                  </div>
                  
                  {/* Manual Capture Button - Modern design */}
                  {(faceCount > 0 || showManualCapture) && currentCapture < 3 && !isProcessing && (
                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
                      <Button
                        onClick={captureManually}
                        className="relative group overflow-hidden bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-6 py-3 rounded-full shadow-2xl border-2 border-white/20 transition-all duration-300 hover:scale-105"
                        size="lg"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-green-600 to-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-full"></div>
                        <Camera className="mr-2 h-5 w-5 relative z-10" />
                        <span className="relative z-10">Capture Now ({currentCapture + 1}/3)</span>
                      </Button>
                    </div>
                  )}
                  
                  {isProcessing && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm rounded-xl">
                      <div className="flex flex-col items-center gap-3 text-white">
                        <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-lg font-medium">Processing capture...</span>
                        <span className="text-sm text-slate-400">Please hold still</span>
                      </div>
                    </div>
                  )}
                </div>
                
                <canvas ref={canvasRef} className="hidden" />
              </div>
            ) : (
              <div className="text-center py-12 border-2 border-dashed border-slate-600 rounded-xl bg-slate-800/50 backdrop-blur-sm">
                <div className="w-16 h-16 mx-auto mb-4 p-3 bg-slate-700/50 rounded-full">
                  <Camera className="w-full h-full text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-slate-300">Face Registration</h3>
                <p className="mb-4 text-slate-400">
                  Click below to start the face registration process
                </p>
                <Button 
                  onClick={() => setIsActive(true)} 
                  className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white px-8 py-3 text-base font-semibold shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl border-0"
                >
                  <Camera className="mr-2 h-4 w-4" />
                  Start Registration
                </Button>
              </div>
            )}
            
            {/* Modern status panel */}
            <div className="bg-slate-800/70 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-1.5 bg-blue-500/20 rounded-lg">
                  <Brain className="h-4 w-4 text-blue-400" />
                </div>
                <span className="font-semibold text-slate-300">System Status</span>
              </div>
              
              {isActive ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Camera:</span>
                    <span className={`flex items-center gap-1 ${cameraReady ? 'text-green-400' : 'text-amber-400'}`}>
                      <div className={`w-2 h-2 rounded-full ${cameraReady ? 'bg-green-400' : 'bg-amber-400'} animate-pulse`}></div>
                      {cameraReady ? 'Ready' : 'Starting...'}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">AI Detection:</span>
                    <span className={`flex items-center gap-1 ${isModelLoaded ? 'text-green-400' : 'text-amber-400'}`}>
                      <div className={`w-2 h-2 rounded-full ${isModelLoaded ? 'bg-green-400' : 'bg-amber-400'} animate-pulse`}></div>
                      {isModelLoaded ? 'Active' : 'Loading...'}
                    </span>
                  </div>
                  
                  {faceCount > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Face Detected:</span>
                      <span className="flex items-center gap-1 text-green-400">
                        <div className="w-2 h-2 rounded-full bg-green-400"></div>
                        ✓ Yes
                      </span>
                    </div>
                  )}

                  {/* Instructions */}
                  <div className="mt-4 p-3 bg-slate-700/50 rounded-lg border border-slate-600/50">
                    <div className="font-medium text-slate-300 mb-2 flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                      Instructions:
                    </div>
                    <div className="text-slate-400 text-sm">
                      {instructions}
                    </div>
                    {(faceCount > 0 || showManualCapture) && currentCapture < 3 && (
                      <div className="text-blue-400 mt-2 flex items-center text-sm">
                        <Camera className="h-3 w-3 mr-1" />
                        You can manually capture anytime using the button below
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between text-sm mt-4 p-2 bg-slate-700/30 rounded-lg">
                    <span className="text-slate-400">Mirror Preview</span>
                    <label className="inline-flex items-center space-x-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={mirrorPreview} 
                        onChange={(e) => setMirrorPreview(e.target.checked)}
                        className="form-checkbox h-4 w-4 text-purple-500 rounded focus:ring-purple-500 focus:ring-2 bg-slate-700 border-slate-600"
                      />
                      <span className="text-sm text-slate-300">{mirrorPreview ? 'On' : 'Off'}</span>
                    </label>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-slate-400">Click "Start Registration" to begin</p>
                  <div className="text-sm text-slate-400 bg-slate-700/50 p-3 rounded-lg border border-slate-600/50">
                    <div className="font-medium mb-2 text-slate-300">Face Registration Process:</div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-1 bg-purple-400 rounded-full"></div>
                        Position your face in the center
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-1 bg-purple-400 rounded-full"></div>
                        3 photos will be captured automatically
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-1 bg-purple-400 rounded-full"></div>
                        You can manually capture anytime
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {currentStep === 'preview' && (
          <>
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 p-3 bg-green-500/20 rounded-full">
                <CheckCircle className="w-full h-full text-green-400" />
              </div>
              <h3 className="text-lg font-semibold text-green-300 mb-2">Images Captured Successfully!</h3>
              <p className="text-slate-400">Review your captured images below</p>
            </div>
            
            <div className="grid grid-cols-3 gap-4 mb-6">
              {capturedImages.map((image, index) => (
                <div key={index} className="relative group">
                  <img
                    src={image}
                    alt={`Captured face ${index + 1}`}
                    className="w-full h-32 object-cover rounded-lg border-2 border-slate-600/50 shadow-lg group-hover:border-purple-400/50 transition-all duration-300"
                  />
                  <Badge className="absolute top-2 left-2 bg-purple-500/90 text-white">
                    {index + 1}
                  </Badge>
                </div>
              ))}
            </div>
            
            <div className="flex gap-3 justify-center">
              <Button 
                variant="outline" 
                onClick={retryCapture}
                disabled={isProcessing}
                className="px-6 py-3 text-base font-semibold bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-600 hover:text-white transition-all duration-300"
              >
                <Camera className="mr-2 h-4 w-4" />
                Retake Photos
              </Button>
              <Button 
                onClick={registerFaces}
                disabled={isProcessing || capturedImages.length === 0}
                className="relative group overflow-hidden bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-6 py-3 text-base font-semibold shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl border-0"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-green-600 to-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                {isProcessing ? (
                  <>
                    <div className="w-5 h-5 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span className="relative z-10">Registering...</span>
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4 relative z-10" />
                    <span className="relative z-10">Register Face</span>
                  </>
                )}
              </Button>
            </div>
          </>
        )}

        {currentStep === 'success' && registrationResult && (
          <div className="text-center py-8">
            {registrationResult.success ? (
              <>
                <div className="w-20 h-20 mx-auto mb-6 p-4 bg-green-500/20 rounded-full">
                  <CheckCircle className="w-full h-full text-green-400" />
                </div>
                <h3 className="text-xl font-semibold text-green-300 mb-3">
                  Registration Successful!
                </h3>
                <p className="text-slate-400 mb-6">
                  {registrationResult.message}
                </p>
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                  <p className="text-sm text-green-400">
                    You can now use face recognition for attendance with improved accuracy.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="w-20 h-20 mx-auto mb-6 p-4 bg-red-500/20 rounded-full">
                  <AlertTriangle className="w-full h-full text-red-400" />
                </div>
                <h3 className="text-xl font-semibold text-red-300 mb-3">
                  Registration Failed
                </h3>
                <p className="text-slate-400 mb-6">
                  {registrationResult.message}
                </p>
                <Button 
                  onClick={retryCapture}
                  className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white px-8 py-3 text-base font-semibold shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl border-0"
                >
                  Try Again
                </Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FaceRegistration;