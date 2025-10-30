import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Calendar, momentLocalizer, Views, View, Event } from 'react-big-calendar';
import type { CSSProperties } from 'react';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import '../styles/calendar-dark.css';
import { useAuth } from '@/contexts/useAuth';
import {
  CalendarDays,
  Plus,
  Filter,
  Settings,
  Clock,
  BookOpen,
  Users,
  AlertCircle,
  X,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Info,
  GraduationCap,
  PartyPopper,
  CalendarX,
  LucideIcon
} from 'lucide-react';

const localizer = momentLocalizer(moment);

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
      const token = localStorage.getItem('authToken');
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

      const apiUrl = `http://localhost:8000/api/calendar/events?${params.toString()}`;
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
                `http://localhost:8000/api/event-sessions/events/${event.id}/sessions`,
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
      const token = localStorage.getItem('authToken');
      if (!token) return;

      const response = await fetch(
        `http://localhost:8000/api/event-sessions/events/${eventId}/sessions`,
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
      const token = localStorage.getItem('authToken');
      if (!token) return;

      const response = await fetch(
        `http://localhost:8000/api/event-sessions/events/${selectedEvent.id}/sessions`,
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
      const token = localStorage.getItem('authToken');
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

        const eventResponse = await fetch('http://localhost:8000/api/calendar/events', {
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

      const sessionResponse = await fetch(`http://localhost:8000/api/event-sessions/events/${targetEventId}/sessions`, {
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
      const token = localStorage.getItem('authToken');
      if (!token) return;

      const response = await fetch(
        `http://localhost:8000/api/event-sessions/sessions/${sessionId}`,
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
      const token = localStorage.getItem('authToken'); // Use authToken instead of token
      const response = await fetch('http://localhost:8000/api/calendar/stats/overview', {
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
      
      const token = localStorage.getItem('authToken');
      const response = await fetch(`http://localhost:8000/api/calendar/events/${selectedEvent.id}`, {
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
        const token = localStorage.getItem('authToken');
        const response = await fetch(`http://localhost:8000/api/calendar/events/${selectedEvent.id}`, {
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
      const token = localStorage.getItem('authToken');
      const response = await fetch(`http://localhost:8000/api/event-sessions/${selectedSession.id}`, {
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
      const token = localStorage.getItem('authToken');
      const response = await fetch('http://localhost:8000/api/calendar/settings/', {
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
      const token = localStorage.getItem('authToken');
      
      // Prepare the event data with proper null handling for empty fields
      const eventData = {
        ...eventForm,
        start_time: eventForm.start_time.trim() === '' ? null : eventForm.start_time,
        end_time: eventForm.end_time.trim() === '' ? null : eventForm.end_time,
        end_date: eventForm.end_date.trim() === '' ? eventForm.start_date : eventForm.end_date,
        description: eventForm.description.trim() === '' ? null : eventForm.description,
      };
      
      const response = await fetch('http://localhost:8000/api/calendar/events', {
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
    const types: { [key: string]: { icon: LucideIcon; color: string; label: string } } = {
      class: { icon: GraduationCap, color: '#22C55E', label: 'Academic Day' },
      exam: { icon: AlertCircle, color: '#F97316', label: 'Exam' },
      holiday: { icon: PartyPopper, color: '#EF4444', label: 'Holiday' },
      special_event: { icon: Users, color: '#8B5CF6', label: 'Special Event' },
      cancelled_class: { icon: CalendarX, color: '#64748B', label: 'Cancelled' }
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

  return (
    <div className={embedded ? "w-full" : "min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950"}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="bg-slate-900/60 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Academic Calendar</h1>
              <p className="text-slate-400">Manage your academic schedule and events</p>
              {/* Debug badge */}
              <div className="mt-2 flex gap-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  isAdmin ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'
                }`}>
                  {isAdmin ? 'Admin User' : 'Student User'}
                </span>
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400">
                  Role: {user?.role || 'Unknown'}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-3 flex-wrap">
              {/* Date Navigation */}
              <div className="flex items-center gap-2 bg-slate-800/60 rounded-xl p-2">
                <button
                  onClick={navigateBack}
                  className="p-2 hover:bg-slate-700/60 rounded-lg transition-all duration-200"
                >
                  <ChevronLeft className="w-5 h-5 text-slate-300" />
                </button>
                
                <div className="px-4 py-2 text-white font-medium min-w-[200px] text-center">
                  {formatDisplayDate()}
                </div>
                
                <button
                  onClick={navigateNext}
                  className="p-2 hover:bg-slate-700/60 rounded-lg transition-all duration-200"
                >
                  <ChevronRight className="w-5 h-5 text-slate-300" />
                </button>
                
                <button
                  onClick={navigateToday}
                  className="px-3 py-2 bg-gradient-to-r from-blue-500 to-teal-400 text-white rounded-lg hover:from-blue-600 hover:to-teal-500 transition-all duration-200 font-medium"
                >
                  Today
                </button>
              </div>

              {/* View Selector */}
              <div className="flex bg-slate-800/60 rounded-xl p-1">
                {(['month', 'week', 'day'] as const).map((view) => (
                  <button
                    key={view}
                    onClick={() => setCurrentView(view)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all duration-200 ${
                      currentView === view
                        ? 'bg-gradient-to-r from-blue-500 to-teal-400 text-white shadow-md'
                        : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                    }`}
                  >
                    {view}
                  </button>
                ))}
              </div>

              {/* Filter */}
              <div className="relative">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="appearance-none bg-slate-800/60 border border-slate-600/50 rounded-xl px-4 py-2.5 pr-10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 backdrop-blur-md"
                >
                  <option value="all">All Events</option>
                  <option value="class">Academic Days</option>
                  <option value="exam">Exams</option>
                  <option value="holiday">Holidays</option>
                  <option value="special_event">Special Events</option>
                  <option value="cancelled_class">Cancelled Classes</option>
                </select>
                <Filter className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>

              {/* Admin Actions */}
              {isAdmin && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-teal-400 text-white px-4 py-2.5 rounded-xl hover:from-blue-600 hover:to-teal-500 transition-all duration-200 shadow-lg font-medium"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Event</span>
                </button>
              )}

              {/* Debug: Show if not admin */}
              {!isAdmin && (
                <div className="flex items-center gap-2 bg-orange-500/20 text-orange-300 px-3 py-2 rounded-xl border border-orange-500/30">
                  <span className="text-sm">Student View - No Create Access</span>
                </div>
              )}

              <button
                onClick={() => setShowSettingsModal(true)}
                className="p-2.5 bg-slate-800/60 border border-slate-600/50 rounded-xl hover:bg-slate-700/60 transition-all duration-200"
              >
                <Settings className="w-5 h-5 text-slate-300" />
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-slate-900/60 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">This Month</p>
                <p className="text-2xl font-bold text-white mt-1">{stats.total_events_this_month || 0}</p>
              </div>
              <div className="p-3 bg-blue-500/20 rounded-xl">
                <CalendarDays className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-slate-900/60 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">Upcoming</p>
                <p className="text-2xl font-bold text-white mt-1">{stats.upcoming_events || 0}</p>
              </div>
              <div className="p-3 bg-teal-500/20 rounded-xl">
                <Clock className="w-6 h-6 text-teal-400" />
              </div>
            </div>
          </div>

          <div className="bg-slate-900/60 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">Today's Academic Events</p>
                <p className="text-2xl font-bold text-white mt-1">{stats.classes_today || 0}</p>
              </div>
              <div className="p-3 bg-purple-500/20 rounded-xl">
                <CalendarDays className="w-6 h-6 text-purple-400" />
              </div>
            </div>
          </div>

          <div className="bg-slate-900/60 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">Attendance</p>
                <p className="text-2xl font-bold text-white mt-1">{stats.total_attendance_marked || 0}</p>
              </div>
              <div className="p-3 bg-purple-500/20 rounded-xl">
                <TrendingUp className="w-6 h-6 text-purple-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Custom Calendar - Events from Database */}
        <div className="bg-slate-900/60 backdrop-blur-md border border-slate-700/50 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-96">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mb-4"></div>
              <p className="text-slate-400">Loading calendar events...</p>
            </div>
          ) : (
            <div className="p-6">
              {/* Calendar Header */}
              <div className="mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-2">
                      {moment(currentDate).format('MMMM YYYY')}
                    </h3>
                    <div className="text-slate-400">
                      Showing {filteredEvents.length} events
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-blue-300 text-sm">
                        <div className="w-4 h-4 border border-dashed border-blue-400 rounded flex items-center justify-center">
                          <span className="text-xs">+</span>
                        </div>
                        <span>Click any date to create an event</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Calendar Views */}
              {currentView === 'month' && (
                <div className="grid grid-cols-7 gap-1">
                  {/* Day Headers */}
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="p-3 text-center font-semibold text-slate-300 bg-slate-800/60 rounded-lg">
                      {day}
                    </div>
                  ))}
                  
                  {/* Calendar Days */}
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
                      
                      days.push(
                        <div 
                          key={dayDate.format('YYYY-MM-DD')}
                          onClick={() => isAdmin && handleCellClick(dayDate)}
                          className={`min-h-[120px] p-2 border border-slate-700/50 rounded-lg relative transition-all duration-200 group ${
                            dayDate.month() === moment(currentDate).month() 
                              ? 'bg-slate-800/40' 
                              : 'bg-slate-900/20 opacity-50'
                          } ${
                            dayDate.format('YYYY-MM-DD') === moment().local().format('YYYY-MM-DD')
                              ? 'ring-2 ring-blue-500/50 bg-blue-950/30'
                              : ''
                          } ${
                            isAdmin && dayDate.month() === moment(currentDate).month()
                              ? 'cursor-pointer hover:bg-slate-700/50 hover:border-blue-500/30 hover:shadow-md'
                              : ''
                          }`}
                        >
                          {/* Day Number and Admin Indicator */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-medium text-slate-300">
                              {dayDate.format('D')}
                            </div>
                            {/* Admin indicator for clickable cells */}
                            {isAdmin && dayDate.month() === moment(currentDate).month() && (
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                <div className="w-5 h-5 border border-dashed border-blue-400 rounded flex items-center justify-center text-blue-400">
                                  <span className="text-xs font-bold">+</span>
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {/* Events for this day */}
                          <div className="space-y-1">
                            {dayEvents
                              .map(event => {
                                const eventResource = event.resource as ExtendedCalendarEvent;
                                return (
                                  <div
                                    key={event.id}
                                    onClick={(e) => {
                                      e.stopPropagation(); // Prevent cell click when clicking event
                                      handleEventClick(event);
                                    }}
                                    onDoubleClick={(e) => {
                                      e.stopPropagation();
                                      // Switch to daily view for this date
                                      setCurrentView('day');
                                      setCurrentDate(dayDate.toDate());
                                    }}
                                    className="cursor-pointer p-2 rounded text-xs font-medium text-white shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105"
                                    style={{
                                      backgroundColor: eventResource?.color_code || '#3B82F6',
                                      borderLeft: `4px solid ${eventResource?.color_code || '#3B82F6'}`
                                    }}
                                    title="Double-click to view daily details"
                                  >
                                    <div className="truncate">
                                      {event.title}
                                    </div>
                                  </div>
                                );
                              })}
                            
                            {/* Show if no events for current month days */}
                            {dayEvents.length === 0 && dayDate.month() === moment(currentDate).month() && (
                              <div className="text-xs text-slate-500 italic opacity-60">
                                {isAdmin ? 'Click to add event' : 'No events'}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                      
                      current.add(1, 'day');
                    }
                    
                    return days;
                  })()}
                </div>
              )}

              {/* Week View */}
              {currentView === 'week' && (
                <div className="space-y-2">
                  {/* Week Header */}
                  <div className="grid grid-cols-8 gap-1 mb-4">
                    <div className="p-2 text-center font-semibold text-slate-400 text-sm">Time</div>
                    {(() => {
                      const startOfWeek = moment(currentDate).startOf('week');
                      const weekDays = [];
                      
                      for (let i = 0; i < 7; i++) {
                        const day = moment(startOfWeek).add(i, 'days');
                        weekDays.push(
                          <div key={day.format('YYYY-MM-DD')} className={`p-3 text-center rounded-lg ${
                            day.format('YYYY-MM-DD') === moment().local().format('YYYY-MM-DD')
                              ? 'bg-blue-500/20 text-blue-300 font-bold'
                              : 'bg-slate-800/60 text-slate-300'
                          }`}>
                            <div className="font-semibold">{day.format('ddd')}</div>
                            <div className="text-lg">{day.format('D')}</div>
                          </div>
                        );
                      }
                      
                      return weekDays;
                    })()}
                  </div>

                  {/* Week Calendar Grid */}
                  <div className="space-y-1">
                    {(() => {
                      const hours = [];
                      const startOfWeek = moment(currentDate).startOf('week');
                      
                      for (let hour = 6; hour <= 22; hour++) {
                        hours.push(
                          <div key={hour} className="grid grid-cols-8 gap-1 h-16">
                            <div className="p-2 text-xs text-slate-400 font-medium border-r border-slate-700/50">
                              {moment().hour(hour).minute(0).format('h:mm A')}
                            </div>
                            {(() => {
                              const weekCells = [];
                              
                              for (let i = 0; i < 7; i++) {
                                const day = moment(startOfWeek).add(i, 'days');
                                const dayEvents = viewFilteredEvents.filter(event => 
                                  isEventInHour(event, hour, day.format('YYYY-MM-DD'))
                                );
                                
                                weekCells.push(
                                  <div 
                                    key={`${day.format('YYYY-MM-DD')}-${hour}`}
                                    onClick={() => {
                                      if (!isAdmin) return;
                                      
                                      // Check if this time slot has a session
                                      const sessionEvent = dayEvents.find(event => 
                                        event.title?.startsWith('[SESSION]') || 
                                        (event.resource as ExtendedCalendarEvent)?.isSession
                                      );
                                      
                                      if (sessionEvent) {
                                        // If it's a session, open session edit modal
                                        handleEventClick(sessionEvent);
                                      } else {
                                        // If empty slot, create new session
                                        handleCellClick(day, hour);
                                      }
                                    }}
                                    className={`border border-slate-700/30 rounded p-1 transition-all duration-200 group ${
                                      isAdmin ? 'cursor-pointer hover:bg-slate-700/50 hover:border-blue-500/30' : ''
                                    } ${
                                      day.format('YYYY-MM-DD') === moment().local().format('YYYY-MM-DD')
                                        ? 'bg-blue-950/20'
                                        : 'bg-slate-800/20'
                                    }`}
                                    style={{
                                      // Set background color for all time slots within event range
                                      backgroundColor: (() => {
                                        const parentEvent = dayEvents.find(event => 
                                          !event.title?.startsWith('[SESSION]') && 
                                          !(event.resource as ExtendedCalendarEvent)?.isSession
                                        );
                                        if (parentEvent) {
                                          return `${(parentEvent.resource as ExtendedCalendarEvent)?.color_code || '#3B82F6'}60`;
                                        }
                                        return undefined;
                                      })()
                                    }}
                                  >
                                    {/* Show parent event title for ALL time slots in event range, and sessions when present */}
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
                                            {/* Always show parent event title as identifier */}
                                            <div className="text-xs font-medium text-slate-400 mb-1">
                                              {parentEvent.title}
                                            </div>
                                            
                                            {/* Show sessions if they exist */}
                                            {sessions.length > 0 && sessions.map((event, idx) => (
                                              <div 
                                                key={idx}
                                                className="cursor-pointer hover:opacity-80 transition-opacity p-1 rounded text-xs"
                                                style={{
                                                  backgroundColor: `${(event.resource as ExtendedCalendarEvent)?.color_code || '#3B82F6'}80`,
                                                  color: '#ffffff',
                                                  border: `1px solid ${(event.resource as ExtendedCalendarEvent)?.color_code || '#3B82F6'}`
                                                }}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleEventClick(event);
                                                }}
                                                title={`${event.title} - Click for details`}
                                              >
                                                <div className="font-semibold">
                                                  {event.title.replace('[SESSION] ', '')}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        );
                                      } else {
                                        return isAdmin && (
                                          <div className="opacity-0 group-hover:opacity-50 text-xs text-slate-500 text-center">
                                            +
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
              )}

              {/* Day View */}
              {currentView === 'day' && (
                <div className="space-y-2">
                  {/* Day Header */}
                  <div className="bg-slate-800/60 rounded-lg p-4 text-center">
                    <h3 className="text-xl font-bold text-white">
                      {moment(currentDate).format('dddd, MMMM D, YYYY')}
                    </h3>
                  </div>

                  {/* Day Schedule */}
                  <div className="space-y-1">
                    {(() => {
                      const hours = [];
                      
                      for (let hour = 6; hour <= 22; hour++) {
                        const hourEvents = viewFilteredEvents.filter(event => 
                          isEventInHour(event, hour, moment(currentDate).format('YYYY-MM-DD'))
                        );
                        
                        hours.push(
                          <div key={hour} className="grid grid-cols-12 gap-2 min-h-[60px]">
                            <div className="col-span-2 p-3 text-sm font-medium text-slate-400 border-r border-slate-700/50">
                              {moment().hour(hour).minute(0).format('h:mm A')}
                            </div>
                            <div 
                              className={`col-span-10 border border-slate-700/30 rounded-lg p-2 transition-all duration-200 group ${
                                isAdmin ? 'cursor-pointer hover:bg-slate-700/50 hover:border-blue-500/30' : ''
                              }`}
                              style={{
                                // Set background color for all time slots within event range
                                backgroundColor: (() => {
                                  const parentEvent = hourEvents.find(event => 
                                    !event.title?.startsWith('[SESSION]') && 
                                    !(event.resource as ExtendedCalendarEvent)?.isSession
                                  );
                                  if (parentEvent) {
                                    return `${(parentEvent.resource as ExtendedCalendarEvent)?.color_code || '#3B82F6'}60`;
                                  }
                                  return undefined;
                                })()
                              }}
                              onClick={() => {
                                if (!isAdmin) return;
                                
                                // Check if this time slot has a session
                                const sessionEvent = hourEvents.find(event => 
                                  event.title?.startsWith('[SESSION]') || 
                                  (event.resource as ExtendedCalendarEvent)?.isSession
                                );
                                
                                if (sessionEvent) {
                                  // If it's a session, open session edit modal
                                  handleEventClick(sessionEvent);
                                } else {
                                  // If empty slot, create new session
                                  handleCellClick(moment(currentDate), hour);
                                }
                              }}
                            >
                              {/* Show parent event title for ALL time slots in event range, and sessions when present */}
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
                                    <div className="space-y-1">
                                      {/* Always show parent event title as identifier */}
                                      <div className="text-xs font-medium text-slate-400 mb-1">
                                        {parentEvent.title}
                                      </div>
                                      
                                      {/* Show sessions if they exist */}
                                      {sessions.length > 0 && sessions.map((event, idx) => (
                                        <div 
                                          key={idx}
                                          className="cursor-pointer hover:opacity-80 transition-opacity p-1 rounded text-xs"
                                          style={{
                                            backgroundColor: `${(event.resource as ExtendedCalendarEvent)?.color_code || '#3B82F6'}80`,
                                            color: '#ffffff',
                                            border: `1px solid ${(event.resource as ExtendedCalendarEvent)?.color_code || '#3B82F6'}`
                                          }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleEventClick(event);
                                          }}
                                          title={`${event.title} - Click for details`}
                                        >
                                          <div className="font-semibold">
                                            {event.title.replace('[SESSION] ', '')}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  );
                                } else {
                                  return isAdmin && (
                                    <div className="opacity-0 group-hover:opacity-50 text-slate-500 text-center text-sm">
                                      Click to add event
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

              {/* Event Summary */}
              <div className="mt-6 p-4 bg-slate-800/40 rounded-lg">
                <h4 className="text-sm font-medium text-slate-300 mb-2">
                  Events this {currentView}:
                </h4>
                <div className="flex flex-wrap gap-2">
                  {viewFilteredEvents.length === 0 ? (
                    <span className="text-slate-400 text-sm">No events found</span>
                  ) : (
                    viewFilteredEvents.map(event => (
                      <div 
                        key={event.id}
                        className="px-3 py-1 rounded-full text-xs font-medium text-white"
                        style={{ backgroundColor: event.resource?.color_code || '#3B82F6' }}
                      >
                        {event.title} - {moment(event.start).format('MMM D')}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Event Types Legend */}
        <div className="bg-slate-900/60 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Filter className="w-5 h-5 text-blue-400" />
            Event Types (Nepal Calendar System)
          </h3>
          <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <p className="text-sm text-blue-300 font-medium flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
              </svg>
              <strong>Nepal Academic Calendar:</strong> Saturday is weekend holiday, Sunday-Friday are working days
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries({
              class: { color: '#22C55E', icon: GraduationCap, label: 'Academic Days' },
              holiday: { color: '#EF4444', icon: PartyPopper, label: 'Holidays (Saturdays)' },
              exam: { color: '#F97316', icon: AlertCircle, label: 'Exams' },
              special_event: { color: '#8B5CF6', icon: Users, label: 'Special Events' },
              cancelled_class: { color: '#64748B', icon: CalendarX, label: 'Cancelled Classes' }
            }).map(([type, info]) => {
              const Icon = info.icon;
              return (
                <div key={type} className="flex items-center space-x-3 p-3 bg-slate-800/40 rounded-xl hover:bg-slate-700/40 transition-all duration-200">
                  <div 
                    className="w-4 h-4 rounded-lg shadow-sm"
                    style={{ backgroundColor: info.color }}
                  ></div>
                  <Icon className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-300 font-medium">{info.label}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 p-3 bg-slate-800/40 rounded-xl">
            <p className="text-xs text-slate-400">
              <strong>Data Source:</strong> Events are loaded from backend database. 
              Red background indicates Saturday holidays (Nepal standard).
            </p>
          </div>
        </div>
      </div>

      {/* Event Details Modal */}
      {showEventModal && selectedEvent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/50 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-start space-x-4">
                  <div 
                    className="p-3 rounded-xl"
                    style={{ backgroundColor: selectedEvent.color_code + '20' }}
                  >
                    {React.createElement(getEventTypeInfo(selectedEvent.event_type).icon, {
                      className: "w-6 h-6",
                      style: { color: selectedEvent.color_code }
                    })}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">{getCleanTitle(selectedEvent.title, selectedEvent.event_type)}</h2>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300 mt-2">
                      {getEventTypeInfo(selectedEvent.event_type).label}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setShowEventModal(false)}
                  className="p-2 hover:bg-slate-800/60 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              
              <div className="space-y-4">
                {selectedEvent.description && (
                  <div>
                    <h3 className="text-sm font-medium text-slate-400 mb-2">Description</h3>
                    <p className="text-slate-200">{selectedEvent.description}</p>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-slate-400 mb-2">Date & Time</h3>
                    <div className="text-slate-200">
                      <p>{moment(selectedEvent.start_date).format('MMMM D, YYYY')}</p>
                      {!selectedEvent.is_all_day && selectedEvent.start_time && (
                        <p className="text-sm text-slate-400">
                          {selectedEvent.start_time} {selectedEvent.end_time && `- ${selectedEvent.end_time}`}
                        </p>
                      )}
                      {selectedEvent.is_all_day && <p className="text-sm text-slate-400">All day</p>}
                    </div>
                  </div>
                  
                  {selectedEvent.location && (
                    <div>
                      <h3 className="text-sm font-medium text-slate-400 mb-2">Location</h3>
                      <p className="text-slate-200">{selectedEvent.location}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Admin Actions */}
              {isAdmin && (
                <div className="border-t border-slate-700/50 pt-4 mt-6">
                  <div className="flex gap-3 flex-wrap">
                    <button
                      onClick={handleEditEvent}
                      className="flex-1 min-w-[120px] px-4 py-2.5 bg-gradient-to-r from-blue-500 to-teal-400 text-white rounded-xl hover:from-blue-600 hover:to-teal-500 transition-all duration-200 font-medium"
                    >
                      Edit Event
                    </button>
                    <button
                      onClick={() => {
                        setShowSessionModal(true);
                        fetchEventSessions(selectedEvent.id);
                      }}
                      className="flex-1 min-w-[120px] px-4 py-2.5 bg-gradient-to-r from-purple-500 to-pink-400 text-white rounded-xl hover:from-purple-600 hover:to-pink-500 transition-all duration-200 font-medium"
                    >
                      Manage Sessions
                    </button>
                    <button
                      onClick={handleDeleteEvent}
                      className="px-4 py-2.5 bg-red-600/80 text-white rounded-xl hover:bg-red-700/80 transition-all duration-200 font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Event Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/50 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white">Create New Event</h2>
                  {eventForm.start_date && (
                    <div className="text-sm text-slate-400 mt-1">
                      <p className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                        </svg>
                        Selected date: {moment(eventForm.start_date).format('MMMM D, YYYY')}
                      </p>
                      {eventForm.start_time && (
                        <p className="flex items-center gap-2">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                          </svg>
                          Selected time: {eventForm.start_time} - {eventForm.end_time}
                        </p>
                      )}
                      {eventForm.is_all_day && (
                        <p className="flex items-center gap-2">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                          </svg>
                          All-day event
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 hover:bg-slate-800/60 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleCreateEvent} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Event Title</label>
                  <input
                    type="text"
                    value={eventForm.title}
                    onChange={(e) => handleFormChange('title', e.target.value)}
                    className="w-full bg-slate-800/60 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                    placeholder="Enter event title..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                  <textarea
                    rows={3}
                    value={eventForm.description}
                    onChange={(e) => handleFormChange('description', e.target.value)}
                    className="w-full bg-slate-800/60 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                    placeholder="Enter event description..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Event Type</label>
                  <select 
                    value={eventForm.event_type}
                    onChange={(e) => handleFormChange('event_type', e.target.value)}
                    className="w-full bg-slate-800/60 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                  >
                    <option value="class">Class</option>
                    <option value="exam">Exam</option>
                    <option value="holiday">Holiday</option>
                    <option value="special_event">Special Event</option>
                  </select>
                  <p className="text-xs text-slate-400 mt-1">Color will be automatically assigned based on event type</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Start Date</label>
                    <input
                      type="date"
                      value={eventForm.start_date}
                      onChange={(e) => handleFormChange('start_date', e.target.value)}
                      className="w-full bg-slate-800/60 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">End Date</label>
                    <input
                      type="date"
                      value={eventForm.end_date}
                      onChange={(e) => handleFormChange('end_date', e.target.value)}
                      className="w-full bg-slate-800/60 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 mb-4">
                  <input
                    type="checkbox"
                    id="allDay"
                    checked={eventForm.is_all_day}
                    onChange={(e) => handleFormChange('is_all_day', e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-slate-800 border-slate-600 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="allDay" className="text-sm font-medium text-slate-300">All Day Event</label>
                </div>

                {!eventForm.is_all_day && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Start Time</label>
                      <input
                        type="time"
                        value={eventForm.start_time}
                        onChange={(e) => handleFormChange('start_time', e.target.value)}
                        className="w-full bg-slate-800/60 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">End Time</label>
                      <input
                        type="time"
                        value={eventForm.end_time}
                        onChange={(e) => handleFormChange('end_time', e.target.value)}
                        className="w-full bg-slate-800/60 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Location</label>
                  <input
                    type="text"
                    value={eventForm.location}
                    onChange={(e) => handleFormChange('location', e.target.value)}
                    className="w-full bg-slate-800/60 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                    placeholder="Enter event location..."
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-2.5 bg-slate-800/60 border border-slate-600/50 rounded-xl text-slate-300 hover:bg-slate-700/60 transition-all duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-teal-400 text-white rounded-xl hover:from-blue-600 hover:to-teal-500 transition-all duration-200 font-medium"
                  >
                    Create Event
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Event Modal */}
      {showEditModal && selectedEvent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/50 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Edit Event</h2>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="p-2 hover:bg-slate-800/60 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleUpdateEvent} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Event Title</label>
                  <input
                    type="text"
                    value={eventForm.title}
                    onChange={(e) => handleFormChange('title', e.target.value)}
                    className="w-full bg-slate-800/60 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                    placeholder="Enter event title..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                  <textarea
                    rows={3}
                    value={eventForm.description}
                    onChange={(e) => handleFormChange('description', e.target.value)}
                    className="w-full bg-slate-800/60 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                    placeholder="Enter event description..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Event Type</label>
                  <select 
                    value={eventForm.event_type}
                    onChange={(e) => handleFormChange('event_type', e.target.value)}
                    className="w-full bg-slate-800/60 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                  >
                    <option value="class">Class</option>
                    <option value="exam">Exam</option>
                    <option value="holiday">Holiday</option>
                    <option value="special_event">Special Event</option>
                  </select>
                  <p className="text-xs text-slate-400 mt-1">Color will be automatically assigned based on event type</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Start Date</label>
                    <input
                      type="date"
                      value={eventForm.start_date}
                      onChange={(e) => handleFormChange('start_date', e.target.value)}
                      className="w-full bg-slate-800/60 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">End Date</label>
                    <input
                      type="date"
                      value={eventForm.end_date}
                      onChange={(e) => handleFormChange('end_date', e.target.value)}
                      className="w-full bg-slate-800/60 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 mb-4">
                  <input
                    type="checkbox"
                    id="editAllDay"
                    checked={eventForm.is_all_day}
                    onChange={(e) => handleFormChange('is_all_day', e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-slate-800 border-slate-600 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="editAllDay" className="text-sm font-medium text-slate-300">All Day Event</label>
                </div>

                {!eventForm.is_all_day && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Start Time</label>
                      <input
                        type="time"
                        value={eventForm.start_time}
                        onChange={(e) => handleFormChange('start_time', e.target.value)}
                        className="w-full bg-slate-800/60 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">End Time</label>
                      <input
                        type="time"
                        value={eventForm.end_time}
                        onChange={(e) => handleFormChange('end_time', e.target.value)}
                        className="w-full bg-slate-800/60 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Location</label>
                  <input
                    type="text"
                    value={eventForm.location}
                    onChange={(e) => handleFormChange('location', e.target.value)}
                    className="w-full bg-slate-800/60 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                    placeholder="Enter event location..."
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2.5 bg-slate-800/60 border border-slate-600/50 rounded-xl text-slate-300 hover:bg-slate-700/60 transition-all duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteEvent}
                    className="px-4 py-2.5 bg-red-500/80 border border-red-400/50 rounded-xl text-white hover:bg-red-600/80 transition-all duration-200 font-medium"
                  >
                    Delete
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-teal-400 text-white rounded-xl hover:from-blue-600 hover:to-teal-500 transition-all duration-200 font-medium"
                  >
                    Update Event
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/50 rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Calendar Settings</h2>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="p-2 hover:bg-slate-800/60 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Default View</label>
                  <select className="w-full bg-slate-800/60 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50">
                    <option>Month</option>
                    <option>Week</option>
                    <option>Day</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Week Starts On</label>
                  <select className="w-full bg-slate-800/60 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50">
                    <option>Sunday</option>
                    <option>Monday</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-300">Show Weekends</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-300">Show Time Grid</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-6">
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="flex-1 px-4 py-2.5 bg-slate-800/60 border border-slate-600/50 rounded-xl text-slate-300 hover:bg-slate-700/60 transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-teal-400 text-white rounded-xl hover:from-blue-600 hover:to-teal-500 transition-all duration-200 font-medium"
                >
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Session Modal */}
      {showEditSessionModal && selectedSession && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/50 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Edit Session</h2>
                <button
                  onClick={() => setShowEditSessionModal(false)}
                  className="p-2 hover:bg-slate-800/60 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Session Title</label>
                  <input
                    type="text"
                    value={selectedSession.title}
                    onChange={(e) => setSelectedSession({...selectedSession, title: e.target.value})}
                    className="w-full bg-slate-800/60 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                    placeholder="Enter session title..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                  <textarea
                    rows={3}
                    value={selectedSession.description || ''}
                    onChange={(e) => setSelectedSession({...selectedSession, description: e.target.value})}
                    className="w-full bg-slate-800/60 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                    placeholder="Enter session description..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Start Time</label>
                    <input
                      type="time"
                      value={selectedSession.start_time}
                      onChange={(e) => setSelectedSession({...selectedSession, start_time: e.target.value})}
                      className="w-full bg-slate-800/60 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">End Time</label>
                    <input
                      type="time"
                      value={selectedSession.end_time}
                      onChange={(e) => setSelectedSession({...selectedSession, end_time: e.target.value})}
                      className="w-full bg-slate-800/60 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Presenter</label>
                  <input
                    type="text"
                    value={selectedSession.presenter || ''}
                    onChange={(e) => setSelectedSession({...selectedSession, presenter: e.target.value})}
                    className="w-full bg-slate-800/60 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                    placeholder="Enter presenter name..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Location</label>
                  <input
                    type="text"
                    value={selectedSession.location || ''}
                    onChange={(e) => setSelectedSession({...selectedSession, location: e.target.value})}
                    className="w-full bg-slate-800/60 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                    placeholder="Enter session location..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Session Type</label>
                  <input
                    type="text"
                    value={selectedSession.session_type || ''}
                    onChange={(e) => setSelectedSession({...selectedSession, session_type: e.target.value})}
                    className="w-full bg-slate-800/60 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                    placeholder="e.g., Lecture, Workshop, Lab..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Color</label>
                  <input
                    type="color"
                    value={selectedSession.color_code || '#3B82F6'}
                    onChange={(e) => setSelectedSession({...selectedSession, color_code: e.target.value})}
                    className="w-full bg-slate-800/60 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="attendance_required"
                    checked={selectedSession.attendance_required}
                    onChange={(e) => setSelectedSession({...selectedSession, attendance_required: e.target.checked})}
                    className="w-4 h-4 text-blue-600 bg-slate-800 border-slate-600 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="attendance_required" className="text-sm font-medium text-slate-300">
                    Attendance Required
                  </label>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowEditSessionModal(false)}
                    className="px-4 py-2.5 bg-slate-800/60 border border-slate-600/50 rounded-xl text-slate-300 hover:bg-slate-700/60 transition-all duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (selectedSession && window.confirm('Are you sure you want to delete this session?')) {
                        handleDeleteSession(selectedSession.id);
                        setShowEditSessionModal(false);
                      }
                    }}
                    className="px-4 py-2.5 bg-red-500/80 border border-red-400/50 rounded-xl text-white hover:bg-red-600/80 transition-all duration-200 font-medium"
                  >
                    Delete
                  </button>
                  <button
                    onClick={handleUpdateSession}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-teal-400 text-white rounded-xl hover:from-blue-600 hover:to-teal-500 transition-all duration-200 font-medium"
                  >
                    Update Session
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clean notification toast */}
      {snackbar.open && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className={`px-4 py-3 rounded-lg shadow-lg border backdrop-blur-sm ${
            snackbar.severity === 'success' 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{snackbar.message}</span>
              <button
                onClick={() => setSnackbar({ ...snackbar, open: false })}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session Management Modal */}
      {showSessionModal && selectedEvent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/50 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white">Manage Sessions</h2>
                  <p className="text-slate-400 mt-1">{selectedEvent.title}</p>
                </div>
                <button
                  onClick={() => setShowSessionModal(false)}
                  className="p-2 hover:bg-slate-800/60 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              {/* Session Form */}
              <div className="bg-slate-800/50 rounded-xl p-4 mb-6">
                <h3 className="text-lg font-semibold text-white mb-4">Add New Session</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Session Title</label>
                    <input
                      type="text"
                      value={sessionForm.title}
                      onChange={(e) => setSessionForm({...sessionForm, title: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., Introduction"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Presenter</label>
                    <input
                      type="text"
                      value={sessionForm.presenter}
                      onChange={(e) => setSessionForm({...sessionForm, presenter: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Start Time</label>
                    <input
                      type="time"
                      value={sessionForm.start_time}
                      onChange={(e) => setSessionForm({...sessionForm, start_time: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">End Time</label>
                    <input
                      type="time"
                      value={sessionForm.end_time}
                      onChange={(e) => setSessionForm({...sessionForm, end_time: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                    <textarea
                      value={sessionForm.description}
                      onChange={(e) => setSessionForm({...sessionForm, description: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                      placeholder="Optional session description"
                    />
                  </div>
                </div>
                <div className="flex justify-end mt-4">
                  <button
                    onClick={() => handleCreateSession()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Add Session
                  </button>
                </div>
              </div>

              {/* Sessions List */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">
                  Sessions ({eventSessions.length})
                </h3>
                {eventSessions.length === 0 ? (
                  <p className="text-slate-400 text-center py-8">No sessions created yet</p>
                ) : (
                  <div className="space-y-3">
                    {eventSessions.map((session, index) => (
                      <div
                        key={session.id}
                        className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3">
                              <span className="text-lg font-semibold text-white">
                                {session.title}
                              </span>
                              <span className="text-sm text-slate-400">
                                {session.start_time} - {session.end_time}
                              </span>
                            </div>
                            {session.presenter && (
                              <p className="text-sm text-slate-300 mt-1">
                                Presenter: {session.presenter}
                              </p>
                            )}
                            {session.description && (
                              <p className="text-sm text-slate-400 mt-2">
                                {session.description}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => handleDeleteSession(session.id)}
                            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Session Modal */}
      {showCreateSessionModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/50 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white">Create Session</h2>
                  <p className="text-slate-400 mt-1">Creating a new session for {clickedDateForSession}</p>
                </div>
                <button
                  onClick={() => setShowCreateSessionModal(false)}
                  className="p-2 hover:bg-slate-800/60 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              {/* Session Form */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Session Title *</label>
                    <input
                      type="text"
                      value={sessionForm.title}
                      onChange={(e) => setSessionForm({...sessionForm, title: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., Introduction to Programming"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Session Type</label>
                    <select
                      value={sessionForm.session_type}
                      onChange={(e) => setSessionForm({...sessionForm, session_type: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="lecture">Lecture</option>
                      <option value="practical">Practical</option>
                      <option value="tutorial">Tutorial</option>
                      <option value="lab">Lab</option>
                      <option value="workshop">Workshop</option>
                      <option value="seminar">Seminar</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Start Time *</label>
                    <input
                      type="time"
                      value={sessionForm.start_time}
                      onChange={(e) => setSessionForm({...sessionForm, start_time: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">End Time *</label>
                    <input
                      type="time"
                      value={sessionForm.end_time}
                      onChange={(e) => setSessionForm({...sessionForm, end_time: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Presenter</label>
                    <input
                      type="text"
                      value={sessionForm.presenter}
                      onChange={(e) => setSessionForm({...sessionForm, presenter: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Location</label>
                    <input
                      type="text"
                      value={sessionForm.location}
                      onChange={(e) => setSessionForm({...sessionForm, location: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                  <textarea
                    value={sessionForm.description}
                    onChange={(e) => setSessionForm({...sessionForm, description: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Optional session description"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    onClick={() => setShowCreateSessionModal(false)}
                    className="px-4 py-2 bg-slate-700/50 text-slate-300 rounded-lg hover:bg-slate-600/50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateSessionWithEvent}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Create Session
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AcademicCalendar;
