import React, { useState } from 'react';
import StudentSidebar from '@/components/StudentSidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Scan } from 'lucide-react';
import FaceRecognition from '@/components/FaceRecognition';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/integrations/api/client';

const StudentMarkAttendancePage = () => {
  const [showScanner, setShowScanner] = useState(false);
  const { toast } = useToast();

  return (
    <StudentSidebar>
      <div className="px-6 py-6">
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 overflow-hidden">
          <CardHeader>
            <CardTitle className="text-white">Mark Attendance</CardTitle>
            <CardDescription className="text-blue-200/80">Use face recognition to mark your attendance</CardDescription>
          </CardHeader>
          <CardContent>
            {showScanner ? (
              <FaceRecognition 
                subjectId="1"
                onCapture={async (dataUrl, recognized) => {
                  if (!recognized) {
                    toast({ title: 'Face not recognized', variant: 'destructive' });
                    return;
                  }
                  try {
                    const res = await api.faceRecognition.markAttendance(dataUrl, '1');
                    if (res.success) {
                      toast({ title: 'Attendance marked successfully' });
                    } else {
                      toast({ title: 'Failed to mark attendance', variant: 'destructive' });
                    }
                  } catch (e) {
                    toast({ title: 'Error marking attendance', variant: 'destructive' });
                  } finally {
                    setShowScanner(false);
                  }
                }}
                onCancel={() => setShowScanner(false)}
              />
            ) : (
              <Button onClick={() => setShowScanner(true)} className="gap-2">
                <Scan className="h-4 w-4" /> Start Face Scan
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </StudentSidebar>
  );
};

export default StudentMarkAttendancePage;
