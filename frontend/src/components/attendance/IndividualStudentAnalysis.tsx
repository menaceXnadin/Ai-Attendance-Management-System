import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import {
  Person16Regular,
  Phone16Regular,
  PersonSettings16Regular,
  Warning16Regular,
  Warning24Regular,
  Target16Regular,
  Target20Regular,
  Target24Regular,
  ErrorCircle16Regular,
  Bookmark16Regular,
  ArrowSync16Regular,
  Print16Regular,
  DocumentArrowDown16Regular,
  Add16Regular,
  Save16Regular,
  CheckmarkCircle16Regular,
  CheckmarkCircle20Regular,
  DismissCircle20Regular,
  BookOpen20Regular,
  BookOpen24Regular,
  Sparkle20Regular,
  Sparkle24Regular,
  Note20Regular,
  ArrowTrending16Regular,
  ArrowTrendingDown16Regular,
  PersonCircle20Regular,
  Info16Regular,
} from '@fluentui/react-icons';
import { api } from '@/integrations/api/client';
import { useToast } from '@/hooks/use-toast';
import AttendanceChart from '@/components/AttendanceChart';
import EnhancedStudentSelector from './EnhancedStudentSelector';
import {
  NO_DATA,
  describeEligibility,
  formatPercent,
  resolveBand,
  resolvePercentage,
  toneClasses,
  useAttendancePolicy,
} from '@/components/attendance-admin/metrics';

interface Student {
  id: number;
  student_id: string;
  name: string;
  email: string;
  semester: number;
  faculty: string;
  faculty_id: number;
}

/** §13.12 metric fields the server may add next to the legacy ones. */
interface MetricExtras {
  has_data?: boolean;
  considered?: number;
  unrecorded?: number;
  eligible?: boolean | null;
  eligibility_provisional?: boolean;
  band?: string | null;
  band_label?: string | null;
}

interface SubjectAttendance extends MetricExtras {
  subject_id: number;
  subject_name: string;
  subject_code: string;
  total_classes: number;
  attended: number;
  present?: number | null;
  absent?: number | null;
  late?: number | null;
  excused?: number | null;
  /** Legacy numeric field (0 when there is no data). */
  attendance_percentage: number;
  /** Server percentage; `null` = no countable classes ("—"). Never computed client-side. */
  pct: number | null;
}

interface StudentInsights {
  student: Student;
  attendance: MetricExtras & {
    totalClasses: number;
    attendedClasses: number;
    absentClasses: number;
    lateClasses: number;
    excusedClasses?: number;
    /** Legacy numeric field (0 when there is no data). */
    percentage: number;
    /** Server percentage; `null` = no data. */
    pct: number | null;
  };
  /** From policy bands on the server; `unknown` when there is no data (never "critical"). */
  riskLevel: 'low' | 'medium' | 'high' | 'critical' | 'unknown';
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

// Fluent chart chrome (theme-aware via CSS variables)
const CHART_TOOLTIP_STYLE: React.CSSProperties = {
  background: 'var(--surface-raised)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 8,
  boxShadow: 'var(--shadow-16)',
  color: 'var(--text-primary)',
  fontSize: 12,
  padding: '8px 12px',
};

const formatTrendDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

/** Risk as reported by the server; "unknown" (neutral) whenever there is no data. */
const effectiveRisk = (insights: StudentInsights): StudentInsights['riskLevel'] =>
  insights.attendance.pct === null ? 'unknown' : insights.riskLevel ?? 'unknown';

const riskLabel = (insights: StudentInsights) => {
  const risk = effectiveRisk(insights);
  return risk === 'unknown' ? 'No data' : risk.charAt(0).toUpperCase() + risk.slice(1);
};

const riskBadgeKey = (insights: StudentInsights) => {
  const risk = effectiveRisk(insights);
  if (risk === 'unknown') return 'none';
  if (risk === 'low') return 'good';
  if (risk === 'medium') return 'warning';
  return 'critical';
};

const IndividualStudentAnalysis: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  
  // Only persist selected student in sessionStorage (not the data)
  const [selectedStudent, setSelectedStudent] = useState<string>(() => {
    return sessionStorage.getItem('individualAnalysisSelectedStudent') || '';
  });
  
  // Don't cache the actual data - always fetch fresh
  const [studentInsights, setStudentInsights] = useState<StudentInsights | null>(null);
  const [attendanceTrends, setAttendanceTrends] = useState<AttendanceTrend[]>([]);
  
  const [loading, setLoading] = useState(false);
  const policyView = useAttendancePolicy();
  const minimum = policyView.minimum;
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

