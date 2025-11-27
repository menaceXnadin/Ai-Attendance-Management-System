import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/useAuth';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/integrations/api/client';
import {
  User,
  Mail,
  IdCard,
  GraduationCap,
  Calendar,
  Phone,
  Shield,
  Camera,
  MapPin,
  Users,
  BookOpen,
  CheckCircle,
  XCircle,
  Edit3,
  Settings,
  Award,
  Clock,
  Star
} from 'lucide-react';

const StudentProfile: React.FC = () => {
  const { user } = useAuth();
  const { data: studentData, isLoading } = useQuery({
    queryKey: ['current-student-profile', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const students = await api.students.getAll();
      return students.find(s => s.email?.toLowerCase() === user.email?.toLowerCase()) || null;
    },
    enabled: !!user?.email,
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="animate-pulse space-y-8">
          {/* Header skeleton */}
          <div className="text-center space-y-4">
            <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded-lg w-64 mx-auto"></div>
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-lg w-96 mx-auto"></div>
          </div>
          
          {/* Profile card skeleton */}
          <div className="bg-slate-200 dark:bg-slate-700 rounded-3xl h-64 w-full"></div>
          
          {/* Info cards skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-slate-200 dark:bg-slate-700 rounded-2xl h-32"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!studentData) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="text-center py-16">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-12 max-w-lg mx-auto border border-slate-200 dark:border-slate-700">
            <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <XCircle className="h-10 w-10 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">Profile Not Found</h2>
            <p className="text-slate-600 dark:text-slate-300 mb-6">We couldn't find your profile data. Please contact support if this persists.</p>
            <Button className="bg-red-500 hover:bg-red-600 text-white">
              <Settings className="h-4 w-4 mr-2" />
              Contact Support
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const profileInfo = [
    {
      icon: User,
      label: 'Full Name',
      value: studentData.name || user?.name || 'Not provided',
      color: 'text-blue-600'
    },
    {
      icon: Mail,
      label: 'Email Address',
      value: studentData.email || user?.email || 'Not provided',
      color: 'text-green-600'
    },
    {
      icon: IdCard,
      label: 'Student ID',
      value: studentData.student_id || studentData.studentId || 'Not assigned',
      color: 'text-purple-600'
    },
    {
      icon: GraduationCap,
      label: 'Faculty',
      value: studentData.faculty || 'Not assigned',
      color: 'text-indigo-600'
    },
    {
      icon: Calendar,
      label: 'Academic Year',
      value: studentData.year ? `Year ${studentData.year}` : 'Not specified',
      color: 'text-orange-600'
    },
    {
      icon: BookOpen,
      label: 'Semester',
      value: studentData.semester ? `Semester ${studentData.semester}` : 'Not specified',
      color: 'text-teal-600'
    },
    {
      icon: Users,
      label: 'Batch',
      value: studentData.batch ? `Batch ${studentData.batch}` : 'Not specified',
      color: 'text-pink-600'
    },
    {
      icon: Phone,
      label: 'Phone Number',
      value: studentData.phone_number || 'Not provided',
      color: 'text-cyan-600'
    },
    {
      icon: Shield,
      label: 'Emergency Contact',
      value: studentData.emergency_contact || 'Not provided',
      color: 'text-red-600'
    }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Modern Header */}
      <div className="text-center space-y-2 sm:space-y-3">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
          Student Profile
        </h1>
        <p className="text-sm sm:text-base md:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto px-4">
          Manage your personal information and academic details
        </p>
      </div>

      {/* Hero Profile Card */}
      <Card className="overflow-hidden border-0 shadow-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
        <CardContent className="p-0">
          <div className="relative">
            {/* Background Pattern */}
            <div className="absolute inset-0 bg-black/10"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-black/20 to-transparent"></div>
            
            {/* Content */}
            <div className="relative px-4 sm:px-6 md:px-8 py-8 sm:py-10 md:py-12 text-white">
              <div className="flex flex-col lg:flex-row items-center gap-4 sm:gap-6 md:gap-8">
                {/* Avatar Section */}
                <div className="relative">
                  <div className="relative">
                    <Avatar className="h-24 w-24 sm:h-28 sm:w-28 md:h-32 md:w-32 border-4 border-white/20 shadow-2xl ring-4 ring-white/10">
                      <AvatarImage 
                        src={studentData.profileImage} 
                        alt={studentData.name || 'Profile'} 
                        className="object-cover"
                      />
                      <AvatarFallback className="bg-white/10 backdrop-blur-sm text-white text-4xl font-bold border border-white/20">
                        {(studentData.name || user?.name || 'U').charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    
                    {/* Face Registration Badge */}
                    <div className={`absolute -bottom-2 -right-2 rounded-full p-3 border-4 border-white shadow-lg ${
                      studentData.face_encoding 
                        ? 'bg-emerald-500' 
                        : 'bg-amber-500'
                    }`}>
                      <Camera className="h-5 w-5 text-white" />
                    </div>
                  </div>
                  
                  {/* Status Indicator */}
                  <div className="absolute -top-2 -right-2">
                    <div className="w-6 h-6 bg-emerald-500 rounded-full border-4 border-white shadow-lg animate-pulse"></div>
                  </div>
                </div>

                {/* Profile Info */}
                <div className="flex-1 text-center lg:text-left space-y-3 sm:space-y-4">
                  <div>
                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2">
                      {studentData.name || user?.name || 'Student'}
                    </h2>
                    <div className="flex items-center gap-2 text-base sm:text-lg md:text-xl text-white/90 mb-3 sm:mb-4 justify-center lg:justify-start">
                      <IdCard className="h-4 w-4 sm:h-5 sm:w-5" />
                      {studentData.student_id || studentData.studentId || 'ID not assigned'}
                    </div>
                  </div>
                  
                  {/* Badges */}
                  <div className="flex flex-wrap gap-2 sm:gap-3 justify-center lg:justify-start">
                    <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/30 px-2 sm:px-3 md:px-4 py-1 sm:py-1.5 md:py-2 text-xs sm:text-sm">
                      <GraduationCap className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                      {studentData.faculty || 'Faculty not assigned'}
                    </Badge>
                    {studentData.year && (
                      <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/30 px-4 py-2 text-sm">
                        <Calendar className="h-4 w-4 mr-2" />
                        Year {studentData.year}
                      </Badge>
                    )}
                    {studentData.semester && (
                      <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/30 px-4 py-2 text-sm">
                        <BookOpen className="h-4 w-4 mr-2" />
                        Semester {studentData.semester}
                      </Badge>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 sm:gap-3 justify-center lg:justify-start pt-3 sm:pt-4">
                    <Button className="bg-white/20 text-white border border-white/30 hover:bg-white/30 backdrop-blur-sm text-xs sm:text-sm px-3 sm:px-4">
                      <Edit3 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                      Edit Profile
                    </Button>
                    <Button className="bg-white text-indigo-600 hover:bg-white/90">
                      <Settings className="h-4 w-4 mr-2" />
                      Settings
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
        <Card className="border-0 shadow-xl bg-white dark:bg-slate-900 overflow-hidden">
          <CardContent className="p-4 sm:p-5 md:p-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center shrink-0">
                <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">Status</p>
                <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-xl bg-white dark:bg-slate-900 overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center">
                <Award className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Performance</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">Excellent</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-xl bg-white dark:bg-slate-900 overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/20 rounded-xl flex items-center justify-center">
                <Star className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Recognition</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {studentData.face_encoding ? 'Enabled' : 'Pending'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Information Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 md:gap-8">
        {/* Personal Information */}
        <Card className="border-0 shadow-xl bg-white dark:bg-slate-900">
          <CardHeader className="pb-3 sm:pb-4">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <User className="h-5 w-5 text-indigo-600" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-6">
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">Full Name</p>
                  <p className="text-sm sm:text-base md:text-lg font-semibold text-slate-900 dark:text-white truncate">
                    {studentData.name || user?.name || 'Not provided'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg flex items-center justify-center shrink-0">
                  <Mail className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">Email Address</p>
                  <p className="text-sm sm:text-base md:text-lg font-semibold text-slate-900 dark:text-white break-all">
                    {studentData.email || user?.email || 'Not provided'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <div className="w-10 h-10 bg-orange-50 dark:bg-orange-900/20 rounded-lg flex items-center justify-center">
                  <Phone className="h-5 w-5 text-orange-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Phone Number</p>
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">
                    {studentData.phone_number || 'Not provided'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <div className="w-10 h-10 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
                  <Shield className="h-5 w-5 text-red-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Emergency Contact</p>
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">
                    {studentData.emergency_contact || 'Not provided'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Academic Information */}
        <Card className="border-0 shadow-xl bg-white dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <GraduationCap className="h-5 w-5 text-purple-600" />
              Academic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <div className="w-10 h-10 bg-purple-50 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                  <IdCard className="h-5 w-5 text-purple-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Student ID</p>
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">
                    {studentData.student_id || studentData.studentId || 'Not assigned'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg flex items-center justify-center">
                  <GraduationCap className="h-5 w-5 text-indigo-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Faculty</p>
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">
                    {studentData.faculty || 'Not assigned'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <div className="w-10 h-10 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-cyan-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Academic Year</p>
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">
                    {studentData.year ? `Year ${studentData.year}` : 'Not specified'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <div className="w-10 h-10 bg-teal-50 dark:bg-teal-900/20 rounded-lg flex items-center justify-center">
                  <BookOpen className="h-5 w-5 text-teal-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Semester</p>
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">
                    {studentData.semester ? `Semester ${studentData.semester}` : 'Not specified'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <div className="w-10 h-10 bg-pink-50 dark:bg-pink-900/20 rounded-lg flex items-center justify-center">
                  <Users className="h-5 w-5 text-pink-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Batch</p>
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">
                    {studentData.batch ? `Batch ${studentData.batch}` : 'Not specified'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Face Recognition Status */}
      <Card className="border-0 shadow-xl bg-white dark:bg-slate-900 overflow-hidden">
        <CardHeader className="pb-3 sm:pb-4">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Camera className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
            Face Recognition System
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`relative p-4 sm:p-5 md:p-6 rounded-2xl border-2 ${
            studentData.face_encoding 
              ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
              : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
          }`}>
            <div className="flex items-center gap-3 sm:gap-4 md:gap-6">
              <div className={`w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center shrink-0 ${
                studentData.face_encoding 
                  ? 'bg-emerald-100 dark:bg-emerald-800'
                  : 'bg-amber-100 dark:bg-amber-800'
              }`}>
                {studentData.face_encoding ? (
                  <CheckCircle className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-emerald-600" />
                ) : (
                  <Clock className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-amber-600" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className={`text-base sm:text-lg md:text-xl font-bold mb-1 sm:mb-2 ${
                  studentData.face_encoding 
                    ? 'text-emerald-800 dark:text-emerald-300'
                    : 'text-amber-800 dark:text-amber-300'
                }`}>
                  {studentData.face_encoding ? 'Face Recognition Active' : 'Face Recognition Pending'}
                </h3>
                <p className={`text-xs sm:text-sm ${
                  studentData.face_encoding 
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-amber-600 dark:text-amber-400'
                }`}>
                  {studentData.face_encoding 
                    ? 'You can use face recognition for quick and secure attendance marking'
                    : 'Complete your face registration to enable automatic attendance tracking'
                  }
                </p>
              </div>

              {!studentData.face_encoding && (
                <Button className="bg-amber-500 hover:bg-amber-600 text-white text-xs sm:text-sm px-3 sm:px-4 shrink-0">
                  <Camera className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  Register Face
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentProfile;
