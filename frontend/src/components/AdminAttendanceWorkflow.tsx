import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  CalendarIcon,
  Users,
  BookOpen,
  CheckCircle,
  XCircle,
  Save,
  Loader2,
} from "lucide-react";
import { api } from "@/integrations/api/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { DayPicker } from "react-day-picker";

interface Faculty {
  id: number;
  name: string;
  description?: string;
}

interface Subject {
  id: number;
  name: string;
  code: string;
  description?: string;
  faculty_id: number;
}

interface StudentWithAttendance {
  id: number;
  student_id: string;
  name: string;
  email: string;
  semester: number;
  faculty_id: number;
  attendance_status: "present" | "absent" | "late";
  date: string;
}

interface AttendanceResponse {
  date: string;
  faculty_id: number;
  semester: number;
  subject_id: number;
  students: StudentWithAttendance[];
  total_students: number;
  present_count: number;
  absent_count: number;
}

const AdminAttendanceWorkflow: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State management
  const [selectedFaculty, setSelectedFaculty] = useState<number | null>(null);
  const [selectedSemester, setSelectedSemester] = useState<number | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [studentAttendance, setStudentAttendance] = useState<
    Record<number, string>
  >({});

  // Fetch faculties
  const { data: faculties = [], isLoading: facultiesLoading } = useQuery({
    queryKey: ["faculties"],
    queryFn: () => api.faculties.getAll(),
  });

  // Fetch subjects based on selected faculty
  const { data: subjects = [], isLoading: subjectsLoading } = useQuery({
    queryKey: ["subjects", selectedFaculty],
    queryFn: () =>
      api.subjects.getByFacultySemester(
        selectedFaculty!,
        selectedSemester || undefined
      ),
    enabled: !!selectedFaculty,
  });

  // Fetch students by subject
  const {
    data: attendanceData,
    isLoading: attendanceLoading,
    refetch: refetchAttendance,
  } = useQuery({
    queryKey: [
      "attendance-by-subject",
      selectedFaculty,
      selectedSemester,
      selectedSubject,
      selectedDate,
    ],
    queryFn: () =>
      api.attendanceAdmin.getStudentsBySubject(
        selectedFaculty!,
        selectedSemester!,
        selectedSubject!,
        selectedDate
      ),
    enabled: !!(selectedFaculty && selectedSemester && selectedSubject),
  });

  // Bulk attendance mutation
  const markAttendanceMutation = useMutation({
    mutationFn: api.attendanceAdmin.markBulkAttendance,
    onSuccess: () => {
      toast({
        title: "Attendance Marked",
        description:
          "Attendance has been successfully updated for all selected students.",
      });
      refetchAttendance();
      queryClient.invalidateQueries({ queryKey: ["attendance-summary"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to mark attendance. Please try again.",
        variant: "destructive",
      });
      console.error("Attendance marking error:", error);
    },
  });

  // Reset dependent selections when parent selection changes
  useEffect(() => {
    setSelectedSemester(null);
    setSelectedSubject(null);
  }, [selectedFaculty]);

  useEffect(() => {
    setSelectedSubject(null);
  }, [selectedSemester]);

  useEffect(() => {
    if (attendanceData?.students) {
      const initialAttendance: Record<number, string> = {};
      attendanceData.students.forEach((student) => {
        initialAttendance[student.id] = student.attendance_status;
      });
      setStudentAttendance(initialAttendance);
    }
  }, [attendanceData]);

  const handleAttendanceChange = (studentId: number, status: string) => {
    setStudentAttendance((prev) => ({
      ...prev,
      [studentId]: status,
    }));
  };

  const handleMarkAllPresent = () => {
    if (attendanceData?.students) {
      const allPresent: Record<number, string> = {};
      attendanceData.students.forEach((student) => {
        allPresent[student.id] = "present";
      });
      setStudentAttendance(allPresent);
    }
  };

  const handleMarkAllAbsent = () => {
    if (attendanceData?.students) {
      const allAbsent: Record<number, string> = {};
      attendanceData.students.forEach((student) => {
        allAbsent[student.id] = "absent";
      });
      setStudentAttendance(allAbsent);
    }
  };

  const handleSaveAttendance = async () => {
    if (!selectedSubject || !attendanceData?.students) return;

    const studentsData = attendanceData.students.map((student) => ({
      student_id: student.id,
      status: studentAttendance[student.id] || "absent",
    }));

    const attendancePayload = {
      subject_id: selectedSubject,
      date: selectedDate,
      students: studentsData,
    };

    markAttendanceMutation.mutate(attendancePayload);
  };

  const semesters = [1, 2, 3, 4, 5, 6, 7, 8];

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "present":
        return "bg-green-500/20 text-green-300 border-green-400/30";
      case "late":
        return "bg-yellow-500/20 text-yellow-300 border-yellow-400/30";
      case "absent":
        return "bg-red-500/20 text-red-300 border-red-400/30";
      default:
        return "bg-gray-500/20 text-gray-300 border-gray-400/30";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-blue-100 to-blue-200 bg-clip-text text-transparent">
            Attendance Management
          </h1>
          <p className="text-blue-200/80 mt-2">
            Manage student attendance by faculty, semester, and subject
          </p>
        </div>
        <Badge
          variant="outline"
          className="bg-blue-500/20 text-blue-300 border-blue-400/30"
        >
          <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-blue-600 mr-2">
            <CalendarIcon className="h-4 w-4 text-white fill-white" />
          </span>
          {format(new Date(selectedDate), "PPP")}
        </Badge>
      </div>

      {/* Selection Controls */}
      <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-400" />
            Select Faculty, Semester & Subject
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            Date Selection
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between bg-slate-800 border-slate-600 hover:bg-slate-700 h-10 relative group !text-white"
                  >
                    <span className="flex items-center">
                      {selectedDate
                        ? format(new Date(selectedDate), "MM/dd/yyyy")
                        : "Pick a date"}
                    </span>
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="opacity-90 group-hover:opacity-100 transition-opacity text-white"
                    >
                      <rect
                        x="3"
                        y="4"
                        width="18"
                        height="18"
                        rx="2"
                        ry="2"
                      ></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto p-0 bg-slate-800 border-slate-600 shadow-2xl"
                  align="start"
                >
                  <style>{`
                    .rdp {
                      margin: 0 !important;
                    }
                    .rdp-nav_button {
                      color: #ffffff !important;
                      background-color: #334155 !important;
                      border: 1px solid #475569 !important;
                    }
                    .rdp-nav_button:hover {
                      background-color: #475569 !important;
                    }
                    .rdp-caption_label {
                      color: #ffffff !important;
                      font-weight: 600 !important;
                    }
                    .rdp-head_cell {
                      color: #cbd5e1 !important;
                    }
                    .rdp-day {
                      color: #ffffff !important;
                      border: 1px solid transparent !important;
                    }
                    .rdp-day:hover {
                      background-color: #475569 !important;
                      border-color: #64748b !important;
                    }
                    .rdp-day_selected {
                      background-color: #2563eb !important;
                      color: #ffffff !important;
                      border-color: #3b82f6 !important;
                    }
                    .rdp-day_today {
                      background-color: #334155 !important;
                      font-weight: bold !important;
                    }
                    .rdp-day_outside {
                      color: #64748b !important;
                    }
                  `}</style>
                  <div className="p-4 bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg">
                    <DayPicker
                      mode="single"
                      selected={
                        selectedDate ? new Date(selectedDate) : undefined
                      }
                      onSelect={(date) => {
                        if (date)
                          setSelectedDate(date.toISOString().split("T")[0]);
                      }}
                      className="text-white rdp-custom"
                      showOutsideDays={false}
                    />
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            Faculty Selection
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                Faculty
              </label>
              <Select
                value={selectedFaculty?.toString() || ""}
                onValueChange={(value) => setSelectedFaculty(parseInt(value))}
              >
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                  <SelectValue placeholder="Select Faculty" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  {facultiesLoading ? (
                    <SelectItem value="loading">
                      Loading faculties...
                    </SelectItem>
                  ) : (
                    faculties.map((faculty: Faculty) => (
                      <SelectItem
                        key={faculty.id}
                        value={faculty.id.toString()}
                      >
                        {faculty.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Semester Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                Semester
              </label>
              <Select
                value={selectedSemester?.toString() || ""}
                onValueChange={(value) => setSelectedSemester(parseInt(value))}
                disabled={!selectedFaculty}
              >
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                  <SelectValue placeholder="Select Semester" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  {semesters.map((semester) => (
                    <SelectItem key={semester} value={semester.toString()}>
                      Semester {semester}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subject Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                Subject
              </label>
              <Select
                value={selectedSubject?.toString() || ""}
                onValueChange={(value) => setSelectedSubject(parseInt(value))}
                disabled={!selectedFaculty || !selectedSemester}
              >
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                  <SelectValue placeholder="Select Subject" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  {subjectsLoading ? (
                    <SelectItem value="loading">Loading subjects...</SelectItem>
                  ) : (
                    subjects.map((subject: Subject) => (
                      <SelectItem
                        key={subject.id}
                        value={subject.id.toString()}
                      >
                        {subject.name} ({subject.code})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Students List with Attendance */}
      {selectedFaculty && selectedSemester && selectedSubject && (
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-green-400" />
                Student Attendance
                {attendanceData && (
                  <Badge className="ml-2 bg-blue-500/20 text-blue-300">
                    {attendanceData.total_students} students
                  </Badge>
                )}
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  onClick={handleMarkAllPresent}
                  variant="outline"
                  size="sm"
                  className="border-green-600 text-green-300 hover:bg-green-800"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Mark All Present
                </Button>
                <Button
                  onClick={handleMarkAllAbsent}
                  variant="outline"
                  size="sm"
                  className="border-red-600 text-red-300 hover:bg-red-800"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Mark All Absent
                </Button>
                <Button
                  onClick={handleSaveAttendance}
                  disabled={markAttendanceMutation.isPending}
                  className="bg-gradient-to-r from-blue-500 to-teal-400 hover:from-blue-600 hover:to-teal-500 text-white"
                >
                  {markAttendanceMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Attendance
                </Button>
              </div>
            </div>
            {attendanceData && (
              <div className="flex gap-4 text-sm text-slate-400">
                <span>
                  Present:{" "}
                  {
                    Object.values(studentAttendance).filter(
                      (s) => s === "present"
                    ).length
                  }
                </span>
                <span>
                  Absent:{" "}
                  {
                    Object.values(studentAttendance).filter(
                      (s) => s === "absent"
                    ).length
                  }
                </span>
                <span>
                  Late:{" "}
                  {
                    Object.values(studentAttendance).filter((s) => s === "late")
                      .length
                  }
                </span>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {attendanceLoading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                <span className="ml-2 text-slate-400">Loading students...</span>
              </div>
            ) : attendanceData?.students.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700">
                    <TableHead className="text-slate-300">Student ID</TableHead>
                    <TableHead className="text-slate-300">Name</TableHead>
                    <TableHead className="text-slate-300">Email</TableHead>
                    <TableHead className="text-slate-300 text-center">
                      Attendance Status
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceData.students.map(
                    (student: StudentWithAttendance) => (
                      <TableRow
                        key={student.id}
                        className="border-slate-700 hover:bg-slate-800/50"
                      >
                        <TableCell className="text-white font-medium">
                          {student.student_id}
                        </TableCell>
                        <TableCell className="text-white">
                          {student.name}
                        </TableCell>
                        <TableCell className="text-slate-400">
                          {student.email}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="flex gap-1">
                              {["present", "absent", "late"].map((status) => (
                                <label
                                  key={status}
                                  className="flex items-center gap-1 cursor-pointer"
                                >
                                  <input
                                    type="radio"
                                    name={`attendance-${student.id}`}
                                    value={status}
                                    checked={
                                      studentAttendance[student.id] === status
                                    }
                                    onChange={() =>
                                      handleAttendanceChange(student.id, status)
                                    }
                                    className="sr-only"
                                  />
                                  <Badge
                                    className={`px-2 py-1 cursor-pointer transition-all ${
                                      studentAttendance[student.id] === status
                                        ? getStatusBadgeColor(status)
                                        : "bg-slate-700/50 text-slate-400 border-slate-600/50"
                                    }`}
                                  >
                                    {status.charAt(0).toUpperCase() +
                                      status.slice(1)}
                                  </Badge>
                                </label>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  )}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-slate-400">
                <Users className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p className="font-medium">No students found</p>
                <p className="text-sm">
                  No students are enrolled in the selected faculty and semester
                  combination.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      {!selectedFaculty && (
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
          <CardContent className="text-center py-12">
            <Users className="h-16 w-16 mx-auto mb-4 text-slate-500 opacity-30" />
            <h3 className="text-xl font-semibold text-white mb-2">
              Welcome to Attendance Management
            </h3>
            <p className="text-slate-400 mb-4">
              Please follow the workflow: Select Faculty → Semester → Subject to
              view and manage student attendance.
            </p>
            <div className="flex items-center justify-center gap-4 text-sm text-slate-500">
              <span className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs">
                  1
                </span>
                Choose Faculty
              </span>
              <span>→</span>
              <span className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs">
                  2
                </span>
                Select Semester
              </span>
              <span>→</span>
              <span className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs">
                  3
                </span>
                Pick Subject
              </span>
              <span>→</span>
              <span className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs">
                  4
                </span>
                Mark Attendance
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminAttendanceWorkflow;
