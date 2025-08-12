import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, Camera, Brain, Zap, TestTube } from 'lucide-react';
import FaceRegistration from '@/components/FaceRegistration';
import FaceRecognition from '@/components/FaceRecognition';
import { useToast } from '@/hooks/use-toast';

const FaceIntegrationTest: React.FC = () => {
  const [showRegistration, setShowRegistration] = useState(false);
  const [showRecognition, setShowRecognition] = useState(false);
  const [testResults, setTestResults] = useState<{
    frontend: 'pending' | 'success' | 'error';
    backend: 'pending' | 'success' | 'error';
  }>({
    frontend: 'pending',
    backend: 'pending'
  });
  const { toast } = useToast();

  const testBackendStatus = async () => {
    try {
      const response = await fetch('/api/face-recognition/service-status');
      const data = await response.json();
      
      if (data.status === 'active') {
        setTestResults(prev => ({ ...prev, backend: 'success' }));
        toast({
          title: "Backend Status: ✅ Active",
          description: `InsightFace service running with ${Object.keys(data.models).length} models loaded`,
        });
      } else {
        setTestResults(prev => ({ ...prev, backend: 'error' }));
        toast({
          title: "Backend Status: ❌ Error",
          description: data.message,
          variant: "destructive"
        });
      }
    } catch (error) {
      setTestResults(prev => ({ ...prev, backend: 'error' }));
      toast({
        title: "Backend Status: ❌ Connection Error",
        description: "Could not connect to backend service",
        variant: "destructive"
      });
    }
  };

  const testFrontendMediaPipe = async () => {
    try {
      // Test if MediaPipe modules are available
      const { FaceDetection } = await import('@mediapipe/face_detection');
      const { Camera } = await import('@mediapipe/camera_utils');
      
      setTestResults(prev => ({ ...prev, frontend: 'success' }));
      toast({
        title: "Frontend Status: ✅ MediaPipe Ready",
        description: "Face detection and camera modules loaded successfully",
      });
    } catch (error) {
      setTestResults(prev => ({ ...prev, frontend: 'error' }));
      toast({
        title: "Frontend Status: ❌ MediaPipe Error",
        description: "Failed to load MediaPipe modules",
        variant: "destructive"
      });
    }
  };

  const handleRegistrationSuccess = () => {
    setShowRegistration(false);
    toast({
      title: "✅ Registration Test Complete",
      description: "MediaPipe detection + InsightFace registration successful!",
    });
  };

  const handleRecognitionCapture = (dataUrl: string, recognized: boolean) => {
    setShowRecognition(false);
    toast({
      title: recognized ? "✅ Recognition Test Complete" : "⚠️ Recognition Test",
      description: recognized 
        ? "MediaPipe + InsightFace face recognition successful!" 
        : "Face captured but not recognized (expected if not registered)",
      variant: recognized ? "default" : "destructive"
    });
  };

  const getStatusBadge = (status: 'pending' | 'success' | 'error') => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-500"><CheckCircle className="w-4 h-4 mr-1" />Ready</Badge>;
      case 'error':
        return <Badge variant="destructive"><AlertCircle className="w-4 h-4 mr-1" />Error</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          🤖 Face Recognition Integration Test
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300">
          MediaPipe (Frontend) + InsightFace (Backend) Integration
        </p>
      </div>

      {/* Status Overview */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <Camera className="h-8 w-8 text-blue-500 mr-3" />
            <div className="flex-1">
              <CardTitle className="text-lg">Frontend: MediaPipe</CardTitle>
              <p className="text-sm text-muted-foreground">Real-time face detection in browser</p>
            </div>
            {getStatusBadge(testResults.frontend)}
          </CardHeader>
          <CardContent>
            <Button onClick={testFrontendMediaPipe} className="w-full mb-4">
              Test MediaPipe Status
            </Button>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span>Face Detection:</span>
                <span className="font-mono">@mediapipe/face_detection</span>
              </div>
              <div className="flex justify-between">
                <span>Camera Utils:</span>
                <span className="font-mono">@mediapipe/camera_utils</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <Brain className="h-8 w-8 text-purple-500 mr-3" />
            <div className="flex-1">
              <CardTitle className="text-lg">Backend: InsightFace</CardTitle>
              <p className="text-sm text-muted-foreground">AI-powered face recognition</p>
            </div>
            {getStatusBadge(testResults.backend)}
          </CardHeader>
          <CardContent>
            <Button onClick={testBackendStatus} className="w-full mb-4">
              Test InsightFace Status
            </Button>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span>Detection Model:</span>
                <span className="font-mono">SCRFD</span>
              </div>
              <div className="flex justify-between">
                <span>Recognition Model:</span>
                <span className="font-mono">ArcFace</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Integration Tests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Zap className="h-6 w-6 text-yellow-500 mr-2" />
            Integration Tests
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Button 
              onClick={() => setShowRegistration(true)}
              size="lg"
              className="h-16 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
              disabled={testResults.frontend !== 'success' || testResults.backend !== 'success'}
            >
              <div className="text-center">
                <div className="font-semibold">Test Face Registration</div>
                <div className="text-sm opacity-90">MediaPipe → InsightFace</div>
              </div>
            </Button>

            <Button 
              onClick={() => setShowRecognition(true)}
              size="lg"
              className="h-16 bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700"
              disabled={testResults.frontend !== 'success' || testResults.backend !== 'success'}
            >
              <div className="text-center">
                <div className="font-semibold">Test Face Recognition</div>
                <div className="text-sm opacity-90">MediaPipe → InsightFace</div>
              </div>
            </Button>
          </div>

          {(testResults.frontend !== 'success' || testResults.backend !== 'success') && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800 text-sm">
                ⚠️ Please test both frontend and backend status before running integration tests.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Technical Details */}
      <Card>
        <CardHeader>
          <CardTitle>Integration Architecture</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-2 text-blue-600">Frontend (MediaPipe)</h4>
              <ul className="text-sm space-y-1">
                <li>• Real-time face detection in browser</li>
                <li>• No server calls for detection</li>
                <li>• WebGL/WASM acceleration</li>
                <li>• Privacy-friendly (local processing)</li>
                <li>• Instant feedback to users</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2 text-purple-600">Backend (InsightFace)</h4>
              <ul className="text-sm space-y-1">
                <li>• High-accuracy face recognition</li>
                <li>• 512-dimensional embeddings</li>
                <li>• Cosine similarity matching</li>
                <li>• Production-grade performance</li>
                <li>• Scalable architecture</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modals */}
      <FaceRegistration
        isOpen={showRegistration}
        onSuccess={handleRegistrationSuccess}
        onCancel={() => setShowRegistration(false)}
      />

      {showRecognition && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full">
            <FaceRecognition
              onCapture={handleRecognitionCapture}
              onCancel={() => setShowRecognition(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default FaceIntegrationTest;
