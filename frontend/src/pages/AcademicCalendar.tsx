import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Calendar, momentLocalizer, Views, View, Event } from 'react-big-calendar';
import type { CSSProperties } from 'react';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import '../styles/calendar.css';
import { useAuth } from '@/contexts/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Add16Regular,
  Add20Regular,
  BookOpen20Regular,
  CalendarCancel20Regular,
  CalendarLtr16Regular,
  CalendarLtr20Regular,
  CalendarToday20Regular,
  CheckmarkCircle20Regular,
  ChevronDown16Regular,
  ChevronLeft20Regular,
  ChevronRight20Regular,
  Clock16Regular,
  Clock20Regular,
  DataTrending20Regular,
  Delete20Regular,
  Dismiss16Regular,
  Dismiss20Regular,
  DocumentEdit20Regular,
  Edit20Regular,
  ErrorCircle20Regular,
  Filter20Regular,
  HatGraduation20Regular,
  Beach20Regular,
  Info16Regular,
  Info20Regular,
  Location20Regular,
  People20Regular,
  Person16Regular,
  Settings20Regular,
  Warning20Regular,
  type FluentIcon
} from '@fluentui/react-icons';
import { getAuthToken } from '@/lib/authToken';

const localizer = momentLocalizer(moment);

/* -------------------------------------------------------------------------- */
/* Presentation helpers (Outlook / Teams calendar look)                        */
/* -------------------------------------------------------------------------- */

// Theme-aware accent color per event type (CSS variables from src/index.css).
const EVENT_TYPE_ACCENTS: Record<string, string> = {
  class: 'var(--chart-3)',
  exam: 'var(--chart-4)',
  holiday: 'var(--status-error)',
  special_event: 'var(--chart-1)',
  cancelled_class: 'var(--text-muted)',
  break: 'var(--status-info)',
};

const EVENT_TYPE_FILTERS = [
  { value: 'class', label: 'Academic Days', desc: 'Lectures & regular classes' },
  { value: 'exam', label: 'Examinations', desc: 'Midterms & finals' },
  { value: 'holiday', label: 'Holidays (Saturdays)', desc: 'Weekly offs & public holidays' },
  { value: 'special_event', label: 'Special Events', desc: 'Workshops & guest sessions' },
  { value: 'cancelled_class', label: 'Cancelled Classes', desc: 'Rescheduled sessions' },
];

// Main events are colored by type; sessions keep their user-picked color.
const getEventAccent = (resource?: { isSession?: boolean; event_type?: string; color_code?: string } | null): string => {
  if (!resource) return 'var(--chart-1)';
  if (resource.isSession) return resource.color_code || 'var(--chart-1)';
  const type = resource.event_type?.toLowerCase();
  return (type && EVENT_TYPE_ACCENTS[type]) || resource.color_code || 'var(--chart-1)';
};

// Exposes the accent to calendar.css (.cal-event / .cal-swatch / .cal-chip)
const accentVar = (accent: string) => ({ '--evt': accent } as CSSProperties);

// Soft slot tint for time cells covered by a parent event
const tintColor = (accent: string) => `color-mix(in srgb, ${accent} 10%, var(--surface-default))`;

const SNACKBAR_TONES: Record<'success' | 'error' | 'warning' | 'info', { box: string; iconClass: string; icon: FluentIcon }> = {
  success: { box: 'border-status-success-border bg-status-success-subtle', iconClass: 'text-status-success', icon: CheckmarkCircle20Regular },
  error: { box: 'border-status-error-border bg-status-error-subtle', iconClass: 'text-status-error', icon: ErrorCircle20Regular },
  warning: { box: 'border-status-warning-border bg-status-warning-subtle', iconClass: 'text-status-warning', icon: Warning20Regular },
  info: { box: 'border-status-info-border bg-status-info-subtle', iconClass: 'text-status-info', icon: Info20Regular },
};

const fieldLabelClass = 'mb-1.5 block text-body-strong text-text-primary';

const checkboxClass = 'h-4 w-4 shrink-0 cursor-pointer rounded-sm border-border-strong accent-[var(--brand)]';

const selectClass =
  'h-9 w-full cursor-pointer appearance-none rounded-md border border-border-default border-b-border-strong bg-surface-default pl-3 pr-9 text-body text-text-primary transition-colors duration-150 ease-fluent-standard hover:border-border-strong focus:border-b-brand focus:shadow-[inset_0_-1px_0_0_var(--brand)] focus:outline-none';

// Fluent-styled native <select> (keeps the native onChange contract)
const NativeSelect: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ className = '', children, ...props }) => (
  <div className="relative">
    <select className={`${selectClass} ${className}`} {...props}>
      {children}
    </select>
    <ChevronDown16Regular
      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
      aria-hidden
    />
  </div>
);

interface DialogShellProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  onClose: () => void;
  widthClass?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

// Fluent dialog surface: raised, 8px radius, shadow-28, title 20/28, right-aligned footer
const DialogShell: React.FC<DialogShellProps> = ({
  title,
  description,
  icon,
  onClose,
  widthClass = 'max-w-2xl',
  footer,
  children
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in-0 duration-150">
    <div
      role="dialog"
      aria-modal="true"
      className={`flex max-h-[90vh] w-full ${widthClass} flex-col overflow-hidden rounded-lg bg-surface-raised text-text-primary shadow-xl`}
    >
      <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-5">
        <div className="flex min-w-0 items-start gap-3">
          {icon}
          <div className="min-w-0">
            <h2 className="text-section-title text-text-primary">{title}</h2>
            {description && <div className="mt-0.5 text-body text-text-muted">{description}</div>}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="-mr-2 h-8 w-8 shrink-0 text-text-muted"
          onClick={onClose}
          aria-label="Close"
        >
          <Dismiss20Regular aria-hidden />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto px-6 pb-6">{children}</div>
      {footer && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border-subtle px-6 py-3">
          {footer}
        </div>
      )}
    </div>
  </div>
);

interface CalendarEvent {
  id: number;
  title: string;
  description?: string;
  start_date: string;
  end_date?: string;
  start_time?: string;
  end_time?: string;
  event_type: string;
  color_code: string;
  is_all_day: boolean;
  created_by: number;
  location?: string;
  subject_id?: number;
  faculty_id?: number;
  class_id?: number;
  start: Date;
  end: Date;
  sessions?: EventSession[];
}

interface EventSession {
  id: number;
  parent_event_id: number;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  session_type?: string;
  presenter?: string;
  location?: string;
  color_code?: string;
  display_order: number;
  is_active: boolean;
  attendance_required: boolean;
  created_at: string;
  updated_at: string;
}

interface ExtendedCalendarEvent extends CalendarEvent {
  isMainEvent?: boolean;
  isSession?: boolean;
  parentEvent?: CalendarEvent;
  // Session-specific properties when isSession is true
  presenter?: string;
  session_type?: string;
  display_order?: number;
  is_active?: boolean;
  attendance_required?: boolean;
}

interface CalendarStats {
  total_events_this_month: number;
  upcoming_events: number;
  classes_today: number;
  total_attendance_marked: number;
}

interface CalendarSettings {
  default_view: string;
  working_hours_start: string;
  working_hours_end: string;
  weekend_visible: boolean;
  time_format: string;
}

interface AcademicCalendarProps {
  embedded?: boolean; // When true, removes full-screen styling for embedding in other layouts
}

