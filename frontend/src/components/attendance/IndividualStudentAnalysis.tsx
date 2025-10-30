import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Loader2, 
  User, 
  TrendingDown, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle,
  FileText,
  Calendar,
  BookOpen,
  Clock,
  Target,
  Download,
  Phone,
  Mail,
  UserCog,
  BookMarked,
  AlertCircle,
  Save,
  Plus,
  Printer,
  FileDown
} from 'lucide-react';
import { api } from '@/integrations/api/client';
import { useToast } from '@/hooks/use-toast';
import AttendanceChart from '@/components/AttendanceChart';
import EnhancedStudentSelector from './EnhancedStudentSelector';

interface Student {
  id: number;
  student_id: string;
  name: string;
  email: string;
  semester: number;
  faculty: string;
  faculty_id: number;
}

interface SubjectAttendance {
  subject_id: number;
  subject_name: string;
  subject_code: string;
  total_classes: number;
  attended: number;
  present?: number;
  absent?: number;
  late?: number;
  excused?: number;
  attendance_percentage: number;
}

interface StudentInsights {
  student: Student;
  attendance: {
    totalClasses: number;
    attendedClasses: number;
    absentClasses: number;
    lateClasses: number;
    excusedClasses?: number;
    percentage: number;
  };
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  trends: {
    improving: boolean;
    declining: boolean;
    stable: boolean;
    recentAverage?: number | null;
    previousAverage?: number | null;
    change?: number | null;
  };
  recommendations: string[];
  subjects: SubjectAttendance[];
}

interface AttendanceTrend {
  date: string;
  attendance_rate: number;
  total_classes: number;
  attended_classes: number;
}

interface ActionItem {
  id: string;
  type: 'contact_student' | 'contact_parent' | 'counseling' | 'academic_warning' | 'monitoring' | 'intervention';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in_progress' | 'completed';
  due_date: string;
  created_at: string;
}

interface DecisionRecord {
  id: string;
  student_id: string;
  decision_type: string;
  description: string;
  action_taken: string;
  outcome: string;
  created_by: string;
  created_at: string;
}

