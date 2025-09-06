import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  Camera, 
  Upload, 
  TestTube, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Users,
  Timer,
  Eye,
  UserCheck,
  RotateCcw,
  Trash2,
  Download
} from 'lucide-react';
import { api } from '@/integrations/api/client';
import type { User } from '@/integrations/api/types';

interface TestResult {
  success: boolean;
  message: string;
  test_type: string;
  details?: Record<string, unknown>;
  confidence_score?: number;
  student_id?: number;
  processing_time_ms?: number;
}

interface ServiceStatus {
  available: boolean;
  message: string;
  insightface_status?: {
    model_name?: string;
    providers?: string[];
  };
  test_endpoints?: string[];
}

interface RegisteredStudent {
  id: number;
  registration_number: string;
  name: string;
  email: string;
  has_face_encoding: boolean;
  encoding_length: number;
}

const FaceRecognitionTestPage: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isVideoActive, setIsVideoActive] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTest, setCurrentTest] = useState<string>('');
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [registeredStudents, setRegisteredStudents] = useState<RegisteredStudent[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Initialize camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: 640, 
          height: 480,
          facingMode: 'user' 
        } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsVideoActive(true);
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Failed to access camera. Please ensure camera permissions are granted.');
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsVideoActive(false);
    }
  }, []);

  // Capture image from video
  const captureImage = useCallback((): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.8).split(',')[1]; // Return base64 without data:image prefix
  }, []);

  // Load file as base64
  const handleFileUpload = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]); // Remove data:image prefix
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, []);

  // API call wrapper
  const makeAPICall = useCallback(async (endpoint: string, data?: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const response = await fetch(`/api/face-testing${endpoint}`, {
      method: data ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    });
    
    if (!response.ok) {
      throw new Error(`API call failed: ${response.statusText}`);
    }
    
    return response.json();
  }, []);

  // Test functions
  const runDetectionTest = useCallback(async (imageData: string) => {
    setIsLoading(true);
    setCurrentTest('Face Detection');
    
    try {
      const result = await makeAPICall('/detect-test', { image_data: imageData });
      setTestResults(prev => [result as unknown as TestResult, ...prev]);
    } catch (error) {
      console.error('Detection test failed:', error);
      setTestResults(prev => [{
        success: false,
        message: `Detection test failed: ${error}`,
        test_type: 'detection'
      }, ...prev]);
    } finally {
      setIsLoading(false);
      setCurrentTest('');
    }
  }, [makeAPICall]);

  const runRegistrationTest = useCallback(async (imageData: string) => {
    setIsLoading(true);
    setCurrentTest('Face Registration');
    
    try {
      const result = await makeAPICall('/register-test', { image_data: imageData });
      setTestResults(prev => [result as unknown as TestResult, ...prev]);
    } catch (error) {
      console.error('Registration test failed:', error);
      setTestResults(prev => [{
        success: false,
        message: `Registration test failed: ${error}`,
        test_type: 'registration'
      }, ...prev]);
    } finally {
      setIsLoading(false);
      setCurrentTest('');
    }
  }, [makeAPICall]);

  const runVerificationTest = useCallback(async (imageData: string, studentId?: number) => {
    setIsLoading(true);
    setCurrentTest('Face Verification');
    
    try {
      const payload: Record<string, unknown> = { image_data: imageData };
      if (studentId) {
        payload.test_student_id = studentId;
      }
      
      const result = await makeAPICall('/verify-test', payload);
      setTestResults(prev => [result as unknown as TestResult, ...prev]);
    } catch (error) {
      console.error('Verification test failed:', error);
      setTestResults(prev => [{
        success: false,
        message: `Verification test failed: ${error}`,
        test_type: 'verification'
      }, ...prev]);
    } finally {
      setIsLoading(false);
      setCurrentTest('');
    }
  }, [makeAPICall]);

  const runComparisonTest = useCallback(async (image1: string, image2: string) => {
    setIsLoading(true);
    setCurrentTest('Face Comparison');
    
    try {
      const compareData = JSON.stringify({ image1, image2 });
      const result = await makeAPICall('/compare-test', { image_data: compareData });
      setTestResults(prev => [result as unknown as TestResult, ...prev]);
    } catch (error) {
      console.error('Comparison test failed:', error);
      setTestResults(prev => [{
        success: false,
        message: `Comparison test failed: ${error}`,
        test_type: 'comparison'
      }, ...prev]);
    } finally {
      setIsLoading(false);
      setCurrentTest('');
    }
  }, [makeAPICall]);

  const runBatchTest = useCallback(async (images: string[]) => {
    setIsLoading(true);
    setCurrentTest('Batch Processing');
    
    try {
      const result = await makeAPICall('/batch-test', { 
        images,
        test_student_id: selectedStudentId 
      });
      setTestResults(prev => [result as unknown as TestResult, ...prev]);
    } catch (error) {
      console.error('Batch test failed:', error);
      setTestResults(prev => [{
        success: false,
        message: `Batch test failed: ${error}`,
        test_type: 'batch'
      }, ...prev]);
    } finally {
      setIsLoading(false);
      setCurrentTest('');
    }
  }, [makeAPICall, selectedStudentId]);

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Load service status
        const status = await makeAPICall('/status');
  setServiceStatus(status as unknown as ServiceStatus);
        
        // Load registered students
        const students = await makeAPICall('/registered-students');
  setRegisteredStudents(Array.isArray(students.students) ? (students.students as RegisteredStudent[]) : []);
      } catch (error) {
        console.error('Failed to load initial data:', error);
      }
    };
    
    loadInitialData();
  }, [makeAPICall]);

  useEffect(() => {
    api.auth.getUser().then(setCurrentUser).catch(() => setCurrentUser(null));
  }, []);

  // Quick actions
  const quickCaptureAndTest = useCallback(async (testType: 'detect' | 'register' | 'verify') => {
    if (!isVideoActive) {
      await startCamera();
      return;
    }
    
    const imageData = captureImage();
    if (!imageData) {
      alert('Failed to capture image');
      return;
    }
    
    setCapturedImages(prev => [imageData, ...prev.slice(0, 4)]); // Keep last 5 images
    
    switch (testType) {
      case 'detect':
        await runDetectionTest(imageData);
        break;
      case 'register':
        await runRegistrationTest(imageData);
        break;
      case 'verify':
        await runVerificationTest(imageData, selectedStudentId || undefined);
        break;
    }
  }, [isVideoActive, startCamera, captureImage, runDetectionTest, runRegistrationTest, runVerificationTest, selectedStudentId]);

  const clearTestData = useCallback(async () => {
    if (!confirm('This will clear ALL face encodings from the database. Are you sure?')) {
      return;
    }
    
    setIsLoading(true);
    try {
      await makeAPICall('/clear-test-data', {});
      alert('Test data cleared successfully');
      // Reload registered students
      const students = await makeAPICall('/registered-students');
  setRegisteredStudents(Array.isArray(students.students) ? (students.students as RegisteredStudent[]) : []);
    } catch (error) {
      console.error('Failed to clear test data:', error);
      alert('Failed to clear test data');
    } finally {
      setIsLoading(false);
    }
  }, [makeAPICall]);

  const exportResults = useCallback(() => {
    const dataStr = JSON.stringify(testResults, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `face-recognition-test-results-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [testResults]);

  const ResultCard = ({ result, index }: { result: TestResult; index: number }) => (
    <Card className={`mb-4 ${result.success ? 'border-green-200' : 'border-red-200'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {result.success ? 
              <CheckCircle className="h-5 w-5 text-green-500" /> : 
              <XCircle className="h-5 w-5 text-red-500" />
            }
            <CardTitle className="text-lg">{result.test_type.toUpperCase()} Test #{testResults.length - index}</CardTitle>
            <Badge variant={result.success ? "default" : "destructive"}>
              {result.success ? 'PASS' : 'FAIL'}
            </Badge>
          </div>
          {result.processing_time_ms && (
            <Badge variant="outline">
              <Timer className="h-3 w-3 mr-1" />
              {result.processing_time_ms.toFixed(0)}ms
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600 mb-3">{result.message}</p>
        
        {result.confidence_score && (
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-medium">Confidence:</span>
            <Progress value={result.confidence_score} className="flex-1" />
            <span className="text-sm">{result.confidence_score.toFixed(1)}%</span>
          </div>
        )}
        
        {result.student_id && (
          <p className="text-sm"><strong>Matched Student ID:</strong> {result.student_id}</p>
        )}
        
        {result.details && (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium text-blue-600">View Details</summary>
            <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-auto max-h-40">
              {JSON.stringify(result.details, null, 2)}
            </pre>
          </details>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Face Recognition Testing Lab</h1>
        <p className="text-gray-600">
          Test and refine face registration and verification without time restrictions
        </p>
        {currentUser && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-blue-600" />
              <span className="font-medium text-blue-800">
                Logged in as: {currentUser.name ?? currentUser.email}
              </span>
              <Badge variant="secondary">
                {currentUser.role}
              </Badge>
              {currentUser.email && (
                <span className="text-sm text-blue-600">({currentUser.email})</span>
              )}
            </div>
          </div>
        )}
        {!currentUser && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <span className="font-medium text-amber-800">
                No user logged in. Please log in first to use the testing features.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Service Status */}
      {serviceStatus && (
        <Alert className={`mb-6 ${serviceStatus.available ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Service Status:</strong> {serviceStatus.message}
            {serviceStatus.insightface_status && (
              <span className="ml-2">
                (Model: {serviceStatus.insightface_status.model_name}, 
                Providers: {serviceStatus.insightface_status.providers?.join(', ')})
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Controls */}
        <div className="space-y-6">
          {/* Camera Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Camera Controls
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <video
                  ref={videoRef}
                  className="w-full h-64 bg-gray-100 rounded-lg"
                  autoPlay
                  playsInline
                  muted
                />
                <canvas ref={canvasRef} className="hidden" />
                {!isVideoActive && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
                    <p className="text-gray-500">Camera not active</p>
                  </div>
                )}
              </div>
              
              <div className="flex gap-2">
                <Button
                  onClick={isVideoActive ? stopCamera : startCamera}
                  variant={isVideoActive ? "destructive" : "default"}
                  className="flex-1"
                >
                  {isVideoActive ? 'Stop Camera' : 'Start Camera'}
                </Button>
              </div>

              {/* Quick Test Buttons */}
              {isVideoActive && (
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    onClick={() => quickCaptureAndTest('detect')}
                    disabled={isLoading}
                    size="sm"
                    variant="outline"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Detect
                  </Button>
                  <Button
                    onClick={() => quickCaptureAndTest('register')}
                    disabled={isLoading}
                    size="sm"
                    variant="outline"
                  >
                    <UserCheck className="h-4 w-4 mr-1" />
                    Register
                  </Button>
                  <Button
                    onClick={() => quickCaptureAndTest('verify')}
                    disabled={isLoading}
                    size="sm"
                    variant="outline"
                  >
                    <TestTube className="h-4 w-4 mr-1" />
                    Verify
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* File Upload Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                File Upload Testing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length === 0) return;
                  
                  try {
                    const imageDataList = await Promise.all(
                      files.map(file => handleFileUpload(file))
                    );
                    
                    setCapturedImages(prev => [...imageDataList, ...prev].slice(0, 10));
                    
                    if (imageDataList.length === 1) {
                      // Single image - run all tests
                      await runDetectionTest(imageDataList[0]);
                      await runRegistrationTest(imageDataList[0]);
                      await runVerificationTest(imageDataList[0]);
                    } else if (imageDataList.length >= 2) {
                      // Multiple images - run batch test and comparison
                      await runBatchTest(imageDataList);
                      if (imageDataList.length >= 2) {
                        await runComparisonTest(imageDataList[0], imageDataList[1]);
                      }
                    }
                  } catch (error) {
                    console.error('File upload failed:', error);
                    alert('Failed to process uploaded files');
                  }
                }}
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="w-full"
                variant="outline"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Images for Testing
              </Button>
            </CardContent>
          </Card>

          {/* Registered Students */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Registered Students ({registeredStudents.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {registeredStudents.length > 0 ? (
                  registeredStudents.map(student => (
                    <div
                      key={student.id}
                      className={`p-2 rounded border cursor-pointer transition-colors ${
                        selectedStudentId === student.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                      }`}
                      onClick={() => setSelectedStudentId(selectedStudentId === student.id ? null : student.id)}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium text-sm">{student.name}</p>
                          <p className="text-xs text-gray-500">{student.registration_number}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {student.encoding_length}D
                        </Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm">No students with registered faces</p>
                )}
              </div>
              {selectedStudentId && (
                <p className="text-xs text-blue-600 mt-2">
                  Testing against student ID: {selectedStudentId}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Captured Images */}
          {capturedImages.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Recent Captures ({capturedImages.length})
                  <Button
                    onClick={() => setCapturedImages([])}
                    size="sm"
                    variant="ghost"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2">
                  {capturedImages.slice(0, 6).map((imageData, index) => (
                    <div key={index} className="relative">
                      <img
                        src={`data:image/jpeg;base64,${imageData}`}
                        alt={`Capture ${index + 1}`}
                        className="w-full h-20 object-cover rounded border cursor-pointer hover:opacity-75"
                        onClick={async () => {
                          await runDetectionTest(imageData);
                        }}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Danger Zone */}
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-600 flex items-center gap-2">
                <Trash2 className="h-5 w-5" />
                Danger Zone
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                onClick={clearTestData}
                disabled={isLoading}
                variant="destructive"
                size="sm"
              >
                Clear All Face Data
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Results */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <TestTube className="h-5 w-5" />
                  Test Results ({testResults.length})
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    onClick={exportResults}
                    disabled={testResults.length === 0}
                    size="sm"
                    variant="outline"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Export
                  </Button>
                  <Button
                    onClick={() => setTestResults([])}
                    disabled={testResults.length === 0}
                    size="sm"
                    variant="ghost"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {isLoading && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span className="text-sm text-blue-600">Running {currentTest}...</span>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="max-h-[800px] overflow-y-auto">
                {testResults.length > 0 ? (
                  testResults.map((result, index) => (
                    <ResultCard key={index} result={result} index={index} />
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <TestTube className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No test results yet</p>
                    <p className="text-sm">Capture an image or upload files to start testing</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default FaceRecognitionTestPage;