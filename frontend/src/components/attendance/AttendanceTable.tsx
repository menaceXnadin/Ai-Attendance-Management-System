import React from 'react';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { format } from 'date-fns';
import { Loader2, CalendarIcon } from 'lucide-react';

interface AttendanceRecord {
  id: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  studentName: string;
  studentRollNo: string;
  studentId: string;
  className: string;
}

interface AttendanceTableProps {
  loading: boolean;
  records: AttendanceRecord[];
}

const AttendanceTable: React.FC<AttendanceTableProps> = ({ loading, records }) => {
  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="animate-spin h-8 w-8 mr-2" />
        <span>Loading attendance records...</span>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <CalendarIcon className="mx-auto h-12 w-12 opacity-30 mb-2" />
        <p className="text-lg">No attendance records found for the selected criteria</p>
        <p className="text-sm">Try selecting a different class or date</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-700/50 overflow-hidden bg-slate-950/50">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Student</TableHead>
          <TableHead>Roll No</TableHead>
          <TableHead>Class</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((record) => (
          <TableRow key={record.id}>
            <TableCell>{record.studentName}</TableCell>
            <TableCell>{record.studentRollNo}</TableCell>
            <TableCell>{record.className}</TableCell>
            <TableCell>{format(new Date(record.date), 'PP')}</TableCell>
            <TableCell>
              <span className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ${
                record.status === 'present' ? 'bg-green-500/20 text-green-300 border-green-500/30 hover:bg-green-500/30' :
                record.status === 'absent' ? 'bg-red-500/20 text-red-300 border-red-500/30 hover:bg-red-500/30' :
                record.status === 'excused' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30 hover:bg-purple-500/30' :
                'bg-blue-500/20 text-blue-300 border-blue-500/30 hover:bg-blue-500/30'
              }`}>
                {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    </div>
  );
};

export default AttendanceTable;
