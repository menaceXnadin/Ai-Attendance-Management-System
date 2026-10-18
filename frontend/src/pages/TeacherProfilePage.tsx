import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/useAuth';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/integrations/api/client';
import TeacherSidebar from '@/components/TeacherSidebar';
import {
  Book20Regular,
  Building20Regular,
  Call20Regular,
  CheckmarkCircle16Filled,
  ContactCard20Regular,
  DismissCircle24Regular,
  Info20Regular,
  Mail20Regular,
  Person20Regular,
  Ribbon16Regular,
  Building16Regular,
  ContactCard16Regular,
  Settings20Regular,
} from '@fluentui/react-icons';

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
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Skeleton className="h-72 w-full rounded-lg" />
            <Skeleton className="h-72 w-full rounded-lg lg:col-span-2" />
          </div>
        </div>
      </TeacherSidebar>
    );
  }

  if (!teacher) {
    return (
      <TeacherSidebar>
        <div className="mx-auto max-w-7xl py-16">
          <div className="mx-auto max-w-lg rounded-lg bg-surface-default p-10 text-center shadow">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-status-error-subtle text-status-error">
              <DismissCircle24Regular aria-hidden />
            </div>
            <h2 className="text-section-title text-text-primary">Profile Not Found</h2>
            <p className="mt-1 text-body text-text-muted">We couldn't find your profile data. Please contact support if this persists.</p>
            <Button variant="outline" className="mt-6">
              <Settings20Regular aria-hidden />
              Contact Support
            </Button>
          </div>
        </div>
      </TeacherSidebar>
    );
  }

  const profileInfo = [
    {
      icon: Person20Regular,
      label: 'Full Name',
      value: teacher.name || user?.name || 'Not provided',
    },
    {
      icon: Mail20Regular,
      label: 'Email Address',
      value: teacher.email || user?.email || 'Not provided',
    },
    {
      icon: ContactCard20Regular,
      label: 'Teacher ID',
      value: teacher.teacher_id || 'Not assigned',
    },
    {
      icon: Call20Regular,
      label: 'Phone Number',
      value: teacher.phone || 'Not provided',
    },
    {
      icon: Building20Regular,
      label: 'Faculty',
      value: teacher.faculty_name || 'Not assigned',
    },
    {
      icon: Book20Regular,
      label: 'Subjects Teaching',
      value: dashboardData?.total_subjects?.toString() || '0',
    }
  ];

  const initials = teacher.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'T';

  return (
    <TeacherSidebar>
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="page-header !mb-0">
          <div>
            <h1 className="text-page-title text-text-primary">Teacher Profile</h1>
            <p className="mt-1 text-body text-text-muted">View and manage your academic account profile</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Profile card */}
          <section className="overflow-hidden rounded-lg bg-surface-default shadow">
            <div className="h-20 bg-brand-subtle" aria-hidden />
            <div className="-mt-12 flex flex-col items-center px-6 pb-6 text-center">
              <div className="relative">
                <Avatar className="h-24 w-24 ring-4 ring-[var(--surface-default)]">
                  <AvatarFallback className="bg-brand text-section-title text-brand-on">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span
                  className="absolute bottom-1 right-1 h-4 w-4 rounded-full bg-presence-available ring-[3px] ring-[var(--surface-default)]"
                  title="Available"
                  aria-label="Available"
                />
              </div>

              <h2 className="mt-3 text-section-title text-text-primary">
                {teacher.name || user?.name || 'Teacher'}
              </h2>
              <p className="text-body text-text-muted">{teacher.email || user?.email}</p>

              <Badge variant="success" shape="pill" className="mt-3 gap-1">
                <CheckmarkCircle16Filled aria-hidden />
                Active
              </Badge>

              <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                <Badge variant="secondary" className="gap-1">
                  <Ribbon16Regular className="text-brand-foreground" aria-hidden />
                  Teacher
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <Building16Regular className="text-brand-foreground" aria-hidden />
                  {teacher.faculty_name || 'Faculty'}
                </Badge>
                <Badge variant="secondary" className="gap-1 font-mono">
                  <ContactCard16Regular className="text-brand-foreground" aria-hidden />
                  {teacher.teacher_id || 'ID'}
                </Badge>
              </div>
            </div>
          </section>

          {/* Contact & details */}
          <section className="rounded-lg bg-surface-default shadow lg:col-span-2">
            <div className="border-b border-border-subtle px-5 py-4">
              <h2 className="text-subheading text-text-primary">Contact &amp; account details</h2>
              <p className="mt-0.5 text-caption text-text-muted">Official information on record with the institution</p>
            </div>
            <dl className="grid grid-cols-1 sm:grid-cols-2">
              {profileInfo.map((info) => (
                <div
                  key={info.label}
                  className="flex items-start gap-3 border-b border-border-subtle px-5 py-4 sm:[&:nth-last-child(-n+2)]:border-b-0 [&:last-child]:border-b-0"
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-surface-subtle text-text-secondary">
                    <info.icon aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <dt className="text-caption text-text-muted">{info.label}</dt>
                    <dd className="break-words text-body-strong text-text-primary">{info.value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </section>
        </div>

        {/* Additional Info Note (Fluent message bar) */}
        <div className="flex items-start gap-3 rounded-md border border-status-info-border bg-status-info-subtle px-4 py-3">
          <Info20Regular className="mt-0.5 shrink-0 text-status-info" aria-hidden />
          <div>
            <h3 className="text-body-strong text-text-primary">Need to update your profile?</h3>
            <p className="text-body text-text-primary">
              To update your official details or course allocations, please contact the institutional administration or your department dean.
            </p>
          </div>
        </div>
      </div>
    </TeacherSidebar>
  );
};

export default TeacherProfilePage;