      // §13.12 fields may sit on the attendance block or at the top level of the payload.
      const topLevel = (insights ?? {}) as Record<string, unknown>;
      const extras: Record<string, unknown> = {};
      ['has_data', 'considered', 'unrecorded', 'eligible', 'eligibility_provisional', 'band', 'band_label'].forEach((key) => {
        if (key in topLevel) extras[key] = topLevel[key];
      });
      if (topLevel.percentage === null) extras.has_data = false;
      const attendanceSource = {
        ...extras,
        ...((insights?.attendance as Partial<StudentInsights['attendance']> & Record<string, unknown>) || {}),
      } as Partial<StudentInsights['attendance']> & Record<string, unknown>;
      const normalizedAttendance: StudentInsights['attendance'] = {
        ...attendanceSource,
        totalClasses: attendanceSource.totalClasses ?? 0,
        attendedClasses: attendanceSource.attendedClasses ?? 0,
        absentClasses: attendanceSource.absentClasses ?? 0,
        lateClasses: attendanceSource.lateClasses ?? 0,
        excusedClasses: attendanceSource.excusedClasses ?? 0,
        percentage: attendanceSource.percentage ?? 0,
        // Prefer has_data/considered; legacy payloads with no classes report 0 → "—".
        pct: resolvePercentage({ ...attendanceSource, total_classes: attendanceSource.totalClasses }),
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

      // Display only what the server computed — no client-side percentage or excused arithmetic.
      const normalizedSubjects: SubjectAttendance[] = (subjectBreakdown || []).map(
        (subject: SubjectAttendance & Record<string, unknown>) => ({
          ...subject,
          attended: subject.attended ?? 0,
          total_classes: subject.total_classes ?? 0,
          attendance_percentage: subject.attendance_percentage ?? 0,
          pct: resolvePercentage(subject, ['attendance_percentage']),
        })
      );

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
    
    // Persist selected student to sessionStorage
    if (studentId) {
      sessionStorage.setItem('individualAnalysisSelectedStudent', studentId);
      fetchStudentAnalysis(studentId);
      fetchAttendanceTrends(studentId);
    } else {
      setStudentInsights(null);
      setAttendanceTrends([]);
      setActionItems([]);
      
      // Clear sessionStorage when student is deselected
      sessionStorage.removeItem('individualAnalysisSelectedStudent');
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
      case 'contact_student': return <Person16Regular aria-hidden />;
      case 'contact_parent': return <Phone16Regular aria-hidden />;
      case 'counseling': return <PersonSettings16Regular aria-hidden />;
      case 'academic_warning': return <Warning16Regular aria-hidden />;
      case 'monitoring': return <Target16Regular aria-hidden />;
      case 'intervention': return <ErrorCircle16Regular aria-hidden />;
      default: return <Bookmark16Regular aria-hidden />;
    }
  };

  const getPriorityColor = (priority: ActionItem['priority']) => {
    switch (priority) {
      case 'critical': return 'bg-status-error text-brand-on border-status-error';
      case 'high': return 'bg-status-error-subtle text-status-error border-status-error-border';
      case 'medium': return 'bg-status-warning-subtle text-status-warning border-status-warning-border';
      case 'low': return 'bg-status-success-subtle text-status-success border-status-success-border';
    }
  };

  const getStatusColor = (status: ActionItem['status']) => {
    switch (status) {
      case 'completed': return 'bg-status-success-subtle text-status-success border-status-success-border';
      case 'in_progress': return 'bg-status-info-subtle text-status-info border-status-info-border';
      case 'pending': return 'bg-surface-subtle text-text-secondary border-border-default';
    }
  };

