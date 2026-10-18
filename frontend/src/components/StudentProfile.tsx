import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/useAuth';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/integrations/api/client';
import {
  Person20Regular,
  Mail20Regular,
  ContactCard20Regular,
  HatGraduation20Regular,
  CalendarLtr20Regular,
  Call20Regular,
  Shield20Regular,
  Camera20Regular,
  PeopleTeam20Regular,
  Book20Regular,
  CheckmarkCircle20Regular,
  DismissCircle20Regular,
  Edit20Regular,
  Settings20Regular,
  Trophy20Regular,
  Clock20Regular,
  Star20Regular,
} from '@fluentui/react-icons';

type InfoRowProps = {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  breakAll?: boolean;
};

const InfoRow = ({ icon, label, value, breakAll }: InfoRowProps) => (
  <div className="grid grid-cols-1 gap-1 px-5 py-3 sm:grid-cols-[200px_1fr] sm:items-center sm:gap-4">
    <dt className="flex items-center gap-2 text-body text-text-muted">
      <span className="shrink-0 text-text-muted">{icon}</span>
      {label}
    </dt>
    <dd className={`text-body text-text-primary ${breakAll ? 'break-all' : 'truncate'}`}>{value}</dd>
  </div>
);

type QuickStatProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: 'success' | 'brand' | 'warning';
};

const toneClass: Record<QuickStatProps['tone'], string> = {
  success: 'bg-status-success-subtle text-status-success',
  brand: 'bg-brand-subtle text-brand-foreground',
  warning: 'bg-status-warning-subtle text-status-warning',
};

