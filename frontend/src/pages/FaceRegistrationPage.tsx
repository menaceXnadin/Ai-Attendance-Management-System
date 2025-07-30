import React, { useState } from 'react';
import { useAuth } from '@/contexts/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import ModernFaceRegistration from '@/components/ModernFaceRegistration';
import ModernFaceRegistrationDialog from '@/components/ModernFaceRegistrationDialog';
import { useToast } from '@/hooks/use-toast';
import { 
  User, 
  Shield, 
  Camera, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowLeft,
  Sparkles,
  Lock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function FaceRegistrationPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);

  // Only allow students to access this page
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Lock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>
              Please log in to access face registration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={() => navigate('/login')} 
              className="w-full"
            >
              Go to Login
            </Button>
            <Button 
              variant="outline" 
              onClick={() => navigate('/')} 
              className="w-full"
            >
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (user.role !== 'student') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertTriangle className="w-12 h-12 mx-auto text-amber-500 mb-4" />
            <CardTitle>Access Restricted</CardTitle>
            <CardDescription>
              Face registration is only available for students
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              variant="outline" 
              onClick={() => navigate('/dashboard')} 
              className="w-full"
            >
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleRegistrationSuccess = () => {
    setRegistrationComplete(true);
    setIsDialogOpen(false);
    toast({
      title: "Face Registration Complete!",
      description: "Your face has been successfully registered for attendance tracking.",
    });
  };

  const handleBack = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBack}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Face Registration
              </h1>
              <p className="text-muted-foreground">
                Set up your face profile for automated attendance
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="hidden sm:flex">
            <User className="w-4 h-4 mr-1" />
            {user.name}
          </Badge>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Registration Panel */}
          <div className="lg:col-span-2">
            <Card className="overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Camera className="w-6 h-6" />
                  </div>
                  <div>
                    <CardTitle>Face Registration System</CardTitle>
                    <CardDescription className="text-blue-100">
                      Secure biometric authentication for attendance tracking
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-8">
                {!registrationComplete ? (
                  <div className="text-center space-y-6">
                    <div className="relative mx-auto w-32 h-32">
                      <div className="w-32 h-32 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                        <Sparkles className="w-16 h-16 text-white" />
                      </div>
                      <div className="absolute -top-2 -right-2 w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                        <Camera className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-xl font-semibold mb-2">Ready to Register Your Face</h3>
                      <p className="text-muted-foreground mb-6">
                        Click the button below to start the face registration process. 
                        Make sure you're in a well-lit area and face the camera directly.
                      </p>
                    </div>

                    <Button 
                      onClick={() => setIsDialogOpen(true)}
                      size="lg"
                      className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-3 px-8 rounded-full transition-all duration-300 transform hover:scale-105"
                    >
                      <Camera className="w-5 h-5 mr-2" />
                      Start Face Registration
                    </Button>
                  </div>
                ) : (
                  <div className="text-center space-y-6">
                    <div className="w-32 h-32 bg-green-500 rounded-full flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-16 h-16 text-white" />
                    </div>
                    
                    <div>
                      <h3 className="text-xl font-semibold text-green-600 mb-2">
                        Registration Complete!
                      </h3>
                      <p className="text-muted-foreground mb-6">
                        Your face has been successfully registered. You can now use face recognition for attendance.
                      </p>
                    </div>

                    <div className="flex gap-4 justify-center">
                      <Button 
                        onClick={() => navigate('/dashboard')}
                        variant="outline"
                      >
                        Back to Dashboard
                      </Button>
                      <Button 
                        onClick={() => {
                          setRegistrationComplete(false);
                          setIsDialogOpen(true);
                        }}
                        variant="outline"
                      >
                        Register Again
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Information Panel */}
          <div className="space-y-6">
            {/* Security Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-green-600" />
                  Security & Privacy
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Face data is encrypted and stored securely</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Only facial features are stored, not images</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Data is tied to your student account only</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>You can update or remove data anytime</span>
                </div>
              </CardContent>
            </Card>

            {/* Tips for Best Results */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                  Tips for Best Results
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>• Face the camera directly</div>
                <div>• Ensure good lighting</div>
                <div>• Remove glasses if possible</div>
                <div>• Maintain a neutral expression</div>
                <div>• Stay still during capture</div>
              </CardContent>
            </Card>

            {/* Student Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-600" />
                  Student Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Name:</span> {user.name}
                </div>
                <div>
                  <span className="font-medium">Email:</span> {user.email}
                </div>
                <div>
                  <span className="font-medium">Role:</span> 
                  <Badge variant="secondary" className="ml-2">
                    {user.role}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Face Registration Dialog */}
        <ModernFaceRegistrationDialog 
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          onRegistrationComplete={handleRegistrationSuccess}
          mode="register"
        />
      </div>
    </div>
  );
}
