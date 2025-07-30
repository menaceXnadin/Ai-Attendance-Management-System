import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Camera, X, Upload } from 'lucide-react';
import { FaceDetection } from '@mediapipe/face_detection';
import { Camera as MPCamera } from '@mediapipe/camera_utils';
import { useAuth } from '@/contexts/useAuth';
import { api } from '@/integrations/api/client';

interface SimpleFaceRegistrationProps {
  onRegistrationComplete?: () => void;
  onClose?: () => void;
  onSuccess?: () => void;
  onCancel?: () => void;
  isOpen?: boolean; // Add this to track if the modal is open
}

const SimpleFaceRegistration: React.FC<SimpleFaceRegistrationProps> = ({
  onRegistrationComplete,
  onClose,
  onSuccess,
  onCancel,
  isOpen = true
}) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [faceDetection, setFaceDetection] = useState<FaceDetection | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [camera, setCamera] = useState<MPCamera | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  // Initialize lightweight MediaPipe Face Detection (just for detection, not recognition)
  useEffect(() => {
    const initializeFaceDetection = async () => {
      try {
        console.log('🤖 Loading lightweight face detection...');
        
        const faceDetector = new FaceDetection({
          locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`;
          }
        });

        // Lightweight settings - just for basic face presence detection
        faceDetector.setOptions({
          model: 'short', // Lightweight model
          minDetectionConfidence: 0.7, // Higher confidence for cleaner detection
        });

        faceDetector.onResults((results) => {
          if (canvasRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              
              if (results.detections && results.detections.length > 0) {
                setFaceDetected(true);
                
                // Simple green overlay to show face is detected
                results.detections.forEach((detection) => {
                  const bbox = detection.boundingBox;
                  if (bbox) {
                    const x = bbox.xCenter * canvas.width - (bbox.width * canvas.width) / 2;
                    const y = bbox.yCenter * canvas.height - (bbox.height * canvas.height) / 2;
                    const width = bbox.width * canvas.width;
                    const height = bbox.height * canvas.height;
                    
                    // Simple green rectangle
                    ctx.strokeStyle = '#00ff00';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(x, y, width, height);
                    
                    // "READY" indicator - save context and flip text back
                    ctx.save();
                    ctx.scale(-1, 1); // Flip text back to normal
                    ctx.fillStyle = '#00ff00';
                    ctx.font = '16px Arial';
                    ctx.fillText('READY TO CAPTURE', -(x + width), y - 10);
                    ctx.restore();
                  }
                });
              } else {
                setFaceDetected(false);
                
                // Simple message - save context and flip text back
                ctx.save();
                ctx.scale(-1, 1); // Flip text back to normal
                ctx.fillStyle = '#ff6b6b';
                ctx.font = '20px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('Position your face in frame', -canvas.width / 2, canvas.height / 2);
                ctx.restore();
              }
            }
          }
        });

        setFaceDetection(faceDetector);
        console.log('✅ Face detection ready!');
      } catch (error) {
        console.error('❌ Failed to load face detection:', error);
      }
    };

    initializeFaceDetection();
  }, []);

  // Cleanup effect - stop camera when component unmounts or when close handlers are triggered
  useEffect(() => {
    return () => {
      // Cleanup function that runs when component unmounts
      console.log('🧹 Cleaning up camera resources...');
      if (camera) {
        camera.stop();
      }
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [camera, stream]);

  // Effect to handle external close/cancel triggers and modal visibility
  useEffect(() => {
    // If modal is closed (isOpen becomes false), stop the camera
    if (isOpen === false && isActive) {
      console.log('🔄 Modal closed, stopping camera...');
      
      // Inline camera stopping to avoid dependency issues
      if (camera) {
        try {
          camera.stop();
        } catch (error) {
          console.warn('Error stopping MediaPipe camera:', error);
        }
        setCamera(null);
      }
      
      if (stream) {
        try {
          stream.getTracks().forEach(track => {
            track.stop();
            console.log(`Stopped track: ${track.kind} - ${track.label}`);
          });
        } catch (error) {
          console.warn('Error stopping stream tracks:', error);
        }
        setStream(null);
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.pause();
      }
      
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
      }
      
      setIsActive(false);
      setFaceDetected(false);
      setCapturedImage(null);
      setIsCapturing(false);
    }
  }, [isOpen, isActive, camera, stream]);

  // Effect to stop camera when component unmounts or handlers change
  useEffect(() => {
    // Add beforeunload event listener to cleanup camera when page is about to unload
    const handleBeforeUnload = () => {
      console.log('🌐 Page unloading, cleaning up camera...');
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (camera) {
        camera.stop();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      // Remove event listener
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      // Cleanup function that runs when component unmounts
      console.log('🧹 Component unmounting, cleaning up camera resources...');
      if (camera) {
        try {
          camera.stop();
        } catch (error) {
          console.warn('Error stopping camera on unmount:', error);
        }
      }
      if (stream) {
        try {
          stream.getTracks().forEach(track => track.stop());
        } catch (error) {
          console.warn('Error stopping stream on unmount:', error);
        }
      }
    };
  }, [camera, stream]);

  // Start camera
  const startCamera = async () => {
    try {
      console.log('🎬 Starting camera...');
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false
      });
      
      setStream(mediaStream);
      setIsActive(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current && canvasRef.current && faceDetection) {
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;
            
            const mpCamera = new MPCamera(videoRef.current, {
              onFrame: async () => {
                if (faceDetection && videoRef.current) {
                  await faceDetection.send({ image: videoRef.current });
                }
              },
              width: 640,
              height: 480
            });
            
            mpCamera.start();
            setCamera(mpCamera);
            console.log('🚀 Camera started!');
          }
        };
      }
      
      toast({
        title: "Camera Ready!",
        description: "Position your face in the frame to capture.",
      });
    } catch (error) {
      console.error('Camera error:', error);
      toast({
        title: "Camera Error",
        description: "Could not access camera. Please check permissions.",
        variant: "destructive"
      });
    }
  };

  // Capture clean image for backend processing
  const captureImage = () => {
    if (!videoRef.current) {
      toast({
        title: "Camera Error",
        description: "Camera not ready. Please wait and try again.",
        variant: "destructive"
      });
      return;
    }

    // Allow capture even without MediaPipe detection since backend will validate
    if (!faceDetected) {
      toast({
        title: "No Face Detected",
        description: "MediaPipe hasn't detected a face, but we'll try anyway. Backend will validate.",
        variant: "default"
      });
    }

    setIsCapturing(true);
    
    // Create capture canvas
    const canvas = captureCanvasRef.current || document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (ctx && videoRef.current) {
      // Set canvas size to match video
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      
      // Draw video frame (without mirror effect for backend processing)
      ctx.scale(-1, 1); // Flip back to normal orientation for backend
      ctx.drawImage(videoRef.current, -canvas.width, 0, canvas.width, canvas.height);
      
      // Get clean image data
      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setCapturedImage(imageDataUrl);
      
      // Debug: Log image info
      console.log('📷 Captured image size:', canvas.width, 'x', canvas.height);
      console.log('📷 Image data URL length:', imageDataUrl.length);
      console.log('📷 Image preview (first 100 chars):', imageDataUrl.substring(0, 100));
      
      // Send to backend for face recognition processing
      sendImageToBackend(imageDataUrl);
    }
    
    setIsCapturing(false);
  };

  // Send image to backend for all face recognition processing
  const sendImageToBackend = async (imageData: string) => {
    try {
      console.log('📤 Sending image to backend for face recognition...');
      
      // Check if user is logged in before proceeding
      if (!user) {
        console.error('❌ No user found in auth context');
        throw new Error('401: Authentication required. Please log in first.');
      }
      
      console.log('✅ User found:', user.id, user.email);
      
      // Check if auth token exists in localStorage
      const token = localStorage.getItem('authToken');
      if (!token) {
        console.error('❌ No auth token found in localStorage');
        throw new Error('401: Authentication token missing. Please log in again.');
      }
      
      console.log('✅ Auth token found, length:', token.length);
      
      // Extract base64 data (remove data:image/jpeg;base64, prefix)
      const base64Data = imageData.split(',')[1];
      console.log('📷 Base64 data length:', base64Data.length);
      
      // Use the API client which already handles auth token
      try {
        console.log('🚀 Calling API registerFace...');
        const result = await api.faceRecognition.registerFace(base64Data);
        console.log('✅ Backend response:', result);
        
        toast({
          title: "Success!",
          description: result.message || "Face registered successfully!",
        });
        onRegistrationComplete?.();
        onSuccess?.();
        stopCamera();
      } catch (apiError) {
        console.error('❌ API error details:', apiError);
        
        // Check if it's an authentication error specifically
        if (apiError instanceof Error && apiError.message.includes('403')) {
          console.error('❌ Authentication failed - token might be expired');
          toast({
            title: "Authentication Error",
            description: "Your session may have expired. Please log out and log in again.",
            variant: "destructive"
          });
          return;
        }
        
        throw apiError; // Re-throw to be caught by outer catch block
      }
    } catch (error) {
      console.error('❌ Backend error:', error);
      
      let errorMessage = "Could not process face registration. Please try again.";
      if (error instanceof Error) {
        // Show more specific error messages
        if (error.message.includes('No face detected')) {
          errorMessage = "No face detected in image. Please ensure your face is clearly visible.";
        } else if (error.message.includes('Multiple faces')) {
          errorMessage = "Multiple faces detected. Please ensure only you are visible.";
        } else if (error.message.includes('401')) {
          errorMessage = "Authentication required. Please log out and log in again.";
        } else if (error.message.includes('403')) {
          errorMessage = "Authentication failed. Please log out and log in again.";
        } else if (error.message.includes('400')) {
          errorMessage = "Image quality issue. Please try capturing again with better lighting.";
        }
      }
      
      toast({
        title: "Registration Failed",
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

  // Stop camera and cleanup all resources
  const stopCamera = () => {
    console.log('🛑 Stopping camera and cleaning up resources...');
    
    // Stop MediaPipe camera
    if (camera) {
      try {
        camera.stop();
      } catch (error) {
        console.warn('Error stopping MediaPipe camera:', error);
      }
      setCamera(null);
    }
    
    // Stop all media stream tracks
    if (stream) {
      try {
        stream.getTracks().forEach(track => {
          track.stop();
          console.log(`Stopped track: ${track.kind} - ${track.label}`);
        });
      } catch (error) {
        console.warn('Error stopping stream tracks:', error);
      }
      setStream(null);
    }
    
    // Reset video element
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.pause();
    }
    
    // Clear canvas
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
    
    // Reset all states
    setIsActive(false);
    setFaceDetected(false);
    setCapturedImage(null);
    setIsCapturing(false);
    
    console.log('✅ Camera cleanup completed');
  };

  const handleClose = () => {
    console.log('🚪 Face registration closing...');
    stopCamera();
    
    // Call the parent handlers
    if (onClose) {
      onClose();
    }
    if (onCancel) {
      onCancel();
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Face Registration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Camera Feed */}
          <div className="relative w-full aspect-video bg-gray-100 rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }} // Mirror for user comfort
            />
            
            {/* Simple detection overlay */}
            <canvas
              ref={canvasRef}
              className="absolute top-0 left-0 w-full h-full pointer-events-none"
              style={{ transform: 'scaleX(-1)' }}
            />
            
            {/* Hidden capture canvas */}
            <canvas ref={captureCanvasRef} style={{ display: 'none' }} />
            
            {!isActive && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
                <div className="text-center p-4">
                  <Camera className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                  <p className="text-gray-600">Click 'Start Camera' to begin</p>
                  <p className="text-xs text-gray-500 mt-2">
                    Face detection will help you capture a clear image
                  </p>
                </div>
              </div>
            )}
            
            {isActive && (
              <div className="absolute top-2 right-2 space-y-1">
                <div className="bg-green-500 text-white px-2 py-1 rounded text-xs">
                  📹 Camera Active
                </div>
                {faceDetected && (
                  <div className="bg-blue-500 text-white px-2 py-1 rounded text-xs">
                    ✅ Face Ready
                  </div>
                )}
                {isActive && !faceDetected && faceDetection && (
                  <div className="bg-orange-500 text-white px-2 py-1 rounded text-xs">
                    👀 Position Face
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Show captured image preview */}
          {capturedImage && (
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">Captured Image (sent to backend):</p>
              <img 
                src={capturedImage} 
                alt="Captured face" 
                className="mx-auto max-w-32 h-auto border rounded"
              />
            </div>
          )}

          {/* Controls */}
          <div className="flex gap-2 justify-center">
            {!isActive ? (
              <Button onClick={startCamera} className="flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Start Camera
              </Button>
            ) : (
              <>
                <Button 
                  onClick={captureImage} 
                  disabled={!videoRef.current || isCapturing}
                  className="flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  {isCapturing ? 'Capturing...' : 'Capture & Register'}
                </Button>
                <Button onClick={stopCamera} variant="outline">
                  Stop Camera
                </Button>
              </>
            )}
            <Button onClick={handleClose} variant="outline">
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          </div>

          {/* Instructions */}
          <div className="text-center text-sm text-gray-600">
            <p>📱 Position your face clearly in the frame</p>
            <p>🔍 Wait for "Face Ready" confirmation</p>
            <p>📸 Click "Capture & Register" to send image to backend</p>
            <p>☁️ All face recognition processing happens on the server</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SimpleFaceRegistration;
