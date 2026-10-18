
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Call20Regular,
  ContactCard20Regular,
  Edit16Regular,
  HatGraduation20Regular,
  Location20Regular,
  Mail20Regular,
  Person20Regular,
} from '@fluentui/react-icons';
import { useAuth } from '@/contexts/useAuth';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/integrations/api/client';

const StudentProfile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch student data from backend
  const { data: studentData, isLoading } = useQuery({
    queryKey: ['student-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      try {
        return await api.students.getById(user.id);
      } catch (error) {
        console.error('Error fetching student profile:', error);
        return null;
      }
    },
    enabled: !!user?.id
  });

  // Local state for form data
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: ''
  });

  // Update form data when student data loads
  React.useEffect(() => {
    if (studentData) {
      setFormData({
        name: studentData.name || '',
        email: studentData.email || '',
        phone: '', // Student type doesn't have phone, will be empty
        address: '' // Student type doesn't have address, will be empty
      });
    } else if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        phone: '',
        address: ''
      });
    }
  }, [studentData, user]);

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (updateData: Record<string, unknown>) => {
      if (!user?.id) throw new Error('User ID not found');
      return await api.students.update(user.id, updateData);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['student-profile', user?.id] });
      toast({
        title: "Profile Updated",
        description: "Your profile changes have been saved successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update profile: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveChanges = () => {
    updateProfileMutation.mutate({
      full_name: formData.name,
      email: formData.email,
      phone_number: formData.phone,
      // Note: address might need to be handled differently based on your backend schema
    });
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <div
          className="mb-4 h-8 w-8 animate-spin rounded-full border-[3px] border-brand-subtle border-t-brand"
          role="progressbar"
          aria-label="Loading"
        />
        <p className="text-body text-text-muted">Loading profile...</p>
      </div>
    );
  }

  const labelClass = 'text-body-strong text-text-primary';

  return (
    <div className="space-y-6">
      {/* Teams profile card */}
      <Card className="border-0 bg-surface-default shadow">
        <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
          <div className="relative shrink-0 self-start sm:self-center">
            <Avatar className="h-20 w-20">
              <AvatarImage src={studentData?.profileImage || '/placeholder.svg'} alt={formData.name} />
              <AvatarFallback className="bg-brand-subtle text-section-title text-brand-foreground">
                {formData.name.split(' ').map(n => n[0]).join('').toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span
              className="absolute bottom-1 right-1 h-4 w-4 rounded-full bg-presence-available ring-2 ring-[var(--surface-default)]"
              aria-label="Available"
              role="img"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-section-title text-text-primary">{formData.name || 'Student'}</h2>
              <Badge variant="success" shape="pill">Active Student</Badge>
            </div>
            <p className="mt-1 text-body text-text-secondary">Computer Science</p>
            <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-caption text-text-muted">
              <span>Student ID {studentData?.studentId || 'N/A'}</span>
              <span>Roll No. {studentData?.rollNo || 'N/A'}</span>
              {formData.email && <span className="truncate">{formData.email}</span>}
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-2 self-start sm:self-center">
            <Edit16Regular aria-hidden />
            Change Photo
          </Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">Profile Information</TabsTrigger>
          <TabsTrigger value="academic">Academic Information</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card className="border-0 bg-surface-default shadow">
            <CardHeader className="space-y-0 border-b border-border-subtle px-5 py-4">
              <CardTitle className="flex items-center gap-2 text-subheading text-text-primary">
                <Person20Regular className="shrink-0 text-brand-foreground" aria-hidden />
                Profile Information
              </CardTitle>
              <CardDescription className="mt-0.5 text-caption text-text-muted">
                View and manage your personal information
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="studentId" className={labelClass}>Student ID</Label>
                  <Input id="studentId" value={studentData?.studentId || 'N/A'} disabled />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rollNumber" className={labelClass}>Roll Number</Label>
                  <Input id="rollNumber" value={studentData?.rollNo || 'N/A'} disabled />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fullName" className={labelClass}>Full Name</Label>
                  <Input
                    id="fullName"
                    value={formData.name}
                    onChange={(e) => { handleInputChange('name', e.target.value); }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="class" className={labelClass}>Class</Label>
                  <Input id="class" value="Computer Science" disabled />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email" className={labelClass}>Email Address</Label>
                  <Input
                    id="email"
                    value={formData.email}
                    type="email"
                    onChange={(e) => { handleInputChange('email', e.target.value); }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className={labelClass}>Phone Number</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => { handleInputChange('phone', e.target.value); }}
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="address" className={labelClass}>Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => { handleInputChange('address', e.target.value); }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dob" className={labelClass}>Date of Birth</Label>
                  <Input id="dob" value="" type="date" placeholder="Not available" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="enrollment" className={labelClass}>Enrollment Date</Label>
                  <Input id="enrollment" value="" type="date" disabled placeholder="Not available" />
                </div>
              </div>
            </CardContent>
            <div className="flex justify-end gap-2 border-t border-border-subtle px-5 py-4">
              <Button variant="outline">Cancel</Button>
              <Button
                onClick={handleSaveChanges}
                disabled={updateProfileMutation.isPending}
              >
                {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="academic">
          <Card className="border-0 bg-surface-default shadow">
            <CardHeader className="space-y-0 border-b border-border-subtle px-5 py-4">
              <CardTitle className="flex items-center gap-2 text-subheading text-text-primary">
                <HatGraduation20Regular className="shrink-0 text-brand-foreground" aria-hidden />
                Academic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <dl className="divide-y divide-border-subtle">
                <div className="flex items-center gap-3 px-5 py-3">
                  <Mail20Regular className="shrink-0 text-text-muted" aria-hidden />
                  <dt className="w-28 shrink-0 text-body text-text-muted">Email</dt>
                  <dd className="min-w-0 truncate text-body text-text-primary">{formData.email}</dd>
                </div>
                <div className="flex items-center gap-3 px-5 py-3">
                  <Call20Regular className="shrink-0 text-text-muted" aria-hidden />
                  <dt className="w-28 shrink-0 text-body text-text-muted">Phone</dt>
                  <dd className="min-w-0 truncate text-body text-text-primary">{formData.phone || 'Not provided'}</dd>
                </div>
                <div className="flex items-center gap-3 px-5 py-3">
                  <Location20Regular className="shrink-0 text-text-muted" aria-hidden />
                  <dt className="w-28 shrink-0 text-body text-text-muted">Location</dt>
                  <dd className="min-w-0 truncate text-body text-text-primary">Education City</dd>
                </div>
                <div className="flex items-center gap-3 px-5 py-3">
                  <ContactCard20Regular className="shrink-0 text-text-muted" aria-hidden />
                  <dt className="w-28 shrink-0 text-body text-text-muted">Status</dt>
                  <dd>
                    <Badge variant="success" shape="pill">Active Student</Badge>
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StudentProfile;
