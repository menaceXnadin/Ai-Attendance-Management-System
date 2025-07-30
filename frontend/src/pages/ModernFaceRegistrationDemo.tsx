import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Camera, 
  Sparkles, 
  Shield, 
  Zap, 
  Eye,
  PlayCircle,
  CheckCircle2,
  Users
} from 'lucide-react';
import ModernFaceRegistrationDialog from '@/components/ModernFaceRegistrationDialog';

const ModernFaceRegistrationDemo = () => {
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const [isVerificationOpen, setIsVerificationOpen] = useState(false);
  const [registrationMode, setRegistrationMode] = useState<'register' | 'verify'>('register');

  const handleSuccess = () => {
    console.log('Face registration/verification successful!');
  };

  const features = [
    {
      icon: <Eye className="w-6 h-6" />,
      title: "Real-time Face Detection",
      description: "Advanced AI powered by MediaPipe for instant face recognition",
      color: "bg-blue-500"
    },
    {
      icon: <Sparkles className="w-6 h-6" />,
      title: "Smooth Animations",
      description: "Modern UI with delightful animations and transitions",
      color: "bg-purple-500"
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: "Secure & Private",
      description: "Your face data is processed securely with enterprise-grade encryption",
      color: "bg-green-500"
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: "Lightning Fast",
      description: "Optimized performance with instant feedback and quick processing",
      color: "bg-yellow-500"
    }
  ];

  const steps = [
    {
      icon: <Camera className="w-8 h-8" />,
      title: "Launch Camera",
      description: "Click 'Start Camera' to begin the face registration process",
      step: "1"
    },
    {
      icon: <Eye className="w-8 h-8" />,
      title: "Face Detection",
      description: "AI detects and analyzes your face positioning in real-time",
      step: "2"
    },
    {
      icon: <PlayCircle className="w-8 h-8" />,
      title: "Countdown & Capture",
      description: "3-second countdown before automatically capturing your photo",
      step: "3"
    },
    {
      icon: <CheckCircle2 className="w-8 h-8" />,
      title: "Review & Confirm",
      description: "Preview your photo and confirm or retake if needed",
      step: "4"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-slate-900 dark:via-blue-900 dark:to-purple-900">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div className="inline-flex items-center px-4 py-2 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-6">
            <Sparkles className="w-4 h-4 mr-2 text-blue-600" />
            <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
              Modern Face Registration System
            </span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
            Face Registration
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              Reimagined
            </span>
          </h1>
          
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-12">
            Experience the future of biometric authentication with our cutting-edge face registration system. 
            Powered by advanced AI, featuring smooth animations, and designed for maximum user experience.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Button
              onClick={() => {
                setRegistrationMode('register');
                setIsRegistrationOpen(true);
              }}
              size="lg"
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-4 px-8 rounded-full transition-all duration-300 transform hover:scale-105"
            >
              <Camera className="w-5 h-5 mr-2" />
              Try Face Registration
            </Button>
            
            <Button
              onClick={() => {
                setRegistrationMode('verify');
                setIsVerificationOpen(true);
              }}
              size="lg"
              variant="outline"
              className="border-2 border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 py-4 px-8 rounded-full transition-all duration-300"
            >
              <Shield className="w-5 h-5 mr-2" />
              Try Face Verification
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">99.9%</div>
              <div className="text-gray-600 dark:text-gray-300">Accuracy Rate</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-2">&lt;2s</div>
              <div className="text-gray-600 dark:text-gray-300">Processing Time</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">10K+</div>
              <div className="text-gray-600 dark:text-gray-300">Registrations</div>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {features.map((feature, index) => (
            <Card key={index} className="border-0 shadow-lg bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
              <CardContent className="p-6 text-center">
                <div className={`w-12 h-12 ${feature.color} rounded-full flex items-center justify-center text-white mx-auto mb-4`}>
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* How It Works */}
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              How It Works
            </h2>
            <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Our streamlined 4-step process makes face registration quick, easy, and secure
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, index) => (
              <div key={index} className="relative">
                <Card className="border-0 shadow-lg bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
                  <CardContent className="p-6 text-center">
                    <div className="relative mb-4">
                      <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white mx-auto">
                        {step.icon}
                      </div>
                      <Badge className="absolute -top-2 -right-2 bg-yellow-500 text-white font-bold">
                        {step.step}
                      </Badge>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      {step.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 text-sm">
                      {step.description}
                    </p>
                  </CardContent>
                </Card>
                
                {/* Connection line (except for last item) */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-3 w-6 h-0.5 bg-gradient-to-r from-blue-500 to-purple-600 transform -translate-y-1/2 z-10"></div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Tech Stack */}
        <div className="mt-16 text-center">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">
            Powered by Advanced Technology
          </h3>
          
          <div className="flex flex-wrap justify-center gap-4">
            {[
              'MediaPipe Face Detection',
              'TensorFlow.js',
              'React 18',
              'TypeScript',
              'Tailwind CSS',
              'Radix UI',
              'WebRTC'
            ].map((tech, index) => (
              <Badge key={index} variant="secondary" className="px-4 py-2 text-sm">
                {tech}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Modern Face Registration Dialogs */}
      <ModernFaceRegistrationDialog
        isOpen={isRegistrationOpen}
        mode="register"
        onSuccess={() => {
          handleSuccess();
          setIsRegistrationOpen(false);
        }}
        onCancel={() => setIsRegistrationOpen(false)}
        onClose={() => setIsRegistrationOpen(false)}
      />

      <ModernFaceRegistrationDialog
        isOpen={isVerificationOpen}
        mode="verify"
        onSuccess={() => {
          handleSuccess();
          setIsVerificationOpen(false);
        }}
        onCancel={() => setIsVerificationOpen(false)}
        onClose={() => setIsVerificationOpen(false)}
      />
    </div>
  );
};

export default ModernFaceRegistrationDemo;