const AcademicCalendar: React.FC<AcademicCalendarProps> = ({ embedded = false }) => {
  // Use authentication context
  const { user, loading: authLoading } = useAuth();
  
  // User role detection
  const isAdmin = useMemo(() => {
    console.log('👤 Current user object:', user);
    const adminStatus = user?.role === 'admin';
    console.log('🔍 User role detected:', user?.role, '| isAdmin:', adminStatus);
    return adminStatus;
  }, [user]);

  // State management
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<Array<{
    id: number;
    title: string;
    start: Date;
    end: Date;
    allDay: boolean;
    resource: CalendarEvent;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<'month' | 'week' | 'day'>('month');
  const [filterType, setFilterType] = useState<string>('all');
  const [showEventModal, setShowEventModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showEditSessionModal, setShowEditSessionModal] = useState(false);
  const [showCreateSessionModal, setShowCreateSessionModal] = useState(false);
  const [clickedDateForSession, setClickedDateForSession] = useState<string>('');
  const [clickedTimeForSession, setClickedTimeForSession] = useState<{startTime: string, endTime: string, isAllDay: boolean}>({startTime: '', endTime: '', isAllDay: false});
  const [selectedSession, setSelectedSession] = useState<EventSession | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [eventSessions, setEventSessions] = useState<EventSession[]>([]);
  const [sessionForm, setSessionForm] = useState({
    title: '',
    description: '',
    start_time: '',
    end_time: '',
    session_type: '',
    presenter: '',
    location: '',
    color_code: '',
    attendance_required: false
  });
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error' | 'warning' | 'info'
  });
  const [stats, setStats] = useState<CalendarStats>({
    total_events_this_month: 0,
    upcoming_events: 0,
    classes_today: 0,
    total_attendance_marked: 0
  });
  const [settings, setSettings] = useState<CalendarSettings>({
    default_view: 'month',
    working_hours_start: '09:00',
    working_hours_end: '17:00',
    weekend_visible: true,
    time_format: '24h'
  });

  // Form state for event creation
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    event_type: 'class',
    start_date: '',
    end_date: '',
    start_time: '',
    end_time: '',
    location: '',
    color_code: '#3B82F6',
    is_all_day: false
  });

  // Settings form state
  const [settingsForm, setSettingsForm] = useState({
    default_view: 'month',
    working_hours_start: '09:00',
    working_hours_end: '17:00',
    weekend_visible: true,
    time_format: '24h',
    auto_refresh: true,
    show_past_events: true,
    default_event_duration: 60
  });

  // Filter events based on type - prevent filter conflicts
  const filteredEvents = useMemo(() => {
    let eventsToFilter = calendarEvents;
    
    // In monthly view, exclude sessions (only show main events)
    if (currentView === 'month') {
      eventsToFilter = calendarEvents.filter(event => 
        !event.title?.startsWith('[SESSION]') && !(event.resource as ExtendedCalendarEvent)?.isSession
      );
    }
    
    if (filterType === 'all') return eventsToFilter;
    
    return eventsToFilter.filter(event => {
      // Sessions should always be visible in daily/weekly views regardless of filter
      if ((currentView === 'day' || currentView === 'week') && 
          (event.title?.startsWith('[SESSION]') || (event.resource as ExtendedCalendarEvent)?.isSession)) {
        return true;
      }
      
      const eventType = event.resource?.event_type?.toLowerCase();
      const filterTypeLower = filterType.toLowerCase();
      return eventType === filterTypeLower;
    });
  }, [calendarEvents, filterType, currentView]);

  // Filter events by current view date range
  const viewFilteredEvents = useMemo(() => {
    let startDate: moment.Moment;
    let endDate: moment.Moment;
    
    if (currentView === 'month') {
      startDate = moment(currentDate).startOf('month');
      endDate = moment(currentDate).endOf('month');
    } else if (currentView === 'week') {
      startDate = moment(currentDate).startOf('week');
      endDate = moment(currentDate).endOf('week');
    } else { // day view
      startDate = moment(currentDate).startOf('day');
      endDate = moment(currentDate).endOf('day');
    }
    
    return filteredEvents.filter(event => {
      const eventDate = moment(event.start);
      return eventDate.isSameOrAfter(startDate) && eventDate.isSameOrBefore(endDate);
    });
  }, [filteredEvents, currentDate, currentView]);

  // Debug: Log filtered events when they change
  useEffect(() => {
    console.log(`🎯 Current view: ${currentView}`);
    console.log('🎯 Filtered events for calendar:', viewFilteredEvents);
    console.log('🎯 Number of filtered events:', viewFilteredEvents.length);
    console.log('🎯 Calendar events raw:', calendarEvents);
    console.log('🎯 Events state raw:', events);
    
    // Debug sessions specifically
    const sessionEvents = viewFilteredEvents.filter(event => 
      event.title?.startsWith('[SESSION]') || (event.resource as ExtendedCalendarEvent)?.isSession
    );
    console.log(`🎯 Session events found in ${currentView} view:`, sessionEvents.length, sessionEvents);
    
    // Debug main events specifically
    const mainEvents = viewFilteredEvents.filter(event => 
      !(event.title?.startsWith('[SESSION]') || (event.resource as ExtendedCalendarEvent)?.isSession)
    );
    console.log(`🎯 Main events found in ${currentView} view:`, mainEvents.length, mainEvents);
    
    if (viewFilteredEvents.length > 0) {
      console.log('🎯 First filtered event structure:', viewFilteredEvents[0]);
      console.log('🎯 First event has resource?', !!viewFilteredEvents[0]?.resource);
    }
  }, [viewFilteredEvents, calendarEvents, events, currentView]);

  // Fetch events from API
  const fetchEvents = useCallback(async () => {
    console.log('🚀 Fetching events for date:', currentDate);
    setLoading(true);
    
    try {
      const token = getAuthToken();
      if (!token) {
        console.error('Authentication token not found.');
        setSnackbar({ open: true, message: 'Authentication error. Please log in again.', severity: 'error' });
        setLoading(false);
        return;
      }

      // Determine date range based on current view
      const startOfMonth = moment(currentDate).startOf('month').format('YYYY-MM-DD');
      const endOfMonth = moment(currentDate).endOf('month').format('YYYY-MM-DD');
      
      const params = new URLSearchParams({
        start_date: startOfMonth,
        end_date: endOfMonth,
      });

      const apiUrl = `/api/calendar/events?${params.toString()}`;
      console.log('📡 Calling API:', apiUrl);

      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🚨 API Error:', response.status, errorText);
        throw new Error(`Failed to fetch events: ${response.status}`);
      }

      const data: CalendarEvent[] = await response.json();
      console.log('✅ API Response Data:', data);

      // Fetch sessions for each event if user is admin
      const eventsWithSessions = await Promise.all(
        data.map(async (event) => {
          if (user?.role === 'admin') {
            try {
              const sessionsResponse = await fetch(
                `/api/event-sessions/events/${event.id}/sessions`,
                {
                  headers: {
                    'Authorization': `Bearer ${token}`,
                  },
                }
              );
              if (sessionsResponse.ok) {
                const sessions = await sessionsResponse.json();
                return { ...event, sessions };
              }
            } catch (error) {
              console.log('No sessions found for event:', event.id);
            }
          }
          return event;
        })
      );

      setEvents(eventsWithSessions);

      // Format events for calendar display 
      // Note: We store both events and sessions, but filter them based on current view
      const formattedEvents: Array<{
        id: string | number;
        title: string;
        start: Date;
        end: Date;
        allDay: boolean;
        resource: ExtendedCalendarEvent;
      }> = [];
      
      eventsWithSessions.forEach(event => {
        // Always add the main event (visible in all views)
        const startDate = new Date(event.start_date + 'T00:00:00');
        const endDate = new Date((event.end_date || event.start_date) + 'T23:59:59');
        
        formattedEvents.push({
          id: event.id,
          title: event.title,
          start: startDate,
          end: endDate,
          allDay: true,
          resource: { ...event, isMainEvent: true },
        });

        // Add individual sessions as separate calendar events (only for daily/weekly views)
        if (event.sessions && event.sessions.length > 0) {
          console.log(`🎯 Processing ${event.sessions.length} sessions for event "${event.title}":`, event.sessions);
          event.sessions.forEach((session) => {
            // Fix: session.start_time is already in HH:MM:SS format, don't add :00
            const sessionStartTime = session.start_time.length === 5 ? session.start_time + ':00' : session.start_time;
            const sessionEndTime = session.end_time.length === 5 ? session.end_time + ':00' : session.end_time;
            
            const sessionStart = new Date(
              event.start_date + 'T' + sessionStartTime
            );
            const sessionEnd = new Date(
              event.start_date + 'T' + sessionEndTime
            );
            
            console.log(`  📅 Creating session calendar event: "${session.title}" from ${sessionStart} to ${sessionEnd} (times: ${sessionStartTime} - ${sessionEndTime})`);
            
            // Debug: Check if the dates are valid
            if (isNaN(sessionStart.getTime()) || isNaN(sessionEnd.getTime())) {
              console.error(`❌ Invalid session dates: start=${sessionStart}, end=${sessionEnd}, startTime=${sessionStartTime}, endTime=${sessionEndTime}`);
              return; // Skip this session if dates are invalid
            }
            
            const sessionCalendarEvent = {
              id: `session-${session.id}`,
              title: `[SESSION] ${session.title}`,
              start: sessionStart,
              end: sessionEnd,
              allDay: false,
              resource: { 
                ...session, 
                parentEvent: event,
                isSession: true,
                color_code: session.color_code || event.color_code
              },
            };
            
            formattedEvents.push(sessionCalendarEvent);
            console.log(`  ✅ Added session to formattedEvents:`, sessionCalendarEvent);
          });
          
          console.log(`🔄 Total sessions processed for "${event.title}": ${event.sessions.length}`);
        }
      });

      console.log('📅 Final events for calendar:', formattedEvents);
      setCalendarEvents(formattedEvents as Array<{
        id: number;
        title: string;
        start: Date;
        end: Date;
        allDay: boolean;
        resource: CalendarEvent;
      }>);

    } catch (error) {
      console.error('❌ Error fetching events:', error);
      setSnackbar({ open: true, message: 'Could not load calendar events.', severity: 'error' });
    } finally {
      setLoading(false);
      console.log('✅ Fetching complete.');
    }
  }, [currentDate, user?.role]);

  // Fetch sessions for a specific event
  const fetchEventSessions = async (eventId: number) => {
    try {
      const token = getAuthToken();
      if (!token) return;

      const response = await fetch(
        `/api/event-sessions/events/${eventId}/sessions`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const sessions = await response.json();
        setEventSessions(sessions);
      } else {
        setEventSessions([]);
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
      setEventSessions([]);
    }
  };

  // Create a new session
  const handleCreateSession = async () => {
    if (!selectedEvent || !sessionForm.title || !sessionForm.start_time || !sessionForm.end_time) {
      setSnackbar({ open: true, message: 'Please fill in all required fields', severity: 'error' });
      return;
    }

    try {
      const token = getAuthToken();
      if (!token) return;

      const response = await fetch(
        `/api/event-sessions/events/${selectedEvent.id}/sessions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            parent_event_id: selectedEvent.id,
            ...sessionForm
          }),
        }
      );

      if (response.ok) {
        // Reset form
        setSessionForm({
          title: '',
          description: '',
          start_time: '',
          end_time: '',
          session_type: '',
          presenter: '',
          location: '',
          color_code: '',
          attendance_required: false
        });
        
        // Refresh sessions
        await fetchEventSessions(selectedEvent.id);
        
        // Refresh events to show updated sessions
        await fetchEvents();
        
        setSnackbar({ open: true, message: 'Session created successfully', severity: 'success' });
      } else {
        const errorData = await response.json();
        setSnackbar({ open: true, message: errorData.detail || 'Failed to create session', severity: 'error' });
      }
    } catch (error) {
      console.error('Error creating session:', error);
      setSnackbar({ open: true, message: 'Failed to create session', severity: 'error' });
    }
  };

  // Create session with automatic event creation for empty time slots
  const handleCreateSessionWithEvent = async () => {
    if (!sessionForm.title || !sessionForm.start_time || !sessionForm.end_time || !clickedDateForSession) {
      setSnackbar({ open: true, message: 'Please fill in title, start time, and end time', severity: 'error' });
      return;
    }

    try {
      const token = getAuthToken();
      if (!token) {
        setSnackbar({ open: true, message: 'Not authenticated', severity: 'error' });
        return;
      }

      console.log('Creating session - checking for existing events on this date/time');

      // Check if there's already an event on this date/time that we can add a session to
      const existingEvents = events.filter(event => 
        event.start_date === clickedDateForSession &&
        (!event.start_time || 
         (event.start_time <= sessionForm.start_time && event.end_time >= sessionForm.end_time) ||
         Math.abs(moment(`${clickedDateForSession} ${event.start_time}`).diff(moment(`${clickedDateForSession} ${sessionForm.start_time}`), 'minutes')) <= 30)
      );

      let targetEventId = null;

      if (existingEvents.length > 0) {
        // Use existing event - pick the first suitable one
        targetEventId = existingEvents[0].id;
        console.log(`Found existing event ID ${targetEventId} - adding session to it`);
      } else {
        // Create a minimal parent event just for this session
        const eventData = {
          title: `${sessionForm.title} (Event Container)`,
          description: 'Auto-created container for session',
          event_type: 'class',
          start_date: clickedDateForSession,
          end_date: clickedDateForSession,
          start_time: sessionForm.start_time,
          end_time: sessionForm.end_time,
          location: sessionForm.location || '',
          color_code: sessionForm.color_code || '#3b82f6',
          is_all_day: false
        };

        console.log('No suitable existing event found - creating minimal container event:', eventData);

        const eventResponse = await fetch('/api/calendar/events', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(eventData),
        });

        if (!eventResponse.ok) {
          const errorText = await eventResponse.text();
          console.error('Failed to create container event:', errorText);
          setSnackbar({ open: true, message: 'Failed to create container event', severity: 'error' });
          return;
        }

        const createdEvent = await eventResponse.json();
        targetEventId = createdEvent.id;
        console.log('Created container event with ID:', targetEventId);
      }

      // Create session in event_sessions table
      const sessionData = {
        parent_event_id: targetEventId,
        title: sessionForm.title,
        description: sessionForm.description || '',
        start_time: sessionForm.start_time,
        end_time: sessionForm.end_time,
        session_type: sessionForm.session_type || 'lecture',
        presenter: sessionForm.presenter || '',
        location: sessionForm.location || '',
        color_code: sessionForm.color_code || '#3b82f6',
        attendance_required: sessionForm.attendance_required || false
      };

      console.log('Creating session in event_sessions table:', sessionData);

      const sessionResponse = await fetch(`/api/event-sessions/events/${targetEventId}/sessions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sessionData),
      });

      if (!sessionResponse.ok) {
        const errorText = await sessionResponse.text();
        console.error('Failed to create session:', errorText);
        setSnackbar({ open: true, message: 'Failed to create session', severity: 'error' });
        return;
      }

      const createdSession = await sessionResponse.json();
      console.log('✅ Created session successfully:', createdSession);

      // Reset form
      setSessionForm({
        title: '',
        description: '',
        start_time: '',
        end_time: '',
        session_type: 'lecture',
        presenter: '',
        location: '',
        color_code: '',
        attendance_required: false
      });
      
      // Reset clicked data
      setClickedDateForSession('');
      setClickedTimeForSession({startTime: '', endTime: '', isAllDay: false});
      
      // Close modal
      setShowCreateSessionModal(false);
      
      // Refresh events to show the new session
      await fetchEvents();
      
      setSnackbar({ open: true, message: 'Session created successfully in event_sessions table!', severity: 'success' });
    } catch (error) {
      console.error('Error creating session:', error);
      setSnackbar({ open: true, message: 'Network error - check if backend is running', severity: 'error' });
    }
  };

  // Delete a session
  const handleDeleteSession = async (sessionId: number) => {
    try {
      const token = getAuthToken();
      if (!token) return;

      const response = await fetch(
        `/api/event-sessions/sessions/${sessionId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        // Refresh sessions
        if (selectedEvent) {
          await fetchEventSessions(selectedEvent.id);
        }
        
        // Refresh events to show updated sessions
        await fetchEvents();
        
        setSnackbar({ open: true, message: 'Session deleted successfully', severity: 'success' });
      } else {
        setSnackbar({ open: true, message: 'Failed to delete session', severity: 'error' });
      }
    } catch (error) {
      console.error('Error deleting session:', error);
      setSnackbar({ open: true, message: 'Failed to delete session', severity: 'error' });
    }
  };

  // Fetch calendar stats
  const fetchStats = async () => {
    try {
      const token = getAuthToken(); // Use authToken instead of token
      const response = await fetch('/api/calendar/stats/overview', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  // Handle cell click for creating events or sessions based on view
  const handleCellClick = (date: moment.Moment, hour?: number) => {
    if (!isAdmin) return; // Only admins can create events
    
    const clickedDate = date.format('YYYY-MM-DD');
    console.log('📅 Cell clicked for date:', clickedDate, 'hour:', hour, 'view:', currentView);
    
    // Determine start and end time based on view and hour
    let startTime = '';
    let endTime = '';
    let isAllDay = false;
    
    if (hour !== undefined) {
      // Week or Day view with specific hour clicked
      startTime = moment().hour(hour).minute(0).format('HH:mm');
      endTime = moment().hour(hour + 1).minute(0).format('HH:mm');
      isAllDay = false;
    } else {
      // Month view - default to all day or empty time
      startTime = '';
      endTime = '';
      isAllDay = currentView === 'month'; // Default to all-day for month view clicks
    }
    
    // Different behavior based on view
    if (currentView === 'month') {
      // Monthly view: Create full events
      const defaultEventType = 'class';
      setEventForm({
        title: '',
        description: '',
        event_type: defaultEventType,
        start_date: clickedDate,
        end_date: clickedDate,
        start_time: startTime,
        end_time: endTime,
        location: '',
        color_code: getEventTypeColor(defaultEventType),
        is_all_day: isAllDay
      });
      
      setShowCreateModal(true);
    } else {
      // Daily/Weekly view: Create sessions (which auto-create events)
      setSessionForm({
        title: '',
        description: '',
        start_time: startTime,
        end_time: endTime,
        session_type: 'lecture',
        presenter: '',
        location: '',
        color_code: '#3b82f6',
        attendance_required: false
      });
      
      // Store clicked date for event creation
      setClickedDateForSession(clickedDate);
      setClickedTimeForSession({ startTime, endTime, isAllDay });
      
      setShowCreateSessionModal(true);
    }
  };

  // Handle event click - Simplified for debugging
  const handleEventClick = (event: Event) => {
    console.log('--- EVENT CLICK HANDLER TRIGGERED ---');
    console.log('Clicked Event Object:', event);
    
    const calendarEvent = event.resource as ExtendedCalendarEvent;
    if (calendarEvent && calendarEvent.id) {
      console.log('Event resource is valid:', calendarEvent);
      
      // Check if this is a session click (either marked as isSession or has [SESSION] prefix)
      const isSession = calendarEvent.isSession || (typeof event.title === 'string' && event.title.startsWith('[SESSION]'));
      
      if (isSession) {
        console.log('🎯 Session clicked! Opening session interface...', calendarEvent);
        // The session data is in the calendarEvent itself (it was created from session data)
        const sessionData: EventSession = {
          id: calendarEvent.id,
          title: calendarEvent.title?.replace('[SESSION] ', '') || calendarEvent.title,
          description: calendarEvent.description || '',
          start_time: calendarEvent.start_time || '',
          end_time: calendarEvent.end_time || '',
          session_type: calendarEvent.session_type || '',
          presenter: calendarEvent.presenter || '',
          location: calendarEvent.location || '',
          color_code: calendarEvent.color_code || '',
          attendance_required: calendarEvent.attendance_required || false,
          parent_event_id: calendarEvent.parentEvent?.id || 0,
          display_order: calendarEvent.display_order || 1,
          is_active: calendarEvent.is_active !== false,
          created_at: '',
          updated_at: ''
        };
        setSelectedSession(sessionData);
        setShowEditSessionModal(true);
      } else {
        console.log('📅 Main event clicked! Opening event details...');
        setSelectedEvent(calendarEvent);
        setShowEventModal(true);
      }
    } else {
      console.error("CRITICAL: Event resource is missing or invalid.", event);
      alert("Could not open event details due to a data issue.");
    }
  };

  // Handle edit event
  const handleEditEvent = () => {
    if (selectedEvent) {
      // Pre-fill form with existing event data
      setEventForm({
        title: selectedEvent.title,
        description: selectedEvent.description || '',
        event_type: selectedEvent.event_type,
        start_date: selectedEvent.start_date,
        end_date: selectedEvent.end_date || selectedEvent.start_date,
        start_time: selectedEvent.start_time || '',
        end_time: selectedEvent.end_time || '',
        location: selectedEvent.location || '',
        color_code: selectedEvent.color_code,
        is_all_day: selectedEvent.is_all_day
      });
      setShowEventModal(false);
      setShowEditModal(true);
    }
  };

  // Handle update event
  const handleUpdateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedEvent) return;
    
    try {
      console.log('🔄 Updating event with data:', eventForm);
      console.log('🔄 Event ID:', selectedEvent.id);
      
      const token = getAuthToken();
      const response = await fetch(`/api/calendar/events/${selectedEvent.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventForm)
      });

      if (response.ok) {
        const updatedEvent = await response.json();
        console.log('✅ Event updated successfully:', updatedEvent);
        
        // Reset form and close modal
        setEventForm({
          title: '',
          description: '',
          event_type: 'class',
          start_date: '',
          end_date: '',
          start_time: '',
          end_time: '',
          location: '',
          color_code: '#3B82F6',
          is_all_day: false
        });
        
        setShowEditModal(false);
        setSelectedEvent(null);
        fetchEvents();
        
        setSnackbar({ 
          open: true, 
          message: 'Event updated successfully!', 
          severity: 'success' 
        });
      } else {
        const errorData = await response.text();
        console.error('❌ Failed to update event:', response.status, errorData);
        setSnackbar({ 
          open: true, 
          message: 'Failed to update event. Please try again.', 
          severity: 'error' 
        });
      }
    } catch (error) {
      console.error('❌ Error updating event:', error);
      setSnackbar({ 
        open: true, 
        message: 'Network error. Please try again.', 
        severity: 'error' 
      });
    }
  };

  // Handle delete event
  const handleDeleteEvent = async () => {
    if (!selectedEvent) return;
    
    if (window.confirm('Are you sure you want to delete this event?')) {
      try {
        const token = getAuthToken();
        const response = await fetch(`/api/calendar/events/${selectedEvent.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
        });

        if (response.ok) {
          console.log('Event deleted successfully');
          setShowEventModal(false);
          setSelectedEvent(null);
          fetchEvents();
        } else {
          console.error('Failed to delete event');
        }
      } catch (error) {
        console.error('Error deleting event:', error);
      }
    }
  };

  // Handle update session
  const handleUpdateSession = async () => {
    if (!selectedSession) return;

    try {
      const token = getAuthToken();
      const response = await fetch(`/api/event-sessions/${selectedSession.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: selectedSession.title,
          description: selectedSession.description,
          start_time: selectedSession.start_time,
          end_time: selectedSession.end_time,
          session_type: selectedSession.session_type,
          presenter: selectedSession.presenter,
          location: selectedSession.location,
          color_code: selectedSession.color_code,
          attendance_required: selectedSession.attendance_required,
          display_order: selectedSession.display_order,
          is_active: selectedSession.is_active
        })
      });

      if (response.ok) {
        console.log('Session updated successfully');
        setSnackbar({ open: true, message: 'Session updated successfully!', severity: 'success' });
        setShowEditSessionModal(false);
        setSelectedSession(null);
        fetchEvents(); // Refresh calendar events
      } else {
        const errorData = await response.json();
        console.error('Failed to update session:', errorData);
        setSnackbar({ open: true, message: 'Failed to update session.', severity: 'error' });
      }
    } catch (error) {
      console.error('Error updating session:', error);
      setSnackbar({ open: true, message: 'Error updating session.', severity: 'error' });
    }
  };

  // Handle settings form changes
  const handleSettingsChange = (field: string, value: string | boolean | number) => {
    setSettingsForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle settings save
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const token = getAuthToken();
      const response = await fetch('/api/calendar/settings/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settingsForm)
      });

      if (response.ok) {
        const savedSettings = await response.json();
        console.log('Settings saved successfully:', savedSettings);
        setSettings(prev => ({ ...prev, ...settingsForm }));
        setShowSettingsModal(false);
        
        // Apply settings immediately
        if (settingsForm.default_view !== currentView) {
          setCurrentView(settingsForm.default_view as 'month' | 'week' | 'day');
        }
      } else {
        console.error('Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  // Define color mapping based on event types
  const getEventTypeColor = (eventType: string): string => {
    const colorMapping: { [key: string]: string } = {
      'class': '#22C55E',          // Green for classes
      'exam': '#F97316',           // Orange for exams  
      'holiday': '#EF4444',        // Red for holidays
      'special_event': '#8B5CF6',  // Purple for special events
      'cancelled_class': '#64748B' // Gray for cancelled
    };
    return colorMapping[eventType] || '#3B82F6'; // Default blue
  };

  // Helper function to get event display info for a specific hour
  const getEventDisplayInfo = (event: Event, targetHour: number): { 
    isStart: boolean; 
    isEnd: boolean; 
    showTitle: boolean;
    position: 'start' | 'middle' | 'end' | 'single';
  } => {
    if (event.resource?.is_all_day) {
      return { isStart: true, isEnd: true, showTitle: true, position: 'single' };
    }

    if (!event.resource?.start_time || !event.resource?.end_time) {
      return { isStart: true, isEnd: true, showTitle: true, position: 'single' };
    }

    const startTime = moment(event.resource.start_time, 'HH:mm');
    const endTime = moment(event.resource.end_time, 'HH:mm');
    const startHour = startTime.hour();
    const endHour = endTime.hour();

    const isStart = targetHour === startHour;
    const isEnd = targetHour === (endHour - 1); // End hour is exclusive
    const isSingle = startHour === (endHour - 1); // Single hour event
    
    let position: 'start' | 'middle' | 'end' | 'single';
    if (isSingle) {
      position = 'single';
    } else if (isStart) {
      position = 'start';
    } else if (isEnd) {
      position = 'end';
    } else {
      position = 'middle';
    }

    return { 
      isStart, 
      isEnd, 
      showTitle: isStart || isSingle, // Only show title at start or for single-hour events
      position 
    };
  };

  // Helper function to check if an event spans across a specific hour
  const isEventInHour = (event: Event, targetHour: number, targetDate: string): boolean => {
    const eventDate = moment(event.start).format('YYYY-MM-DD');
    
    // Check if event is on the target date
    if (eventDate !== targetDate) return false;
    
    // Handle all-day events
    if (event.resource?.is_all_day) return true;
    
    // Check if event has time information
    if (!event.resource?.start_time || !event.resource?.end_time) {
      // Fallback to event start hour if no time range specified
      const eventHour = moment(event.start).hour();
      return eventHour === targetHour;
    }
    
    // Parse start and end times
    const startTime = moment(event.resource.start_time, 'HH:mm');
    const endTime = moment(event.resource.end_time, 'HH:mm');
    
    const startHour = startTime.hour();
    const endHour = endTime.hour();
    
    // Check if target hour is within the event's time range
    return targetHour >= startHour && targetHour < endHour;
  };

  // Handle form input changes
  const handleFormChange = (field: string, value: string | boolean) => {
    setEventForm(prev => {
      const updated = {
        ...prev,
        [field]: value
      };
      
      // Automatically set color when event type changes
      if (field === 'event_type') {
        updated.color_code = getEventTypeColor(value as string);
      }
      
      return updated;
    });
  };

  // Handle form submission
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const token = getAuthToken();
      
      // Prepare the event data with proper null handling for empty fields
      const eventData = {
        ...eventForm,
        start_time: eventForm.start_time.trim() === '' ? null : eventForm.start_time,
        end_time: eventForm.end_time.trim() === '' ? null : eventForm.end_time,
        end_date: eventForm.end_date.trim() === '' ? eventForm.start_date : eventForm.end_date,
        description: eventForm.description.trim() === '' ? null : eventForm.description,
      };
      
      const response = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData)
      });

      if (response.ok) {
        const newEvent = await response.json();
        console.log('Event created successfully:', newEvent);
        
        // Reset form
        setEventForm({
          title: '',
          description: '',
          event_type: 'class',
          start_date: '',
          end_date: '',
          start_time: '',
          end_time: '',
          location: '',
          color_code: '#3B82F6',
          is_all_day: false
        });
        
        // Close modal and refresh events
        setShowCreateModal(false);
        fetchEvents();
      } else {
        const errorData = await response.text();
        console.error('Failed to create event:', errorData);
      }
    } catch (error) {
      console.error('Error creating event:', error);
    }
  };

  // Get event type info
  const getEventTypeInfo = (type: string) => {
    const normalizedType = type?.toLowerCase();
    const types: { [key: string]: { icon: FluentIcon; color: string; label: string } } = {
      class: { icon: HatGraduation20Regular, color: EVENT_TYPE_ACCENTS.class, label: 'Academic Day' },
      exam: { icon: DocumentEdit20Regular, color: EVENT_TYPE_ACCENTS.exam, label: 'Exam' },
      holiday: { icon: Beach20Regular, color: EVENT_TYPE_ACCENTS.holiday, label: 'Holiday' },
      special_event: { icon: People20Regular, color: EVENT_TYPE_ACCENTS.special_event, label: 'Special Event' },
      cancelled_class: { icon: CalendarCancel20Regular, color: EVENT_TYPE_ACCENTS.cancelled_class, label: 'Cancelled' }
    };
    return types[normalizedType] || types.special_event;
  };

  // Clean up event titles for display
  const getCleanTitle = (title: string, eventType: string) => {
    const normalizedType = eventType?.toLowerCase();
    if (normalizedType === 'class' && title.endsWith(' Class')) {
      return title.replace(' Class', '');
    }
    return title;
  };

  // Navigation handlers
  const navigateToday = () => setCurrentDate(new Date());
  const navigateBack = () => {
    const newDate = moment(currentDate).subtract(1, currentView).toDate();
    setCurrentDate(newDate);
  };
  const navigateNext = () => {
    const newDate = moment(currentDate).add(1, currentView).toDate();
    setCurrentDate(newDate);
  };

  // Format date for display
  const formatDisplayDate = () => {
    if (currentView === 'month') {
      return moment(currentDate).format('MMMM YYYY');
    } else if (currentView === 'week') {
      const start = moment(currentDate).startOf('week');
      const end = moment(currentDate).endOf('week');
      return `${start.format('MMM D')} - ${end.format('MMM D, YYYY')}`;
    } else {
      return moment(currentDate).format('MMMM D, YYYY');
    }
  };

  // The eventPropGetter and dayPropGetter have been removed for debugging.
  // We will rely on the default calendar styling.

  useEffect(() => {
    fetchEvents();
    fetchStats();
  }, [fetchEvents]);

  // Debug filtered events whenever they change
  useEffect(() => {
    console.log('🚨 FILTERED EVENTS UPDATED:', filteredEvents);
    console.log('🚨 Events count:', filteredEvents.length);
    if (filteredEvents.length > 0) {
      console.log('🚨 First event details:', {
        title: filteredEvents[0].title,
        start: filteredEvents[0].start,
        end: filteredEvents[0].end,
        allDay: filteredEvents[0].allDay,
        resource: filteredEvents[0].resource
      });
    }
  }, [filteredEvents]);

  // ---------- Presentation-only derived data (side panel) ----------
  const upcomingEvents = useMemo(() => {
    const today = moment().format('YYYY-MM-DD');
    return [...events]
      .filter(ev => (ev.end_date || ev.start_date) >= today)
      .filter(ev => filterType === 'all' || ev.event_type?.toLowerCase() === filterType.toLowerCase())
      .sort((a, b) =>
        a.start_date.localeCompare(b.start_date) || (a.start_time || '').localeCompare(b.start_time || '')
      )
      .slice(0, 6);
  }, [events, filterType]);

  const eventTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    events.forEach(ev => {
      const type = ev.event_type?.toLowerCase();
      if (type) counts[type] = (counts[type] || 0) + 1;
    });
    return counts;
  }, [events]);

  const snackbarTone = SNACKBAR_TONES[snackbar.severity] || SNACKBAR_TONES.info;
  const SnackbarIcon = snackbarTone.icon;

  // Shared fields for the Create / Edit event dialogs
  const renderEventFields = (idPrefix: string) => (
    <>
      <div>
        <label htmlFor={`${idPrefix}-title`} className={fieldLabelClass}>Event Title</label>
        <Input
          id={`${idPrefix}-title`}
          type="text"
          value={eventForm.title}
          onChange={(e) => handleFormChange('title', e.target.value)}
          placeholder="Enter event title..."
          required
        />
      </div>

      <div>
        <label htmlFor={`${idPrefix}-description`} className={fieldLabelClass}>Description</label>
        <Textarea
          id={`${idPrefix}-description`}
          rows={3}
          value={eventForm.description}
          onChange={(e) => handleFormChange('description', e.target.value)}
          placeholder="Enter event description..."
        />
      </div>

      <div>
        <label htmlFor={`${idPrefix}-type`} className={fieldLabelClass}>Event Type</label>
        <NativeSelect
          id={`${idPrefix}-type`}
          value={eventForm.event_type}
          onChange={(e) => handleFormChange('event_type', e.target.value)}
        >
          <option value="class">Class</option>
          <option value="exam">Exam</option>
          <option value="holiday">Holiday</option>
          <option value="special_event">Special Event</option>
        </NativeSelect>
        <p className="mt-1 text-caption text-text-muted">Color will be automatically assigned based on event type</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label htmlFor={`${idPrefix}-start-date`} className={fieldLabelClass}>Start Date</label>
          <Input
            id={`${idPrefix}-start-date`}
            type="date"
            value={eventForm.start_date}
            onChange={(e) => handleFormChange('start_date', e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-end-date`} className={fieldLabelClass}>End Date</label>
          <Input
            id={`${idPrefix}-end-date`}
            type="date"
            value={eventForm.end_date}
            onChange={(e) => handleFormChange('end_date', e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id={idPrefix === 'create' ? 'allDay' : 'editAllDay'}
          checked={eventForm.is_all_day}
          onChange={(e) => handleFormChange('is_all_day', e.target.checked)}
          className={checkboxClass}
        />
        <label htmlFor={idPrefix === 'create' ? 'allDay' : 'editAllDay'} className="cursor-pointer text-body text-text-primary">
          All Day Event
        </label>
      </div>

      {!eventForm.is_all_day && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor={`${idPrefix}-start-time`} className={fieldLabelClass}>Start Time</label>
            <Input
              id={`${idPrefix}-start-time`}
              type="time"
              value={eventForm.start_time}
              onChange={(e) => handleFormChange('start_time', e.target.value)}
            />
          </div>
          <div>
            <label htmlFor={`${idPrefix}-end-time`} className={fieldLabelClass}>End Time</label>
            <Input
              id={`${idPrefix}-end-time`}
              type="time"
              value={eventForm.end_time}
              onChange={(e) => handleFormChange('end_time', e.target.value)}
            />
          </div>
        </div>
      )}

      <div>
        <label htmlFor={`${idPrefix}-location`} className={fieldLabelClass}>Location</label>
        <Input
          id={`${idPrefix}-location`}
          type="text"
          value={eventForm.location}
          onChange={(e) => handleFormChange('location', e.target.value)}
          placeholder="Enter event location..."
        />
      </div>
    </>
  );

  const viewOptions = ['month', 'week', 'day'] as const;

  return (
    <div className={embedded ? 'w-full space-y-4' : 'mx-auto w-full max-w-[1600px] space-y-4 pb-12'}>
      {/* Page header */}
      <div className="page-header">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-page-title text-text-primary">Academic Calendar</h1>
            <span className="inline-flex items-center rounded-full bg-brand-subtle px-2 py-0.5 text-caption-strong text-brand-foreground">
              Nepal Standard
            </span>
            {isAdmin && (
              <span className="inline-flex items-center rounded-full border border-status-success-border bg-status-success-subtle px-2 py-0.5 text-caption-strong text-status-success">
                Admin Mode
              </span>
            )}
          </div>
          <p className="mt-1 text-body text-text-muted">
            Institutional semester dates, examination schedules, sessions, and holiday tracking
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowSettingsModal(true)}
            title="Calendar Settings"
            aria-label="Calendar Settings"
          >
            <Settings20Regular aria-hidden />
          </Button>
          {isAdmin && (
            <Button onClick={() => setShowCreateModal(true)}>
              <Add20Regular aria-hidden />
              Add Event
            </Button>
          )}
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'This Month',
            value: stats.total_events_this_month || 0,
            caption: `Events in ${moment(currentDate).format('MMMM')}`,
            icon: CalendarLtr20Regular,
            chip: 'bg-brand-subtle text-brand-foreground',
          },
          {
            label: 'Upcoming Events',
            value: stats.upcoming_events || 0,
            caption: 'Next 30 days ahead',
            icon: Clock20Regular,
            chip: 'bg-brand-subtle text-brand-foreground',
          },
          {
            label: "Today's Schedule",
            value: stats.classes_today || 0,
            caption: moment().format('dddd, MMM D'),
            icon: BookOpen20Regular,
            chip: 'bg-brand-subtle text-brand-foreground',
          },
          {
            label: 'Attendance Marked',
            value: stats.total_attendance_marked || 0,
            caption: 'Recorded sessions',
            icon: DataTrending20Regular,
            chip: 'bg-status-success-subtle text-status-success',
          },
        ].map((tile) => {
          const TileIcon = tile.icon;
          return (
            <div key={tile.label} className="flex items-center gap-3 rounded-lg bg-surface-default p-4 shadow">
              <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-md ${tile.chip}`}>
                <TileIcon aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-caption text-text-muted">{tile.label}</p>
                <p className="text-[28px] font-semibold leading-9 tabular-nums text-text-primary">{tile.value}</p>
                <p className="truncate text-caption text-text-secondary">{tile.caption}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Calendar + side panel */}
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        {/* Calendar surface */}
        <section className="min-w-0 overflow-hidden rounded-lg bg-surface-default shadow" aria-label="Calendar">
          {/* Toolbar (Outlook style) */}
          <div className="flex flex-col gap-3 border-b border-border-subtle px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-1">
              <Button variant="outline" size="sm" onClick={navigateToday} className="mr-1">
                <CalendarToday20Regular aria-hidden />
                Today
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={navigateBack}
                aria-label="Previous date range"
                title="Previous"
              >
                <ChevronLeft20Regular aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={navigateNext}
                aria-label="Next date range"
                title="Next"
              >
                <ChevronRight20Regular aria-hidden />
              </Button>
              <h2 className="ml-2 text-section-title text-text-primary">{formatDisplayDate()}</h2>
              <span className="ml-2 hidden items-center rounded-full bg-surface-subtle px-2 py-0.5 text-caption tabular-nums text-text-muted sm:inline-flex">
                {filteredEvents.length} {filteredEvents.length === 1 ? 'event' : 'events'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isAdmin && (
                <span className="hidden items-center gap-1.5 text-caption text-text-muted 2xl:inline-flex">
                  <Info16Regular aria-hidden />
                  Click cell to add event
                </span>
              )}

              {/* Compact filter (side panel holds the full filter list on wide screens) */}
              <div className="w-48 xl:hidden">
                <NativeSelect
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  aria-label="Filter event types"
                  className="h-8"
                >
                  <option value="all">All Event Types</option>
                  {EVENT_TYPE_FILTERS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </NativeSelect>
              </div>

              {/* View switcher (segmented) */}
              <div
                role="tablist"
                aria-label="Calendar view"
                className="inline-flex rounded-md border border-border-default bg-surface-default p-0.5"
              >
                {viewOptions.map((view) => (
                  <button
                    key={view}
                    type="button"
                    role="tab"
                    aria-selected={currentView === view}
                    onClick={() => setCurrentView(view)}
                    className={`h-7 rounded-sm px-3 text-body capitalize transition-colors duration-150 ease-fluent-standard ${
                      currentView === view
                        ? 'bg-brand-subtle font-semibold text-brand-foreground'
                        : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                    }`}
                  >
                    {view}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Calendar body */}
          {loading ? (
            <div className="flex h-96 flex-col items-center justify-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-subtle border-t-brand" aria-hidden />
              <p className="text-caption text-text-muted">Loading calendar events...</p>
            </div>
          ) : (
            <div>
              {/* Month View */}
              {currentView === 'month' && (
                <div className="overflow-x-auto">
                  <div className="min-w-[720px]">
                    {/* Weekday header row */}
                    <div className="grid grid-cols-7 border-b border-border-subtle">
                      {[
                        { name: 'Sun', full: 'Sunday' },
                        { name: 'Mon', full: 'Monday' },
                        { name: 'Tue', full: 'Tuesday' },
                        { name: 'Wed', full: 'Wednesday' },
                        { name: 'Thu', full: 'Thursday' },
                        { name: 'Fri', full: 'Friday' },
                        { name: 'Sat', full: 'Saturday', isHoliday: true }
                      ].map(day => (
                        <div
                          key={day.name}
                          title={day.full}
                          className={`flex items-center gap-1.5 px-2 py-2 text-caption ${
                            day.isHoliday ? 'text-status-error' : 'text-text-muted'
                          }`}
                        >
                          <span>{day.name}</span>
                          {day.isHoliday && (
                            <span className="hidden rounded-sm bg-status-error-subtle px-1 text-overline text-status-error sm:inline">
                              Holiday
                            </span>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Day matrix */}
                    <div className="grid grid-cols-7">
                      {(() => {
                        const startOfMonth = moment(currentDate).startOf('month');
                        const endOfMonth = moment(currentDate).endOf('month');
                        const startOfWeek = moment(startOfMonth).startOf('week');
                        const endOfWeek = moment(endOfMonth).endOf('week');

                        const days = [];
                        const current = moment(startOfWeek);

                        while (current.isSameOrBefore(endOfWeek)) {
                          const dayDate = current.clone();
                          const dayEvents = viewFilteredEvents.filter(event =>
                            moment(event.start).format('YYYY-MM-DD') === dayDate.format('YYYY-MM-DD')
                          );
                          const isCurrentMonth = dayDate.month() === moment(currentDate).month();
                          const isSaturday = dayDate.day() === 6;
                          const isToday = dayDate.format('YYYY-MM-DD') === moment().local().format('YYYY-MM-DD');

                          days.push(
                            <div
                              key={dayDate.format('YYYY-MM-DD')}
                              onClick={() => isAdmin && isCurrentMonth && handleCellClick(dayDate)}
                              className={`group relative flex min-h-[112px] flex-col gap-1 border-b border-r border-border-subtle p-1.5 transition-colors duration-150 ease-fluent-standard [&:nth-child(7n)]:border-r-0 sm:min-h-[124px] ${
                                isToday
                                  ? 'bg-brand-subtle hover:bg-brand-subtle-hover'
                                  : !isCurrentMonth
                                    ? 'bg-surface-subtle'
                                    : isSaturday
                                      ? 'bg-status-error-subtle/50 hover:bg-status-error-subtle'
                                      : 'bg-surface-default hover:bg-surface-hover'
                              } ${isAdmin && isCurrentMonth ? 'cursor-pointer' : ''}`}
                            >
                              {/* Date row */}
                              <div className="flex items-center justify-between">
                                {isToday ? (
                                  <span className="grid h-6 min-w-[24px] place-items-center rounded-full bg-brand px-1 text-caption-strong tabular-nums text-brand-on">
                                    {dayDate.format('D')}
                                  </span>
                                ) : (
                                  <span
                                    className={`grid h-6 min-w-[24px] place-items-center px-1 text-caption-strong tabular-nums ${
                                      !isCurrentMonth ? 'text-text-disabled' : isSaturday ? 'text-status-error' : 'text-text-primary'
                                    }`}
                                  >
                                    {dayDate.format('D')}
                                  </span>
                                )}

                                <div className="flex items-center gap-1">
                                  {isSaturday && isCurrentMonth && dayEvents.length === 0 && (
                                    <span className="hidden px-1 text-overline text-status-error sm:inline">
                                      Weekend
                                    </span>
                                  )}
                                  {isAdmin && isCurrentMonth && (
                                    <span
                                      className="grid h-5 w-5 place-items-center rounded-sm text-brand-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-100 hover:bg-brand-subtle"
                                      title="Click to add event"
                                    >
                                      <Add16Regular aria-hidden />
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Events */}
                              <div className="flex-1 space-y-0.5">
                                {dayEvents.slice(0, 3).map(event => {
                                  const eventResource = event.resource as ExtendedCalendarEvent;
                                  const isCancelled = eventResource?.event_type?.toLowerCase() === 'cancelled_class';
                                  return (
                                    <div
                                      key={event.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEventClick(event);
                                      }}
                                      onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        setCurrentView('day');
                                        setCurrentDate(dayDate.toDate());
                                      }}
                                      className={`cal-event ${isCancelled ? 'is-cancelled' : ''}`}
                                      style={accentVar(getEventAccent(eventResource))}
                                      title={`${event.title} (Double-click to open day view)`}
                                    >
                                      <span className="truncate">{event.title}</span>
                                    </div>
                                  );
                                })}

                                {dayEvents.length > 3 && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCurrentView('day');
                                      setCurrentDate(dayDate.toDate());
                                    }}
                                    className="block rounded-sm px-1.5 text-left text-caption-strong text-brand-foreground hover:underline"
                                  >
                                    +{dayEvents.length - 3} more
                                  </button>
                                )}
                              </div>
                            </div>
                          );

                          current.add(1, 'day');
                        }

                        return days;
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {/* Week View */}
              {currentView === 'week' && (
                <div className="overflow-x-auto">
                  <div className="min-w-[800px]">
                    {/* Week header */}
                    <div className="grid grid-cols-8 border-b border-border-subtle">
                      <div className="flex items-end justify-end px-2 py-2 text-caption text-text-muted">
                        Time
                      </div>
                      {(() => {
                        const startOfWeek = moment(currentDate).startOf('week');
                        const weekDays = [];

                        for (let i = 0; i < 7; i++) {
                          const day = moment(startOfWeek).add(i, 'days');
                          const isToday = day.format('YYYY-MM-DD') === moment().local().format('YYYY-MM-DD');
                          const isSaturday = day.day() === 6;

                          weekDays.push(
                            <div
                              key={day.format('YYYY-MM-DD')}
                              className={`flex flex-col items-start gap-0.5 border-l border-border-subtle px-2 py-2 ${
                                isToday ? 'bg-brand-subtle' : ''
                              }`}
                            >
                              <span
                                className={`text-caption ${
                                  isToday ? 'text-brand-foreground' : isSaturday ? 'text-status-error' : 'text-text-muted'
                                }`}
                              >
                                {day.format('ddd')}
                              </span>
                              {isToday ? (
                                <span className="grid h-8 w-8 place-items-center rounded-full bg-brand text-subheading tabular-nums text-brand-on">
                                  {day.format('D')}
                                </span>
                              ) : (
                                <span
                                  className={`grid h-8 place-items-center text-subheading tabular-nums ${
                                    isSaturday ? 'text-status-error' : 'text-text-primary'
                                  }`}
                                >
                                  {day.format('D')}
                                </span>
                              )}
                            </div>
                          );
                        }

                        return weekDays;
                      })()}
                    </div>

                    {/* Week grid */}
                    <div className="divide-y divide-border-subtle">
                      {(() => {
                        const hours = [];
                        const startOfWeek = moment(currentDate).startOf('week');

                        for (let hour = 6; hour <= 22; hour++) {
                          hours.push(
                            <div key={hour} className="grid min-h-[56px] grid-cols-8 divide-x divide-border-subtle">
                              <div className="px-2 pt-1 text-right text-caption tabular-nums text-text-muted">
                                {moment().hour(hour).minute(0).format('h:mm A')}
                              </div>
                              {(() => {
                                const weekCells = [];

                                for (let i = 0; i < 7; i++) {
                                  const day = moment(startOfWeek).add(i, 'days');
                                  const dayEvents = viewFilteredEvents.filter(event =>
                                    isEventInHour(event, hour, day.format('YYYY-MM-DD'))
                                  );
                                  const isToday = day.format('YYYY-MM-DD') === moment().local().format('YYYY-MM-DD');
                                  const isSaturday = day.day() === 6;

                                  weekCells.push(
                                    <div
                                      key={`${day.format('YYYY-MM-DD')}-${hour}`}
                                      onClick={() => {
                                        if (!isAdmin) return;

                                        const sessionEvent = dayEvents.find(event =>
                                          event.title?.startsWith('[SESSION]') ||
                                          (event.resource as ExtendedCalendarEvent)?.isSession
                                        );

                                        if (sessionEvent) {
                                          handleEventClick(sessionEvent);
                                        } else {
                                          handleCellClick(day, hour);
                                        }
                                      }}
                                      className={`group p-1 transition-colors duration-150 ease-fluent-standard ${
                                        isAdmin ? 'cursor-pointer hover:bg-surface-hover' : ''
                                      } ${
                                        isToday
                                          ? 'bg-brand-subtle/40'
                                          : isSaturday
                                            ? 'bg-status-error-subtle/40'
                                            : 'bg-surface-default'
                                      }`}
                                      style={{
                                        backgroundColor: (() => {
                                          const parentEvent = dayEvents.find(event =>
                                            !event.title?.startsWith('[SESSION]') &&
                                            !(event.resource as ExtendedCalendarEvent)?.isSession
                                          );
                                          if (parentEvent) {
                                            return tintColor(getEventAccent(parentEvent.resource as ExtendedCalendarEvent));
                                          }
                                          return undefined;
                                        })()
                                      }}
                                    >
                                      {(() => {
                                        const sessions = dayEvents.filter(event =>
                                          event.title?.startsWith('[SESSION]') ||
                                          (event.resource as ExtendedCalendarEvent)?.isSession
                                        );
                                        const parentEvent = dayEvents.find(event =>
                                          !event.title?.startsWith('[SESSION]') &&
                                          !(event.resource as ExtendedCalendarEvent)?.isSession
                                        );

                                        if (parentEvent) {
                                          return (
                                            <div className="space-y-1">
                                              <div className="truncate px-1 text-caption-strong text-text-primary">
                                                {parentEvent.title}
                                              </div>

                                              {sessions.length > 0 && sessions.map((event, idx) => (
                                                <div
                                                  key={idx}
                                                  className="cal-event"
                                                  style={accentVar(getEventAccent(event.resource as ExtendedCalendarEvent))}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleEventClick(event);
                                                  }}
                                                  title={`${event.title} - Click for details`}
                                                >
                                                  <span className="truncate">{event.title.replace('[SESSION] ', '')}</span>
                                                </div>
                                              ))}
                                            </div>
                                          );
                                        } else {
                                          return isAdmin && (
                                            <div className="flex h-full items-center justify-center text-text-muted opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                                              <Add16Regular aria-hidden />
                                            </div>
                                          );
                                        }
                                      })()}
                                    </div>
                                  );
                                }

                                return weekCells;
                              })()}
                            </div>
                          );
                        }

                        return hours;
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {/* Day View */}
              {currentView === 'day' && (
                <div>
                  {/* Day header */}
                  <div className="border-b border-border-subtle px-4 py-3">
                    <h3 className="text-subheading text-text-primary">
                      {moment(currentDate).format('dddd, MMMM D, YYYY')}
                    </h3>
                    <p className="mt-0.5 text-caption text-text-muted">
                      {viewFilteredEvents.length} events and sessions scheduled for today
                    </p>
                  </div>

                  {/* Day schedule */}
                  <div className="divide-y divide-border-subtle">
                    {(() => {
                      const hours = [];

                      for (let hour = 6; hour <= 22; hour++) {
                        const hourEvents = viewFilteredEvents.filter(event =>
                          isEventInHour(event, hour, moment(currentDate).format('YYYY-MM-DD'))
                        );

                        hours.push(
                          <div key={hour} className="grid min-h-[56px] grid-cols-12 divide-x divide-border-subtle">
                            <div className="col-span-3 px-3 pt-1.5 text-right text-caption tabular-nums text-text-muted sm:col-span-2">
                              {moment().hour(hour).minute(0).format('h:mm A')}
                            </div>
                            <div
                              className={`group col-span-9 p-2 transition-colors duration-150 ease-fluent-standard sm:col-span-10 ${
                                isAdmin ? 'cursor-pointer hover:bg-surface-hover' : ''
                              }`}
                              style={{
                                backgroundColor: (() => {
                                  const parentEvent = hourEvents.find(event =>
                                    !event.title?.startsWith('[SESSION]') &&
                                    !(event.resource as ExtendedCalendarEvent)?.isSession
                                  );
                                  if (parentEvent) {
                                    return tintColor(getEventAccent(parentEvent.resource as ExtendedCalendarEvent));
                                  }
                                  return undefined;
                                })()
                              }}
                              onClick={() => {
                                if (!isAdmin) return;

                                const sessionEvent = hourEvents.find(event =>
                                  event.title?.startsWith('[SESSION]') ||
                                  (event.resource as ExtendedCalendarEvent)?.isSession
                                );

                                if (sessionEvent) {
                                  handleEventClick(sessionEvent);
                                } else {
                                  handleCellClick(moment(currentDate), hour);
                                }
                              }}
                            >
                              {(() => {
                                const sessions = hourEvents.filter(event =>
                                  event.title?.startsWith('[SESSION]') ||
                                  (event.resource as ExtendedCalendarEvent)?.isSession
                                );
                                const parentEvent = hourEvents.find(event =>
                                  !event.title?.startsWith('[SESSION]') &&
                                  !(event.resource as ExtendedCalendarEvent)?.isSession
                                );

                                if (parentEvent) {
                                  return (
                                    <div className="space-y-1.5">
                                      <div className="text-caption-strong text-text-primary">
                                        {parentEvent.title}
                                      </div>

                                      {sessions.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                          {sessions.map((event, idx) => (
                                            <div
                                              key={idx}
                                              className="cal-event cal-event--roomy"
                                              style={accentVar(getEventAccent(event.resource as ExtendedCalendarEvent))}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleEventClick(event);
                                              }}
                                              title={`${event.title} - Click for details`}
                                            >
                                              <span>{event.title.replace('[SESSION] ', '')}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                } else {
                                  return isAdmin && (
                                    <div className="flex items-center gap-1.5 text-caption text-text-muted opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                                      <Add16Regular aria-hidden />
                                      Click to schedule session
                                    </div>
                                  );
                                }
                              })()}
                            </div>
                          </div>
                        );
                      }

                      return hours;
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Side panel */}
        <aside className="space-y-4" aria-label="Calendar details">
          {/* Upcoming events */}
          <section className="rounded-lg bg-surface-default shadow">
            <div className="flex items-center justify-between gap-2 border-b border-border-subtle px-4 py-3">
              <h3 className="text-subheading text-text-primary">Upcoming</h3>
              <span className="text-caption text-text-muted">{moment(currentDate).format('MMMM YYYY')}</span>
            </div>
            {upcomingEvents.length === 0 ? (
              <div className="flex flex-col items-center px-4 py-8 text-center">
                <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-surface-subtle text-text-muted">
                  <CalendarLtr20Regular aria-hidden />
                </div>
                <p className="text-body-strong text-text-primary">No upcoming events</p>
                <p className="mt-0.5 text-caption text-text-muted">
                  Nothing else is scheduled in {moment(currentDate).format('MMMM')}.
                </p>
              </div>
            ) : (
              <ul className="space-y-0.5 p-2">
                {upcomingEvents.map(ev => {
                  const start = moment(ev.start_date);
                  return (
                    <li key={ev.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedEvent(ev);
                          setShowEventModal(true);
                        }}
                        className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors duration-150 ease-fluent-standard hover:bg-surface-hover"
                      >
                        <div className="flex w-10 shrink-0 flex-col items-center rounded-md border border-border-subtle bg-surface-default py-0.5">
                          <span className="text-overline text-text-muted">{start.format('MMM')}</span>
                          <span className="text-subheading tabular-nums text-text-primary">{start.format('D')}</span>
                        </div>
                        <div
                          className="min-w-0 flex-1 border-l-[3px] pl-2"
                          style={{ borderLeftColor: getEventAccent(ev) }}
                        >
                          <p className="truncate text-body-strong text-text-primary">
                            {getCleanTitle(ev.title, ev.event_type)}
                          </p>
                          <p className="truncate text-caption text-text-muted">
                            {start.format('dddd')} ·{' '}
                            {ev.is_all_day || !ev.start_time
                              ? 'All day'
                              : `${ev.start_time.slice(0, 5)}${ev.end_time ? ` – ${ev.end_time.slice(0, 5)}` : ''}`}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Event types: filter + legend */}
          <section className="rounded-lg bg-surface-default shadow">
            <div className="flex items-center justify-between gap-2 border-b border-border-subtle px-4 py-3">
              <h3 className="flex items-center gap-2 text-subheading text-text-primary">
                <Filter20Regular className="text-text-muted" aria-hidden />
                Event types
              </h3>
              <span className="text-caption text-text-muted">Nepal Institutional System</span>
            </div>
            <div className="space-y-0.5 p-2" role="radiogroup" aria-label="Filter by event type">
              {[
                { value: 'all', label: 'All Event Types', desc: 'Show every category' },
                ...EVENT_TYPE_FILTERS,
              ].map(opt => {
                const selected = filterType === opt.value;
                const count = opt.value === 'all' ? events.length : eventTypeCounts[opt.value] || 0;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setFilterType(opt.value)}
                    className={`flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors duration-150 ease-fluent-standard ${
                      selected ? 'bg-brand-subtle' : 'hover:bg-surface-hover'
                    }`}
                  >
                    <span className="flex w-4 shrink-0 justify-center">
                      {opt.value === 'all' ? (
                        <CalendarLtr16Regular className="text-text-muted" aria-hidden />
                      ) : (
                        <span className="cal-swatch" style={accentVar(EVENT_TYPE_ACCENTS[opt.value])} />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-body ${
                          selected ? 'font-semibold text-brand-foreground' : 'text-text-primary'
                        }`}
                      >
                        {opt.label}
                      </span>
                      <span className="block truncate text-caption text-text-muted">{opt.desc}</span>
                    </span>
                    <span className="text-caption tabular-nums text-text-muted">{count}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Nepal calendar message bar */}
          <div className="flex items-start gap-2 rounded-md border border-status-info-border bg-status-info-subtle px-3 py-2 text-body text-text-primary">
            <Info20Regular className="shrink-0 text-status-info" aria-hidden />
            <p>
              <span className="font-semibold">Nepal Academic Calendar Standard:</span> Saturday is the official weekly institutional holiday (marked in red). Sunday through Friday are active working academic days.
            </p>
          </div>
        </aside>
      </div>

      {/* Event Details Dialog */}
      {showEventModal && selectedEvent && (
        <DialogShell
          onClose={() => setShowEventModal(false)}
          widthClass="max-w-xl"
          icon={
            <div className="cal-chip h-10 w-10" style={accentVar(getEventAccent(selectedEvent))}>
              {React.createElement(getEventTypeInfo(selectedEvent.event_type).icon, {
                className: 'h-5 w-5',
                'aria-hidden': true
              })}
            </div>
          }
          title={getCleanTitle(selectedEvent.title, selectedEvent.event_type)}
          description={
            <span className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface-subtle px-2 py-0.5 text-caption text-text-secondary">
              <span className="cal-swatch" style={accentVar(getEventAccent(selectedEvent))} />
              {getEventTypeInfo(selectedEvent.event_type).label}
            </span>
          }
          footer={
            isAdmin ? (
              <>
                <Button variant="destructive" className="mr-auto" onClick={handleDeleteEvent}>
                  <Delete20Regular aria-hidden />
                  Delete
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowSessionModal(true);
                    fetchEventSessions(selectedEvent.id);
                  }}
                >
                  Manage Sessions
                </Button>
                <Button onClick={handleEditEvent}>
                  <Edit20Regular aria-hidden />
                  Edit Event
                </Button>
              </>
            ) : undefined
          }
        >
          <div className="space-y-4">
            {selectedEvent.description && (
              <div>
                <h3 className="mb-1 text-caption-strong text-text-muted">Description</h3>
                <p className="text-body text-text-primary">{selectedEvent.description}</p>
              </div>
            )}

            <dl className="divide-y divide-border-subtle rounded-md border border-border-subtle">
              <div className="flex items-start gap-3 px-3 py-2.5">
                <Clock20Regular className="shrink-0 text-text-muted" aria-hidden />
                <div>
                  <dt className="text-caption text-text-muted">Date & Time</dt>
                  <dd className="text-body text-text-primary">
                    <p>{moment(selectedEvent.start_date).format('MMMM D, YYYY')}</p>
                    {!selectedEvent.is_all_day && selectedEvent.start_time && (
                      <p className="text-caption text-text-muted">
                        {selectedEvent.start_time} {selectedEvent.end_time && `- ${selectedEvent.end_time}`}
                      </p>
                    )}
                    {selectedEvent.is_all_day && <p className="text-caption text-text-muted">All day</p>}
                  </dd>
                </div>
              </div>

              {selectedEvent.location && (
                <div className="flex items-start gap-3 px-3 py-2.5">
                  <Location20Regular className="shrink-0 text-text-muted" aria-hidden />
                  <div>
                    <dt className="text-caption text-text-muted">Location</dt>
                    <dd className="text-body text-text-primary">{selectedEvent.location}</dd>
                  </div>
                </div>
              )}
            </dl>
          </div>
        </DialogShell>
      )}

      {/* Create Event Dialog */}
      {showCreateModal && (
        <DialogShell
          onClose={() => setShowCreateModal(false)}
          widthClass="max-w-2xl"
          title="Create New Event"
          description={
            eventForm.start_date ? (
              <div className="mt-1 space-y-0.5">
                <p className="flex items-center gap-1.5">
                  <CalendarLtr16Regular aria-hidden />
                  Selected date: {moment(eventForm.start_date).format('MMMM D, YYYY')}
                </p>
                {eventForm.start_time && (
                  <p className="flex items-center gap-1.5">
                    <Clock16Regular aria-hidden />
                    Selected time: {eventForm.start_time} - {eventForm.end_time}
                  </p>
                )}
                {eventForm.is_all_day && (
                  <p className="flex items-center gap-1.5">
                    <CalendarLtr16Regular aria-hidden />
                    All-day event
                  </p>
                )}
              </div>
            ) : undefined
          }
          footer={
            <>
              <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button type="submit" form="create-event-form">
                Create Event
              </Button>
            </>
          }
        >
          <form id="create-event-form" onSubmit={handleCreateEvent} className="space-y-4">
            {renderEventFields('create')}
          </form>
        </DialogShell>
      )}

      {/* Edit Event Dialog */}
      {showEditModal && selectedEvent && (
        <DialogShell
          onClose={() => setShowEditModal(false)}
          widthClass="max-w-2xl"
          title="Edit Event"
          footer={
            <>
              <Button type="button" variant="destructive" className="mr-auto" onClick={handleDeleteEvent}>
                <Delete20Regular aria-hidden />
                Delete
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowEditModal(false)}>
                Cancel
              </Button>
              <Button type="submit" form="edit-event-form">
                Update Event
              </Button>
            </>
          }
        >
          <form id="edit-event-form" onSubmit={handleUpdateEvent} className="space-y-4">
            {renderEventFields('edit')}
          </form>
        </DialogShell>
      )}

      {/* Settings Dialog */}
      {showSettingsModal && (
        <DialogShell
          onClose={() => setShowSettingsModal(false)}
          widthClass="max-w-md"
          title="Calendar Settings"
          footer={
            <>
              <Button variant="outline" onClick={() => setShowSettingsModal(false)}>
                Cancel
              </Button>
              <Button onClick={() => setShowSettingsModal(false)}>
                Save Settings
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label htmlFor="settings-default-view" className={fieldLabelClass}>Default View</label>
              <NativeSelect id="settings-default-view">
                <option>Month</option>
                <option>Week</option>
                <option>Day</option>
              </NativeSelect>
            </div>

            <div>
              <label htmlFor="settings-week-start" className={fieldLabelClass}>Week Starts On</label>
              <NativeSelect id="settings-week-start">
                <option>Sunday</option>
                <option>Monday</option>
              </NativeSelect>
            </div>

            <div className="divide-y divide-border-subtle rounded-md border border-border-subtle">
              <div className="flex items-center justify-between gap-4 px-3 py-2.5">
                <span className="text-body text-text-primary">Show Weekends</span>
                <Switch defaultChecked aria-label="Show Weekends" />
              </div>
              <div className="flex items-center justify-between gap-4 px-3 py-2.5">
                <span className="text-body text-text-primary">Show Time Grid</span>
                <Switch defaultChecked aria-label="Show Time Grid" />
              </div>
            </div>
          </div>
        </DialogShell>
      )}

      {/* Edit Session Dialog */}
      {showEditSessionModal && selectedSession && (
        <DialogShell
          onClose={() => setShowEditSessionModal(false)}
          widthClass="max-w-2xl"
          title="Edit Session"
          footer={
            <>
              <Button
                variant="destructive"
                className="mr-auto"
                onClick={() => {
                  if (selectedSession && window.confirm('Are you sure you want to delete this session?')) {
                    handleDeleteSession(selectedSession.id);
                    setShowEditSessionModal(false);
                  }
                }}
              >
                <Delete20Regular aria-hidden />
                Delete
              </Button>
              <Button variant="outline" onClick={() => setShowEditSessionModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateSession}>
                Update Session
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label htmlFor="edit-session-title" className={fieldLabelClass}>Session Title</label>
              <Input
                id="edit-session-title"
                type="text"
                value={selectedSession.title}
                onChange={(e) => setSelectedSession({...selectedSession, title: e.target.value})}
                placeholder="Enter session title..."
              />
            </div>

            <div>
              <label htmlFor="edit-session-description" className={fieldLabelClass}>Description</label>
              <Textarea
                id="edit-session-description"
                rows={3}
                value={selectedSession.description || ''}
                onChange={(e) => setSelectedSession({...selectedSession, description: e.target.value})}
                placeholder="Enter session description..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="edit-session-start" className={fieldLabelClass}>Start Time</label>
                <Input
                  id="edit-session-start"
                  type="time"
                  value={selectedSession.start_time}
                  onChange={(e) => setSelectedSession({...selectedSession, start_time: e.target.value})}
                />
              </div>
              <div>
                <label htmlFor="edit-session-end" className={fieldLabelClass}>End Time</label>
                <Input
                  id="edit-session-end"
                  type="time"
                  value={selectedSession.end_time}
                  onChange={(e) => setSelectedSession({...selectedSession, end_time: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="edit-session-presenter" className={fieldLabelClass}>Presenter</label>
                <Input
                  id="edit-session-presenter"
                  type="text"
                  value={selectedSession.presenter || ''}
                  onChange={(e) => setSelectedSession({...selectedSession, presenter: e.target.value})}
                  placeholder="Enter presenter name..."
                />
              </div>
              <div>
                <label htmlFor="edit-session-location" className={fieldLabelClass}>Location</label>
                <Input
                  id="edit-session-location"
                  type="text"
                  value={selectedSession.location || ''}
                  onChange={(e) => setSelectedSession({...selectedSession, location: e.target.value})}
                  placeholder="Enter session location..."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="edit-session-type" className={fieldLabelClass}>Session Type</label>
                <Input
                  id="edit-session-type"
                  type="text"
                  value={selectedSession.session_type || ''}
                  onChange={(e) => setSelectedSession({...selectedSession, session_type: e.target.value})}
                  placeholder="e.g., Lecture, Workshop, Lab..."
                />
              </div>
              <div>
                <label htmlFor="edit-session-color" className={fieldLabelClass}>Color</label>
                <input
                  id="edit-session-color"
                  type="color"
                  value={selectedSession.color_code || '#3B82F6'}
                  onChange={(e) => setSelectedSession({...selectedSession, color_code: e.target.value})}
                  className="h-9 w-full cursor-pointer rounded-md border border-border-default bg-surface-default p-1 transition-colors duration-150 hover:border-border-strong"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="attendance_required"
                checked={selectedSession.attendance_required}
                onChange={(e) => setSelectedSession({...selectedSession, attendance_required: e.target.checked})}
                className={checkboxClass}
              />
              <label htmlFor="attendance_required" className="cursor-pointer text-body text-text-primary">
                Attendance Required
              </label>
            </div>
          </div>
        </DialogShell>
      )}

      {/* Toast (Fluent message bar) */}
      {snackbar.open && (
        <div className="fixed bottom-4 right-4 z-50 animate-fade-in-up" role="status" aria-live="polite">
          <div className={`flex max-w-sm items-start gap-2 rounded-md border py-2 pl-3 pr-2 text-text-primary shadow-lg ${snackbarTone.box}`}>
            <SnackbarIcon className={`mt-0.5 shrink-0 ${snackbarTone.iconClass}`} aria-hidden />
            <span className="flex-1 py-0.5 text-body">{snackbar.message}</span>
            <button
              type="button"
              onClick={() => setSnackbar({ ...snackbar, open: false })}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-text-muted transition-colors duration-150 hover:bg-surface-hover hover:text-text-primary"
              aria-label="Dismiss notification"
            >
              <Dismiss16Regular aria-hidden />
            </button>
          </div>
        </div>
      )}

      {/* Session Management Dialog */}
      {showSessionModal && selectedEvent && (
        <DialogShell
          onClose={() => setShowSessionModal(false)}
          widthClass="max-w-4xl"
          title="Manage Sessions"
          description={selectedEvent.title}
        >
          {/* Add session */}
          <div className="mb-5 rounded-lg border border-border-subtle bg-surface-subtle p-4">
            <h3 className="mb-3 text-subheading text-text-primary">Add New Session</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="manage-session-title" className={fieldLabelClass}>Session Title</label>
                <Input
                  id="manage-session-title"
                  type="text"
                  value={sessionForm.title}
                  onChange={(e) => setSessionForm({...sessionForm, title: e.target.value})}
                  placeholder="e.g., Introduction"
                />
              </div>
              <div>
                <label htmlFor="manage-session-presenter" className={fieldLabelClass}>Presenter</label>
                <Input
                  id="manage-session-presenter"
                  type="text"
                  value={sessionForm.presenter}
                  onChange={(e) => setSessionForm({...sessionForm, presenter: e.target.value})}
                  placeholder="Optional"
                />
              </div>
              <div>
                <label htmlFor="manage-session-start" className={fieldLabelClass}>Start Time</label>
                <Input
                  id="manage-session-start"
                  type="time"
                  value={sessionForm.start_time}
                  onChange={(e) => setSessionForm({...sessionForm, start_time: e.target.value})}
                />
              </div>
              <div>
                <label htmlFor="manage-session-end" className={fieldLabelClass}>End Time</label>
                <Input
                  id="manage-session-end"
                  type="time"
                  value={sessionForm.end_time}
                  onChange={(e) => setSessionForm({...sessionForm, end_time: e.target.value})}
                />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="manage-session-description" className={fieldLabelClass}>Description</label>
                <Textarea
                  id="manage-session-description"
                  value={sessionForm.description}
                  onChange={(e) => setSessionForm({...sessionForm, description: e.target.value})}
                  rows={2}
                  placeholder="Optional session description"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={() => handleCreateSession()}>
                <Add20Regular aria-hidden />
                Add Session
              </Button>
            </div>
          </div>

          {/* Sessions list */}
          <div>
            <h3 className="mb-3 text-subheading text-text-primary">
              Sessions ({eventSessions.length})
            </h3>
            {eventSessions.length === 0 ? (
              <div className="flex flex-col items-center rounded-lg border border-dashed border-border-default py-8 text-center">
                <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-surface-subtle text-text-muted">
                  <CalendarLtr20Regular aria-hidden />
                </div>
                <p className="text-body text-text-muted">No sessions created yet</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {eventSessions.map((session) => (
                  <li
                    key={session.id}
                    className="flex items-start gap-3 rounded-md border border-l-[3px] border-border-subtle bg-surface-default px-3 py-2.5"
                    style={{ borderLeftColor: session.color_code || 'var(--chart-1)' }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        <span className="text-body-strong text-text-primary">{session.title}</span>
                        <span className="inline-flex items-center gap-1 text-caption tabular-nums text-text-muted">
                          <Clock16Regular aria-hidden />
                          {session.start_time} - {session.end_time}
                        </span>
                      </div>
                      {session.presenter && (
                        <p className="mt-1 flex items-center gap-1 text-caption text-text-secondary">
                          <Person16Regular aria-hidden />
                          Presenter: {session.presenter}
                        </p>
                      )}
                      {session.description && (
                        <p className="mt-1.5 text-caption text-text-muted">{session.description}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteSession(session.id)}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-status-error transition-colors duration-150 hover:bg-status-error-subtle"
                      aria-label={`Delete session ${session.title}`}
                      title="Delete session"
                    >
                      <Delete20Regular aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogShell>
      )}

      {/* Create Session Dialog */}
      {showCreateSessionModal && (
        <DialogShell
          onClose={() => setShowCreateSessionModal(false)}
          widthClass="max-w-2xl"
          title="Create Session"
          description={`Creating a new session for ${clickedDateForSession}`}
          footer={
            <>
              <Button variant="outline" onClick={() => setShowCreateSessionModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateSessionWithEvent}>
                Create Session
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="create-session-title" className={fieldLabelClass}>Session Title *</label>
                <Input
                  id="create-session-title"
                  type="text"
                  value={sessionForm.title}
                  onChange={(e) => setSessionForm({...sessionForm, title: e.target.value})}
                  placeholder="e.g., Introduction to Programming"
                />
              </div>
              <div>
                <label htmlFor="create-session-type" className={fieldLabelClass}>Session Type</label>
                <NativeSelect
                  id="create-session-type"
                  value={sessionForm.session_type}
                  onChange={(e) => setSessionForm({...sessionForm, session_type: e.target.value})}
                >
                  <option value="lecture">Lecture</option>
                  <option value="practical">Practical</option>
                  <option value="tutorial">Tutorial</option>
                  <option value="lab">Lab</option>
                  <option value="workshop">Workshop</option>
                  <option value="seminar">Seminar</option>
                </NativeSelect>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="create-session-start" className={fieldLabelClass}>Start Time *</label>
                <Input
                  id="create-session-start"
                  type="time"
                  value={sessionForm.start_time}
                  onChange={(e) => setSessionForm({...sessionForm, start_time: e.target.value})}
                />
              </div>
              <div>
                <label htmlFor="create-session-end" className={fieldLabelClass}>End Time *</label>
                <Input
                  id="create-session-end"
                  type="time"
                  value={sessionForm.end_time}
                  onChange={(e) => setSessionForm({...sessionForm, end_time: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="create-session-presenter" className={fieldLabelClass}>Presenter</label>
                <Input
                  id="create-session-presenter"
                  type="text"
                  value={sessionForm.presenter}
                  onChange={(e) => setSessionForm({...sessionForm, presenter: e.target.value})}
                  placeholder="Optional"
                />
              </div>
              <div>
                <label htmlFor="create-session-location" className={fieldLabelClass}>Location</label>
                <Input
                  id="create-session-location"
                  type="text"
                  value={sessionForm.location}
                  onChange={(e) => setSessionForm({...sessionForm, location: e.target.value})}
                  placeholder="Optional"
                />
              </div>
            </div>

            <div>
              <label htmlFor="create-session-description" className={fieldLabelClass}>Description</label>
              <Textarea
                id="create-session-description"
                value={sessionForm.description}
                onChange={(e) => setSessionForm({...sessionForm, description: e.target.value})}
                rows={3}
                placeholder="Optional session description"
              />
            </div>
          </div>
        </DialogShell>
      )}
    </div>
  );
};

export default AcademicCalendar;
