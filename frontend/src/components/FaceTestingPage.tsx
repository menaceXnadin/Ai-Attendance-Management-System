import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import FaceRegistration from '@/components/FaceRegistration';
import FaceRecognition from '@/components/FaceRecognition';
import { Camera, UserCheck, TestTube, X, AlertCircle } from 'lucide-react';
import { api } from '@/integrations/api/client';
import type { User } from '@/integrations/api/types';

const FaceTestingPage: React.FC = () => {
  const [showRegistration, setShowRegistration] = useState(false);
  const [showRecognition, setShowRecognition] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [lastCaptureResult, setLastCaptureResult] = useState<{
    dataUrl: string;
    recognized: boolean;
    timestamp: string;
  } | null>(null);

  // Load current user on component mount
  useEffect(() => {
    api.auth.getUser().then(setCurrentUser).catch(() => setCurrentUser(null));
  }, []);

  const handleRegistrationSuccess = () => {
    console.log('Face registration completed successfully');
    setShowRegistration(false);
  };

  const handleRegistrationCancel = () => {
    console.log('Face registration cancelled');
    setShowRegistration(false);
  };

  const handleRecognitionCapture = (dataUrl: string, recognized: boolean) => {
    console.log('Face recognition result:', { recognized, dataUrlLength: dataUrl.length });
    setLastCaptureResult({
      dataUrl,
      recognized,
      timestamp: new Date().toLocaleString()
    });
    // Keep recognition open for continued testing
  };

  const handleRecognitionCancel = () => {
    console.log('Face recognition cancelled');
    setShowRecognition(false);
  };

  if (showRegistration) {
    return (
      <>
        {/* Overlay behind content */}
        <div className="fixed inset-0 bg-black/60 z-[60]" />
        {/* Modal content above overlay */}
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="bg-white text-black rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-xl font-semibold">Face Registration Testing</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRegistrationCancel}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4">
              <FaceRegistration
                onSuccess={handleRegistrationSuccess}
                onCancel={handleRegistrationCancel}
                isOpen={true}
              />
            </div>
          </div>
        </div>
      </>
    );
  }

  if (showRecognition) {
    return (
      <>
        <div className="fixed inset-0 bg-black/60 z-[60]" />
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="bg-white text-black rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-xl font-semibold">Face Recognition Testing</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRecognitionCancel}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4">
              <FaceRecognition
                onCapture={handleRecognitionCapture}
                onCancel={handleRecognitionCancel}
                disabled={false}
              />
              {lastCaptureResult && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <h4 className="font-medium mb-2">Last Recognition Result:</h4>
                  <div className="flex items-center gap-3">
                    <img 
                      src={lastCaptureResult.dataUrl} 
                      alt="Captured face" 
                      className="w-16 h-16 rounded-lg object-cover"
                    />
                    <div>
                      <p className={`font-medium ${lastCaptureResult.recognized ? 'text-green-600' : 'text-red-600'}`}>
                        {lastCaptureResult.recognized ? '✅ Recognition Successful' : '❌ Recognition Failed'}
                      </p>
                      <p className="text-sm text-gray-500">{lastCaptureResult.timestamp}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 text-gray-900 select-text">Face Recognition Testing</h1>
        <p className="text-gray-700 select-text">
          Test your existing face registration and recognition components without time restrictions
        </p>
        
        {/* Current User Display */}
        {currentUser && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-300 rounded-lg">
            <div className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-blue-600" />
              <span className="font-medium text-blue-900 select-text">
                Logged in as: {currentUser.name || 'Unknown User'}
              </span>
              <Badge variant="secondary">
                {currentUser.role || 'User'}
              </Badge>
              {currentUser.email && (
                <span className="text-sm text-blue-700 select-text">({currentUser.email})</span>
              )}
            </div>
          </div>
        )}
        {!currentUser && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-300 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <span className="font-medium text-amber-800 select-text">
                No user logged in. Please log in first to use the testing features.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Authentication Notice */}
      <Card className="mb-6 bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-2">
            <UserCheck className="h-5 w-5 text-blue-600" />
            <span className="font-medium text-blue-700">Authentication Required</span>
          </div>
          <div className="text-sm space-y-1">
            <p className="text-blue-600"><strong>📝 Face Registration:</strong> Will register face for the currently logged-in student</p>
            <p className="text-blue-600"><strong>🔍 Face Recognition:</strong> Will verify against the currently logged-in student's registered face</p>
            <p className="text-blue-600"><strong>🔑 How to test:</strong> Log in as a student first, then use these testing components</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Face Registration Testing */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-blue-600" />
              Face Registration
            </CardTitle>
            <CardDescription>
              Test your face registration component to register or update your face encoding
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-gray-600">
              <p><strong>What this tests:</strong></p>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>MediaPipe face detection</li>
                <li>Image capture quality</li>
                <li>Backend face encoding generation</li>
                <li>Database storage for <strong>current student</strong></li>
              </ul>
            </div>
            <Button
              onClick={() => setShowRegistration(true)}
              className="w-full"
            >
              <Camera className="h-4 w-4 mr-2" />
              Test Face Registration
            </Button>
          </CardContent>
        </Card>

        {/* Face Recognition Testing */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TestTube className="h-5 w-5 text-green-600" />
              Face Recognition
            </CardTitle>
            <CardDescription>
              Test your face recognition component to verify identity matching
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-gray-600">
              <p><strong>What this tests:</strong></p>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>MediaPipe face detection</li>
                <li>Identity verification against <strong>current student</strong></li>
                <li>Face matching accuracy</li>
                <li>Recognition confidence</li>
              </ul>
            </div>
            <Button
              onClick={() => setShowRecognition(true)}
              className="w-full"
              variant="outline"
            >
              <Camera className="h-4 w-4 mr-2" />
              Test Face Recognition
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Instructions */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Testing Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">🔧 How to Test:</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
              <li><strong>Login First:</strong> Go to <a href="/login" className="text-blue-600 underline">/login</a> and log in as a student</li>
              <li><strong>Face Registration:</strong> Click "Test Face Registration" to register your face for the logged-in student</li>
              <li><strong>Face Recognition:</strong> Click "Test Face Recognition" to verify your identity against your registered face</li>
              <li><strong>Test Multiple Scenarios:</strong> Try different lighting conditions, angles, and distances</li>
              <li><strong>Check Console:</strong> Open browser DevTools to see detailed logs and debug information</li>
            </ol>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">💡 Testing Tips:</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
              <li>Ensure good lighting on your face</li>
              <li>Look directly at the camera</li>
              <li>Make sure only your face is visible</li>
              <li>Test with and without glasses</li>
              <li>Try different facial expressions</li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium mb-2">🐛 Debugging:</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
              <li>Check browser console for error messages</li>
              <li>Verify camera permissions are granted</li>
              <li>Ensure backend server is running</li>
              <li>Check network tab for API call responses</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Current Status */}
      <Card className="mt-6 bg-green-50 border-green-200">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-green-700">
            <TestTube className="h-5 w-5" />
            <span className="font-medium">Testing Mode Active</span>
          </div>
          <p className="text-sm text-green-600 mt-1">
            No time restrictions applied - you can test anytime without class schedule limitations
          </p>
          <p className="text-xs text-green-500 mt-1">
            Note: You must be logged in as a student for the components to work properly
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default FaceTestingPage;