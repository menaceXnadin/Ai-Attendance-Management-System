import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Camera, Upload, CheckCircle, X, AlertTriangle, User, Loader2, Users, Brain } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/integrations/api/client';
import { useRealFaceDetection } from '@/hooks/useRealFaceDetection2';

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
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [currentStep, setCurrentStep] = useState<'capture' | 'preview' | 'success'>('capture');
  const [registrationResult, setRegistrationResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number>();
  const { toast } = useToast();

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
      console.log(`🎯 Real face detection found ${faces.length} faces:`, faces);
      if (faces.length > 0) {
        setCameraReady(true);
      }
    },
    isActive
  });

  // Simple camera readiness check (since real detection handles the heavy lifting)
  const checkCameraReady = useCallback(() => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    
    // Check if video is actually playing and has dimensions
    if (video.videoWidth > 0 && video.videoHeight > 0 && !video.paused) {
      setCameraReady(true);
    } else {
      setCameraReady(false);
    }

    if (isActive) {
      animationRef.current = requestAnimationFrame(checkCameraReady);
    }
  }, [isActive]);

  // Setup camera
  useEffect(() => {
    const setupCamera = async () => {
      if (isActive && videoRef.current && isOpen) {
        try {
          streamRef.current = await navigator.mediaDevices.getUserMedia({
            video: { 
              facingMode: 'user',
              width: { ideal: 640 },
              height: { ideal: 480 }
            }
          });
          
          videoRef.current.srcObject = streamRef.current;
          videoRef.current.onloadedmetadata = () => {
            checkCameraReady();
          };
        } catch (err) {
          toast({
            title: "Camera Error",
            description: "Unable to access camera. Please check permissions.",
            variant: "destructive",
          });
          setIsActive(false);
        }
      }
    };

    setupCamera();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [isActive, checkCameraReady, toast, isOpen]);

  // Cleanup when component unmounts or modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsActive(false);
      setCapturedImages([]);
      setCurrentStep('capture');
      setRegistrationResult(null);
      setCameraReady(false);
    }
  }, [isOpen]);

  const captureImage = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) {
      toast({
        title: "Camera Not Ready",
        description: "Please wait for the camera to initialize.",
        variant: "destructive",
      });
      return;
    }
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    if (!context) return;
    
    // Check if video has content
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      toast({
        title: "Video Not Ready",
        description: "Please wait for the camera to load completely.",
        variant: "destructive",
      });
      return;
    }
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedImages(prev => [...prev, dataUrl]);
    
    toast({
      title: "Image Captured",
      description: `Captured ${capturedImages.length + 1} of 3 images for better accuracy`,
    });

    // Automatically proceed to preview after 3 captures
    if (capturedImages.length >= 2) {
      setCurrentStep('preview');
      setIsActive(false);
    }
  }, [capturedImages.length, toast]);

  const registerFaces = async () => {
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

      // Register the face
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
          onSuccess?.();
        }, 2000);
      } else {
        toast({
          title: "Registration Failed",
          description: result.message,
          variant: "destructive",
        });
        setRegistrationResult(result);
      }
    } catch (error: unknown) {
      console.error("Face registration error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to register face. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      setRegistrationResult({
        success: false,
        message: errorMessage
      });
    }
    
    setIsProcessing(false);
  };

  const retryCapture = () => {
    setCapturedImages([]);
    setCurrentStep('capture');
    setRegistrationResult(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Face Registration
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onCancel}
              disabled={isProcessing}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Progress indicator */}
          <div className="flex items-center gap-2 mt-4">
            <Badge variant={currentStep === 'capture' ? 'default' : 'secondary'}>
              1. Capture
            </Badge>
            <div className="flex-1 h-px bg-gray-200"></div>
            <Badge variant={currentStep === 'preview' ? 'default' : 'secondary'}>
              2. Preview
            </Badge>
            <div className="flex-1 h-px bg-gray-200"></div>
            <Badge variant={currentStep === 'success' ? 'default' : 'secondary'}>
              3. Complete
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {currentStep === 'capture' && (
            <>
              {isActive ? (
                <div className="relative">
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline
                    muted
                    className="w-full rounded-lg border-2 border-gray-200"
                  />
                  
                  {/* Face detection overlay canvas */}
                  <canvas
                    ref={overlayCanvasRef}
                    className="absolute top-0 left-0 w-full h-full pointer-events-none rounded-lg"
                  />
                  
                  {/* Camera ready indicator */}
                  <div className={`absolute top-4 right-4 p-2 rounded-full ${
                    cameraReady ? 'bg-green-500' : 'bg-orange-500'
                  } text-white`}>
                    {cameraReady ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <AlertTriangle className="h-4 w-4" />
                    )}
                  </div>
                  
                  {/* Face detection status */}
                  {faceCount > 0 && (
                    <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {faceCount} face{faceCount !== 1 ? 's' : ''} detected
                    </div>
                  )}
                  
                  {/* Capture count indicator */}
                  <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
                    {capturedImages.length}/3 captured
                  </div>
                  
                  <canvas ref={canvasRef} className="hidden" />
                </div>
              ) : (
                <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
                  <Camera className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-medium mb-2">Ready to Register Your Face</h3>
                  <p className="text-gray-600 mb-4">
                    We'll capture 3 images for better recognition accuracy
                  </p>
                  <Button onClick={() => setIsActive(true)}>
                    <Camera className="mr-2 h-4 w-4" />
                    Start Camera
                  </Button>
                </div>
              )}
              
              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">📋 Instructions:</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Ensure good lighting on your face</li>
                  <li>• Look directly at the camera</li>
                  <li>• Keep your face within the frame</li>
                  <li>• Avoid wearing sunglasses or masks</li>
                  <li>• Click "Capture" when camera shows green (ready)</li>
                </ul>
                
                {!isModelLoaded && isActive && (
                  <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                    <p className="text-xs text-yellow-800">
                      ⏳ <strong>First time?</strong> AI model loading may take 10-15 seconds. 
                      Future visits will be much faster (2-3 seconds) thanks to browser caching.
                    </p>
                  </div>
                )}
              </div>
              
              {/* Status indicators */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className={`flex items-center gap-1 ${cameraReady ? 'text-green-600' : 'text-orange-500'}`}>
                    <div className={`w-2 h-2 rounded-full ${cameraReady ? 'bg-green-500' : 'bg-orange-400'}`}></div>
                    {cameraReady ? 'Camera Ready' : 'Initializing Camera...'}
                  </span>
                  
                  {isActive && (
                    <span className="text-blue-600">Camera Active</span>
                  )}
                </div>

                {/* Face Detection Status */}
                <div className="flex items-center justify-between">
                  <span className={`flex items-center gap-1 ${isModelLoaded ? 'text-green-600' : 'text-orange-500'}`}>
                    <Brain className={`w-4 h-4 ${isModelLoaded ? 'text-green-500' : 'text-orange-400'}`} />
                    {isModelLoaded ? 'AI Face Detection Ready' : 'Loading AI Model...'}
                  </span>
                  
                  {faceCount > 0 && (
                    <span className="text-green-600 font-medium">
                      {faceCount} face{faceCount !== 1 ? 's' : ''} detected! 🎯
                    </span>
                  )}
                </div>

                {faceDetectionError && (
                  <div className="text-red-600 text-xs bg-red-50 p-2 rounded">
                    Face Detection Error: {faceDetectionError}
                  </div>
                )}
              </div>
              
              {/* Action buttons */}
              <div className="flex gap-2 pt-4">
                {isActive && (
                  <>
                    <Button 
                      variant="outline" 
                      onClick={() => setIsActive(false)}
                      className="flex-1"
                    >
                      Stop Camera
                    </Button>
                    <Button 
                      onClick={captureImage}
                      className="flex-1"
                    >
                      <Camera className="mr-2 h-4 w-4" />
                      Capture ({capturedImages.length}/3)
                    </Button>
                  </>
                )}
              </div>
            </>
          )}

          {currentStep === 'preview' && (
            <>
              <div className="text-center">
                <h3 className="text-lg font-medium mb-4">Review Captured Images</h3>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  {capturedImages.map((image, index) => (
                    <div key={index} className="relative">
                      <img 
                        src={image} 
                        alt={`Captured face ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg border-2 border-gray-200"
                      />
                      <Badge className="absolute top-2 left-2" variant="secondary">
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
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    Retake Photos
                  </Button>
                  <Button 
                    onClick={registerFaces}
                    disabled={isProcessing || capturedImages.length === 0}
                  >
                    {isProcessing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    {isProcessing ? 'Registering...' : 'Register Face'}
                  </Button>
                </div>
              </div>
            </>
          )}

          {currentStep === 'success' && registrationResult && (
            <div className="text-center py-8">
              {registrationResult.success ? (
                <>
                  <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
                  <h3 className="text-xl font-semibold text-green-700 mb-2">
                    Registration Successful!
                  </h3>
                  <p className="text-gray-600 mb-6">
                    {registrationResult.message}
                  </p>
                  <p className="text-sm text-gray-500">
                    You can now use face recognition for attendance.
                  </p>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-16 w-16 mx-auto text-red-500 mb-4" />
                  <h3 className="text-xl font-semibold text-red-700 mb-2">
                    Registration Failed
                  </h3>
                  <p className="text-gray-600 mb-6">
                    {registrationResult.message}
                  </p>
                  <Button onClick={retryCapture}>
                    Try Again
                  </Button>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FaceRegistration;