  const generateAutomaticActions = (insights: StudentInsights) => {
    const automaticActions: Omit<ActionItem, 'id' | 'created_at'>[] = [];
    const pct = insights.attendance.pct;
    // Band comes from the server (or policy bands for the server percentage); no data → no band.
    const band = resolveBand(insights.attendance, policyView, pct);

    if (pct !== null && band?.tone === 'destructive') {
      automaticActions.push({
        type: 'academic_warning',
        title: 'Issue Academic Warning',
        description: `Student attendance is ${formatPercent(pct)}, below the ${minimum}% requirement. Immediate intervention needed.`,
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
    } else if (pct !== null && band?.tone === 'warning') {
      automaticActions.push({
        type: 'contact_student',
        title: 'Student Check-in Meeting',
        description: `Attendance is ${formatPercent(pct)}. Schedule meeting to understand attendance barriers.`,
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
            body { font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, 'Helvetica Neue', sans-serif; margin: 20px; color: #242424; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #E0E0E0; padding-bottom: 20px; }
            .section { margin-bottom: 25px; }
            .section h2 { color: #5B5FC7; border-bottom: 1px solid #E0E0E0; padding-bottom: 5px; }
            .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 15px 0; }
            .card { border: 1px solid #E0E0E0; padding: 15px; border-radius: 8px; }
            .table { width: 100%; border-collapse: collapse; margin: 10px 0; }
            .table th, .table td { border: 1px solid #E0E0E0; padding: 8px; text-align: left; }
            .table th { background-color: #FAFAFA; font-weight: 600; }
            .badge { padding: 2px 8px; border-radius: 9999px; font-size: 12px; font-weight: 600; }
            .badge-excellent { background-color: #E8EBFA; color: #444791; }
            .badge-good { background-color: #F1FAF1; color: #0E700E; }
            .badge-warning { background-color: #FFF9F5; color: #8A3707; }
            .badge-critical { background-color: #FDF3F4; color: #B10E1C; }
            .badge-none { background-color: #F5F5F5; color: #616161; }
            .action-item { border-left: 4px solid #5B5FC7; padding: 10px; margin: 10px 0; background-color: #FAFAFA; }
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
            <p style="font-size: 24px; font-weight: 600; color: #5B5FC7;">${formatPercent(studentInsights.attendance.pct)}</p>
          </div>
          <div class="card">
            <h3>Classes Attended</h3>
            <p style="font-size: 20px;">${studentInsights.attendance.attendedClasses}/${studentInsights.attendance.totalClasses}</p>
            <p style="font-size: 13px; color: #616161; margin-top: 4px;">Late arrivals: ${studentInsights.attendance.lateClasses}</p>
          </div>
          <div class="card">
            <h3>Absent Classes</h3>
            <p style="font-size: 20px; color: #B10E1C;">${studentInsights.attendance.absentClasses}</p>
            <p style="font-size: 13px; color: #616161; margin-top: 4px;">Excused: ${studentInsights.attendance.excusedClasses ?? 0}</p>
          </div>
          <div class="card">
            <h3>Risk Level</h3>
            <span class="badge badge-${riskBadgeKey(studentInsights)}">${riskLabel(studentInsights).toUpperCase()}</span>
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
              ${studentInsights.subjects.map(subject => {
                const band = resolveBand(subject, policyView, subject.pct);
                const badgeKey = !band ? 'none' : band.tone === 'brand' ? 'excellent' : band.tone === 'success' ? 'good' : band.tone === 'warning' ? 'warning' : band.tone === 'destructive' ? 'critical' : 'none';
                return `
                <tr>
                  <td>${subject.subject_name}</td>
                  <td>${subject.subject_code}</td>
                  <td>${subject.total_classes}</td>
                  <td>${subject.attended}${subject.excused ? `<div style="font-size: 12px; color: #616161;">Excused: ${subject.excused}</div>` : ''}</td>
                  <td>${subject.late ?? NO_DATA}</td>
                  <td>${subject.absent ?? NO_DATA}</td>
                  <td>${formatPercent(subject.pct)}</td>
                  <td><span class="badge badge-${badgeKey}">${band ? band.label : 'No data'}</span></td>
                </tr>
              `;
              }).join('')}
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
            <div style="background-color: #EBF3FC; border-left: 4px solid #0F6CBD; padding: 15px; margin: 10px 0;">
              <p>${rec}</p>
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${teacherNotes ? `
        <div class="section">
          <h2>Teacher Notes</h2>
          <div style="background-color: #FAFAFA; border: 1px solid #E0E0E0; padding: 15px; border-radius: 8px;">
            <p style="white-space: pre-wrap;">${teacherNotes}</p>
          </div>
        </div>
      ` : ''}
    `;
  };

  const selectedStudentData = students.find(s => s.id.toString() === selectedStudent);

  const getRiskBadgeColor = (risk: string) => {
    switch (risk) {
      case 'critical': return 'bg-status-error text-brand-on border-status-error';
      case 'high': return 'bg-status-error-subtle text-status-error border-status-error-border';
      case 'medium': return 'bg-status-warning-subtle text-status-warning border-status-warning-border';
      case 'low': return 'bg-status-success-subtle text-status-success border-status-success-border';
      default: return 'bg-surface-subtle text-text-secondary border-border-default';
    }
  };

  const getRiskChipColor = (risk: string) => {
    switch (risk) {
      case 'critical':
      case 'high': return 'bg-status-error-subtle text-status-error';
      case 'medium': return 'bg-status-warning-subtle text-status-warning';
      case 'low': return 'bg-status-success-subtle text-status-success';
      default: return 'bg-surface-subtle text-text-muted';
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
    <div className="space-y-4">
      {/* Student Selection */}
      <section className="rounded-lg bg-surface-default shadow">
        <header className="flex flex-col gap-3 border-b border-border-subtle px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <PersonCircle20Regular className="text-brand-foreground" aria-hidden />
            <h2 className="text-subheading text-text-primary">
              Individual Student Analysis
            </h2>
          </div>

          {selectedStudent && (
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  if (selectedStudent) {
                    fetchStudentAnalysis(selectedStudent);
                    fetchAttendanceTrends(selectedStudent);
                  }
                }}
                variant="ghost"
                size="sm"
              >
                <ArrowSync16Regular aria-hidden />
                Refresh Data
              </Button>
              <Button
                onClick={handlePrint}
                variant="outline"
                size="sm"
              >
                <Print16Regular aria-hidden />
                Print Report
              </Button>
              <Button
                onClick={generatePDFReport}
                disabled={isExporting}
                size="sm"
              >
                {isExporting ? (
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-brand-on/40 border-t-brand-on"
                    aria-hidden
                  />
                ) : (
                  <DocumentArrowDown16Regular aria-hidden />
                )}
                Export Report
              </Button>
            </div>
          )}
        </header>
        <div className="p-5">
          <EnhancedStudentSelector
            students={students}
            selectedStudentId={selectedStudent}
            onStudentSelect={handleStudentSelect}
          />
        </div>
      </section>

      {loading && (
        <div className="flex items-center justify-center gap-3 py-12 text-body text-text-muted">
          <span
            className="h-5 w-5 animate-spin rounded-full border-2 border-brand-subtle border-t-brand"
            aria-hidden
          />
          <span>Loading student analysis...</span>
        </div>
      )}

      {selectedStudent && !loading && (
        <>
          {studentInsights ? (
            <>
              {/* Risk Assessment Cards */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg bg-surface-default p-4 shadow">
                  <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-brand-subtle text-brand-foreground">
                      <BookOpen20Regular aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-caption text-text-muted">Overall Attendance</p>
                      <p className="text-[28px] font-semibold leading-9 tabular-nums text-text-primary">
                        {formatPercent(studentInsights.attendance.pct)}
                      </p>
                      {studentInsights.attendance.pct === null ? (
                        <p className="text-caption text-text-muted">No classes counted yet</p>
                      ) : (
                        (() => {
                          const eligibility = describeEligibility(studentInsights.attendance);
                          return eligibility ? (
                            <p className={`text-caption-strong ${toneClasses[eligibility.tone].text}`}>{eligibility.label}</p>
                          ) : null;
                        })()
                      )}
                    </div>
                  </div>
                  {studentInsights.attendance.pct !== null && (
                    <Progress
                      value={studentInsights.attendance.pct}
                      className="mt-3 h-1.5 bg-surface-pressed"
                    />
                  )}
                  {typeof studentInsights.attendance.unrecorded === 'number' && studentInsights.attendance.unrecorded > 0 && (
                    <p className="mt-2 text-caption text-status-warning">
                      {studentInsights.attendance.unrecorded} unrecorded session
                      {studentInsights.attendance.unrecorded === 1 ? '' : 's'} not yet counted
                    </p>
                  )}
                </div>

                <div className="rounded-lg bg-surface-default p-4 shadow">
                  <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-status-success-subtle text-status-success">
                      <CheckmarkCircle20Regular aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p className="text-caption text-text-muted">Classes Attended</p>
                      <p className="text-[28px] font-semibold leading-9 tabular-nums text-text-primary">
                        {studentInsights.attendance.attendedClasses}/{studentInsights.attendance.totalClasses}
                      </p>
                      <p className="text-caption text-text-muted">
                        Late arrivals: <span className="tabular-nums">{studentInsights.attendance.lateClasses}</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg bg-surface-default p-4 shadow">
                  <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-status-error-subtle text-status-error">
                      <DismissCircle20Regular aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p className="text-caption text-text-muted">Absent Classes</p>
                      <p className="text-[28px] font-semibold leading-9 tabular-nums text-text-primary">
                        {studentInsights.attendance.absentClasses}
                      </p>
                      <p className="text-caption text-text-muted">
                        Excused: <span className="tabular-nums">{studentInsights.attendance.excusedClasses ?? 0}</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg bg-surface-default p-4 shadow">
                  <div className="flex items-start gap-3">
                    <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-md ${getRiskChipColor(effectiveRisk(studentInsights))}`}>
                      <Target20Regular aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p className="text-caption text-text-muted">Risk Level</p>
                      <span className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-caption-strong ${getRiskBadgeColor(effectiveRisk(studentInsights))}`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
                        {riskLabel(studentInsights)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Charts */}
              {(studentInsights.subjects.length > 0 || (Array.isArray(attendanceTrends) && attendanceTrends.length > 1)) && (
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  {studentInsights.subjects.length > 0 && (
                    <section className="rounded-lg bg-surface-default shadow">
                      <header className="border-b border-border-subtle px-5 py-4">
                        <h3 className="text-subheading text-text-primary">Attendance by subject</h3>
                        <p className="mt-0.5 text-caption text-text-muted">
                          Attendance percentage per subject · line marks the {minimum}% minimum · subjects with no
                          classes yet have no bar
                        </p>
                      </header>
                      <div className="px-3 py-4">
                        <ResponsiveContainer width="100%" height={Math.max(200, studentInsights.subjects.length * 40 + 40)}>
                          <BarChart
                            data={studentInsights.subjects}
                            layout="vertical"
                            margin={{ top: 4, right: 24, bottom: 4, left: 4 }}
                            barCategoryGap={8}
                          >
                            <CartesianGrid horizontal={false} stroke="var(--border-subtle)" />
                            <XAxis
                              type="number"
                              domain={[0, 100]}
                              ticks={[0, 25, 50, 75, 100]}
                              tickFormatter={(value: number) => `${value}%`}
                              tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis
                              type="category"
                              dataKey="subject_code"
                              width={72}
                              tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <Tooltip
                              cursor={{ fill: 'var(--surface-hover)' }}
                              contentStyle={CHART_TOOLTIP_STYLE}
                              labelStyle={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 4 }}
                              itemStyle={{ color: 'var(--text-secondary)' }}
                              labelFormatter={(label, payload) => payload?.[0]?.payload?.subject_name ?? label}
                              formatter={(value: unknown) => [formatPercent(value), 'Attendance']}
                            />
                            <ReferenceLine x={minimum} stroke="var(--status-error)" strokeWidth={1} ifOverflow="extendDomain" />
                            <Bar
                              dataKey="pct"
                              name="Attendance"
                              fill="var(--chart-1)"
                              radius={[0, 4, 4, 0]}
                              maxBarSize={20}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </section>
                  )}

                  {Array.isArray(attendanceTrends) && attendanceTrends.length > 1 && (
                    <section className="rounded-lg bg-surface-default shadow">
                      <header className="border-b border-border-subtle px-5 py-4">
                        <h3 className="text-subheading text-text-primary">Attendance trend</h3>
                        <p className="mt-0.5 text-caption text-text-muted">Daily attendance rate over the last 30 days</p>
                      </header>
                      <div className="px-3 py-4">
                        <ResponsiveContainer width="100%" height={260}>
                          <AreaChart data={attendanceTrends} margin={{ top: 8, right: 24, bottom: 4, left: 4 }}>
                            <CartesianGrid vertical={false} stroke="var(--border-subtle)" />
                            <XAxis
                              dataKey="date"
                              tickFormatter={formatTrendDate}
                              tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                              axisLine={{ stroke: 'var(--border-subtle)' }}
                              tickLine={false}
                              minTickGap={24}
                            />
                            <YAxis
                              domain={[0, 100]}
                              ticks={[0, 25, 50, 75, 100]}
                              tickFormatter={(value: number) => `${value}%`}
                              tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                              axisLine={false}
                              tickLine={false}
                              width={44}
                            />
                            <Tooltip
                              cursor={{ stroke: 'var(--border-default)', strokeWidth: 1 }}
                              contentStyle={CHART_TOOLTIP_STYLE}
                              labelStyle={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 4 }}
                              itemStyle={{ color: 'var(--text-secondary)' }}
                              labelFormatter={(label) => formatTrendDate(String(label))}
                              formatter={(value: unknown) => [formatPercent(value), 'Attendance rate']}
                            />
                            <Area
                              type="monotone"
                              dataKey="attendance_rate"
                              name="Attendance rate"
                              stroke="var(--chart-1)"
                              strokeWidth={2}
                              fill="var(--chart-1)"
                              fillOpacity={0.1}
                              dot={false}
                              activeDot={{ r: 4, fill: 'var(--chart-1)', stroke: 'var(--surface-default)', strokeWidth: 2 }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </section>
                  )}
                </div>
              )}

              {/* Subject-wise Attendance Table */}
              <section className="overflow-hidden rounded-lg bg-surface-default shadow">
                <header className="flex items-center gap-2 border-b border-border-subtle px-5 py-4">
                  <BookOpen20Regular className="text-brand-foreground" aria-hidden />
                  <h3 className="text-subheading text-text-primary">
                    Semester-wise Subject Breakdown
                  </h3>
                </header>
                {studentInsights.subjects && studentInsights.subjects.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-surface-subtle">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="px-4 text-caption-strong normal-case tracking-normal text-text-secondary">Subject</TableHead>
                          <TableHead className="px-4 text-caption-strong normal-case tracking-normal text-text-secondary">Subject Code</TableHead>
                          <TableHead className="px-4 text-center text-caption-strong normal-case tracking-normal text-text-secondary">Total Classes Held</TableHead>
                          <TableHead className="px-4 text-center text-caption-strong normal-case tracking-normal text-text-secondary">Attended</TableHead>
                          <TableHead className="px-4 text-center text-caption-strong normal-case tracking-normal text-text-secondary">Late</TableHead>
                          <TableHead className="px-4 text-center text-caption-strong normal-case tracking-normal text-text-secondary">Absent</TableHead>
                          <TableHead className="px-4 text-center text-caption-strong normal-case tracking-normal text-text-secondary">Attendance %</TableHead>
                          <TableHead className="px-4 text-center text-caption-strong normal-case tracking-normal text-text-secondary">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {studentInsights.subjects.map((subject) => {
                          const band = resolveBand(subject, policyView, subject.pct);
                          return (
                          <TableRow key={subject.subject_id} className="border-b border-border-subtle hover:bg-surface-hover">
                            <TableCell className="px-4 py-2.5 text-body-strong text-text-primary">
                              {subject.subject_name}
                            </TableCell>
                            <TableCell className="px-4 py-2.5 font-mono text-caption text-text-secondary">
                              {subject.subject_code}
                            </TableCell>
                            <TableCell className="px-4 py-2.5 text-center text-body tabular-nums text-text-primary">
                              {subject.total_classes}
                            </TableCell>
                            <TableCell className="px-4 py-2.5 text-center text-body tabular-nums">
                              <span className="font-semibold text-status-success">{subject.attended}</span>
                              {typeof subject.present === 'number' ? (
                                <div className="text-caption text-text-muted">On time: {subject.present}</div>
                              ) : null}
                              {subject.excused ? (
                                <div className="text-caption text-text-muted">Excused: {subject.excused}</div>
                              ) : null}
                            </TableCell>
                            <TableCell className="px-4 py-2.5 text-center text-body font-semibold tabular-nums text-status-warning">
                              {subject.late ?? NO_DATA}
                            </TableCell>
                            <TableCell className="px-4 py-2.5 text-center text-body font-semibold tabular-nums text-status-error">
                              {subject.absent ?? NO_DATA}
                            </TableCell>
                            <TableCell className="px-4 py-2.5 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <span className="w-12 text-right text-body-strong tabular-nums text-text-primary">
                                  {formatPercent(subject.pct)}
                                </span>
                                {subject.pct !== null ? (
                                  <Progress value={subject.pct} className="h-1.5 w-16 bg-surface-pressed" />
                                ) : (
                                  <span className="w-16" aria-hidden />
                                )}
                              </div>
                              {typeof subject.unrecorded === 'number' && subject.unrecorded > 0 && (
                                <div className="text-caption text-status-warning">{subject.unrecorded} unrecorded</div>
                              )}
                            </TableCell>
                            <TableCell className="px-4 py-2.5 text-center">
                              <span
                                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-caption-strong ${
                                  toneClasses[band?.tone ?? 'secondary'].pill
                                }`}
                              >
                                {band ? band.label : 'No data'}
                              </span>
                              {subject.eligibility_provisional && band && (
                                <div className="mt-0.5 text-caption text-text-muted">Provisional</div>
                              )}
                            </TableCell>
                          </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center px-6 py-10 text-center">
                    <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-surface-subtle text-text-muted">
                      <BookOpen24Regular aria-hidden />
                    </div>
                    <p className="text-body text-text-muted">No subject data available</p>
                  </div>
                )}
              </section>

              {/* Decision Support - Action Items */}
              <section className="rounded-lg bg-surface-default shadow">
                <header className="flex flex-col gap-3 border-b border-border-subtle px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <Target20Regular className="text-brand-foreground" aria-hidden />
                    <h3 className="text-subheading text-text-primary">
                      Action Items & Decision Support
                    </h3>
                  </div>
                  <Button
                    onClick={() => setShowAddAction(true)}
                    size="sm"
                    className="self-start sm:self-auto"
                  >
                    <Add16Regular aria-hidden />
                    Add Action
                  </Button>
                </header>
                <div className="p-5">
                  {showAddAction && (
                    <div className="mb-4 rounded-lg border border-border-subtle bg-surface-subtle p-4">
                      <h4 className="mb-4 text-body-strong text-text-primary">Add New Action Item</h4>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div className="flex flex-col gap-1">
                            <label className="text-body-strong text-text-primary">
                              Action Type
                            </label>
                            <Select
                              value={newActionItem.type}
                              onValueChange={(value: ActionItem['type']) =>
                                setNewActionItem(prev => ({ ...prev, type: value }))
                              }
                            >
                              <SelectTrigger className="h-9 bg-surface-default">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="contact_student">Contact Student</SelectItem>
                                <SelectItem value="contact_parent">Contact Parent</SelectItem>
                                <SelectItem value="counseling">Academic Counseling</SelectItem>
                                <SelectItem value="academic_warning">Academic Warning</SelectItem>
                                <SelectItem value="monitoring">Enhanced Monitoring</SelectItem>
                                <SelectItem value="intervention">Intervention</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-body-strong text-text-primary">
                              Priority
                            </label>
                            <Select
                              value={newActionItem.priority}
                              onValueChange={(value: ActionItem['priority']) =>
                                setNewActionItem(prev => ({ ...prev, priority: value }))
                              }
                            >
                              <SelectTrigger className="h-9 bg-surface-default">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="critical">Critical</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-body-strong text-text-primary">
                            Title
                          </label>
                          <Input
                            value={newActionItem.title}
                            onChange={(e) => setNewActionItem(prev => ({ ...prev, title: e.target.value }))}
                            placeholder="Enter action title..."
                            className="bg-surface-default"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-body-strong text-text-primary">
                            Description
                          </label>
                          <Textarea
                            value={newActionItem.description}
                            onChange={(e) => setNewActionItem(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Describe the action needed..."
                            rows={3}
                            className="bg-surface-default"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-body-strong text-text-primary">
                            Due Date
                          </label>
                          <Input
                            type="date"
                            value={newActionItem.due_date}
                            onChange={(e) => setNewActionItem(prev => ({ ...prev, due_date: e.target.value }))}
                            className="bg-surface-default sm:max-w-xs"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button
                            onClick={() => setShowAddAction(false)}
                            variant="outline"
                          >
                            Cancel
                          </Button>
                          <Button onClick={addActionItem}>
                            <Save16Regular aria-hidden />
                            Save Action
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {actionItems.length > 0 ? (
                    <ul className="divide-y divide-border-subtle overflow-hidden rounded-md border border-border-subtle">
                      {actionItems.map((action) => (
                        <li key={action.id} className="flex flex-col gap-3 p-4 transition-colors duration-150 ease-fluent-standard hover:bg-surface-hover sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex flex-1 items-start gap-3">
                            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-brand-subtle text-brand-foreground">
                              {getActionIcon(action.type)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="mb-1 flex flex-wrap items-center gap-2">
                                <h4 className="text-body-strong text-text-primary">{action.title}</h4>
                                <span className={`inline-flex items-center rounded-full border px-2 py-px text-caption-strong capitalize ${getPriorityColor(action.priority)}`}>
                                  {action.priority}
                                </span>
                                <span className={`inline-flex items-center rounded-full border px-2 py-px text-caption-strong capitalize ${getStatusColor(action.status)}`}>
                                  {action.status.replace('_', ' ')}
                                </span>
                              </div>
                              <p className="mb-2 text-body text-text-secondary">{action.description}</p>
                              <div className="flex flex-wrap items-center gap-4 text-caption text-text-muted">
                                <span>Due: {action.due_date}</span>
                                <span>Created: {new Date(action.created_at).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-1 sm:ml-4">
                            {action.status === 'pending' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateActionStatus(action.id, 'in_progress')}
                              >
                                Start
                              </Button>
                            )}
                            {action.status === 'in_progress' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateActionStatus(action.id, 'completed')}
                              >
                                <CheckmarkCircle16Regular className="text-status-success" aria-hidden />
                                Complete
                              </Button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="flex flex-col items-center py-8 text-center">
                      <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-surface-subtle text-text-muted">
                        <Target24Regular aria-hidden />
                      </div>
                      <p className="text-subheading text-text-primary">No action items yet</p>
                      <p className="mt-1 text-body text-text-muted">Action items will be automatically generated based on attendance patterns</p>
                    </div>
                  )}
                </div>
              </section>

              {/* Insights and Recommendations */}
              <section className="rounded-lg bg-surface-default shadow">
                <header className="flex items-center gap-2 border-b border-border-subtle px-5 py-4">
                  <Sparkle20Regular className="text-brand-foreground" aria-hidden />
                  <h3 className="text-subheading text-text-primary">
                    AI Insights & Recommendations
                  </h3>
                </header>
                <div className="p-5">
                  {studentInsights.recommendations.length > 0 ? (
                    <div className="space-y-2">
                      {studentInsights.recommendations.map((recommendation, index) => (
                        <div
                          key={index}
                          role="status"
                          className="flex items-start gap-2 rounded-md border border-status-info-border bg-status-info-subtle px-3 py-2 text-body text-text-primary"
                        >
                          <Info16Regular className="mt-0.5 shrink-0 text-status-info" aria-hidden />
                          <p>{recommendation}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center py-8 text-center">
                      <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-surface-subtle text-text-muted">
                        <Sparkle24Regular aria-hidden />
                      </div>
                      <p className="text-body text-text-muted">No specific recommendations available</p>
                    </div>
                  )}
                </div>
              </section>

              {/* Quick Decision Summary */}
              <section className="rounded-lg bg-surface-default shadow">
                <header className="flex items-center gap-2 border-b border-border-subtle px-5 py-4">
                  <Target20Regular className="text-brand-foreground" aria-hidden />
                  <h3 className="text-subheading text-text-primary">
                    Decision Summary
                  </h3>
                </header>
                <div className="p-5">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="rounded-md border border-border-subtle bg-surface-subtle p-4">
                      <p className="text-caption text-text-muted">Total Action Items</p>
                      <p className="text-[28px] font-semibold leading-9 tabular-nums text-text-primary">{actionItems.length}</p>
                      <p className="text-caption text-text-muted">
                        {actionItems.filter(item => item.status === 'pending').length} pending
                      </p>
                    </div>
                    <div className="rounded-md border border-border-subtle bg-surface-subtle p-4">
                      <p className="text-caption text-text-muted">Critical Actions</p>
                      <p className="text-[28px] font-semibold leading-9 tabular-nums text-status-error">
                        {actionItems.filter(item => item.priority === 'critical').length}
                      </p>
                      <p className="text-caption text-text-muted">
                        Require immediate attention
                      </p>
                    </div>
                    <div className="rounded-md border border-border-subtle bg-surface-subtle p-4">
                      <p className="text-caption text-text-muted">Completion Rate</p>
                      <p className="text-[28px] font-semibold leading-9 tabular-nums text-status-success">
                        {actionItems.length > 0
                          ? Math.round((actionItems.filter(item => item.status === 'completed').length / actionItems.length) * 100)
                          : 0
                        }%
                      </p>
                      <p className="text-caption text-text-muted">
                        Actions completed
                      </p>
                    </div>
                  </div>

                  {(studentInsights.trends.recentAverage !== undefined && studentInsights.trends.recentAverage !== null) && (
                    <div className="mt-4 text-body text-text-secondary">
                      Recent 7-day attendance average: <span className="font-semibold tabular-nums text-text-primary">{formatPercentage(studentInsights.trends.recentAverage)}%</span>
                      {studentInsights.trends.previousAverage !== undefined && studentInsights.trends.previousAverage !== null
                        ? ` (previous: ${formatPercentage(studentInsights.trends.previousAverage)}%)`
                        : ''}
                      {studentInsights.trends.change !== undefined && studentInsights.trends.change !== null
                        ? ` • Change: ${formatDelta(studentInsights.trends.change)}%`
                        : ''}
                    </div>
                  )}

                  {studentInsights.trends.improving && (
                    <div role="status" className="mt-4 flex items-start gap-2 rounded-md border border-status-success-border bg-status-success-subtle px-3 py-2 text-body text-text-primary">
                      <ArrowTrending16Regular className="mt-0.5 shrink-0 text-status-success" aria-hidden />
                      <p>
                        Attendance has improved over the last week. Keep reinforcing the positive habits that led to this change.
                      </p>
                    </div>
                  )}

                  {studentInsights.trends.declining && (
                    <div role="status" className="mt-4 flex items-start gap-2 rounded-md border border-status-warning-border bg-status-warning-subtle px-3 py-2 text-body text-text-primary">
                      <ArrowTrendingDown16Regular className="mt-0.5 shrink-0 text-status-warning" aria-hidden />
                      <p>
                        Attendance is trending downward compared to the previous week. Review recent absences and plan corrective actions.
                      </p>
                    </div>
                  )}

                  {studentInsights.attendance.pct !== null &&
                    resolveBand(studentInsights.attendance, policyView, studentInsights.attendance.pct)?.tone === 'destructive' && (
                    <div role="alert" className="mt-4 flex items-start gap-2 rounded-md border border-status-error-border bg-status-error-subtle px-3 py-2 text-body text-text-primary">
                      <ErrorCircle16Regular className="mt-0.5 shrink-0 text-status-error" aria-hidden />
                      <p>
                        <strong className="font-semibold">Critical Alert:</strong> Student attendance is below the {minimum}% minimum requirement.
                        Immediate intervention and academic warning may be necessary.
                      </p>
                    </div>
                  )}
                </div>
              </section>

              {/* Teacher Notes */}
              <section className="rounded-lg bg-surface-default shadow">
                <header className="flex items-center gap-2 border-b border-border-subtle px-5 py-4">
                  <Note20Regular className="text-brand-foreground" aria-hidden />
                  <h3 className="text-subheading text-text-primary">
                    Teacher Notes & Decision Log
                  </h3>
                </header>
                <div className="space-y-4 p-5">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="isa-teacher-notes" className="text-body-strong text-text-primary">
                      Add Notes (decisions made, observations, etc.)
                    </label>
                    <Textarea
                      id="isa-teacher-notes"
                      value={teacherNotes}
                      onChange={(e) => setTeacherNotes(e.target.value)}
                      placeholder="Record your observations, decisions made, and follow-up actions..."
                      rows={4}
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      onClick={() => {
                        // Save notes logic would go here
                        toast({
                          title: "Notes Saved",
                          description: "Teacher notes have been recorded",
                        });
                        setTeacherNotes('');
                      }}
                    >
                      <Save16Regular aria-hidden />
                      Save Notes
                    </Button>
                  </div>
                </div>
              </section>
            </>
          ) : (
            <div className="flex flex-col items-center rounded-lg bg-surface-default px-6 py-12 text-center shadow">
              <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-surface-subtle text-text-muted">
                <Warning24Regular aria-hidden />
              </div>
              <p className="text-subheading text-text-primary">No analysis data available</p>
              <p className="mt-1 text-body text-text-muted">
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
