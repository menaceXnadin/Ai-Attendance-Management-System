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
  searchQuery?: string;
  statusFilter?: string;
  selectedClass?: string;
  classes?: Array<{id: string; name: string}>;
  currentPage?: number;
  pageSize?: number;
  totalRecords?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

const AttendanceTable: React.FC<AttendanceTableProps> = ({ 
  loading, 
  records,
  searchQuery = '',
  statusFilter = 'all',
  selectedClass = '',
  classes = [],
  currentPage = 1,
  pageSize = 10,
  totalRecords = 0,
  onPageChange,
  onPageSizeChange
}) => {
  // Server already returns paginated records; just render provided page
  const paginatedRecords = records;
  const total = totalRecords ?? records.length;
  const totalPages = Math.max(1, Math.ceil(total / (pageSize || 1)));
  
  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="animate-spin h-8 w-8 mr-2" />
        <span>Loading attendance records...</span>
      </div>
    );
  }

  if (!loading && total === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <CalendarIcon className="mx-auto h-12 w-12 opacity-30 mb-2" />
        <p className="text-lg">
          {searchQuery || statusFilter !== 'all' || (selectedClass && selectedClass !== 'all')
            ? 'No records match your filters' 
            : 'No attendance records found for the selected criteria'}
        </p>
        <p className="text-sm">
          {searchQuery || statusFilter !== 'all' || (selectedClass && selectedClass !== 'all')
            ? 'Try adjusting your search or filters'
            : 'Try selecting a different class or date'}
        </p>
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
        {paginatedRecords.map((record) => (
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
    
    {/* Pagination Controls */}
    {total > 0 && (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 border-t border-slate-700/50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-300">Show</label>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
              className="px-3 py-1.5 rounded bg-slate-800 text-white border border-slate-600 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <label className="text-sm text-slate-300">entries</label>
          </div>
          
          <div className="text-sm text-slate-300">
            <span>Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, total)} of {total}</span>
            {searchQuery && totalRecords && totalRecords > total && (
              <span className="text-slate-400 ml-1">({totalRecords} total)</span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange?.(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-1.5 rounded bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              
              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange?.(pageNum)}
                  className={`px-3 py-1.5 rounded transition-colors ${
                    currentPage === pageNum
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          
          <button
            onClick={() => onPageChange?.(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 rounded bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    )}
    </div>
  );
};

export default AttendanceTable;
