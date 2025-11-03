
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { User, Mail, Phone, MapPin, Calendar, Edit, Loader2 } from 'lucide-react';
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
        <Loader2 className="h-12 w-12 animate-spin text-brand-500 mb-4" />
        <p className="text-muted-foreground">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Information
          </CardTitle>
          <CardDescription>
            View and manage your personal information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex flex-col items-center space-y-4">
              <Avatar className="h-24 w-24">
                <AvatarImage src={studentData?.profileImage || '/placeholder.svg'} alt={formData.name} />
                <AvatarFallback className="text-lg">
                  {formData.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <Edit className="h-4 w-4" />
                Change Photo
              </Button>
            </div>
            
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="studentId">Student ID</Label>
                <Input id="studentId" value={studentData?.studentId || 'N/A'} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rollNumber">Roll Number</Label>
                <Input id="rollNumber" value={studentData?.rollNo || 'N/A'} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input 
                  id="fullName" 
                  value={formData.name} 
                  onChange={(e) => { handleInputChange('name', e.target.value); }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="class">Class</Label>
                <Input id="class" value="Computer Science" disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input 
                  id="email" 
                  value={formData.email} 
                  type="email" 
                  onChange={(e) => { handleInputChange('email', e.target.value); }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input 
                  id="phone" 
                  value={formData.phone} 
                  onChange={(e) => { handleInputChange('phone', e.target.value); }}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="address">Address</Label>
                <Input 
                  id="address" 
                  value={formData.address} 
                  onChange={(e) => { handleInputChange('address', e.target.value); }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dob">Date of Birth</Label>
                <Input id="dob" value="" type="date" placeholder="Not available" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="enrollment">Enrollment Date</Label>
                <Input id="enrollment" value="" type="date" disabled placeholder="Not available" />
              </div>
            </div>
          </div>
          
          <div className="mt-6 flex justify-end space-x-3">
            <Button variant="outline">Cancel</Button>
            <Button 
              onClick={handleSaveChanges} 
              disabled={updateProfileMutation.isPending}
            >
              {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Academic Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center space-x-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Email</p>
                <p className="text-sm text-muted-foreground">{formData.email}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Phone className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Phone</p>
                <p className="text-sm text-muted-foreground">{formData.phone || 'Not provided'}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Location</p>
                <p className="text-sm text-muted-foreground">Education City</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Badge variant="secondary">Active Student</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentProfile;
