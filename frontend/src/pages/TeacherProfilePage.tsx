import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/useAuth';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/integrations/api/client';
import TeacherSidebar from '@/components/TeacherSidebar';
import {
  User,
  Mail,
  IdCard,
  Phone,
  MapPin,
  BookOpen,
  Award,
  CheckCircle,
  XCircle,
  Settings
} from 'lucide-react';

const TeacherProfilePage: React.FC = () => {
  const { user } = useAuth();
  
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['teacher-dashboard'],
    queryFn: async () => {
      return await api.teacher.getDashboard();
    },
  });

  const teacher = dashboardData?.teacher;

  if (isLoading) {
    return (
      <TeacherSidebar>
        <div className="p-6 max-w-7xl mx-auto">
          <div className="animate-pulse space-y-8">
            <div className="text-center space-y-4">
              <div className="h-8 bg-slate-700 rounded-lg w-64 mx-auto"></div>
              <div className="h-4 bg-slate-700 rounded-lg w-96 mx-auto"></div>
            </div>
            <div className="bg-slate-700 rounded-3xl h-64 w-full"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-slate-700 rounded-2xl h-32"></div>
              ))}
            </div>
          </div>
        </div>
      </TeacherSidebar>
    );
  }

  if (!teacher) {
    return (
      <TeacherSidebar>
        <div className="p-6 max-w-7xl mx-auto">
          <div className="text-center py-16">
            <div className="bg-slate-900/70 rounded-3xl shadow-2xl p-12 max-w-lg mx-auto border border-slate-700">
              <div className="w-20 h-20 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <XCircle className="h-10 w-10 text-red-500" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">Profile Not Found</h2>
              <p className="text-slate-400 mb-6">We couldn't find your profile data. Please contact support if this persists.</p>
              <Button className="bg-red-500 hover:bg-red-600 text-white">
                <Settings className="h-4 w-4 mr-2" />
                Contact Support
              </Button>
            </div>
          </div>
        </div>
      </TeacherSidebar>
    );
  }

  const profileInfo = [
    {
      icon: User,
      label: 'Full Name',
      value: teacher.name || user?.name || 'Not provided',
      color: 'text-blue-400'
    },
    {
      icon: Mail,
      label: 'Email Address',
      value: teacher.email || user?.email || 'Not provided',
      color: 'text-green-400'
    },
    {
      icon: IdCard,
      label: 'Teacher ID',
      value: teacher.teacher_id || 'Not assigned',
      color: 'text-purple-400'
    },
    {
      icon: Phone,
      label: 'Phone Number',
      value: teacher.phone || 'Not provided',
      color: 'text-orange-400'
    },
    {
      icon: MapPin,
      label: 'Faculty',
      value: teacher.faculty_name || 'Not assigned',
      color: 'text-pink-400'
    },
    {
      icon: BookOpen,
      label: 'Subjects Teaching',
      value: dashboardData?.total_subjects?.toString() || '0',
      color: 'text-cyan-400'
    }
  ];

  return (
    <TeacherSidebar>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Teacher Profile</h1>
          <p className="text-slate-400">View and manage your profile information</p>
        </div>

        {/* Profile Card */}
        <Card className="mb-8 bg-gradient-to-br from-slate-900/90 to-slate-800/90 border-slate-700/80 backdrop-blur-sm">
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
              {/* Avatar */}
              <Avatar className="h-32 w-32 border-4 border-blue-500/30 shadow-2xl">
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-cyan-500 text-white text-3xl font-bold">
                  {teacher.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'T'}
                </AvatarFallback>
              </Avatar>

              {/* Info */}
              <div className="flex-1 text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-3 mb-3">
                  <h2 className="text-3xl font-bold text-white">
                    {teacher.name || user?.name || 'Teacher'}
                  </h2>
                  <Badge className="bg-green-500/20 text-green-300 border-green-400/30">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Active
                  </Badge>
                </div>
                <p className="text-slate-400 text-lg mb-4">{teacher.email || user?.email}</p>
                
                <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-300 border-blue-400/30">
                    <Award className="h-3 w-3 mr-1" />
                    Teacher
                  </Badge>
                  <Badge variant="outline" className="bg-purple-500/10 text-purple-300 border-purple-400/30">
                    <MapPin className="h-3 w-3 mr-1" />
                    {teacher.faculty_name || 'Faculty'}
                  </Badge>
                  <Badge variant="outline" className="bg-cyan-500/10 text-cyan-300 border-cyan-400/30">
                    <IdCard className="h-3 w-3 mr-1" />
                    {teacher.teacher_id || 'ID'}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>



        {/* Profile Information Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {profileInfo.map((info, index) => (
            <Card key={index} className="bg-slate-900/70 border-slate-700/80 backdrop-blur-sm hover:border-slate-600/80 transition-all">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
                  <info.icon className={`h-4 w-4 ${info.color}`} />
                  {info.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold text-white break-words">{info.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Additional Info Note */}
        <Card className="mt-8 bg-blue-500/10 border-blue-400/30 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <Settings className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Need to update your information?</h3>
                <p className="text-slate-400">
                  To update your profile information, please contact the system administrator or your faculty office.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </TeacherSidebar>
  );
};

export default TeacherProfilePage;
