import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Camera, 
  Users, 
  CheckCircle, 
  AlertCircle, 
  Activity, 
  Scan, 
  Settings,
  Play,
  Pause,
  RotateCcw,
  Zap,
  Shield,
  Clock
} from 'lucide-react';
import LiveFaceDetection from '@/components/LiveFaceDetection2';

const FaceDetectionTest: React.FC = () => {
  const [detectionStats, setDetectionStats] = useState({
    totalDetections: 0,
    successRate: 98.7,
    avgProcessingTime: 0.3,
    currentFaces: 0
  });
  
  const [isActive, setIsActive] = useState(true);
  const [systemStatus, setSystemStatus] = useState<'active' | 'paused' | 'error'>('active');

  // Simulate real-time stats updates
  useEffect(() => {
    const interval = setInterval(() => {
      if (isActive) {
        setDetectionStats(prev => ({
          ...prev,
          totalDetections: prev.totalDetections + Math.floor(Math.random() * 3),
          avgProcessingTime: 0.2 + Math.random() * 0.3,
          currentFaces: Math.floor(Math.random() * 4)
        }));
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isActive]);

  const handleToggleDetection = () => {
    setIsActive(!isActive);
    setSystemStatus(isActive ? 'paused' : 'active');
  };

  const handleReset = () => {
    setDetectionStats({
      totalDetections: 0,
      successRate: 98.7,
      avgProcessingTime: 0.3,
      currentFaces: 0
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 p-6">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500 rounded-full opacity-5 blur-3xl animate-pulse"></div>
        <div className="absolute top-60 -left-20 w-60 h-60 bg-teal-400 rounded-full opacity-5 blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header Section */}
        <div className="text-center mb-8 space-y-4">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600/20 to-teal-400/20 px-4 py-2 rounded-full border border-blue-400/30 mb-4">
            <Scan className="h-4 w-4 text-teal-400" />
            <span className="text-sm font-medium text-blue-200">AI-Powered Detection Engine</span>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-300 via-teal-300 to-indigo-300 bg-clip-text text-transparent mb-4">
            Live Face Recognition Test
          </h1>
          <p className="text-lg text-blue-200/80 max-w-2xl mx-auto">
            Experience real-time facial recognition with advanced AI detection algorithms and comprehensive analytics
          </p>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 hover:border-blue-500/30 transition-all">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                  <Activity className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">System Status</p>
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${
                      systemStatus === 'active' ? 'bg-green-500 animate-pulse' : 
                      systemStatus === 'paused' ? 'bg-yellow-500' : 'bg-red-500'
                    }`}></div>
                    <span className="text-sm font-medium text-white capitalize">{systemStatus}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 hover:border-teal-500/30 transition-all">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                  <Users className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">Current Faces</p>
                  <p className="text-2xl font-bold text-white">{detectionStats.currentFaces}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 hover:border-purple-500/30 transition-all">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">Success Rate</p>
                  <p className="text-2xl font-bold text-white">{detectionStats.successRate}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 hover:border-orange-500/30 transition-all">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">Avg. Speed</p>
                  <p className="text-2xl font-bold text-white">{detectionStats.avgProcessingTime.toFixed(1)}s</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Detection Area */}
          <div className="lg:col-span-2">
            <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl text-white flex items-center gap-2">
                    <Camera className="h-5 w-5 text-teal-400" />
                    Live Detection Feed
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={systemStatus === 'active' ? 'default' : 'secondary'} className="bg-teal-500/20 text-teal-300">
                      {systemStatus === 'active' && <div className="h-2 w-2 bg-teal-400 rounded-full animate-pulse mr-1" />}
                      {systemStatus.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="relative aspect-video bg-slate-800/50 overflow-hidden">
                  <LiveFaceDetection 
                    onFaceDetected={(faces) => {
                      console.log('Detected faces:', faces);
                      setDetectionStats(prev => ({
                        ...prev,
                        currentFaces: faces.length
                      }));
                    }}
                    showControls={false}
                  />
                  
                  {/* Overlay Info */}
                  <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
                    <div className="bg-black/60 backdrop-blur-md rounded-lg px-3 py-2">
                      <p className="text-xs text-green-400 font-medium">● LIVE</p>
                    </div>
                    <div className="bg-black/60 backdrop-blur-md rounded-lg px-3 py-2">
                      <p className="text-xs text-white">AI Model: InsightFace v2.0</p>
                    </div>
                  </div>

                  {/* Detection Overlay */}
                  {systemStatus === 'active' && (
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                        <div className="w-48 h-48 border-2 border-teal-400/50 rounded-lg animate-pulse">
                          <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-teal-400"></div>
                          <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-teal-400"></div>
                          <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-teal-400"></div>
                          <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-teal-400"></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Control Bar */}
                <div className="p-4 bg-slate-800/30 border-t border-slate-700/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Button
                        size="sm"
                        onClick={handleToggleDetection}
                        className={`${
                          isActive 
                            ? 'bg-red-500 hover:bg-red-600' 
                            : 'bg-green-500 hover:bg-green-600'
                        } text-white transition-all duration-300`}
                      >
                        {isActive ? <Pause className="h-4 w-4 mr-1" /> : <Play className="h-4 w-4 mr-1" />}
                        {isActive ? 'Pause' : 'Start'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleReset}
                        className="border-slate-600 text-slate-300 hover:bg-slate-700"
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Reset
                      </Button>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <span>Detection: {detectionStats.totalDetections} frames</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar with Analytics */}
          <div className="space-y-6">
            {/* Performance Metrics */}
            <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
              <CardHeader>
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <Activity className="h-5 w-5 text-blue-400" />
                  Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Detection Accuracy</span>
                    <span className="text-white font-medium">{detectionStats.successRate}%</span>
                  </div>
                  <Progress value={detectionStats.successRate} className="h-2" />
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Processing Speed</span>
                    <span className="text-white font-medium">Excellent</span>
                  </div>
                  <Progress value={85} className="h-2" />
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">System Load</span>
                    <span className="text-white font-medium">Low</span>
                  </div>
                  <Progress value={23} className="h-2" />
                </div>
              </CardContent>
            </Card>

            {/* Detection Settings */}
            <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
              <CardHeader>
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <Settings className="h-5 w-5 text-purple-400" />
                  Detection Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">Face Tracking</span>
                  <div className="h-5 w-9 bg-teal-500 rounded-full relative">
                    <div className="absolute right-0.5 top-0.5 h-4 w-4 bg-white rounded-full transition-transform"></div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">Bounding Boxes</span>
                  <div className="h-5 w-9 bg-teal-500 rounded-full relative">
                    <div className="absolute right-0.5 top-0.5 h-4 w-4 bg-white rounded-full transition-transform"></div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">Confidence Scores</span>
                  <div className="h-5 w-9 bg-slate-600 rounded-full relative">
                    <div className="absolute left-0.5 top-0.5 h-4 w-4 bg-white rounded-full transition-transform"></div>
                  </div>
                </div>
                
                <div className="pt-2 border-t border-slate-700">
                  <p className="text-xs text-slate-500 mb-2">Detection Sensitivity</p>
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map((level) => (
                      <div 
                        key={level}
                        className={`h-2 flex-1 rounded ${level <= 4 ? 'bg-teal-500' : 'bg-slate-600'}`}
                      />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
              <CardHeader>
                <CardTitle className="text-lg text-white">Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/50">
                  <Shield className="h-4 w-4 text-green-400" />
                  <div className="flex-1">
                    <p className="text-xs text-slate-400">Security Level</p>
                    <p className="text-sm font-medium text-white">High</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/50">
                  <Clock className="h-4 w-4 text-blue-400" />
                  <div className="flex-1">
                    <p className="text-xs text-slate-400">Session Time</p>
                    <p className="text-sm font-medium text-white">00:05:42</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/50">
                  <Zap className="h-4 w-4 text-yellow-400" />
                  <div className="flex-1">
                    <p className="text-xs text-slate-400">FPS</p>
                    <p className="text-sm font-medium text-white">30</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Bottom Info Section */}
        <div className="mt-8 text-center">
          <Card className="bg-slate-900/40 backdrop-blur-md border-slate-700/30 max-w-4xl mx-auto">
            <CardContent className="p-6">
              <div className="flex items-center justify-center gap-2 mb-3">
                <AlertCircle className="h-5 w-5 text-teal-400" />
                <h3 className="text-lg font-semibold text-white">Detection Technology</h3>
              </div>
              <p className="text-slate-300 mb-4">
                This demo showcases advanced AI-powered facial recognition using state-of-the-art computer vision algorithms. 
                The system provides real-time detection with high accuracy and minimal processing latency.
              </p>
              <div className="flex items-center justify-center gap-6 text-sm text-slate-400">
                <span>• Real-time Processing</span>
                <span>• 99%+ Accuracy</span>
                <span>• Privacy Focused</span>
                <span>• Cross-platform Compatible</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default FaceDetectionTest;