const QuickStat = ({ icon, label, value, tone }: QuickStatProps) => (
  <Card className="border-0 bg-surface-default shadow">
    <CardContent className="flex items-center gap-4 p-5">
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-md ${toneClass[tone]}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-caption text-text-muted">{label}</p>
        <p className="text-section-title text-text-primary">{value}</p>
      </div>
    </CardContent>
  </Card>
);

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
      <div className="mx-auto max-w-6xl space-y-4">
        {/* Header skeleton */}
        <div className="flex items-center gap-5 rounded-lg bg-surface-default p-6 shadow">
          <Skeleton className="h-20 w-20 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-80" />
          </div>
        </div>
        {/* Info cards skeleton */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-lg" />
      </div>
    );
  }

  if (!studentData) {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-md rounded-lg bg-surface-default p-10 text-center shadow">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-status-error-subtle text-status-error">
            <DismissCircle20Regular aria-hidden />
          </div>
          <h2 className="mb-1 text-section-title text-text-primary">Profile Not Found</h2>
          <p className="mb-6 text-body text-text-muted">We couldn't find your profile data. Please contact support if this persists.</p>
          <Button variant="outline">
            <Settings20Regular aria-hidden />
            Contact Support
          </Button>
        </div>
      </div>
    );
  }

  const profileInfo = [
    {
      icon: Person20Regular,
      label: 'Full Name',
      value: studentData.name || user?.name || 'Not provided',
    },
    {
      icon: Mail20Regular,
      label: 'Email Address',
      value: studentData.email || user?.email || 'Not provided',
    },
    {
      icon: ContactCard20Regular,
      label: 'Student ID',
      value: studentData.student_id || studentData.studentId || 'Not assigned',
    },
    {
      icon: HatGraduation20Regular,
      label: 'Faculty',
      value: studentData.faculty || 'Not assigned',
    },
    {
      icon: CalendarLtr20Regular,
      label: 'Academic Year',
      value: studentData.year ? `Year ${studentData.year}` : 'Not specified',
    },
    {
      icon: Book20Regular,
      label: 'Semester',
      value: studentData.semester ? `Semester ${studentData.semester}` : 'Not specified',
    },
    {
      icon: PeopleTeam20Regular,
      label: 'Batch',
      value: studentData.batch ? `Batch ${studentData.batch}` : 'Not specified',
    },
    {
      icon: Call20Regular,
      label: 'Phone Number',
      value: studentData.phone_number || 'Not provided',
    },
    {
      icon: Shield20Regular,
      label: 'Emergency Contact',
      value: studentData.emergency_contact || 'Not provided',
    }
  ];

  const personalRows = profileInfo.filter(p =>
    ['Full Name', 'Email Address', 'Phone Number', 'Emergency Contact'].includes(p.label)
  );
  const academicRows = profileInfo.filter(p =>
    ['Student ID', 'Faculty', 'Academic Year', 'Semester', 'Batch'].includes(p.label)
  );

  const displayName = studentData.name || user?.name || 'Student';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p.charAt(0).toUpperCase())
    .join('') || 'U';
  // `face_encoding` is always null in payloads; use the enrolment fields.
  const faceRegistered = !!studentData.face_registered;
  const faceDeleted = !faceRegistered && studentData.face_enrollment_status === 'deleted';

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-page-title text-text-primary">Student Profile</h1>
        <p className="mt-1 text-body text-text-muted">
          Manage your personal information and academic details
        </p>
      </div>

      {/* Profile card */}
      <Card className="border-0 bg-surface-default shadow">
        <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
          <div className="relative w-fit shrink-0">
            <Avatar className="h-20 w-20">
              <AvatarImage
                src={studentData.profileImage ?? undefined}
                alt={studentData.name || 'Profile'}
                className="object-cover"
              />
              <AvatarFallback className="bg-brand-subtle text-[28px] font-semibold text-brand-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            {/* Presence / status indicator */}
            <span
              className="absolute bottom-0.5 right-0.5 h-4 w-4 rounded-full bg-presence-available ring-2 ring-[color:var(--surface-default)]"
              aria-label="Active"
              role="img"
            />
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <div>
              <h2 className="truncate text-page-title text-text-primary">{displayName}</h2>
              <p className="flex flex-wrap items-center gap-x-2 text-body text-text-muted">
                <span className="font-mono">{studentData.student_id || studentData.studentId || 'ID not assigned'}</span>
                <span aria-hidden>·</span>
                <span>{studentData.email || user?.email}</span>
              </p>
            </div>

            {/* Meta pills */}
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary" shape="pill" className="gap-1 font-normal">
                <HatGraduation20Regular className="h-3.5 w-3.5" aria-hidden />
                {studentData.faculty || 'Faculty not assigned'}
              </Badge>
              {studentData.year && (
                <Badge variant="secondary" shape="pill" className="gap-1 font-normal">
                  <CalendarLtr20Regular className="h-3.5 w-3.5" aria-hidden />
                  Year {studentData.year}
                </Badge>
              )}
              {studentData.semester && (
                <Badge variant="secondary" shape="pill" className="gap-1 font-normal">
                  <Book20Regular className="h-3.5 w-3.5" aria-hidden />
                  Semester {studentData.semester}
                </Badge>
              )}
              <Badge variant={faceRegistered ? 'success' : 'warning'} shape="pill" className="gap-1 font-normal">
                <Camera20Regular className="h-3.5 w-3.5" aria-hidden />
                {faceRegistered ? 'Face registered' : faceDeleted ? 'Face check-in locked' : 'Face pending'}
              </Badge>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 sm:self-start">
            <Button variant="outline">
              <Edit20Regular aria-hidden />
              Edit Profile
            </Button>
            <Button variant="ghost">
              <Settings20Regular aria-hidden />
              Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        <QuickStat
          icon={<CheckmarkCircle20Regular aria-hidden />}
          label="Status"
          value="Active"
          tone="success"
        />
        <QuickStat
          icon={<Trophy20Regular aria-hidden />}
          label="Performance"
          value="Excellent"
          tone="brand"
        />
        <QuickStat
          icon={<Star20Regular aria-hidden />}
          label="Recognition"
          value={faceRegistered ? 'Enabled' : 'Pending'}
          tone={faceRegistered ? 'success' : 'warning'}
        />
      </div>

      {/* Sections */}
      <Tabs defaultValue="personal" className="space-y-4">
        <TabsList>
          <TabsTrigger value="personal">Personal Information</TabsTrigger>
          <TabsTrigger value="academic">Academic Information</TabsTrigger>
          <TabsTrigger value="face">Face Recognition</TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="mt-0">
          <Card className="border-0 bg-surface-default shadow">
            <CardHeader className="border-b border-border-subtle px-5 py-4">
              <CardTitle className="flex items-center gap-2 text-subheading text-text-primary">
                <Person20Regular className="text-text-muted" aria-hidden />
                Personal Information
              </CardTitle>
            </CardHeader>
            <dl className="divide-y divide-border-subtle">
              {personalRows.map(({ icon: Icon, label, value }) => (
                <InfoRow
                  key={label}
                  icon={<Icon aria-hidden />}
                  label={label}
                  value={value}
                  breakAll={label === 'Email Address'}
                />
              ))}
            </dl>
          </Card>
        </TabsContent>

        <TabsContent value="academic" className="mt-0">
          <Card className="border-0 bg-surface-default shadow">
            <CardHeader className="border-b border-border-subtle px-5 py-4">
              <CardTitle className="flex items-center gap-2 text-subheading text-text-primary">
                <HatGraduation20Regular className="text-text-muted" aria-hidden />
                Academic Information
              </CardTitle>
            </CardHeader>
            <dl className="divide-y divide-border-subtle">
              {academicRows.map(({ icon: Icon, label, value }) => (
                <InfoRow key={label} icon={<Icon aria-hidden />} label={label} value={value} />
              ))}
            </dl>
          </Card>
        </TabsContent>

        <TabsContent value="face" className="mt-0">
          <Card className="border-0 bg-surface-default shadow">
            <CardHeader className="border-b border-border-subtle px-5 py-4">
              <CardTitle className="flex items-center gap-2 text-subheading text-text-primary">
                <Camera20Regular className="text-text-muted" aria-hidden />
                Face Recognition System
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <div
                className={`flex flex-col gap-4 rounded-md border px-4 py-3 sm:flex-row sm:items-center ${
                  faceRegistered
                    ? 'border-status-success-border bg-status-success-subtle'
                    : 'border-status-warning-border bg-status-warning-subtle'
                }`}
              >
                <div className="flex flex-1 items-start gap-3">
                  <span className={`mt-0.5 shrink-0 ${faceRegistered ? 'text-status-success' : 'text-status-warning'}`}>
                    {faceRegistered ? <CheckmarkCircle20Regular aria-hidden /> : <Clock20Regular aria-hidden />}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-body-strong text-text-primary">
                      {faceRegistered ? 'Face check-in active' : faceDeleted ? 'Face registration locked' : 'Face registration pending'}
                    </h3>
                    <p className="text-body text-text-secondary">
                      {faceRegistered
                        ? 'You can check in to your classes with your face.'
                        : faceDeleted
                          ? 'You deleted your face data. Ask an administrator to reset your face registration to register again.'
                          : 'Register your face to check in to your classes with the camera.'}
                    </p>
                  </div>
                </div>

                {!faceDeleted && (
                  <Button className="shrink-0" variant={faceRegistered ? 'outline' : 'default'} asChild>
                    <Link to="/face-registration">
                      <Camera20Regular aria-hidden />
                      {faceRegistered ? 'Manage' : 'Register face'}
                    </Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StudentProfile;
