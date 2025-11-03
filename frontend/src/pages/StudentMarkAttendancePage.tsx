import React, { useState } from 'react';
import StudentSidebar from '@/components/StudentSidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Scan, AlertTriangle } from 'lucide-react';
import FaceRecognition from '@/components/FaceRecognition';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';

const StudentMarkAttendancePage = () => {
  const [showScanner, setShowScanner] = useState(false);
  const { toast } = useToast();

  return (
    <StudentSidebar>
      <div className="px-6 py-6">
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 overflow-hidden">
          <CardHeader>
            <CardTitle className="text-white">Face Verification Test</CardTitle>
            <CardDescription className="text-blue-200/80">
              Test if your face matches the stored data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="bg-blue-500/10 border-blue-500/50">
              <AlertTriangle className="h-4 w-4 text-blue-400" />
              <AlertDescription className="text-blue-200">
                <strong>Simple Test:</strong> Just verifying your face matches - no attendance marking.
              </AlertDescription>
            </Alert>

            {showScanner ? (
              <FaceRecognition 
                onCapture={(dataUrl, recognized) => {
                  if (recognized) {
                    toast({ 
                      title: '✅ Face Matched!', 
                      description: 'Your face matches the stored data'
                    });
                  } else {
                    toast({ 
                      title: '❌ Face Not Matched', 
                      description: 'Face does not match stored data',
                      variant: 'destructive' 
                    });
                  }
                  setShowScanner(false);
                }}
                onCancel={() => setShowScanner(false)}
              />
            ) : (
              <Button 
                onClick={() => setShowScanner(true)} 
                className="w-full gap-2"
                size="lg"
              >
                <Scan className="h-4 w-4" /> Start Face Verification
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </StudentSidebar>
  );
};

export default StudentMarkAttendancePage;
