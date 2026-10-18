import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowDownload20Regular, DocumentPdf20Regular, Checkmark16Regular } from '@fluentui/react-icons';
import { useToast } from '@/hooks/use-toast';
import { formatPercent } from '@/components/attendance-admin/metrics';

interface PDFExportProps {
  studentData: {
    name: string;
    id: string;
    class: string;
    email: string;
  };
  attendanceData: {
    /** `null` when there are no countable classes (renders "—"). */
    percentage: number | null;
    total: number;
    present: number;
    absent: number;
    late: number;
  };
  marksData: Array<{
    subject: string;
    marks: number;
    totalMarks: number;
    grade: string;
    percentage: number;
  }>;
}

const PDFExportCard: React.FC<PDFExportProps> = ({
  studentData,
  attendanceData,
  marksData
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const generatePDF = async () => {
    setIsExporting(true);
    
    try {
      // Simulate PDF generation delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // In a real implementation, you would use a library like jsPDF or react-pdf
      // For now, we'll create a simple HTML document and trigger download
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Academic Report - ${studentData.name}</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 40px; 
              color: #333;
              line-height: 1.6;
            }
            .header { 
              text-align: center; 
              border-bottom: 2px solid #3b82f6; 
              padding-bottom: 20px; 
              margin-bottom: 30px;
            }
            .logo { 
              font-size: 24px; 
              font-weight: bold; 
              color: #3b82f6; 
              margin-bottom: 10px;
            }
            .student-info { 
              background: #f8fafc; 
              padding: 20px; 
              border-radius: 8px; 
              margin-bottom: 30px;
            }
            .section { 
              margin-bottom: 30px;
            }
            .section-title { 
              font-size: 18px; 
              font-weight: bold; 
              color: #1e40af; 
              border-bottom: 1px solid #e2e8f0; 
              padding-bottom: 5px;
              margin-bottom: 15px;
            }
            .stats-grid { 
              display: grid; 
              grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
              gap: 15px; 
              margin-bottom: 20px;
            }
            .stat-card { 
              background: #f1f5f9; 
              padding: 15px; 
              border-radius: 6px; 
              text-align: center;
            }
            .stat-value { 
              font-size: 24px; 
              font-weight: bold; 
              color: #059669;
            }
            .stat-label { 
              font-size: 12px; 
              color: #64748b; 
              margin-top: 5px;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-top: 10px;
            }
            th, td { 
              padding: 12px; 
              text-align: left; 
              border-bottom: 1px solid #e2e8f0;
            }
            th { 
              background: #f8fafc; 
              font-weight: 600;
            }
            .grade { 
              padding: 4px 8px; 
              border-radius: 4px; 
              font-size: 12px; 
              font-weight: bold;
            }
            .grade-a { background: #dcfce7; color: #166534; }
            .grade-b { background: #fef3c7; color: #92400e; }
            .grade-c { background: #fee2e2; color: #991b1b; }
            .footer { 
              text-align: center; 
              margin-top: 40px; 
              padding-top: 20px; 
              border-top: 1px solid #e2e8f0; 
              color: #64748b; 
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">AttendAI</div>
            <h1>Academic Report</h1>
            <p>Generated on ${new Date().toLocaleDateString()}</p>
          </div>

          <div class="student-info">
            <h2>Student Information</h2>
            <p><strong>Name:</strong> ${studentData.name}</p>
            <p><strong>Student ID:</strong> ${studentData.id}</p>
            <p><strong>Class:</strong> ${studentData.class}</p>
            <p><strong>Email:</strong> ${studentData.email}</p>
          </div>

          <div class="section">
            <h2 class="section-title">Attendance Summary</h2>
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-value">${formatPercent(attendanceData.percentage)}</div>
                <div class="stat-label">Overall Attendance</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">${attendanceData.present}</div>
                <div class="stat-label">Classes Present</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">${attendanceData.absent}</div>
                <div class="stat-label">Classes Absent</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">${attendanceData.late}</div>
                <div class="stat-label">Late Arrivals</div>
              </div>
            </div>
          </div>

          <div class="section">
            <h2 class="section-title">Academic Performance</h2>
            <table>
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Marks</th>
                  <th>Total</th>
                  <th>Percentage</th>
                  <th>Grade</th>
                </tr>
              </thead>
              <tbody>
                ${marksData.map(subject => `
                  <tr>
                    <td>${subject.subject}</td>
                    <td>${subject.marks}</td>
                    <td>${subject.totalMarks}</td>
                    <td>${formatPercent(subject.percentage)}</td>
                    <td><span class="grade grade-${subject.grade.charAt(0).toLowerCase()}">${subject.grade}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="footer">
            <p>This report was generated by AttendAI Academic Management System</p>
            <p>For any queries, please contact your academic advisor</p>
          </div>
        </body>
        </html>
      `;

      // Create and trigger download
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Academic_Report_${studentData.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Report Generated",
        description: "Your academic report has been downloaded successfully.",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "There was an error generating your report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card className="border-0 bg-surface-default shadow">
      <CardHeader className="flex-row items-start gap-3 space-y-0 px-5 py-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-brand-subtle text-brand-foreground">
          <DocumentPdf20Regular aria-hidden />
        </div>
        <div className="min-w-0">
          <CardTitle className="text-subheading text-text-primary">
            Export Academic Report
          </CardTitle>
          <CardDescription className="text-caption text-text-muted">
            Download a comprehensive PDF report of your academic performance
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-5 pb-5">
        <div className="space-y-2 rounded-md border border-border-subtle bg-surface-subtle p-4">
          <h4 className="text-body-strong text-text-primary">Report includes:</h4>
          <ul className="space-y-1.5 text-body text-text-secondary">
            {['Complete attendance summary', 'Subject-wise marks and grades', 'Performance analytics', 'Official institutional header'].map(item => (
              <li key={item} className="flex items-center gap-2">
                <Checkmark16Regular className="shrink-0 text-status-success" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <Button
          onClick={generatePDF}
          disabled={isExporting}
          className="w-full"
        >
          {isExporting ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
              Generating Report...
            </>
          ) : (
            <>
              <ArrowDownload20Regular aria-hidden />
              Download PDF Report
            </>
          )}
        </Button>

        <p className="text-center text-caption text-text-muted">
          Report will be saved as HTML format (PDF library integration recommended for production)
        </p>
      </CardContent>
    </Card>
  );
};

export default PDFExportCard;
