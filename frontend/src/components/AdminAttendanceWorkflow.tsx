import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  CalendarLtr16Regular,
  People20Regular,
  Checkmark16Regular,
  ClipboardTaskListLtr24Regular,
} from "@fluentui/react-icons";
import { api } from "@/integrations/api/client";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import DateSessionRegister from "@/components/attendance-admin/DateSessionRegister";
import TermStateBanner from "@/components/layout/TermStateBanner";

/** `YYYY-MM-DD` in the browser's local calendar (avoids the UTC shift of toISOString). */
const toLocalDateString = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Parses `YYYY-MM-DD` as a local date. */
const fromLocalDateString = (value: string) => new Date(`${value}T00:00:00`);

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

const AdminAttendanceWorkflow: React.FC = () => {
  // State management
  const [selectedFaculty, setSelectedFaculty] = useState<number | null>(null);
  const [selectedSemester, setSelectedSemester] = useState<number | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(toLocalDateString(new Date()));

  // Fetch faculties
  const { data: faculties = [], isLoading: facultiesLoading } = useQuery({
    queryKey: ["faculties"],
    queryFn: () => api.faculties.getAll(),
  });

  // Fetch subjects based on selected faculty
  const { data: subjects = [], isLoading: subjectsLoading } = useQuery({
    queryKey: ["subjects", selectedFaculty, selectedSemester],
    queryFn: () =>
      api.subjects.getByFacultySemester(
        selectedFaculty!,
        selectedSemester || undefined
      ),
    enabled: !!selectedFaculty,
  });

  // Reset dependent selections when parent selection changes
  useEffect(() => {
    setSelectedSemester(null);
    setSelectedSubject(null);
  }, [selectedFaculty]);

  useEffect(() => {
    setSelectedSubject(null);
  }, [selectedSemester]);

  const semesters = [1, 2, 3, 4, 5, 6, 7, 8];

  const steps = [
    { label: "Choose Faculty", done: !!selectedFaculty },
    { label: "Select Semester", done: !!selectedSemester },
    { label: "Pick Subject", done: !!selectedSubject },
    { label: "Mark Attendance", done: false },
  ];
  const currentStep = steps.findIndex((step) => !step.done);

  return (
    <div className="space-y-4">
      <div className="page-header mb-2">
        <div>
          <h1 className="text-page-title text-text-primary">
            Attendance Management
          </h1>
          <p className="mt-1 text-body text-text-muted">
            Manage student attendance by faculty, semester, and subject
          </p>
        </div>
        <span className="inline-flex h-8 items-center gap-2 rounded-full border border-border-subtle bg-surface-default px-3 text-body text-text-secondary shadow-sm">
          <CalendarLtr16Regular className="text-brand-foreground" aria-hidden />
          {format(fromLocalDateString(selectedDate), "PPP")}
        </span>
      </div>

      <TermStateBanner showSetupLink />

      {/* Stepper */}
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-3 rounded-lg bg-surface-default px-5 py-4 shadow">
        {steps.map((step, index) => {
          const isCurrent = index === currentStep;
          return (
            <li key={step.label} className="flex items-center gap-2">
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-caption-strong ${
                  step.done
                    ? "bg-brand text-brand-on"
                    : isCurrent
                    ? "border-2 border-brand text-brand-foreground"
                    : "border border-border-default text-text-muted"
                }`}
              >
                {step.done ? <Checkmark16Regular aria-hidden /> : index + 1}
              </span>
              <span
                className={`text-body ${
                  step.done || isCurrent
                    ? "font-semibold text-text-primary"
                    : "text-text-muted"
                }`}
              >
                {step.label}
              </span>
              {index < steps.length - 1 && (
                <span
                  className={`mx-2 hidden h-px w-10 sm:block ${
                    step.done ? "bg-brand" : "bg-border-default"
                  }`}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>

      {/* Selection Controls */}
      <section className="rounded-lg bg-surface-default shadow">
        <header className="flex items-center gap-2 border-b border-border-subtle px-5 py-4">
          <People20Regular className="text-brand-foreground" aria-hidden />
          <h2 className="text-subheading text-text-primary">
            Select Faculty, Semester & Subject
          </h2>
        </header>
        <div className="p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Date Selection */}
            <div className="flex flex-col gap-1">
              <label className="text-body-strong text-text-primary">Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-9 w-full justify-between px-3 font-normal"
                  >
                    <span className="flex items-center">
                      {selectedDate
                        ? format(fromLocalDateString(selectedDate), "MM/dd/yyyy")
                        : "Pick a date"}
                    </span>
                    <CalendarLtr16Regular className="text-text-muted" aria-hidden />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={
                      selectedDate ? fromLocalDateString(selectedDate) : undefined
                    }
                    onSelect={(date) => {
                      if (date)
                        setSelectedDate(toLocalDateString(date));
                    }}
                    showOutsideDays={false}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Faculty Selection */}
            <div className="flex flex-col gap-1">
              <label className="text-body-strong text-text-primary">
                Faculty
              </label>
              <Select
                value={selectedFaculty?.toString() || ""}
                onValueChange={(value) => setSelectedFaculty(parseInt(value))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select Faculty" />
                </SelectTrigger>
                <SelectContent>
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
            <div className="flex flex-col gap-1">
              <label className="text-body-strong text-text-primary">
                Semester
              </label>
              <Select
                value={selectedSemester?.toString() || ""}
                onValueChange={(value) => setSelectedSemester(parseInt(value))}
                disabled={!selectedFaculty}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select Semester" />
                </SelectTrigger>
                <SelectContent>
                  {semesters.map((semester) => (
                    <SelectItem key={semester} value={semester.toString()}>
                      Semester {semester}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subject Selection */}
            <div className="flex flex-col gap-1">
              <label className="text-body-strong text-text-primary">
                Subject
              </label>
              <Select
                value={selectedSubject?.toString() || ""}
                onValueChange={(value) => setSelectedSubject(parseInt(value))}
                disabled={!selectedFaculty || !selectedSemester}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select Subject" />
                </SelectTrigger>
                <SelectContent>
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
        </div>
      </section>

      {/* Session register (contract v1): resolves the session(s) for the day */}
      {selectedFaculty && selectedSemester && selectedSubject && (
        <DateSessionRegister
          facultyId={selectedFaculty}
          semester={selectedSemester}
          subjectId={selectedSubject}
          date={selectedDate}
        />
      )}

      {/* Instructions */}
      {!selectedFaculty && (
        <section className="rounded-lg bg-surface-default px-6 py-12 text-center shadow">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-brand-subtle text-brand-foreground">
            <ClipboardTaskListLtr24Regular aria-hidden />
          </div>
          <h3 className="text-section-title text-text-primary">
            Welcome to Attendance Management
          </h3>
          <p className="mx-auto mt-1 max-w-lg text-body text-text-muted">
            Please follow the workflow: Select Faculty → Semester → Subject to
            view and manage student attendance.
          </p>
        </section>
      )}
    </div>
  );
};

export default AdminAttendanceWorkflow;
