
import * as React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Camera, CheckCircle, X, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { mediapipeLocateFile } from '@/lib/mediapipe';
import { FaceDetection } from '@mediapipe/face_detection';
import { Camera as MPCamera } from '@mediapipe/camera_utils';
import { useTimeRestrictions } from '@/hooks/useTimeRestrictions';
import { getPreferredCamera, createCameraConstraints, testCameraWithFallback } from '@/utils/cameraSelector';

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
  const [faceBox, setFaceBox] = useState<{x: number, y: number, width: number, height: number} | null>(null);
  const [boxColor, setBoxColor] = useState<'idle' | 'detected'>('idle');
  const [feedback, setFeedback] = useState<string>('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mpCameraRef = useRef<MPCamera | null>(null);
  const faceDetectionRef = useRef<FaceDetection | null>(null);
  const faceBoxRef = useRef<typeof faceBox>(null);
  const { toast } = useToast();

  useEffect(() => {
    faceBoxRef.current = faceBox;
  }, [faceBox]);

  // Time restriction management
  const {
    isAllowed: canVerify,
    reason: restrictionReason,
    currentPeriod,
    timeUntilNext
  } = useTimeRestrictions();

  // Time restrictions enabled - use actual time-based access control
  const finalCanVerify = canVerify;
  const finalRestrictionReason = restrictionReason;

  // Start/stop the webcam stream with MediaPipe face detection only
  useEffect(() => {
    if (!isActive) {
      // Cleanup
      if (mpCameraRef.current) {
        mpCameraRef.current.stop();
        mpCameraRef.current = null;
      }
      setFaceBox(null);
      setFeedback('');
      return;
    }
    
    let destroyed = false;

    const setup = async () => {
      // Setup MediaPipe Face Detection
      const faceDetection = new FaceDetection({
        locateFile: (file: string) => mediapipeLocateFile(file)
      });

      faceDetection.setOptions({
        model: 'short',
        minDetectionConfidence: 0.6
      });

      faceDetection.onResults((results: {detections?: Array<{boundingBox: {xCenter: number, yCenter: number, width: number, height: number}}>}) => {
        try {
          if (destroyed) return;
          if (results.detections && results.detections.length > 0) {
            const det = results.detections[0];
            const box = det.boundingBox;
            setFaceBox({
              x: box.xCenter - box.width / 2,
              y: box.yCenter - box.height / 2,
              width: box.width,
              height: box.height
            });
            setBoxColor('detected');
            setFeedback('Face detected. Ready to capture!');
          } else {
            setFaceBox(null);
            setBoxColor('idle');
            setFeedback('No face detected.');
          }
        } catch (error) {
          console.error('Face detection error:', error);
          setFeedback('Face detection error. Please try again.');
        }
      });

      // Explicitly initialize the solution before first send
      try {
        // @ts-expect-error initialize exists on MediaPipe solutions
        if (typeof (faceDetection as any).initialize === 'function') {
          await (faceDetection as any).initialize();
        }
      } catch (e) {
        console.warn('FaceDetection.initialize() failed or unavailable, continuing:', e);
      }

      if (destroyed) return;
      faceDetectionRef.current = faceDetection;

      // Setup camera with smart camera selection
      if (!videoRef.current) return;

      try {
        setFeedback('Initializing camera...');
        const stream = await testCameraWithFallback();
        if (destroyed) return;
        if (!stream) {
          setFeedback('Failed to access camera. Please check permissions and ensure a camera is available.');
          return;
        }

        // Set up video element with the stream
        videoRef.current.srcObject = stream;

        const safeSendFrame = () => {
          const v = videoRef.current;
          const fd = faceDetectionRef.current;
          if (!v || !fd || destroyed || !isActive) return;
          const w = v.videoWidth | 0;
          const h = v.videoHeight | 0;
          if (w <= 0 || h <= 0 || w > 4000 || h > 4000) {
            // Skip unreasonable sizes to avoid WASM memory OOB
            return;
          }
          try {
            fd.send({ image: v });
          } catch (err) {
            // Prevent spamming if WASM errors once
            console.warn('FaceDetection.send error (skipping frame):', err);
          }
        };

        // Create a custom frame capture loop instead of MediaPipe Camera
        const captureLoop = () => {
          safeSendFrame();
          if (!destroyed && isActive) {
            requestAnimationFrame(captureLoop);
          }
        };

        // Wait for video to be ready, then start the detection loop
        videoRef.current.onloadedmetadata = () => {
          if (destroyed) return;
          setFeedback('Camera ready. Position your face in the frame.');
          requestAnimationFrame(captureLoop);
        };

        // Store the stream for cleanup
        mpCameraRef.current = { 
          stop: () => {
            stream.getTracks().forEach(track => track.stop());
          }
        } as MPCamera;

      } catch (error) {
        console.error('Camera initialization error:', error);
        setFeedback('Failed to access camera. Please ensure camera permissions are granted and no other application is using the camera.');
      }
    };

    setup();

    return () => {
      destroyed = true;
      if (mpCameraRef.current) {
        mpCameraRef.current.stop();
        mpCameraRef.current = null;
      }
      if (faceDetectionRef.current) {
        try { faceDetectionRef.current.close(); } catch {}
        faceDetectionRef.current = null;
      }
      setFaceBox(null);
      setFeedback('');
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
      let startColor = '#38bdf8';
      let endColor = '#06b6d4';
      if (boxColor === 'recognized') {
        startColor = '#34d399';
        endColor = '#22c55e';
      } else if (boxColor === 'warning') {
        startColor = '#facc15';
        endColor = '#f97316';
      }
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, startColor);
      grad.addColorStop(1, endColor);
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
    
    // Check if video is ready
    if (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
      toast({
        title: 'Video Not Ready',
        description: 'Please wait for the camera to initialize.',
        variant: 'destructive',
      });
      return;
    }
    
    if (!faceBox) {
      toast({
        title: 'No Face Detected',
        description: 'Please ensure your face is visible in the frame.',
        variant: 'destructive',
      });
      return;
    }

    setIsCapturing(true);
    setFeedback('Processing image...');
    
    // Stop face detection during processing to save resources
    if (faceDetectionRef.current) {
      try {
        // Pause the detection loop by clearing the face detection
        faceDetectionRef.current.close();
        faceDetectionRef.current = null;
      } catch (error) {
        console.warn('Error pausing face detection:', error);
      }
    }
    
    // Stop camera stream to freeze the video
    if (mpCameraRef.current) {
      try {
        mpCameraRef.current.stop();
        mpCameraRef.current = null;
      } catch (error) {
        console.warn('Error stopping camera:', error);
      }
    }
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;
    
    let dataUrl = '';
    
    try {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Mirror the canvas to match the mirrored video display
      context.save();
      context.scale(-1, 1);
      context.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
      context.restore();
      
      dataUrl = canvas.toDataURL('image/jpeg');
      const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '');
    
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
        console.log('[DEBUG] Marking attendance for subject:', subjectId);
        console.log('[DEBUG] Image data length:', base64?.length || 0);
        
        const attendancePayload = { 
          image_data: base64, 
          subject_id: Number(subjectId) 
        };
        console.log('[DEBUG] Attendance payload:', attendancePayload);
        
        const attendRes = await fetch('/api/face-recognition/mark-attendance', {
          method: 'POST',
          headers: commonHeaders,
          body: JSON.stringify(attendancePayload)
        });
        
        console.log('[DEBUG] Attendance response status:', attendRes.status);
        const attendData = await attendRes.json();
        console.log('[DEBUG] Attendance response data:', attendData);

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
      console.error('Face capture error:', e);
      setIsRecognized(false);
      onCapture(dataUrl || '', false);
      toast({
        title: 'Verification Error',
        description: 'Error verifying identity. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsCapturing(false);
      setIsActive(false); // Close the camera interface
      setFeedback('');
    }
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
    <Card className="overflow-hidden bg-slate-800/95 backdrop-blur-sm border border-slate-700/50 shadow-2xl">
      <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 border-b border-slate-700/50 p-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-white">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Camera className="h-5 w-5 text-blue-400" />
            </div>
            Face Recognition
            {currentPeriod && (
              <span className="text-sm font-normal text-slate-400 bg-slate-700/50 px-2 py-1 rounded-md">
                {currentPeriod.name}
              </span>
            )}
          </CardTitle>
        </div>
        <CardDescription className="text-slate-300">
          Position your face in the frame and capture to verify your identity for attendance.
        </CardDescription>
        
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 mt-3">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-green-500/20 rounded-lg">
              <Shield className="h-4 w-4 text-green-400" />
            </div>
            <div>
              <span className="text-sm font-semibold text-green-300">
                Face Verification Active
              </span>
              <p className="text-xs text-green-400/80 mt-1">
                Advanced AI facial recognition ready for secure attendance marking
              </p>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex flex-col items-center justify-center p-4 bg-slate-900/50">
        {isActive ? (
          <div
            className="relative w-full mx-auto"
            style={{ maxWidth: 'min(360px, 75vw)', maxHeight: '50vh' }}
          >
            <div
              className="relative overflow-hidden rounded-lg border-2 border-slate-600/50 shadow-2xl"
              style={{ aspectRatio: '3/4' }}
            >
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline
                className="w-full h-full object-cover bg-slate-800"
                style={{ transform: 'scaleX(-1)' }}
                width={480}
                height={640}
              />
              <canvas
                ref={canvasRef}
                width={480}
                height={640}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: '100%',
                  height: '100%',
                  zIndex: 20,
                  pointerEvents: 'none',
                  background: 'none',
                }}
              />

              {/* Modern scanning overlay */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-4 left-4 w-8 h-8 border-l-2 border-t-2 border-blue-400 rounded-tl-lg"></div>
                <div className="absolute top-4 right-4 w-8 h-8 border-r-2 border-t-2 border-blue-400 rounded-tr-lg"></div>
                <div className="absolute bottom-4 left-4 w-8 h-8 border-l-2 border-b-2 border-blue-400 rounded-bl-lg"></div>
                <div className="absolute bottom-4 right-4 w-8 h-8 border-r-2 border-b-2 border-blue-400 rounded-br-lg"></div>
              </div>
              
              {isCapturing && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-md rounded-xl z-30">
                  <div className="flex flex-col items-center gap-4 text-white">
                    <div className="relative">
                      <div className="w-16 h-16 border-4 border-blue-500/30 rounded-full"></div>
                      <div className="absolute inset-0 w-16 h-16 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    <div className="text-center space-y-2">
                      <span className="text-xl font-semibold block">Verifying Identity</span>
                      <span className="text-sm text-slate-300 block">Please wait while we process your image...</span>
                    </div>
                    <div className="flex flex-col gap-2 text-xs text-slate-400 mt-2">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></div>
                        <span>Analyzing facial features</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                        <span>Matching with database</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                        <span>Validating identity</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Live feedback with modern design - positioned at bottom of camera frame */}
              {!isCapturing && (
                <div className="absolute bottom-4 left-0 right-0 flex justify-center px-4 z-20">
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${
                    feedback.includes('Ready')
                      ? 'bg-sky-500/20 text-sky-200 border border-sky-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      feedback.includes('Ready')
                        ? 'bg-sky-400'
                        : 'bg-amber-400'
                    } animate-pulse`}></div>
                    {feedback || 'Initializing camera...'}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div
            className="border-2 border-dashed border-slate-600 rounded-lg w-full mx-auto bg-slate-800/50 backdrop-blur-sm"
            style={{ maxWidth: 'min(360px, 75vw)', aspectRatio: '3/4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {isRecognized ? (
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 p-3 bg-green-500/20 rounded-full">
                  <CheckCircle className="w-full h-full text-green-400" />
                </div>
                <h3 className="text-lg font-semibold text-green-300 mb-2">Face Successfully Recognized!</h3>
                <p className="text-slate-400">Identity verified and attendance marked</p>
              </div>
            ) : (
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 p-3 bg-slate-700/50 rounded-full">
                  <Camera className="w-full h-full text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-300 mb-2">Ready for Face Recognition</h3>
                <p className="text-slate-400">Click "Start Camera" to begin secure identity verification</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex justify-center space-x-3 p-3 bg-slate-800/50 border-t border-slate-700/50">
        {!isActive ? (
          <div className="flex space-x-2">
            <Button 
              onClick={() => setIsActive(true)} 
              disabled={disabled || isCapturing}
              className="relative group overflow-hidden bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white px-6 py-2 text-sm font-semibold shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl border-0"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <Camera className="mr-2 h-4 w-4 relative z-10" /> 
              <span className="relative z-10">Start Camera</span>
            </Button>
            {onCancel && (
              <Button 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleCancel();
                }}
                variant="outline"
                className="px-6 py-2 text-sm font-semibold bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-600 hover:text-white transition-all duration-300"
              >
                <X className="mr-2 h-4 w-4" /> Cancel
              </Button>
            )}
          </div>
        ) : (
          <div className="flex space-x-2">
            <Button 
              onClick={captureImage} 
              disabled={isCapturing}
              className={`relative group overflow-hidden px-6 py-2 text-sm font-semibold shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl border-0 ${
                isCapturing 
                  ? 'bg-slate-600 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white'
              }`}
            >
              {isCapturing ? (
                <>
                  <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Processing...
                </>
              ) : (
                <>
                  <div className="absolute inset-0 bg-gradient-to-r from-green-600 to-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <Camera className="mr-2 h-4 w-4 relative z-10" />
                  <span className="relative z-10">Capture & Verify</span>
                </>
              )}
            </Button>
            <Button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleCancel();
              }}
              disabled={isCapturing}
              variant="outline"
              className="px-6 py-2 text-sm font-semibold bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-600 hover:text-white transition-all duration-300"
            >
              <X className="mr-2 h-4 w-4" /> Cancel
            </Button>
          </div>
        )}
      </CardFooter>
    </Card>
  );
};

export default FaceRecognition;
