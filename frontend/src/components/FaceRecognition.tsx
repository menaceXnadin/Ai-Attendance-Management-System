import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Camera, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FaceRecognitionProps {
  onCapture: (dataUrl: string, recognized: boolean) => void;
  disabled?: boolean;
}

const FaceRecognition = ({ onCapture, disabled }: FaceRecognitionProps) => {
  const [isActive, setIsActive] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isRecognized, setIsRecognized] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  // Start/stop the webcam stream
  useEffect(() => {
    let stream: MediaStream | null = null;

    const setupCamera = async () => {
      if (isActive && videoRef.current) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user' }
          });
          
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (err) {
          toast({
            title: "Camera Error",
            description: "Unable to access camera. Please check permissions.",
            variant: "destructive",
          });
          setIsActive(false);
        }
      } else if (!isActive && stream) {
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
      }
    };

    setupCamera();

    return () => {
      if (stream) {
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, [isActive, toast]);

  // Mock face recognition process for frontend demonstration
  const captureImage = async () => {
    if (!canvasRef.current || !videoRef.current) return;
    
    setIsCapturing(true);
    
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext('2d');
    
    if (!context) return;
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Get image data URL
    const dataUrl = canvas.toDataURL('image/png');

    try {
      // Simulate API response with a mock result
      // Mock face recognition with 70% success rate for demo purposes
      const mockRecognized = Math.random() > 0.3;
      const mockName = mockRecognized ? "Demo Student" : "Unknown";
      
      setIsRecognized(mockRecognized);
      onCapture(dataUrl, mockRecognized);
      
      if (mockRecognized) {
        toast({
          title: 'Face Recognized',
          description: `Welcome, ${mockName}!`,
          variant: 'default',
        });
      } else {
        toast({
          title: 'Face Not Recognized',
          description: 'Please try again or contact administrator.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Recognition Error',
        description: 'Error processing image.',
        variant: 'destructive',
      });
    }
    
    setIsCapturing(false);
    // Turn off camera after a brief delay
    setTimeout(() => setIsActive(false), 2000);
    
    setIsCapturing(false);
    // Turn off camera after a brief delay
    setTimeout(() => setIsActive(false), 2000);
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>Facial Recognition</CardTitle>
        <CardDescription>
          Position your face in the frame and click "Capture" to mark attendance.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="flex flex-col items-center justify-center">
        {isActive ? (
          <div className="relative w-full max-w-md">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline
              className="w-full rounded-md border-2 border-brand-300 shadow-sm"
            />
            {isCapturing && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20 rounded-md">
                <div className="animate-pulse text-white text-lg">Processing...</div>
              </div>
            )}
            <canvas ref={canvasRef} className="hidden" />
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
      
      <CardFooter className="flex justify-center space-x-4 pb-6">
        {!isActive ? (
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-brand-400 to-brand-600 rounded-lg blur opacity-75 group-hover:opacity-100 transition duration-200"></div>
            <Button 
              onClick={() => setIsActive(true)} 
              disabled={disabled || isCapturing}
              className="relative bg-brand-500 hover:bg-brand-600 px-6 py-3 text-base shadow-lg rounded-lg"
            >
              <Camera className="mr-2 h-5 w-5" /> Start Camera
            </Button>
          </div>
        ) : (
          <div className="relative group">
            <div className={`absolute -inset-0.5 ${isCapturing ? 'bg-gray-300' : 'bg-gradient-to-r from-green-400 to-green-600'} rounded-lg blur opacity-75 group-hover:opacity-100 transition duration-200`}></div>
            <Button 
              onClick={captureImage} 
              disabled={isCapturing}
              className={`relative px-6 py-3 text-base shadow-lg rounded-lg ${isCapturing ? 'bg-gray-400' : 'bg-green-500 hover:bg-green-600'}`}
            >
              {isCapturing ? "Processing..." : "Capture"}
            </Button>
          </div>
        )}
      </CardFooter>
    </Card>
  );
};

export default FaceRecognition;
