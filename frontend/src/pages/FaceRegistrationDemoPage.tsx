import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import FaceRegistration from '@/components/FaceRegistration';
import FaceRecognition from '@/components/FaceRecognition';

export default function FaceRegistrationDemoPage() {
  const [showFaceRegistration, setShowFaceRegistration] = useState(false);
  const [showFaceRecognition, setShowFaceRecognition] = useState(false);

  return (
    <div className="max-w-4xl mx-auto py-10">
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Face Registration Demo</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-500">
            Test the same face registration UI used in the student dashboard. Choose between face registration or recognition.
          </p>
        </CardContent>
      </Card>
      
      <div className="grid md:grid-cols-2 gap-6">
        {/* Face Registration Card */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="text-blue-600">Face Registration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              This is the exact same face registration component used when students click "Update Face Registration" in their dashboard.
            </p>
            <button
              onClick={() => setShowFaceRegistration(true)}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Open Face Registration
            </button>
          </CardContent>
        </Card>

        {/* Face Recognition Card */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="text-indigo-600">Face Recognition</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              Test the face recognition component used for attendance marking.
            </p>
            <button
              onClick={() => setShowFaceRecognition(true)}
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Open Face Recognition
            </button>
          </CardContent>
        </Card>
      </div>

      {/* Face Registration Modal */}
      <FaceRegistration
        isOpen={showFaceRegistration}
        onSuccess={() => {
          setShowFaceRegistration(false);
          alert('Face registration completed successfully!');
        }}
        onCancel={() => setShowFaceRegistration(false)}
      />

      {/* Face Recognition Modal */}
      {showFaceRecognition && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Face Recognition Test</h3>
              <button
                onClick={() => setShowFaceRecognition(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <FaceRecognition 
              onCapture={(result) => {
                console.log('Face recognition result:', result);
                alert(`Face recognition result: ${JSON.stringify(result, null, 2)}`);
              }} 
            />
          </div>
        </div>
      )}
    </div>
  );
}