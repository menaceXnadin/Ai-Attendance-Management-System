import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/useAuth';
import { api } from '@/integrations/api/client';
import StudentSidebar from '@/components/StudentSidebar';
import FaceRegistration from '@/components/FaceRegistration';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';

const StudentFaceRegistrationPage = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

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
      <div className="p-6">
        <div className="max-w-2xl mx-auto">
          <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
            <CardHeader>
              <CardTitle className="text-2xl text-white flex items-center gap-3">
                {isFaceRegistered ? (
                  <>
                    <CheckCircle className="h-8 w-8 text-green-400" />
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
                  <div className="bg-green-500/20 border border-green-400/30 rounded-xl p-6">
                    <div className="text-green-300 mb-3">
                      <span className="font-semibold text-lg">Your face is successfully registered!</span>
                    </div>
                    <p className="text-green-200/80">
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
                      className="bg-gradient-to-r from-blue-500 to-teal-400 hover:from-blue-600 hover:to-teal-500"
                    >
                      Back to Dashboard
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-amber-500/20 border border-amber-400/30 rounded-xl p-6">
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
    </StudentSidebar>
  );
};

export default StudentFaceRegistrationPage;
