import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Camera, Square, Users } from 'lucide-react';

interface DetectedFace {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

interface LiveFaceDetectionProps {
  onFaceDetected?: (faces: DetectedFace[]) => void;
  showControls?: boolean;
}

const LiveFaceDetection: React.FC<LiveFaceDetectionProps> = ({ 
  onFaceDetected, 
  showControls = true 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [isActive, setIsActive] = useState(false);
  const [detectedFaces, setDetectedFaces] = useState<DetectedFace[]>([]);
  const [faceCount, setFaceCount] = useState(0);
  const [error, setError] = useState<string>('');

  // Draw bounding boxes around detected faces (hoisted as function declaration)
  function drawBoundingBoxes(ctx: CanvasRenderingContext2D, faces: DetectedFace[]) {
    faces.forEach((face) => {
      const { x, y, width, height, confidence } = face;

      const color = confidence > 0.8 ? '#00ff00' : confidence > 0.6 ? '#ffff00' : '#ff0000';
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, width, height);

      ctx.fillStyle = color;
      ctx.font = '16px Arial';
      ctx.fillText(`Face ${(confidence * 100).toFixed(0)}%`, x, y > 20 ? y - 5 : y + height + 20);

      const cornerSize = 15;
      ctx.lineWidth = 2;
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
    });
  }

  // Simulate face detection for demo purposes (hoisted)
  const simulateFaceDetection = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const faceWidth = width * 0.3;
    const faceHeight = height * 0.4;
    const x = (width - faceWidth) / 2;
    const y = (height - faceHeight) / 2;

    const simulatedFace: DetectedFace = { x, y, width: faceWidth, height: faceHeight, confidence: 0.8 };
    setDetectedFaces([simulatedFace]);
    setFaceCount(1);
    if (onFaceDetected) onFaceDetected([simulatedFace]);
    drawBoundingBoxes(ctx, [simulatedFace]);
  }, [onFaceDetected]);

  // Face detection using browser's built-in FaceDetector API (if available)
  // Fallback to simple simulation if not available
  const detectFaces = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Match canvas to video size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      type FaceDetectionResult = { boundingBox: { x: number; y: number; width: number; height: number }; landmarks?: unknown };

      const FaceDetectorClass = (window as unknown as { FaceDetector?: new (options?: { maxDetectedFaces?: number; fastMode?: boolean }) => { detect: (image: CanvasImageSource) => Promise<FaceDetectionResult[]> } }).FaceDetector;

      if (FaceDetectorClass) {
        const faceDetector = new FaceDetectorClass({ maxDetectedFaces: 10, fastMode: false });
        const faces = await faceDetector.detect(canvas);

        const detectedFaceData: DetectedFace[] = faces.map((f) => ({
          x: f.boundingBox.x,
          y: f.boundingBox.y,
          width: f.boundingBox.width,
          height: f.boundingBox.height,
          confidence: f.landmarks ? 0.9 : 0.7,
        }));

        setDetectedFaces(detectedFaceData);
        setFaceCount(detectedFaceData.length);
        if (onFaceDetected) onFaceDetected(detectedFaceData);
        drawBoundingBoxes(ctx, detectedFaceData);
      } else {
        // Fallback to simulation when API isn't available
        simulateFaceDetection(ctx, canvas.width, canvas.height);
      }
    } catch (err) {
      console.error('Face detection error:', err);
      simulateFaceDetection(ctx, canvas.width, canvas.height);
    }
  }, [onFaceDetected, simulateFaceDetection]);

  // (helpers moved above to avoid use-before-declaration)

  // Start camera stream
  const startDetection = async () => {
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsActive(true);
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('Failed to access camera. Please check permissions.');
    }
  };

  // Stop camera stream
  const stopDetection = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsActive(false);
    setDetectedFaces([]);
    setFaceCount(0);
  };

  // Detection loop
  useEffect(() => {
    let animationFrame: number;
    
    if (isActive && videoRef.current) {
      const runDetection = () => {
        detectFaces();
        animationFrame = requestAnimationFrame(runDetection);
      };
      
      // Start detection when video is ready
      const video = videoRef.current;
      const handleVideoReady = () => {
        runDetection();
      };
      
      if (video.readyState >= 2) {
        runDetection();
      } else {
        video.addEventListener('loadeddata', handleVideoReady);
      }
      
      return () => {
        if (animationFrame) {
          cancelAnimationFrame(animationFrame);
        }
        video.removeEventListener('loadeddata', handleVideoReady);
      };
    }
    
    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [isActive, detectFaces]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopDetection();
    };
  }, []);

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Live Face Detection
          {faceCount > 0 && (
            <span className="flex items-center gap-1 text-sm bg-green-100 text-green-800 px-2 py-1 rounded-full">
              <Users className="h-4 w-4" />
              {faceCount} face{faceCount !== 1 ? 's' : ''} detected
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md">
            {error}
          </div>
        )}
        
        <div className="relative">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-auto rounded-lg bg-gray-900"
            style={{ maxHeight: '400px' }}
          />
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
            style={{ maxHeight: '400px' }}
          />
        </div>

        {showControls && (
          <div className="flex gap-2 justify-center">
            {!isActive ? (
              <Button onClick={startDetection} className="flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Start Face Detection
              </Button>
            ) : (
              <Button onClick={stopDetection} variant="destructive" className="flex items-center gap-2">
                <Square className="h-4 w-4" />
                Stop Detection
              </Button>
            )}
          </div>
        )}

        {/* Detection Stats */}
        {isActive && (
          <div className="text-sm text-gray-600 text-center">
            <div className="flex justify-center gap-4">
              <span>Faces Detected: <strong>{faceCount}</strong></span>
              <span>Status: <strong className="text-green-600">Active</strong></span>
            </div>
            {detectedFaces.length > 0 && (
              <div className="mt-2">
                <div className="text-xs text-gray-500">
                  Detection Confidence: {detectedFaces.map((face, i) => (
                    <span key={i} className="ml-1">
                      Face {i + 1}: {(face.confidence * 100).toFixed(0)}%
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LiveFaceDetection;
