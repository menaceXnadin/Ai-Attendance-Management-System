
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { User, Mail, Phone, MapPin, Calendar, Edit } from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import { useToast } from '@/hooks/use-toast';

const StudentProfile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Mock data - in real app, this would come from API
  // Extended with authenticated user data where available
  const [studentData, setStudentData] = useState({
    id: user?.id || 'STU001',
    name: user?.name || 'John Smith',
    email: user?.email || 'student@example.com',
    phone: '+1 (555) 123-4567',
    address: '123 Student Street, Education City',
    dateOfBirth: '2000-05-15',
    enrollmentDate: '2023-09-01',
    class: 'Computer Science',
    rollNumber: 'CS001',
    profileImage: '/placeholder.svg'
  });

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
                <AvatarImage src={studentData.profileImage} alt={studentData.name} />
                <AvatarFallback className="text-lg">
                  {studentData.name.split(' ').map(n => n[0]).join('')}
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
                <Input id="studentId" value={studentData.id} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rollNumber">Roll Number</Label>
                <Input id="rollNumber" value={studentData.rollNumber} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input id="fullName" value={studentData.name} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="class">Class</Label>
                <Input id="class" value={studentData.class} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" value={studentData.email} type="email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input id="phone" value={studentData.phone} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="address">Address</Label>
                <Input id="address" value={studentData.address} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dob">Date of Birth</Label>
                <Input id="dob" value={studentData.dateOfBirth} type="date" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="enrollment">Enrollment Date</Label>
                <Input id="enrollment" value={studentData.enrollmentDate} type="date" disabled />
              </div>
            </div>
          </div>
          
          <div className="mt-6 flex justify-end space-x-3">
            <Button variant="outline">Cancel</Button>
            <Button onClick={() => {
              toast({
                title: "Profile Updated",
                description: "Your profile changes have been saved successfully.",
              });
            }}>Save Changes</Button>
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
                <p className="text-sm text-muted-foreground">{studentData.email}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Phone className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Phone</p>
                <p className="text-sm text-muted-foreground">{studentData.phone}</p>
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
