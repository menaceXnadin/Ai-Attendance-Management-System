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
              <span className={`px-2 py-1 rounded-full text-xs ${
                record.status === 'present' ? 'bg-green-100 text-green-800' :
                record.status === 'absent' ? 'bg-red-100 text-red-800' :
                record.status === 'excused' ? 'bg-purple-100 text-purple-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default AttendanceTable;
