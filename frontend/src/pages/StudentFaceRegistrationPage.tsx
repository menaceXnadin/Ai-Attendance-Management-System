import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/useAuth';
import { api } from '@/integrations/api/client';
import StudentSidebar from '@/components/StudentSidebar';
import FaceRegistration from '@/components/FaceRegistration';
import FaceRecognition from '@/components/FaceRecognition';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertTriangle, Loader2, Scan, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const StudentFaceRegistrationPage = () => {
  const [open, setOpen] = useState(false);
  const [showFaceVerification, setShowFaceVerification] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  // Fetch student data to check face registration status
  const { data: studentData, isLoading, refetch } = useQuery({
    queryKey: ['current-student-face-status', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      try {
        const students = await api.students.getAll();
        const found = students.find(s => s.email === user.email);
        if (!found) {
          const foundInsensitive = students.find(s => s.email?.toLowerCase() === user.email?.toLowerCase());
          return foundInsensitive || null;
        }
        return found;
      } catch (error) {
        console.error('Error fetching student data:', error);
        return null;
      }
    },
    enabled: !!user?.email,
  });

  if (isLoading) {
    return (
      <StudentSidebar>
        <div className="flex items-center justify-center min-h-screen">
          <div className="flex items-center gap-3 text-white">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Loading face registration status...</span>
          </div>
        </div>
      </StudentSidebar>
    );
  }

  const isFaceRegistered = !!studentData?.face_encoding;

  return (
    <StudentSidebar>
      <div className="p-6 space-y-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Face Registration Status Card */}
          <Card className="bg-surface-default border-border-subtle shadow-card">
            <CardHeader>
              <CardTitle className="text-xl text-text-primary flex items-center gap-3">
                {isFaceRegistered ? (
                  <>
                    <CheckCircle className="h-7 w-7 text-status-success" />
                    Face Recognition Ready
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-7 w-7 text-status-warning" />
                    Face Registration Required
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {isFaceRegistered ? (
                <div className="space-y-4">
                  <div className="bg-status-success-subtle border border-status-success-border rounded-xl p-5">
                    <div className="text-status-success mb-2">
                      <span className="font-semibold text-base">Your face is successfully registered!</span>
                    </div>
                    <p className="text-xs text-text-secondary">
                      You can now use face recognition for quick attendance marking across all your classes.
                    </p>
                  </div>
                  
                  <div className="flex gap-3">
                    <Button 
                      onClick={() => setOpen(true)}
                      variant="outline"
                      className="border-border-default hover:bg-surface-subtle"
                    >
                      Update Face Data
                    </Button>
                    
                    <Button 
                      onClick={() => navigate('/student')}
                      className="bg-action-primary hover:bg-action-primary-hover text-white"
                    >
                      Back to Dashboard
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-status-warning-subtle border border-status-warning-border rounded-xl p-5">
                    <div className="text-status-warning mb-2">
                      <span className="font-semibold text-base">Face registration is required</span>
                    </div>
                    <p className="text-xs text-text-secondary mb-3">
                      Please register your face to enable automated attendance marking. The process takes less than a minute.
                    </p>
                    <ul className="text-xs text-text-muted space-y-1 list-disc list-inside">
                      <li>Ensure good lighting</li>
                      <li>Face the camera directly</li>
                      <li>Remove accessories like sunglasses or hats</li>
                    </ul>
                  </div>
                  
                  <div className="flex gap-3">
                    <Button 
                      onClick={() => setOpen(true)}
                      className="bg-action-primary hover:bg-action-primary-hover text-white"
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      Register Face Now
                    </Button>
                    
                    <Button 
                      variant="outline"
                      onClick={() => navigate('/student')}
                      className="border-border-default hover:bg-surface-subtle"
                    >
                      Skip for Now
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Face Verification Test Card */}
          {isFaceRegistered && (
            <Card className="bg-surface-default border-border-subtle shadow-card">
              <CardHeader>
                <CardTitle className="text-lg text-text-primary flex items-center gap-2.5">
                  <Shield className="h-5 w-5 text-action-primary" />
                  Face Verification Test
                </CardTitle>
                <CardDescription className="text-text-muted text-xs">
                  Test if your face matches the stored data. This is for verification only - no attendance will be marked.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-status-info-subtle border border-status-info-border rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-4 w-4 text-action-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-action-primary font-medium text-xs mb-0.5">Verification Mode</p>
                      <p className="text-text-secondary text-xs">
                        Confirming your facial vectors match your student record without committing an attendance record.
                      </p>
                    </div>
                  </div>
                </div>

                <Button 
                  onClick={() => setShowFaceVerification(true)}
                  className="w-full bg-action-primary hover:bg-action-primary-hover text-white"
                >
                  <Scan className="h-4 w-4 mr-2" />
                  Start Face Verification
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Face Registration Modal */}
      <FaceRegistration
        isOpen={open}
        onSuccess={() => {
          setOpen(false);
          refetch(); // Refresh the student data to show updated status
        }}
        onCancel={() => {
          setOpen(false);
        }}
      />

      {/* Face Verification Modal */}
      {showFaceVerification && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div
            className="bg-surface-default border border-border-default rounded-xl w-full shadow-2xl flex flex-col max-h-[90vh]"
            style={{ width: 'min(92vw, 720px)' }}
          >
            <div className="border-b border-border-subtle px-6 py-4 flex-shrink-0 sticky top-0 bg-surface-default z-10">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
                  <Scan className="h-5 w-5 text-action-primary" />
                  Face Verification Test
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFaceVerification(false)}
                  className="text-text-muted hover:text-text-primary"
                >
                  Close
                </Button>
              </div>
            </div>
            <div className="p-4 flex-1">
              <FaceRecognition
                onCapture={(dataUrl, recognized) => {
                  setShowFaceVerification(false);
                  if (recognized) {
                    toast({
                      title: "Verification Successful",
                      description: "Face recognized successfully!",
                    });
                  } else {
                    toast({
                      title: "Verification Failed",
                      description: "Face not recognized. Please try again.",
                      variant: "destructive",
                    });
                  }
                }}
                onCancel={() => setShowFaceVerification(false)}
              />
            </div>
          </div>
        </div>
      )}
    </StudentSidebar>
  );
};

export default StudentFaceRegistrationPage;