const IndividualStudentAnalysis: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [studentInsights, setStudentInsights] = useState<StudentInsights | null>(null);
  const [attendanceTrends, setAttendanceTrends] = useState<AttendanceTrend[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [showAddAction, setShowAddAction] = useState(false);
  const [newActionItem, setNewActionItem] = useState<Omit<ActionItem, 'id' | 'status' | 'created_at'>>({
    type: 'contact_student',
    title: '',
    description: '',
    priority: 'medium',
    due_date: '',
  });
  const [decisionRecords, setDecisionRecords] = useState<DecisionRecord[]>([]);
  const [teacherNotes, setTeacherNotes] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  // Fetch students on component mount
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const response = await api.students.getAll();
        setStudents(response.map(student => ({
          id: parseInt(student.id),
          student_id: student.studentId,
          name: student.name,
          email: student.email,
          semester: student.semester || 1,
          faculty: student.faculty || 'Unknown',
          faculty_id: student.faculty_id || 0,
        })));
      } catch (error) {
        console.error('Error fetching students:', error);
        toast({
          title: "Error",
          description: "Failed to load students",
          variant: "destructive",
        });
      }
    };

    fetchStudents();
  }, [toast]);

  const fetchStudentAnalysis = useCallback(async (studentId: string) => {
    try {
      setLoading(true);
      const studentIdNum = parseInt(studentId);
      const insights = await api.analytics.getStudentInsights(studentIdNum);
      const subjectBreakdownResponse = await api.attendance.getStudentSubjectBreakdown(studentIdNum);
      
      // Handle new response format with metadata (subjects array wrapped in object)
      const subjectBreakdown = Array.isArray(subjectBreakdownResponse) 
        ? subjectBreakdownResponse 
        : subjectBreakdownResponse?.subjects || [];

      const attendanceSource = (insights?.attendance as Partial<StudentInsights['attendance']>) || {};
      const normalizedAttendance: StudentInsights['attendance'] = {
        totalClasses: attendanceSource.totalClasses ?? 0,
        attendedClasses: attendanceSource.attendedClasses ?? 0,
        absentClasses: attendanceSource.absentClasses ?? 0,
        lateClasses: attendanceSource.lateClasses ?? 0,
        excusedClasses: attendanceSource.excusedClasses ?? 0,
        percentage: attendanceSource.percentage ?? 0,
      };

      const trendSource = (insights?.trends as Partial<StudentInsights['trends']>) || {};
      const normalizedTrends: StudentInsights['trends'] = {
        improving: trendSource.improving ?? false,
        declining: trendSource.declining ?? false,
        stable: trendSource.stable ?? true,
        recentAverage: trendSource.recentAverage ?? null,
        previousAverage: trendSource.previousAverage ?? null,
        change: trendSource.change ?? null,
      };

      const normalizedSubjects: SubjectAttendance[] = (subjectBreakdown || []).map((subject: SubjectAttendance) => {
        const late = subject.late ?? 0;
        const attended = subject.attended ?? 0;
        const excused = subject.excused ?? 0;
        const present = subject.present ?? Math.max(attended - late, 0);
        const absent = subject.absent ?? Math.max(subject.total_classes - attended - excused, 0);

        const effectiveTotal = Math.max(subject.total_classes - excused, 0);
        const percent = effectiveTotal ? (attended / effectiveTotal) * 100 : 0;
        const roundedPercent = Number.isFinite(percent) ? Number(percent.toFixed(2)) : 0;

        return {
          ...subject,
          attended,
          present,
          late,
          absent,
          excused,
          attendance_percentage: roundedPercent,
        };
      });

      const enhancedInsights: StudentInsights = {
        ...insights,
        attendance: normalizedAttendance,
        trends: normalizedTrends,
        subjects: normalizedSubjects,
      };

      setStudentInsights(enhancedInsights);
    } catch (error) {
      console.error('Error fetching student analysis:', error);
      toast({
        title: "Error",
        description: "Failed to load student analysis",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchAttendanceTrends = useCallback(async (studentId: string) => {
    try {
      const studentIdNum = parseInt(studentId);
      const trends = await api.analytics.getAttendanceTrends(studentIdNum);
      setAttendanceTrends(trends);
    } catch (error) {
      console.error('Error fetching attendance trends:', error);
    }
  }, []);

  const handleStudentSelect = useCallback((studentId: string) => {
    setSelectedStudent(studentId);
    if (studentId) {
      fetchStudentAnalysis(studentId);
      fetchAttendanceTrends(studentId);
    } else {
      setStudentInsights(null);
      setAttendanceTrends([]);
      setActionItems([]);
    }
  }, [fetchStudentAnalysis, fetchAttendanceTrends]);

  const addActionItem = () => {
    if (!newActionItem.title || !newActionItem.description) {
      toast({
        title: "Validation Error",
        description: "Please fill in title and description",
        variant: "destructive",
      });
      return;
    }

    const actionItem: ActionItem = {
      id: Date.now().toString(),
      ...newActionItem,
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    setActionItems([...actionItems, actionItem]);
    setNewActionItem({
      type: 'contact_student',
      title: '',
      description: '',
      priority: 'medium',
      due_date: '',
    });
    setShowAddAction(false);

    toast({
      title: "Action Item Added",
      description: "New action item has been created successfully",
    });
  };

  const updateActionStatus = (actionId: string, status: ActionItem['status']) => {
    setActionItems(actionItems.map(item => 
      item.id === actionId ? { ...item, status } : item
    ));
    
    toast({
      title: "Status Updated",
      description: `Action item marked as ${status}`,
    });
  };

  const getActionIcon = (type: ActionItem['type']) => {
    switch (type) {
      case 'contact_student': return <User className="h-4 w-4" />;
      case 'contact_parent': return <Phone className="h-4 w-4" />;
      case 'counseling': return <UserCog className="h-4 w-4" />;
      case 'academic_warning': return <AlertTriangle className="h-4 w-4" />;
      case 'monitoring': return <Target className="h-4 w-4" />;
      case 'intervention': return <AlertCircle className="h-4 w-4" />;
      default: return <BookMarked className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: ActionItem['priority']) => {
    switch (priority) {
      case 'critical': return 'bg-red-500/20 text-red-300 border-red-400/30';
      case 'high': return 'bg-orange-500/20 text-orange-300 border-orange-400/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30';
      case 'low': return 'bg-green-500/20 text-green-300 border-green-400/30';
    }
  };

  const getStatusColor = (status: ActionItem['status']) => {
    switch (status) {
      case 'completed': return 'bg-green-500/20 text-green-300 border-green-400/30';
      case 'in_progress': return 'bg-blue-500/20 text-blue-300 border-blue-400/30';
      case 'pending': return 'bg-gray-500/20 text-gray-300 border-gray-400/30';
    }
  };

  const generateAutomaticActions = (insights: StudentInsights) => {
    const automaticActions: Omit<ActionItem, 'id' | 'created_at'>[] = [];
    
    if (insights.attendance.percentage < 75) {
      automaticActions.push({
        type: 'academic_warning',
        title: 'Issue Academic Warning',
        description: `Student attendance is ${insights.attendance.percentage.toFixed(1)}%, below the 75% requirement. Immediate intervention needed.`,
        priority: 'critical',
        status: 'pending',
        due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 3 days
      });
      
      automaticActions.push({
        type: 'contact_parent',
        title: 'Contact Parent/Guardian',
        description: 'Inform parent about critical attendance situation and discuss support options.',
        priority: 'high',
        status: 'pending',
        due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 days
      });
    } else if (insights.attendance.percentage < 85) {
      automaticActions.push({
        type: 'contact_student',
        title: 'Student Check-in Meeting',
        description: `Attendance is ${insights.attendance.percentage.toFixed(1)}%. Schedule meeting to understand attendance barriers.`,
        priority: 'medium',
        status: 'pending',
        due_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 5 days
      });
    }
    
    if (insights.attendance.absentClasses > 5) {
      automaticActions.push({
        type: 'counseling',
        title: 'Academic Counseling Session',
        description: 'High number of absences detected. Provide academic support and attendance strategies.',
        priority: 'medium',
        status: 'pending',
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1 week
      });
    }

    if (insights.attendance.lateClasses > 3) {
      automaticActions.push({
        type: 'monitoring',
        title: 'Address Repeated Late Arrivals',
        description: `Student has ${insights.attendance.lateClasses} late arrivals recorded. Reinforce punctuality expectations and offer support if needed.`,
        priority: insights.attendance.lateClasses > 6 ? 'high' : 'medium',
        status: 'pending',
        due_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      });
    }

    if (insights.trends.declining) {
      automaticActions.push({
        type: 'intervention',
        title: 'Plan Attendance Intervention',
        description: 'Attendance trend is declining compared to the previous week. Schedule a meeting to understand the cause and agree on corrective steps.',
        priority: 'high',
        status: 'pending',
        due_date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      });
    }
    
    return automaticActions.map(action => ({
      ...action,
      id: `auto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString(),
    }));
  };

  // Generate automatic actions when insights are loaded
  useEffect(() => {
    if (studentInsights && actionItems.length === 0) {
      const autoActions = generateAutomaticActions(studentInsights);
      setActionItems(autoActions);
    }
  }, [studentInsights, actionItems.length]);

  // Export functionality
  const generatePDFReport = async () => {
    if (!studentInsights || !selectedStudentData) {
      toast({
        title: "Export Error",
        description: "No student data available for export",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    
    try {
      // Create a comprehensive report object
      const reportData = {
        student: selectedStudentData,
        analysis: studentInsights,
        actionItems: actionItems,
        trends: attendanceTrends,
        generatedAt: new Date().toISOString(),
        teacherNotes: teacherNotes,
      };

      // In a real implementation, you would send this to a PDF generation service
      // For now, we'll create a downloadable JSON report
      const blob = new Blob([JSON.stringify(reportData, null, 2)], {
        type: 'application/json',
      });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `student-analysis-${selectedStudentData.name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Report Exported",
        description: "Student analysis report has been downloaded successfully",
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export Failed",
        description: "Failed to generate report",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    if (!selectedStudentData) {
      toast({
        title: "Print Error",
        description: "No student selected for printing",
        variant: "destructive",
      });
      return;
    }

    // Create a print-friendly version
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const printContent = generatePrintableReport();
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Student Analysis Report - ${selectedStudentData.name}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #ccc; padding-bottom: 20px; }
            .section { margin-bottom: 25px; }
            .section h2 { color: #2563eb; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; }
            .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 15px 0; }
            .card { border: 1px solid #d1d5db; padding: 15px; border-radius: 8px; }
            .table { width: 100%; border-collapse: collapse; margin: 10px 0; }
            .table th, .table td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
            .table th { background-color: #f3f4f6; font-weight: bold; }
            .badge { padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
            .badge-good { background-color: #dcfce7; color: #166534; }
            .badge-warning { background-color: #fef3c7; color: #92400e; }
            .badge-critical { background-color: #fee2e2; color: #dc2626; }
            .action-item { border-left: 4px solid #3b82f6; padding: 10px; margin: 10px 0; background-color: #f8fafc; }
            @media print { body { margin: 0; } .no-print { display: none; } }
          </style>
        </head>
        <body>
          ${printContent}
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    
    // Auto-print after content loads
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const generatePrintableReport = () => {
    if (!studentInsights || !selectedStudentData) return '';

    return `
      <div class="header">
        <h1>Individual Student Analysis Report</h1>
        <p><strong>Student:</strong> ${selectedStudentData.name} (${selectedStudentData.student_id})</p>
        <p><strong>Faculty:</strong> ${selectedStudentData.faculty} | <strong>Semester:</strong> ${selectedStudentData.semester}</p>
        <p><strong>Generated:</strong> ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
      </div>

      <div class="section">
        <h2>Attendance Summary</h2>
        <div class="grid">
          <div class="card">
            <h3>Overall Attendance</h3>
            <p style="font-size: 24px; font-weight: bold; color: #2563eb;">${studentInsights.attendance.percentage.toFixed(1)}%</p>
          </div>
          <div class="card">
            <h3>Classes Attended</h3>
            <p style="font-size: 20px;">${studentInsights.attendance.attendedClasses}/${studentInsights.attendance.totalClasses}</p>
            <p style="font-size: 13px; color: #64748b; margin-top: 4px;">Late arrivals: ${studentInsights.attendance.lateClasses}</p>
          </div>
          <div class="card">
            <h3>Absent Classes</h3>
            <p style="font-size: 20px; color: #dc2626;">${studentInsights.attendance.absentClasses}</p>
            <p style="font-size: 13px; color: #6b7280; margin-top: 4px;">Excused: ${studentInsights.attendance.excusedClasses ?? 0}</p>
          </div>
          <div class="card">
            <h3>Risk Level</h3>
            <span class="badge badge-${studentInsights.riskLevel === 'low' ? 'good' : studentInsights.riskLevel === 'medium' ? 'warning' : 'critical'}">${studentInsights.riskLevel.toUpperCase()}</span>
          </div>
        </div>
      </div>

      ${studentInsights.subjects.length > 0 ? `
        <div class="section">
          <h2>Subject-wise Breakdown</h2>
          <table class="table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Subject Code</th>
                <th>Total Classes</th>
                <th>Attended</th>
                <th>Late</th>
                <th>Absent</th>
                <th>Attendance %</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${studentInsights.subjects.map(subject => `
                <tr>
                  <td>${subject.subject_name}</td>
                  <td>${subject.subject_code}</td>
                  <td>${subject.total_classes}</td>
                  <td>${subject.attended}${subject.excused ? `<div style="font-size: 12px; color: #6b7280;">Excused: ${subject.excused}</div>` : ''}</td>
                  <td>${subject.late ?? 0}</td>
                  <td>${subject.absent ?? subject.total_classes - subject.attended}</td>
                  <td>${subject.attendance_percentage.toFixed(1)}%</td>
                  <td><span class="badge badge-${subject.attendance_percentage >= 85 ? 'good' : subject.attendance_percentage >= 75 ? 'warning' : 'critical'}">${subject.attendance_percentage >= 85 ? 'Good' : subject.attendance_percentage >= 75 ? 'Warning' : 'Critical'}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}

      ${actionItems.length > 0 ? `
        <div class="section">
          <h2>Action Items & Recommendations</h2>
          ${actionItems.map(action => `
            <div class="action-item">
              <h4>${action.title} <span class="badge badge-${action.priority === 'low' ? 'good' : action.priority === 'medium' ? 'warning' : 'critical'}">${action.priority.toUpperCase()}</span></h4>
              <p>${action.description}</p>
              <p><strong>Status:</strong> ${action.status.replace('_', ' ').toUpperCase()} | <strong>Due:</strong> ${action.due_date}</p>
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${studentInsights.recommendations.length > 0 ? `
        <div class="section">
          <h2>AI Insights & Recommendations</h2>
          ${studentInsights.recommendations.map((rec, index) => `
            <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 10px 0;">
              <p>${rec}</p>
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${teacherNotes ? `
        <div class="section">
          <h2>Teacher Notes</h2>
          <div style="background-color: #f9fafb; border: 1px solid #d1d5db; padding: 15px; border-radius: 8px;">
            <p style="white-space: pre-wrap;">${teacherNotes}</p>
          </div>
        </div>
      ` : ''}
    `;
  };

  const selectedStudentData = students.find(s => s.id.toString() === selectedStudent);

  const getRiskBadgeColor = (risk: string) => {
    switch (risk) {
      case 'critical': return 'bg-red-500/20 text-red-300 border-red-400/30';
      case 'high': return 'bg-orange-500/20 text-orange-300 border-orange-400/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30';
      case 'low': return 'bg-green-500/20 text-green-300 border-green-400/30';
      default: return 'bg-gray-500/20 text-gray-300 border-gray-400/30';
    }
  };

  const formatPercentage = (value?: number | null) =>
    typeof value === 'number' ? value.toFixed(1) : '--';

  const formatDelta = (value?: number | null) => {
    if (typeof value !== 'number') return '--';
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}`;
  };

  return (
    <div className="space-y-6">
      {/* Student Selection */}
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl text-slate-200 flex items-center gap-2">
              <User className="h-5 w-5" />
              Individual Student Analysis
            </CardTitle>
            
            {selectedStudentData && (
              <div className="flex gap-2">
                <Button
                  onClick={handlePrint}
                  variant="outline"
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Print Report
                </Button>
                <Button
                  onClick={generatePDFReport}
                  disabled={isExporting}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isExporting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileDown className="h-4 w-4 mr-2" />
                  )}
                  Export Report
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <EnhancedStudentSelector
            students={students}
            selectedStudentId={selectedStudent}
            onStudentSelect={handleStudentSelect}
          />
        </CardContent>
      </Card>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
          <span className="ml-2 text-slate-400">Loading student analysis...</span>
        </div>
      )}

      {selectedStudent && !loading && (
        <>
          {studentInsights ? (
            <>
              {/* Risk Assessment Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-slate-800/50 border-slate-700/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-400">Overall Attendance</p>
                        <p className="text-2xl font-bold text-slate-200">
                          {studentInsights.attendance.percentage.toFixed(1)}%
                        </p>
                      </div>
                      <div className="h-12 w-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <BookOpen className="h-6 w-6 text-blue-400" />
                      </div>
                    </div>
                    <Progress 
                      value={studentInsights.attendance.percentage} 
                      className="mt-2"
                    />
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/50 border-slate-700/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-400">Classes Attended</p>
                        <p className="text-2xl font-bold text-slate-200">
                          {studentInsights.attendance.attendedClasses}/{studentInsights.attendance.totalClasses}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Late arrivals: {studentInsights.attendance.lateClasses}
                        </p>
                      </div>
                      <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center">
                        <CheckCircle className="h-6 w-6 text-green-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/50 border-slate-700/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-400">Absent Classes</p>
                        <p className="text-2xl font-bold text-slate-200">
                          {studentInsights.attendance.absentClasses}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Excused: {studentInsights.attendance.excusedClasses ?? 0}
                        </p>
                      </div>
                      <div className="h-12 w-12 rounded-full bg-red-500/20 flex items-center justify-center">
                        <AlertTriangle className="h-6 w-6 text-red-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/50 border-slate-700/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-400">Risk Level</p>
                        <Badge className={getRiskBadgeColor(studentInsights.riskLevel)}>
                          {studentInsights.riskLevel.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="h-12 w-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                        <Target className="h-6 w-6 text-orange-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Subject-wise Attendance Table */}
              <Card className="bg-slate-800/50 border-slate-700/50">
                <CardHeader>
                  <CardTitle className="text-lg text-slate-200 flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    Semester-wise Subject Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {studentInsights.subjects && studentInsights.subjects.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-slate-700/50">
                            <TableHead className="text-slate-300">Subject</TableHead>
                            <TableHead className="text-slate-300">Subject Code</TableHead>
                            <TableHead className="text-slate-300 text-center">Total Classes Held</TableHead>
                            <TableHead className="text-slate-300 text-center">Attended</TableHead>
                            <TableHead className="text-slate-300 text-center">Late</TableHead>
                            <TableHead className="text-slate-300 text-center">Absent</TableHead>
                            <TableHead className="text-slate-300 text-center">Attendance %</TableHead>
                            <TableHead className="text-slate-300 text-center">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {studentInsights.subjects.map((subject) => (
                            <TableRow key={subject.subject_id} className="border-slate-700/50">
                              <TableCell className="text-slate-200 font-medium">
                                {subject.subject_name}
                              </TableCell>
                              <TableCell className="text-slate-300">
                                {subject.subject_code}
                              </TableCell>
                              <TableCell className="text-center text-slate-200">
                                {subject.total_classes}
                              </TableCell>
                              <TableCell className="text-center text-green-400">
                                {subject.attended}
                                {typeof subject.present === 'number' ? (
                                  <div className="text-xs text-slate-400">On time: {subject.present}</div>
                                ) : null}
                                {subject.excused ? (
                                  <div className="text-xs text-slate-400">Excused: {subject.excused}</div>
                                ) : null}
                              </TableCell>
                              <TableCell className="text-center text-yellow-300">
                                {subject.late ?? 0}
                              </TableCell>
                              <TableCell className="text-center text-red-400">
                                {subject.absent ?? subject.total_classes - subject.attended}
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <span className="text-slate-200 font-medium">
                                    {subject.attendance_percentage.toFixed(1)}%
                                  </span>
                                  <Progress 
                                    value={subject.attendance_percentage} 
                                    className="w-16"
                                  />
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge 
                                  className={
                                    subject.attendance_percentage >= 85 
                                      ? 'bg-green-500/20 text-green-300 border-green-400/30'
                                      : subject.attendance_percentage >= 75
                                      ? 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30'
                                      : 'bg-red-500/20 text-red-300 border-red-400/30'
                                  }
                                >
                                  {subject.attendance_percentage >= 85 
                                    ? 'Good' 
                                    : subject.attendance_percentage >= 75 
                                    ? 'Warning' 
                                    : 'Critical'
                                  }
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <BookOpen className="h-12 w-12 mx-auto mb-4 text-slate-500 opacity-50" />
                      <p className="text-slate-400">No subject data available</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Attendance Trends Chart */}
              {attendanceTrends.length > 0 && (
                <Card className="bg-slate-800/50 border-slate-700/50">
                  <CardHeader>
                    <CardTitle className="text-lg text-slate-200 flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Attendance Trends
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <AttendanceChart 
                      data={attendanceTrends.map(trend => ({
                        name: trend.date,
                        present: trend.attended_classes,
                        absent: trend.total_classes - trend.attended_classes,
                        late: 0
                      }))}
                      title="Daily Attendance Trends"
                      type="line"
                    />
                  </CardContent>
                </Card>
              )}

              {/* Decision Support - Action Items */}
              <Card className="bg-slate-800/50 border-slate-700/50">
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg text-slate-200 flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      Action Items & Decision Support
                    </CardTitle>
                    <Button
                      onClick={() => setShowAddAction(true)}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Action
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {showAddAction && (
                    <Card className="mb-4 bg-slate-700/50 border-slate-600/50">
                      <CardHeader>
                        <CardTitle className="text-sm text-slate-200">Add New Action Item</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">
                              Action Type
                            </label>
                            <Select 
                              value={newActionItem.type} 
                              onValueChange={(value: ActionItem['type']) => 
                                setNewActionItem(prev => ({ ...prev, type: value }))
                              }
                            >
                              <SelectTrigger className="bg-slate-600/50 border-slate-500/50">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-slate-800 border-slate-700">
                                <SelectItem value="contact_student">Contact Student</SelectItem>
                                <SelectItem value="contact_parent">Contact Parent</SelectItem>
                                <SelectItem value="counseling">Academic Counseling</SelectItem>
                                <SelectItem value="academic_warning">Academic Warning</SelectItem>
                                <SelectItem value="monitoring">Enhanced Monitoring</SelectItem>
                                <SelectItem value="intervention">Intervention</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">
                              Priority
                            </label>
                            <Select 
                              value={newActionItem.priority} 
                              onValueChange={(value: ActionItem['priority']) => 
                                setNewActionItem(prev => ({ ...prev, priority: value }))
                              }
                            >
                              <SelectTrigger className="bg-slate-600/50 border-slate-500/50">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-slate-800 border-slate-700">
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="critical">Critical</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-1">
                            Title
                          </label>
                          <Input
                            value={newActionItem.title}
                            onChange={(e) => setNewActionItem(prev => ({ ...prev, title: e.target.value }))}
                            placeholder="Enter action title..."
                            className="bg-slate-600/50 border-slate-500/50"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-1">
                            Description
                          </label>
                          <Textarea
                            value={newActionItem.description}
                            onChange={(e) => setNewActionItem(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Describe the action needed..."
                            rows={3}
                            className="bg-slate-600/50 border-slate-500/50"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-1">
                            Due Date
                          </label>
                          <Input
                            type="date"
                            value={newActionItem.due_date}
                            onChange={(e) => setNewActionItem(prev => ({ ...prev, due_date: e.target.value }))}
                            className="bg-slate-600/50 border-slate-500/50"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={addActionItem} className="bg-green-600 hover:bg-green-700">
                            <Save className="h-4 w-4 mr-2" />
                            Save Action
                          </Button>
                          <Button 
                            onClick={() => setShowAddAction(false)} 
                            variant="outline"
                            className="border-slate-600 text-slate-300 hover:bg-slate-700"
                          >
                            Cancel
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {actionItems.length > 0 ? (
                    <div className="space-y-3">
                      {actionItems.map((action) => (
                        <Card key={action.id} className="bg-slate-700/30 border-slate-600/50">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3 flex-1">
                                <div className="mt-1">
                                  {getActionIcon(action.type)}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-medium text-slate-200">{action.title}</h4>
                                    <Badge className={getPriorityColor(action.priority)}>
                                      {action.priority}
                                    </Badge>
                                    <Badge className={getStatusColor(action.status)}>
                                      {action.status.replace('_', ' ')}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-slate-300 mb-2">{action.description}</p>
                                  <div className="flex items-center gap-4 text-xs text-slate-400">
                                    <span>Due: {action.due_date}</span>
                                    <span>Created: {new Date(action.created_at).toLocaleDateString()}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-1 ml-4">
                                {action.status === 'pending' && (
                                  <Button 
                                    size="sm" 
                                    onClick={() => updateActionStatus(action.id, 'in_progress')}
                                    className="bg-blue-600 hover:bg-blue-700"
                                  >
                                    Start
                                  </Button>
                                )}
                                {action.status === 'in_progress' && (
                                  <Button 
                                    size="sm" 
                                    onClick={() => updateActionStatus(action.id, 'completed')}
                                    className="bg-green-600 hover:bg-green-700"
                                  >
                                    Complete
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Target className="h-12 w-12 mx-auto mb-4 text-slate-500 opacity-50" />
                      <p className="text-slate-400">No action items yet</p>
                      <p className="text-slate-500 text-sm">Action items will be automatically generated based on attendance patterns</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Insights and Recommendations */}
              <Card className="bg-slate-800/50 border-slate-700/50">
                <CardHeader>
                  <CardTitle className="text-lg text-slate-200 flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    AI Insights & Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {studentInsights.recommendations.length > 0 ? (
                    <div className="space-y-3">
                      {studentInsights.recommendations.map((recommendation, index) => (
                        <Alert key={index} className="bg-blue-500/10 border-blue-400/30">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription className="text-slate-200">
                            {recommendation}
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <FileText className="h-12 w-12 mx-auto mb-4 text-slate-500 opacity-50" />
                      <p className="text-slate-400">No specific recommendations available</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick Decision Summary */}
              <Card className="bg-slate-800/50 border-slate-700/50">
                <CardHeader>
                  <CardTitle className="text-lg text-slate-200 flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Decision Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-slate-700/30 rounded-lg">
                      <p className="text-sm text-slate-400">Total Action Items</p>
                      <p className="text-2xl font-bold text-slate-200">{actionItems.length}</p>
                      <p className="text-xs text-slate-500">
                        {actionItems.filter(item => item.status === 'pending').length} pending
                      </p>
                    </div>
                    <div className="p-4 bg-slate-700/30 rounded-lg">
                      <p className="text-sm text-slate-400">Critical Actions</p>
                      <p className="text-2xl font-bold text-red-400">
                        {actionItems.filter(item => item.priority === 'critical').length}
                      </p>
                      <p className="text-xs text-slate-500">
                        Require immediate attention
                      </p>
                    </div>
                    <div className="p-4 bg-slate-700/30 rounded-lg">
                      <p className="text-sm text-slate-400">Completion Rate</p>
                      <p className="text-2xl font-bold text-green-400">
                        {actionItems.length > 0 
                          ? Math.round((actionItems.filter(item => item.status === 'completed').length / actionItems.length) * 100)
                          : 0
                        }%
                      </p>
                      <p className="text-xs text-slate-500">
                        Actions completed
                      </p>
                    </div>
                  </div>

                  {(studentInsights.trends.recentAverage !== undefined && studentInsights.trends.recentAverage !== null) && (
                    <div className="mt-4 text-sm text-slate-300">
                      Recent 7-day attendance average: {formatPercentage(studentInsights.trends.recentAverage)}%
                      {studentInsights.trends.previousAverage !== undefined && studentInsights.trends.previousAverage !== null
                        ? ` (previous: ${formatPercentage(studentInsights.trends.previousAverage)}%)`
                        : ''}
                      {studentInsights.trends.change !== undefined && studentInsights.trends.change !== null
                        ? ` • Change: ${formatDelta(studentInsights.trends.change)}%`
                        : ''}
                    </div>
                  )}

                  {studentInsights.trends.improving && (
                    <Alert className="mt-4 bg-green-500/10 border-green-400/30">
                      <TrendingUp className="h-4 w-4" />
                      <AlertDescription className="text-slate-200">
                        Attendance has improved over the last week. Keep reinforcing the positive habits that led to this change.
                      </AlertDescription>
                    </Alert>
                  )}

                  {studentInsights.trends.declining && (
                    <Alert className="mt-4 bg-yellow-500/10 border-yellow-400/30">
                      <TrendingDown className="h-4 w-4" />
                      <AlertDescription className="text-slate-200">
                        Attendance is trending downward compared to the previous week. Review recent absences and plan corrective actions.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {studentInsights.attendance.percentage < 75 && (
                    <Alert className="mt-4 bg-red-500/10 border-red-400/30">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-slate-200">
                        <strong>Critical Alert:</strong> Student attendance is below 75% minimum requirement. 
                        Immediate intervention and academic warning may be necessary.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              {/* Teacher Notes */}
              <Card className="bg-slate-800/50 border-slate-700/50">
                <CardHeader>
                  <CardTitle className="text-lg text-slate-200 flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Teacher Notes & Decision Log
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Add Notes (decisions made, observations, etc.)
                      </label>
                      <Textarea
                        value={teacherNotes}
                        onChange={(e) => setTeacherNotes(e.target.value)}
                        placeholder="Record your observations, decisions made, and follow-up actions..."
                        rows={4}
                        className="bg-slate-700/50 border-slate-600/50 text-slate-200"
                      />
                    </div>
                    <Button 
                      onClick={() => {
                        // Save notes logic would go here
                        toast({
                          title: "Notes Saved",
                          description: "Teacher notes have been recorded",
                        });
                        setTeacherNotes('');
                      }}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save Notes
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="text-center py-12">
              <AlertTriangle className="h-16 w-16 mx-auto mb-4 text-slate-500 opacity-50" />
              <p className="text-slate-400 text-lg">No analysis data available</p>
              <p className="text-slate-500 text-sm">
                Unable to load attendance analysis for selected student
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default IndividualStudentAnalysis;