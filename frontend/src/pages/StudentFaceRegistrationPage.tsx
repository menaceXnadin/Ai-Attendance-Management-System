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
          <Card className="bg-slate-900/70 backdrop-blur-sm border-slate-700/80">
            <CardHeader>
              <CardTitle className="text-2xl text-white flex items-center gap-3">
                {isFaceRegistered ? (
                  <>
                    <CheckCircle className="h-8 w-8 text-emerald-400" />
                    Face Recognition Ready
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-8 w-8 text-amber-400" />
                    Face Registration Required
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {isFaceRegistered ? (
                <div className="space-y-4">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6">
                    <div className="text-emerald-300 mb-3">
                      <span className="font-semibold text-lg">Your face is successfully registered!</span>
                    </div>
                    <p className="text-emerald-200/80">
                      You can now use face recognition for quick attendance marking across all your classes.
                    </p>
                  </div>
                  
                  <div className="flex gap-4">
                    <Button 
                      onClick={() => setOpen(true)}
                      variant="outline"
                      className="border-slate-600 text-slate-300 hover:bg-slate-800"
                    >
                      Update Face Registration
                    </Button>
                    
                    <Button 
                      onClick={() => navigate('/student')}
                      className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
                    >
                      Back to Dashboard
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-6">
                    <div className="text-amber-300 mb-3">
                      <span className="font-semibold text-lg">Set up face recognition</span>
                    </div>
                    <p className="text-amber-200/80">
                      Register your face to enable quick attendance marking. This is a one-time setup process.
                    </p>
                  </div>
                  
                  <div className="flex gap-4">
                    <Button 
                      onClick={() => setOpen(true)}
                      className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                    >
                      Start Face Registration
                    </Button>
                    
                    <Button 
                      onClick={() => navigate('/student')}
                      variant="outline"
                      className="border-slate-600 text-slate-300 hover:bg-slate-800"
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
            <Card className="bg-slate-900/70 backdrop-blur-sm border-slate-700/80">
              <CardHeader>
                <CardTitle className="text-xl text-white flex items-center gap-3">
                  <Shield className="h-6 w-6 text-blue-400" />
                  Face Verification Test
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Test if your face matches the stored data. This is for verification only - no attendance will be marked.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-blue-300 font-medium mb-1">Simple Test</p>
                      <p className="text-blue-200/80 text-sm">
                        Just verifying your face matches - no attendance marking.
                      </p>
                    </div>
                  </div>
                </div>

                <Button 
                  onClick={() => setShowFaceVerification(true)}
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div
            className="bg-slate-900/95 border border-slate-700 rounded-xl w-full shadow-2xl flex flex-col max-h-[90vh]"
            style={{ width: 'min(92vw, 720px)' }}
          >
            <div className="border-b border-slate-800 px-6 py-4 flex-shrink-0 sticky top-0 bg-slate-900/95 z-10">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Scan className="h-5 w-5 text-blue-400" />
                  Face Verification Test
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFaceVerification(false)}
                  className="text-slate-400 hover:text-white"
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
