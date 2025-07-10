
import React from 'react';
import { Calendar, User, Users, BookOpen } from 'lucide-react';
import HeaderStats from '@/components/HeaderStats';
import AttendanceChart from '@/components/AttendanceChart';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import FaceRecognition from '@/components/FaceRecognition';
import { useToast } from '@/hooks/use-toast';

// Mock data for dashboard
const stats = [
  {
    title: 'Total Students',
    stat: '156',
    description: '+12 this month',
    icon: <Users size={20} />,
  },
  {
    title: 'Classes',
    stat: '8',
    description: 'Active classes',
    icon: <BookOpen size={20} />,
  },
  {
    title: 'Present Today',
    stat: '124',
    description: '79% attendance rate',
    icon: <User size={20} />,
  },
  {
    title: 'Upcoming Classes',
    stat: '3',
    description: 'Next: Math 101',
    icon: <Calendar size={20} />,
  },
];

const weeklyData = [
  { name: 'Monday', present: 120, absent: 36, late: 15 },
  { name: 'Tuesday', present: 132, absent: 24, late: 12 },
  { name: 'Wednesday', present: 125, absent: 31, late: 18 },
  { name: 'Thursday', present: 118, absent: 38, late: 14 },
  { name: 'Friday', present: 110, absent: 46, late: 10 },
];

const classData = [
  { name: 'Math 101', present: 25, absent: 5, late: 2 },
  { name: 'Physics 201', present: 18, absent: 7, late: 3 },
  { name: 'Chemistry 101', present: 22, absent: 3, late: 1 },
  { name: 'English 301', present: 20, absent: 8, late: 0 },
  { name: 'Computer Science', present: 19, absent: 6, late: 3 },
];

const recentStudents = [
  { id: '1', name: 'Emma Thompson', time: '08:15 AM', status: 'Present', imageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&auto=format&fit=crop' },
  { id: '2', name: 'James Wilson', time: '08:22 AM', status: 'Present', imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&auto=format&fit=crop' },
  { id: '3', name: 'Sophia Chen', time: '08:30 AM', status: 'Late', imageUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&auto=format&fit=crop' },
  { id: '4', name: 'Daniel Kim', time: '08:35 AM', status: 'Present', imageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&auto=format&fit=crop' },
];

const Dashboard = () => {
  const { toast } = useToast();

  const handleCapture = (dataUrl: string, recognized: boolean) => {
    console.log('Image captured:', { dataUrl, recognized });
    // In a real app, you would send this to the server for processing
  };

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <HeaderStats stats={stats} />
      
      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Face Recognition */}
        <div className="lg:col-span-1 space-y-6">
          <FaceRecognition onCapture={handleCapture} />
          
          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentStudents.map((student) => (
                  <div key={student.id} className="flex items-center p-2 hover:bg-gray-50 rounded-md">
                    <img 
                      src={student.imageUrl} 
                      alt={student.name} 
                      className="h-10 w-10 rounded-full mr-3"
                    />
                    <div className="flex-1">
                      <p className="font-medium">{student.name}</p>
                      <p className="text-sm text-gray-500">{student.time}</p>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-medium ${
                      student.status === 'Present' 
                        ? 'bg-green-100 text-green-800' 
                        : student.status === 'Late'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {student.status}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-center">
                <Link to="/app/attendance">
                  <Button variant="outline" size="sm">View All</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Charts */}
        <div className="lg:col-span-2 space-y-6">
          <AttendanceChart 
            data={weeklyData}
            title="Weekly Attendance"
            description="Student attendance trends for the current week"
            type="bar"
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AttendanceChart 
              data={classData}
              title="Attendance by Class"
              description="Breakdown by individual classes"
              type="pie"
            />
            
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Link to="/app/students">
                  <Button className="w-full justify-start bg-brand-500 hover:bg-brand-600">
                    <User className="mr-2 h-4 w-4" />
                    Add New Student
                  </Button>
                </Link>
                <Link to="/app/attendance">
                  <Button variant="outline" className="w-full justify-start">
                    <Calendar className="mr-2 h-4 w-4" />
                    View Attendance Reports
                  </Button>
                </Link>
                <Link to="/app/classes">
                  <Button variant="outline" className="w-full justify-start">
                    <BookOpen className="mr-2 h-4 w-4" />
                    Manage Classes
                  </Button>
                </Link>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => {
                    toast({
                      title: "Generating Report",
                      description: "Your attendance report is being generated and will be emailed to you shortly.",
                    });
                  }}
                >
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    className="mr-2 h-4 w-4"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <line x1="10" y1="9" x2="8" y2="9"></line>
                  </svg>
                  Download Report
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
