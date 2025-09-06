
import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Camera, CheckCircle, X, Lock, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { FaceDetection } from '@mediapipe/face_detection';
import { Camera as MPCamera } from '@mediapipe/camera_utils';
import { useTimeRestrictions } from '@/hooks/useTimeRestrictions';

type BackendFace = {
  bbox: [number, number, number, number];
  confidence: number;
  width: number;
  height: number;
  area_percentage: number;
};

interface FaceRecognitionProps {
  onCapture: (dataUrl: string, recognized: boolean) => void;
  onCancel?: () => void;
  disabled?: boolean;
  subjectId?: string; // optional, used when marking attendance
}

const FaceRecognition = ({ onCapture, onCancel, disabled, subjectId }: FaceRecognitionProps) => {
  const [isActive, setIsActive] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isRecognized, setIsRecognized] = useState(false);
  const [feedback, setFeedback] = useState<string>('');
  const [faceBox, setFaceBox] = useState<{x: number, y: number, width: number, height: number} | null>(null);
  const [boxColor, setBoxColor] = useState<string>('lime');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mpCameraRef = useRef<MPCamera | null>(null);
  const faceDetectionRef = useRef<FaceDetection | null>(null);
  const { toast } = useToast();

  // Time restriction management
  const {
    isAllowed: canVerify,
    reason: restrictionReason,
    currentPeriod,
    timeUntilNext
  } = useTimeRestrictions();

  // Time restrictions disabled - always allow verification
  const finalCanVerify = true;
  const finalRestrictionReason = "Face verification available";

  // Start/stop the webcam stream with improved error handling and live detection
  useEffect(() => {
    if (!isActive) {
      // Cleanup
      if (mpCameraRef.current) {
        mpCameraRef.current.stop();
        mpCameraRef.current = null;
      }
      setFaceBox(null);
      setFeedback('');
  // No facemesh cleanup needed
      return;
    }
    // Setup MediaPipe Face Detection
    const faceDetection = new FaceDetection({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`
    });
    faceDetection.setOptions({
      model: 'short',
      minDetectionConfidence: 0.6
    });
    faceDetection.onResults((results: {detections?: Array<{boundingBox: {xCenter: number, yCenter: number, width: number, height: number}}>}) => {
      if (results.detections && results.detections.length > 0) {
        const det = results.detections[0];
        const box = det.boundingBox;
        setFaceBox({
          x: box.xCenter - box.width / 2,
          y: box.yCenter - box.height / 2,
          width: box.width,
          height: box.height
        });
        setBoxColor('lime');
        setFeedback('Face detected. Ready to capture!');
      } else {
        setFaceBox(null);
        setFeedback('No face detected.');
      }
    });
    faceDetectionRef.current = faceDetection;



    // Setup camera
    if (videoRef.current) {
      mpCameraRef.current = new MPCamera(videoRef.current, {
        onFrame: async () => {
          await faceDetection.send({ image: videoRef.current });
        },
        width: 640,
        height: 480
      });
      mpCameraRef.current.start();
    }
    return () => {
      if (mpCameraRef.current) {
        mpCameraRef.current.stop();
        mpCameraRef.current = null;
      }
      setFaceBox(null);
      setFeedback('');
  // No facemesh cleanup needed
    };
  }, [isActive]);

  // Draw bounding box overlay on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Draw bounding box if detected
    if (faceBox) {
      ctx.save();
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, '#38bdf8');
      grad.addColorStop(1, '#06b6d4');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 3;
      ctx.shadowColor = '#06b6d4AA';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      // Mirror X for bounding box
      const x = (1 - faceBox.x - faceBox.width) * canvas.width;
      const y = faceBox.y * canvas.height;
      const w = faceBox.width * canvas.width;
      const h = faceBox.height * canvas.height;
      if (ctx.roundRect) {
        ctx.roundRect(x, y, w, h, 18);
      } else {
        ctx.rect(x, y, w, h);
      }
      ctx.stroke();
      ctx.restore();
    }
  }, [faceBox]);

  // Real capture: use backend verification
  const captureImage = async () => {
    if (!canvasRef.current || !videoRef.current) return;
    if (!faceBox) {
      toast({
        title: 'No Face Detected',
        description: 'Please ensure your face is visible in the frame.',
        variant: 'destructive',
      });
      return;
    }
    setIsCapturing(true);
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg');
    const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '');
    try {
      // 1) Verify identity against the logged-in user's saved embedding
      const token = localStorage.getItem('authToken');
      const commonHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const idRes = await fetch('/api/face-recognition/verify-identity', {
        method: 'POST',
        headers: commonHeaders,
        body: JSON.stringify({ image_data: base64 })
      });
      const idData = await idRes.json();

      const matched = !!idData.matched;
      setIsRecognized(matched);

      if (!matched) {
        onCapture(dataUrl, false);
        toast({
          title: 'Identity Mismatch',
          description: idData.message || 'Face does not match the current user.',
          variant: 'destructive',
        });
        return;
      }

      // 2) Optionally mark attendance if subjectId is provided
      if (subjectId) {
        const attendRes = await fetch('/api/face-recognition/mark-attendance', {
          method: 'POST',
          headers: commonHeaders,
          body: JSON.stringify({ image_data: base64, subject_id: Number(subjectId) })
        });
        const attendData = await attendRes.json();

        const ok = attendData.success && attendData.attendance_marked;
        onCapture(dataUrl, ok);
        toast({
          title: ok ? 'Attendance Marked' : 'Attendance Not Marked',
          description: attendData.message || (ok ? 'Attendance marked successfully.' : 'Could not mark attendance.'),
          variant: ok ? 'default' : 'destructive',
        });
      } else {
        // If no subjectId, just report successful identity match
        onCapture(dataUrl, true);
        toast({
          title: 'Identity Verified',
          description: 'Face matches your registered profile.',
        });
      }
    } catch (e) {
      setIsRecognized(false);
      onCapture(dataUrl, false);
      toast({
        title: 'Verification Error',
        description: 'Error verifying identity. Please try again.',
        variant: 'destructive',
      });
    }
    setIsCapturing(false);
    setTimeout(() => setIsActive(false), 2000);
  };

  const handleCancel = () => {
    console.log('Cancel button clicked');
    
    // Stop camera if running
    if (mpCameraRef.current) {
      try {
        mpCameraRef.current.stop();
        console.log('Camera stopped successfully');
      } catch (error) {
        console.error('Error stopping camera:', error);
      }
      mpCameraRef.current = null;
    }
    
    // Clean up face detection
    if (faceDetectionRef.current) {
      try {
        faceDetectionRef.current.close();
        console.log('Face detection closed successfully');
      } catch (error) {
        console.error('Error closing face detection:', error);
      }
      faceDetectionRef.current = null;
    }
    
    // Reset all states
    setIsActive(false);
    setIsCapturing(false);
    setIsRecognized(false);
    setFeedback('');
    setFaceBox(null);
    
    // Call the parent's onCancel callback
    if (onCancel) {
      console.log('Calling parent onCancel callback');
      onCancel();
    } else {
      console.log('No onCancel callback provided');
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Facial Recognition
            {currentPeriod && (
              <span className="text-sm font-normal text-muted-foreground">
                - {currentPeriod.name}
              </span>
            )}
          </CardTitle>
        </div>
        <CardDescription>
          Position your face in the frame and click "Capture" to mark attendance.
        </CardDescription>
        
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-2">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-800">
              Face Verification Available
            </span>
          </div>
          <p className="text-xs text-green-600 mt-1">
            Time restrictions disabled - always available for testing
          </p>
        </div>
      </CardHeader>
      
      <CardContent className="flex flex-col items-center justify-center">
        {isActive ? (
          <div className="relative w-full max-w-md">
            <div className="relative">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline
                className="w-full rounded-md border-2 border-brand-300 shadow-sm"
                style={{ transform: 'scaleX(-1)' }} // Mirror effect
                width={640}
                height={480}
              />
              <canvas
                ref={canvasRef}
                width={640}
                height={480}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: '100%',
                  height: '100%',
                  zIndex: 20,
                  pointerEvents: 'none', // This should allow clicks to pass through
                  background: 'none',
                }}
              />
              {isCapturing && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20 rounded-md">
                  <div className="animate-pulse text-white text-lg">Processing...</div>
                </div>
              )}
            </div>
            {/* Live feedback below video */}
            <div className="mt-2 text-center min-h-[24px]">
              <span className={`text-sm ${feedback.includes('Ready') ? 'text-green-500' : 'text-yellow-400'}`}>{feedback}</span>
            </div>
          </div>
        ) : (
          <div className="border-2 border-dashed border-gray-300 rounded-md w-full max-w-md h-64 flex items-center justify-center bg-gray-50">
            {isRecognized ? (
              <div className="text-center text-green-500">
                <CheckCircle className="w-16 h-16 mx-auto mb-2" />
                <p>Face successfully recognized!</p>
              </div>
            ) : (
              <div className="text-center text-gray-500">
                <Camera className="w-16 h-16 mx-auto mb-2 opacity-40" />
                <p>Click "Start Camera" to begin facial recognition</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex justify-center space-x-4 pb-6" style={{ pointerEvents: 'auto' }}>
        {!isActive ? (
          <div className="flex space-x-3" style={{ pointerEvents: 'auto' }}>
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-brand-400 to-brand-600 rounded-lg blur opacity-75 group-hover:opacity-100 transition duration-200"></div>
              <Button 
                onClick={() => setIsActive(true)} 
                disabled={disabled || isCapturing}
                className="relative bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 text-white px-6 py-3 text-base shadow-lg rounded-lg"
                style={{ pointerEvents: 'auto' }}
              >
                <Camera className="mr-2 h-5 w-5" /> Start Camera
              </Button>
            </div>
            {onCancel && (
              <div className="relative group" style={{ pointerEvents: 'auto' }}>
                <div className="absolute -inset-0.5 bg-gradient-to-r from-red-400 to-red-600 rounded-lg blur opacity-75 group-hover:opacity-100 transition duration-200"></div>
                <Button 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Cancel button clicked (when camera inactive)');
                    handleCancel();
                  }}
                  className="relative bg-red-600 hover:bg-red-700 text-white px-6 py-3 text-base rounded-lg"
                  style={{ pointerEvents: 'auto' }}
                >
                  <X className="mr-2 h-5 w-5 text-white" /> Cancel
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex space-x-3" style={{ pointerEvents: 'auto' }}>
            <div className="relative group">
              <div className={`absolute -inset-0.5 ${
                isCapturing || !finalCanVerify 
                  ? 'bg-gray-300' 
                  : 'bg-gradient-to-r from-green-400 to-green-600'
              } rounded-lg blur opacity-75 group-hover:opacity-100 transition duration-200`}></div>
              <Button 
                onClick={captureImage} 
                disabled={isCapturing}
                className={`relative px-6 py-3 text-base shadow-lg rounded-lg ${
                  isCapturing 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-green-500 hover:bg-green-600'
                }`}
                style={{ pointerEvents: 'auto' }}
              >
                {isCapturing ? "Processing..." : "Capture"}
              </Button>
            </div>
            <div className="relative group" style={{ pointerEvents: 'auto' }}>
              <div className="absolute -inset-0.5 bg-gradient-to-r from-red-400 to-red-600 rounded-lg blur opacity-75 group-hover:opacity-100 transition duration-200"></div>
              <Button 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('Cancel button clicked (when camera active)');
                  handleCancel();
                }}
                disabled={isCapturing}
                className="relative inline-flex items-center justify-center gap-2 px-6 py-3 text-base font-semibold rounded-lg shadow-lg bg-red-600 hover:bg-red-700 text-white"
                style={{ pointerEvents: 'auto' }}
              >
                <X className="mr-2 h-5 w-5 text-white" /> Cancel
              </Button>
            </div>
          </div>
        )}
      </CardFooter>
    </Card>
  );
};

export default FaceRecognition;
