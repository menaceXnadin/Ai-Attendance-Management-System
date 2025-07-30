import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Database, Users, Calendar, AlertCircle } from 'lucide-react';
import { api } from '@/integrations/api/client';
import { useToast } from '@/hooks/use-toast';

interface SeedingStats {
  studentsCreated: number;
  attendanceRecordsCreated: number;
  classesCreated: number;
  errors: string[];
}

const DataSeeder: React.FC = () => {
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedingStats, setSeedingStats] = useState<SeedingStats | null>(null);
  const { toast } = useToast();

  // Only show in development mode
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const seedStudentData = async (): Promise<SeedingStats> => {
    const stats: SeedingStats = {
      studentsCreated: 0,
      attendanceRecordsCreated: 0,
      classesCreated: 0,
      errors: []
    };

    const sampleStudents = [
      {
        name: 'John Doe',
        email: 'john.doe@student.com',
        studentId: 'STU001',
        password: 'student123',
        rollNo: 'Computer Science',
        role: 'student' as const
      },
      {
        name: 'Jane Smith',
        email: 'jane.smith@student.com',
        studentId: 'STU002',
        password: 'student123',
        rollNo: 'Information Technology',
        role: 'student' as const
      },
      {
        name: 'Mike Johnson',
        email: 'mike.johnson@student.com',
        studentId: 'STU003',
        password: 'student123',
        rollNo: 'Computer Engineering',
        role: 'student' as const
      },
      {
        name: 'Sarah Wilson',
        email: 'sarah.wilson@student.com',
        studentId: 'STU004',
        password: 'student123',
        rollNo: 'Software Engineering',
        role: 'student' as const
      },
      {
        name: 'David Brown',
        email: 'david.brown@student.com',
        studentId: 'STU005',
        password: 'student123',
        rollNo: 'Computer Science',
        role: 'student' as const
      }
    ];

    // Create students
    for (const studentData of sampleStudents) {
      try {
        await api.students.create(studentData);
        stats.studentsCreated++;
      } catch (error) {
        const err = error as Error;
        if (!err.message.includes('already registered') && !err.message.includes('already exists')) {
          stats.errors.push(`Failed to create student ${studentData.name}: ${err.message}`);
        }
      }
    }

    // Create some sample attendance records
    try {
      const students = await api.students.getAll();
      const today = new Date();
      
      for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        
        for (const student of students.slice(0, 3)) { // Only for first 3 students
          try {
            const statuses = ['present', 'absent', 'late'];
            const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
            
            await api.attendance.create({
              studentId: student.id,
              classId: '1',
              date: date.toISOString().split('T')[0],
              status: randomStatus as 'present' | 'absent' | 'late'
            });
            stats.attendanceRecordsCreated++;
          } catch (error) {
            // Skip if record already exists
            if (!(error as Error).message.includes('already exists')) {
              stats.errors.push(`Failed to create attendance for ${student.name}: ${(error as Error).message}`);
            }
          }
        }
      }
    } catch (error) {
      stats.errors.push(`Failed to create attendance records: ${(error as Error).message}`);
    }

    return stats;
  };

  const handleSeedData = async () => {
    setIsSeeding(true);
    setSeedingStats(null);

    try {
      const stats = await seedStudentData();
      setSeedingStats(stats);
      
      if (stats.errors.length === 0) {
        toast({
          title: "Data Seeding Complete",
          description: `Created ${stats.studentsCreated} students and ${stats.attendanceRecordsCreated} attendance records.`,
        });
      } else {
        toast({
          title: "Data Seeding Completed with Warnings",
          description: `${stats.errors.length} errors occurred during seeding.`,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Seeding Failed",
        description: `Error: ${(error as Error).message}`,
        variant: "destructive",
      });
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <Card className="border-dashed border-amber-300 bg-amber-50">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-amber-600" />
          <CardTitle className="text-amber-800">Development Data Seeder</CardTitle>
          <Badge variant="outline" className="text-amber-700 border-amber-300">
            DEV ONLY
          </Badge>
        </div>
        <CardDescription className="text-amber-700">
          Generate sample data for testing the application. This feature is only available in development mode.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="border-amber-200 bg-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            This will create sample students, attendance records, and other test data. 
            Existing data will not be duplicated.
          </AlertDescription>
        </Alert>

        <Button 
          onClick={handleSeedData}
          disabled={isSeeding}
          className="w-full bg-amber-600 hover:bg-amber-700"
        >
          {isSeeding ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Seeding Data...
            </>
          ) : (
            <>
              <Database className="mr-2 h-4 w-4" />
              Seed Sample Data
            </>
          )}
        </Button>

        {seedingStats && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <Users className="h-4 w-4 text-blue-600" />
                  <span className="font-semibold text-blue-800">{seedingStats.studentsCreated}</span>
                </div>
                <p className="text-xs text-blue-600">Students</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <Calendar className="h-4 w-4 text-green-600" />
                  <span className="font-semibold text-green-800">{seedingStats.attendanceRecordsCreated}</span>
                </div>
                <p className="text-xs text-green-600">Attendance</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <span className="font-semibold text-red-800">{seedingStats.errors.length}</span>
                </div>
                <p className="text-xs text-red-600">Errors</p>
              </div>
            </div>

            {seedingStats.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <details>
                    <summary className="cursor-pointer font-medium">
                      {seedingStats.errors.length} error(s) occurred
                    </summary>
                    <ul className="mt-2 space-y-1 text-sm">
                      {seedingStats.errors.map((error, index) => (
                        <li key={index} className="text-red-700">• {error}</li>
                      ))}
                    </ul>
                  </details>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DataSeeder;
