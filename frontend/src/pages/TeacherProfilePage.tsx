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
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-text-primary mb-1">Teacher Profile</h1>
          <p className="text-xs sm:text-sm text-text-muted">View and manage your academic account profile</p>
        </div>

        {/* Profile Card */}
        <Card className="bg-surface-default border-border-subtle shadow-card">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
              {/* Avatar */}
              <Avatar className="h-24 w-24 border-2 border-action-primary/30 shadow-md">
                <AvatarFallback className="bg-action-primary text-white text-2xl font-bold">
                  {teacher.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'T'}
                </AvatarFallback>
              </Avatar>

              {/* Info */}
              <div className="flex-1 text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                  <h2 className="text-2xl font-bold text-text-primary">
                    {teacher.name || user?.name || 'Teacher'}
                  </h2>
                  <Badge variant="success" className="text-xs">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Active
                  </Badge>
                </div>
                <p className="text-text-muted text-sm mb-4">{teacher.email || user?.email}</p>
                
                <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                  <Badge variant="secondary" className="text-xs">
                    <Award className="h-3 w-3 mr-1 text-action-primary" />
                    Teacher
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    <MapPin className="h-3 w-3 mr-1 text-action-primary" />
                    {teacher.faculty_name || 'Faculty'}
                  </Badge>
                  <Badge variant="secondary" className="text-xs font-mono">
                    <IdCard className="h-3 w-3 mr-1 text-action-primary" />
                    {teacher.teacher_id || 'ID'}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profile Information Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {profileInfo.map((info, index) => (
            <Card key={index} className="bg-surface-default border-border-subtle shadow-card hover:border-border-default transition-colors">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-text-muted uppercase tracking-wider flex items-center gap-2">
                  <info.icon className="h-3.5 w-3.5 text-action-primary" />
                  {info.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-base font-semibold text-text-primary break-words">{info.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Additional Info Note */}
        <Card className="bg-surface-canvas border-border-subtle shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start gap-3.5">
              <div className="h-9 w-9 rounded-lg bg-action-primary-subtle flex items-center justify-center shrink-0">
                <Settings className="h-4 w-4 text-action-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-0.5">Need to update your profile?</h3>
                <p className="text-xs text-text-muted leading-relaxed">
                  To update your official details or course allocations, please contact the institutional administration or your department dean.
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
