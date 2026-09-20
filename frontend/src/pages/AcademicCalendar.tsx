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
    <div className={embedded ? "w-full space-y-6" : "w-full max-w-[1600px] mx-auto space-y-6 pb-12"}>
      {/* Page Context & Top Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight">
              Academic Calendar
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-action-primary-subtle text-action-primary border border-action-primary/20">
              Nepal Standard
            </span>
            {isAdmin && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-status-success-subtle text-status-success border border-status-success-border">
                Admin Mode
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-text-muted mt-1">
            Institutional semester dates, examination schedules, sessions, and holiday tracking
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {isAdmin && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-action-primary hover:bg-action-primary-hover text-white rounded-lg text-xs sm:text-sm font-semibold shadow-xs transition-colors active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>Add Event</span>
            </button>
          )}
          <button
            onClick={() => setShowSettingsModal(true)}
            className="p-2 bg-surface-default hover:bg-surface-subtle border border-border-default rounded-lg text-text-secondary hover:text-text-primary transition-colors shadow-xs"
            title="Calendar Settings"
            aria-label="Calendar Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: This Month */}
        <div className="bg-surface-default border border-border-subtle hover:border-border-default rounded-xl p-4 sm:p-5 shadow-xs transition-all duration-200 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">This Month</p>
            <p className="text-2xl sm:text-3xl font-bold text-text-primary tabular-nums tracking-tight">
              {stats.total_events_this_month || 0}
            </p>
            <p className="text-[11px] text-text-secondary">Events in {moment(currentDate).format('MMMM')}</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-action-primary-subtle flex items-center justify-center text-action-primary shrink-0">
            <CalendarDays className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Upcoming */}
        <div className="bg-surface-default border border-border-subtle hover:border-border-default rounded-xl p-4 sm:p-5 shadow-xs transition-all duration-200 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Upcoming Events</p>
            <p className="text-2xl sm:text-3xl font-bold text-text-primary tabular-nums tracking-tight">
              {stats.upcoming_events || 0}
            </p>
            <p className="text-[11px] text-text-secondary">Next 30 days ahead</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-status-info-subtle flex items-center justify-center text-status-info shrink-0">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Today */}
        <div className="bg-surface-default border border-border-subtle hover:border-border-default rounded-xl p-4 sm:p-5 shadow-xs transition-all duration-200 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Today\'s Schedule</p>
            <p className="text-2xl sm:text-3xl font-bold text-text-primary tabular-nums tracking-tight">
              {stats.classes_today || 0}
            </p>
            <p className="text-[11px] text-text-secondary">{moment().format('dddd, MMM D')}</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-status-warning-subtle flex items-center justify-center text-status-warning shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: Attendance */}
        <div className="bg-surface-default border border-border-subtle hover:border-border-default rounded-xl p-4 sm:p-5 shadow-xs transition-all duration-200 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Attendance Marked</p>
            <p className="text-2xl sm:text-3xl font-bold text-text-primary tabular-nums tracking-tight">
              {stats.total_attendance_marked || 0}
            </p>
            <p className="text-[11px] text-text-secondary">Recorded sessions</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-status-success-subtle flex items-center justify-center text-status-success shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Calendar Card */}
      <div className="bg-surface-default border border-border-subtle rounded-xl shadow-xs overflow-hidden">
        {/* Integrated Calendar Header / Toolbar */}
        <div className="p-4 sm:p-5 border-b border-border-subtle flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-surface-default">
          {/* Left: Date Display & Connected Navigation */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center shadow-2xs rounded-lg overflow-hidden border border-border-default">
              <button
                onClick={navigateBack}
                className="p-2 bg-surface-default hover:bg-surface-subtle text-text-secondary hover:text-text-primary transition-colors border-r border-border-default"
                aria-label="Previous date range"
                title="Previous"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={navigateToday}
                className="px-3.5 py-1.5 bg-surface-default hover:bg-surface-subtle text-text-primary text-xs font-semibold transition-colors border-r border-border-default"
              >
                Today
              </button>
              <button
                onClick={navigateNext}
                className="p-2 bg-surface-default hover:bg-surface-subtle text-text-secondary hover:text-text-primary transition-colors"
                aria-label="Next date range"
                title="Next"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <h2 className="text-lg sm:text-xl font-bold text-text-primary tracking-tight">
              {formatDisplayDate()}
            </h2>

            <span className="text-xs text-text-muted bg-surface-subtle px-2.5 py-1 rounded-full border border-border-subtle font-medium hidden sm:inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-action-primary" />
              {filteredEvents.length} {filteredEvents.length === 1 ? 'event' : 'events'}
            </span>
          </div>

          {/* Right: View Selector, Filter, and Admin Indicator */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* View Selector segmented control */}
            <div className="inline-flex bg-surface-subtle border border-border-subtle rounded-lg p-1">
              {(['month', 'week', 'day'] as const).map((view) => (
                <button
                  key={view}
                  onClick={() => setCurrentView(view)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-all ${
                    currentView === view
                      ? 'bg-surface-default text-text-primary shadow-xs'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {view}
                </button>
              ))}
            </div>

            {/* Filter Dropdown */}
            <div className="relative">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="appearance-none bg-surface-default border border-border-default rounded-lg pl-3 pr-8 py-1.5 text-xs font-medium text-text-primary hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-action-primary/20 focus:border-action-primary transition-colors cursor-pointer"
              >
                <option value="all">All Event Types</option>
                <option value="class">Academic Days</option>
                <option value="exam">Examinations</option>
                <option value="holiday">Holidays (Saturdays)</option>
                <option value="special_event">Special Events</option>
                <option value="cancelled_class">Cancelled Classes</option>
              </select>
              <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
            </div>

            {isAdmin && (
              <div className="hidden xl:flex items-center gap-1.5 text-xs text-text-muted bg-surface-subtle border border-border-subtle px-2.5 py-1.5 rounded-lg">
                <span className="w-1.5 h-1.5 rounded-full bg-status-success" />
                <span>Click cell to add event</span>
              </div>
            )}
          </div>
        </div>

        {/* Calendar Body */}
        {loading ? (
          <div className="flex flex-col items-center justify-center h-96">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-action-primary mb-3"></div>
            <p className="text-xs font-medium text-text-muted">Loading calendar events...</p>
          </div>
        ) : (
          <div>
            {/* Month View */}
            {currentView === 'month' && (
              <div className="overflow-x-auto">
                <div className="min-w-[720px]">
                  {/* Day Headers Row */}
                  <div className="grid grid-cols-7 border-b border-border-subtle bg-surface-subtle/70 text-center divide-x divide-border-subtle">
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
                        className={`py-2.5 px-2 text-xs font-semibold tracking-wider uppercase flex items-center justify-center gap-1.5 ${
                          day.isHoliday ? 'text-status-error' : 'text-text-secondary'
                        }`}
                      >
                        <span>{day.name}</span>
                        {day.isHoliday && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-status-error-subtle text-status-error font-medium normal-case hidden sm:inline">
                            Holiday
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Calendar Days Matrix */}
                  <div className="grid grid-cols-7 divide-x divide-y divide-border-subtle border-b border-border-subtle">
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
                            className={`min-h-[110px] sm:min-h-[125px] lg:min-h-[135px] p-2 sm:p-2.5 flex flex-col justify-between transition-colors relative group ${
                              !isCurrentMonth
                                ? 'bg-surface-canvas/50 text-text-muted/40'
                                : isSaturday
                                  ? 'bg-status-error-subtle/15 hover:bg-status-error-subtle/25'
                                  : 'bg-surface-default hover:bg-surface-subtle/50'
                            } ${
                              isToday ? 'bg-action-primary-subtle/30 ring-1 ring-inset ring-action-primary/40' : ''
                            } ${
                              isAdmin && isCurrentMonth ? 'cursor-pointer' : ''
                            }`}
                          >
                            {/* Day Header Row */}
                            <div className="flex items-center justify-between mb-1.5">
                              {isToday ? (
                                <span className="w-6 h-6 rounded-full bg-action-primary text-white font-bold text-xs flex items-center justify-center shadow-xs">
                                  {dayDate.format('D')}
                                </span>
                              ) : (
                                <span className={`text-xs sm:text-sm font-semibold ${
                                  !isCurrentMonth ? 'text-text-muted/40' : isSaturday ? 'text-status-error' : 'text-text-primary'
                                }`}>
                                  {dayDate.format('D')}
                                </span>
                              )}

                              {/* Weekend label or Admin Hover Plus */}
                              <div className="flex items-center gap-1">
                                {isSaturday && isCurrentMonth && dayEvents.length === 0 && (
                                  <span className="text-[9px] font-medium text-status-error/80 px-1 py-0.5 rounded bg-status-error-subtle hidden sm:inline">
                                    Weekend
                                  </span>
                                )}
                                {isAdmin && isCurrentMonth && (
                                  <span
                                    className="opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 rounded hover:bg-action-primary-subtle text-action-primary flex items-center justify-center text-xs font-bold"
                                    title="Click to add event"
                                  >
                                    +
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Events List in Day Cell */}
                            <div className="space-y-1 flex-1">
                              {dayEvents.slice(0, 3).map(event => {
                                const eventResource = event.resource as ExtendedCalendarEvent;
                                const color = eventResource?.color_code || '#3B82F6';
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
                                    className="cursor-pointer px-2 py-1 rounded text-[11px] font-medium leading-tight text-white truncate shadow-2xs hover:shadow-xs transition-all hover:opacity-95 flex items-center gap-1.5"
                                    style={{
                                      backgroundColor: color
                                    }}
                                    title={`${event.title} (Double-click to open day view)`}
                                  >
                                    <span className="truncate">{event.title}</span>
                                  </div>
                                );
                              })}

                              {dayEvents.length > 3 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCurrentView('day');
                                    setCurrentDate(dayDate.toDate());
                                  }}
                                  className="text-[10px] font-semibold text-action-primary hover:underline pl-1 block text-left"
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
                  {/* Week Header */}
                  <div className="grid grid-cols-8 border-b border-border-subtle bg-surface-subtle/70 text-center divide-x divide-border-subtle">
                    <div className="py-2.5 px-2 text-xs font-semibold text-text-muted uppercase tracking-wider flex items-center justify-center">
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
                            className={`py-2.5 px-2 text-center transition-colors ${
                              isToday
                                ? 'bg-action-primary-subtle text-action-primary font-bold'
                                : isSaturday
                                  ? 'text-status-error font-semibold'
                                  : 'text-text-secondary'
                            }`}
                          >
                            <div className="text-xs uppercase tracking-wider">{day.format('ddd')}</div>
                            <div className="text-base font-bold mt-0.5">{day.format('D')}</div>
                          </div>
                        );
                      }
                      
                      return weekDays;
                    })()}
                  </div>

                  {/* Week Calendar Grid */}
                  <div className="divide-y divide-border-subtle">
                    {(() => {
                      const hours = [];
                      const startOfWeek = moment(currentDate).startOf('week');
                      
                      for (let hour = 6; hour <= 22; hour++) {
                        hours.push(
                          <div key={hour} className="grid grid-cols-8 divide-x divide-border-subtle min-h-[58px]">
                            <div className="p-2 text-xs text-text-muted font-medium text-center bg-surface-subtle/20 flex items-start justify-center">
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
                                    className={`p-1 transition-all group ${
                                      isAdmin ? 'cursor-pointer hover:bg-surface-subtle/70' : ''
                                    } ${
                                      isToday
                                        ? 'bg-action-primary-subtle/20'
                                        : isSaturday
                                          ? 'bg-status-error-subtle/10'
                                          : 'bg-surface-default'
                                    }`}
                                    style={{
                                      backgroundColor: (() => {
                                        const parentEvent = dayEvents.find(event => 
                                          !event.title?.startsWith('[SESSION]') && 
                                          !(event.resource as ExtendedCalendarEvent)?.isSession
                                        );
                                        if (parentEvent) {
                                          return `${(parentEvent.resource as ExtendedCalendarEvent)?.color_code || '#3B82F6'}30`;
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
                                            <div className="text-[11px] font-semibold text-text-primary px-1.5 py-0.5 rounded truncate">
                                              {parentEvent.title}
                                            </div>
                                            
                                            {sessions.length > 0 && sessions.map((event, idx) => (
                                              <div 
                                                key={idx}
                                                className="cursor-pointer hover:opacity-90 transition-opacity p-1 rounded text-[11px] font-medium text-white shadow-2xs"
                                                style={{
                                                  backgroundColor: (event.resource as ExtendedCalendarEvent)?.color_code || '#3B82F6'
                                                }}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleEventClick(event);
                                                }}
                                                title={`${event.title} - Click for details`}
                                              >
                                                <div className="font-semibold truncate">
                                                  {event.title.replace('[SESSION] ', '')}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        );
                                      } else {
                                        return isAdmin && (
                                          <div className="opacity-0 group-hover:opacity-60 text-xs text-text-muted text-center font-bold">
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
              </div>
            )}

            {/* Day View */}
            {currentView === 'day' && (
              <div>
                {/* Day Header Banner */}
                <div className="bg-surface-subtle/80 border-b border-border-subtle p-4 text-center">
                  <h3 className="text-lg sm:text-xl font-bold text-text-primary">
                    {moment(currentDate).format('dddd, MMMM D, YYYY')}
                  </h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    {viewFilteredEvents.length} events and sessions scheduled for today
                  </p>
                </div>

                {/* Day Schedule Grid */}
                <div className="divide-y divide-border-subtle">
                  {(() => {
                    const hours = [];
                    
                    for (let hour = 6; hour <= 22; hour++) {
                      const hourEvents = viewFilteredEvents.filter(event => 
                        isEventInHour(event, hour, moment(currentDate).format('YYYY-MM-DD'))
                      );
                      
                      hours.push(
                        <div key={hour} className="grid grid-cols-12 divide-x divide-border-subtle min-h-[58px]">
                          <div className="col-span-3 sm:col-span-2 p-3 text-xs font-semibold text-text-muted text-center bg-surface-subtle/20 flex items-start justify-center">
                            {moment().hour(hour).minute(0).format('h:mm A')}
                          </div>
                          <div 
                            className={`col-span-9 sm:col-span-10 p-2 sm:p-2.5 transition-all group ${
                              isAdmin ? 'cursor-pointer hover:bg-surface-subtle/60' : ''
                            }`}
                            style={{
                              backgroundColor: (() => {
                                const parentEvent = hourEvents.find(event => 
                                  !event.title?.startsWith('[SESSION]') && 
                                  !(event.resource as ExtendedCalendarEvent)?.isSession
                                );
                                if (parentEvent) {
                                  return `${(parentEvent.resource as ExtendedCalendarEvent)?.color_code || '#3B82F6'}25`;
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
                                    <div className="text-xs font-semibold text-text-primary">
                                      {parentEvent.title}
                                    </div>
                                    
                                    {sessions.length > 0 && (
                                      <div className="flex flex-wrap gap-2">
                                        {sessions.map((event, idx) => (
                                          <div 
                                            key={idx}
                                            className="cursor-pointer hover:opacity-90 transition-opacity px-2.5 py-1 rounded text-xs font-medium text-white shadow-2xs"
                                            style={{
                                              backgroundColor: (event.resource as ExtendedCalendarEvent)?.color_code || '#3B82F6'
                                            }}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleEventClick(event);
                                            }}
                                            title={`${event.title} - Click for details`}
                                          >
                                            <span className="font-semibold">{event.title.replace('[SESSION] ', '')}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              } else {
                                return isAdmin && (
                                  <div className="opacity-0 group-hover:opacity-50 text-text-muted text-xs font-medium">
                                    + Click to schedule session
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
      </div>

      {/* Legend & Nepal Academic Calendar System Info */}
      <div className="bg-surface-default border border-border-subtle rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm sm:text-base font-semibold text-text-primary flex items-center gap-2">
            <Filter className="w-4 h-4 text-action-primary" />
            <span>Event Types & Academic Schedule</span>
          </h3>
          <span className="text-xs text-text-muted font-medium">
            Nepal Institutional System
          </span>
        </div>

        {/* Nepal Calendar Banner */}
        <div className="p-3 bg-action-primary-subtle/50 border border-action-primary/20 rounded-lg flex items-center gap-2.5 text-xs text-text-primary">
          <Info className="w-4 h-4 text-action-primary shrink-0" />
          <span>
            <strong>Nepal Academic Calendar Standard:</strong> Saturday is the official weekly institutional holiday (marked in red). Sunday through Friday are active working academic days.
          </span>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Object.entries({
            class: { color: '#22C55E', icon: GraduationCap, label: 'Academic Days', desc: 'Lectures & regular classes' },
            holiday: { color: '#EF4444', icon: PartyPopper, label: 'Holidays (Saturdays)', desc: 'Weekly offs & public holidays' },
            exam: { color: '#F97316', icon: AlertCircle, label: 'Examinations', desc: 'Midterms & finals' },
            special_event: { color: '#8B5CF6', icon: Users, label: 'Special Events', desc: 'Workshops & guest sessions' },
            cancelled_class: { color: '#64748B', icon: CalendarX, label: 'Cancelled Classes', desc: 'Rescheduled sessions' }
          }).map(([type, info]) => {
            const Icon = info.icon;
            return (
              <div 
                key={type} 
                className="p-3 bg-surface-subtle/60 border border-border-subtle rounded-lg flex items-start gap-2.5 hover:bg-surface-subtle transition-colors"
              >
                <div 
                  className="w-3.5 h-3.5 rounded-full shrink-0 mt-0.5 shadow-2xs"
                  style={{ backgroundColor: info.color }}
                />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-text-primary truncate">{info.label}</div>
                  <div className="text-[10px] text-text-muted truncate mt-0.5">{info.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

{/* Event Details Modal */}
      {showEventModal && selectedEvent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface-default border border-border-subtle rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
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
                    <h2 className="text-2xl font-bold text-text-primary">{getCleanTitle(selectedEvent.title, selectedEvent.event_type)}</h2>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-action-primary-subtle text-action-primary mt-1.5">
                      {getEventTypeInfo(selectedEvent.event_type).label}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setShowEventModal(false)}
                  className="p-2 hover:bg-surface-subtle rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-text-muted" />
                </button>
              </div>
              
              <div className="space-y-4">
                {selectedEvent.description && (
                  <div>
                    <h3 className="text-sm font-medium text-text-muted mb-1.5">Description</h3>
                    <p className="text-text-primary">{selectedEvent.description}</p>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-text-muted mb-1.5">Date & Time</h3>
                    <div className="text-text-primary">
                      <p>{moment(selectedEvent.start_date).format('MMMM D, YYYY')}</p>
                      {!selectedEvent.is_all_day && selectedEvent.start_time && (
                        <p className="text-sm text-text-muted">
                         {selectedEvent.start_time} {selectedEvent.end_time && `- ${selectedEvent.end_time}`}
                        </p>
                      )}
                      {selectedEvent.is_all_day && <p className="text-sm text-text-muted">All day</p>}
                    </div>
                  </div>
                  
                  {selectedEvent.location && (
                    <div>
                      <h3 className="text-sm font-medium text-text-muted mb-1.5">Location</h3>
                      <p className="text-text-primary">{selectedEvent.location}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Admin Actions */}
              {isAdmin && (
                <div className="border-t border-border-subtle pt-4 mt-6">
                  <div className="flex gap-3 flex-wrap">
                    <button
                      onClick={handleEditEvent}
                      className="flex-1 min-w-[120px] px-4 py-2.5 bg-action-primary text-white rounded-lg hover:bg-action-primary-hover transition-colors font-medium"
                    >
                      Edit Event
                    </button>
                    <button
                      onClick={() => {
                        setShowSessionModal(true);
                        fetchEventSessions(selectedEvent.id);
                      }}
                      className="flex-1 min-w-[120px] px-4 py-2.5 bg-action-primary text-white rounded-md hover:bg-action-primary-hover transition-colors font-medium"
                    >
                      Manage Sessions
                    </button>
                    <button
                      onClick={handleDeleteEvent}
                      className="px-4 py-2.5 bg-status-error text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
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
          <div className="bg-surface-default border border-border-subtle rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-text-primary">Create New Event</h2>
                  {eventForm.start_date && (
                    <div className="text-sm text-text-muted mt-1">
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
                  className="p-2 hover:bg-surface-subtle rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-text-muted" />
                </button>
              </div>

              <form onSubmit={handleCreateEvent} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Event Title</label>
                  <input
                    type="text"
                    value={eventForm.title}
                    onChange={(e) => handleFormChange('title', e.target.value)}
                    className="w-full bg-surface-canvas border border-border-default rounded-lg px-3 py-2 text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-action-primary focus:border-action-primary"
                    placeholder="Enter event title..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Description</label>
                  <textarea
                    rows={3}
                    value={eventForm.description}
                    onChange={(e) => handleFormChange('description', e.target.value)}
                    className="w-full bg-surface-canvas border border-border-default rounded-lg px-3 py-2 text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-action-primary focus:border-action-primary"
                    placeholder="Enter event description..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Event Type</label>
                  <select 
                    value={eventForm.event_type}
                    onChange={(e) => handleFormChange('event_type', e.target.value)}
                    className="w-full bg-surface-canvas border border-border-default rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:ring-1 focus:ring-action-primary focus:border-action-primary"
                  >
                    <option value="class">Class</option>
                    <option value="exam">Exam</option>
                    <option value="holiday">Holiday</option>
                    <option value="special_event">Special Event</option>
                  </select>
                  <p className="text-xs text-text-muted mt-1">Color will be automatically assigned based on event type</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">Start Date</label>
                    <input
                      type="date"
                      value={eventForm.start_date}
                      onChange={(e) => handleFormChange('start_date', e.target.value)}
                      className="w-full bg-surface-canvas border border-border-default rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:ring-1 focus:ring-action-primary focus:border-action-primary"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">End Date</label>
                    <input
                      type="date"
                      value={eventForm.end_date}
                      onChange={(e) => handleFormChange('end_date', e.target.value)}
                      className="w-full bg-surface-canvas border border-border-default rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:ring-1 focus:ring-action-primary focus:border-action-primary"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 mb-4">
                  <input
                    type="checkbox"
                    id="allDay"
                    checked={eventForm.is_all_day}
                    onChange={(e) => handleFormChange('is_all_day', e.target.checked)}
                    className="w-4 h-4 text-action-primary bg-surface-canvas border-border-default rounded focus:ring-action-primary"
                  />
                  <label htmlFor="allDay" className="text-sm font-medium text-text-secondary">All Day Event</label>
                </div>

                {!eventForm.is_all_day && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">Start Time</label>
                      <input
                        type="time"
                        value={eventForm.start_time}
                        onChange={(e) => handleFormChange('start_time', e.target.value)}
                        className="w-full bg-surface-canvas border border-border-default rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:ring-1 focus:ring-action-primary focus:border-action-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">End Time</label>
                      <input
                        type="time"
                        value={eventForm.end_time}
                        onChange={(e) => handleFormChange('end_time', e.target.value)}
                        className="w-full bg-surface-canvas border border-border-default rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:ring-1 focus:ring-action-primary focus:border-action-primary"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Location</label>
                  <input
                    type="text"
                    value={eventForm.location}
                    onChange={(e) => handleFormChange('location', e.target.value)}
                    className="w-full bg-surface-canvas border border-border-default rounded-lg px-3 py-2 text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-action-primary focus:border-action-primary"
                    placeholder="Enter event location..."
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-2.5 bg-surface-subtle border border-border-subtle rounded-lg text-text-secondary hover:bg-surface-canvas transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2.5 bg-action-primary text-white rounded-lg hover:bg-action-primary-hover transition-colors font-medium"
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
          <div className="bg-surface-default border border-border-subtle rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-text-primary">Edit Event</h2>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="p-2 hover:bg-surface-subtle rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-text-muted" />
                </button>
              </div>

              <form onSubmit={handleUpdateEvent} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Event Title</label>
                  <input
                    type="text"
                    value={eventForm.title}
                    onChange={(e) => handleFormChange('title', e.target.value)}
                    className="w-full bg-surface-canvas border border-border-default rounded-lg px-3 py-2 text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-action-primary focus:border-action-primary"
                    placeholder="Enter event title..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Description</label>
                  <textarea
                    rows={3}
                    value={eventForm.description}
                    onChange={(e) => handleFormChange('description', e.target.value)}
                    className="w-full bg-surface-canvas border border-border-default rounded-lg px-3 py-2 text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-action-primary focus:border-action-primary"
                    placeholder="Enter event description..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Event Type</label>
                  <select 
                    value={eventForm.event_type}
                    onChange={(e) => handleFormChange('event_type', e.target.value)}
                    className="w-full bg-surface-canvas border border-border-default rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:ring-1 focus:ring-action-primary focus:border-action-primary"
                  >
                    <option value="class">Class</option>
                    <option value="exam">Exam</option>
                    <option value="holiday">Holiday</option>
                    <option value="special_event">Special Event</option>
                  </select>
                  <p className="text-xs text-text-muted mt-1">Color will be automatically assigned based on event type</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">Start Date</label>
                    <input
                      type="date"
                      value={eventForm.start_date}
                      onChange={(e) => handleFormChange('start_date', e.target.value)}
                      className="w-full bg-surface-canvas border border-border-default rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:ring-1 focus:ring-action-primary focus:border-action-primary"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">End Date</label>
                    <input
                      type="date"
                      value={eventForm.end_date}
                      onChange={(e) => handleFormChange('end_date', e.target.value)}
                      className="w-full bg-surface-canvas border border-border-default rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:ring-1 focus:ring-action-primary focus:border-action-primary"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 mb-4">
                  <input
                    type="checkbox"
                    id="editAllDay"
                    checked={eventForm.is_all_day}
                    onChange={(e) => handleFormChange('is_all_day', e.target.checked)}
                    className="w-4 h-4 text-action-primary bg-surface-canvas border-border-default rounded focus:ring-action-primary"
                  />
                  <label htmlFor="editAllDay" className="text-sm font-medium text-text-secondary">All Day Event</label>
                </div>

                {!eventForm.is_all_day && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">Start Time</label>
                      <input
                        type="time"
                        value={eventForm.start_time}
                        onChange={(e) => handleFormChange('start_time', e.target.value)}
                        className="w-full bg-surface-canvas border border-border-default rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:ring-1 focus:ring-action-primary focus:border-action-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">End Time</label>
                      <input
                        type="time"
                        value={eventForm.end_time}
                        onChange={(e) => handleFormChange('end_time', e.target.value)}
                        className="w-full bg-surface-canvas border border-border-default rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:ring-1 focus:ring-action-primary focus:border-action-primary"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Location</label>
                  <input
                    type="text"
                    value={eventForm.location}
                    onChange={(e) => handleFormChange('location', e.target.value)}
                    className="w-full bg-surface-canvas border border-border-default rounded-lg px-3 py-2 text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-action-primary focus:border-action-primary"
                    placeholder="Enter event location..."
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2.5 bg-surface-subtle border border-border-subtle rounded-lg text-text-secondary hover:bg-surface-canvas transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteEvent}
                    className="px-4 py-2.5 bg-status-error text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                  >
                    Delete
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2.5 bg-action-primary text-white rounded-lg hover:bg-action-primary-hover transition-colors font-medium"
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
          <div className="bg-surface-default border border-border-subtle rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-text-primary">Calendar Settings</h2>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="p-2 hover:bg-surface-subtle rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-text-muted" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Default View</label>
                  <select className="w-full bg-surface-canvas border border-border-default rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:ring-1 focus:ring-action-primary focus:border-action-primary">
                    <option>Month</option>
                    <option>Week</option>
                    <option>Day</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Week Starts On</label>
                  <select className="w-full bg-surface-canvas border border-border-default rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:ring-1 focus:ring-action-primary focus:border-action-primary">
                    <option>Sunday</option>
                    <option>Monday</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-300">Show Weekends</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-border-default peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-action-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-action-primary"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-300">Show Time Grid</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-border-default peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-action-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-action-primary"></div>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-6">
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="flex-1 px-4 py-2.5 bg-surface-subtle border border-border-subtle rounded-lg text-text-secondary hover:bg-surface-canvas transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="flex-1 px-4 py-2.5 bg-action-primary text-white rounded-lg hover:bg-action-primary-hover transition-colors font-medium"
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
          <div className="bg-surface-default border border-border-subtle rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-text-primary">Edit Session</h2>
                <button
                  onClick={() => setShowEditSessionModal(false)}
                  className="p-2 hover:bg-surface-subtle rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-text-muted" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Session Title</label>
                  <input
                    type="text"
                    value={selectedSession.title}
                    onChange={(e) => setSelectedSession({...selectedSession, title: e.target.value})}
                    className="w-full bg-surface-canvas border border-border-default rounded-lg px-3 py-2 text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-action-primary focus:border-action-primary"
                    placeholder="Enter session title..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Description</label>
                  <textarea
                    rows={3}
                    value={selectedSession.description || ''}
                    onChange={(e) => setSelectedSession({...selectedSession, description: e.target.value})}
                    className="w-full bg-surface-canvas border border-border-default rounded-lg px-3 py-2 text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-action-primary focus:border-action-primary"
                    placeholder="Enter session description..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">Start Time</label>
                    <input
                      type="time"
                      value={selectedSession.start_time}
                      onChange={(e) => setSelectedSession({...selectedSession, start_time: e.target.value})}
                      className="w-full bg-surface-canvas border border-border-default rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:ring-1 focus:ring-action-primary focus:border-action-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">End Time</label>
                    <input
                      type="time"
                      value={selectedSession.end_time}
                      onChange={(e) => setSelectedSession({...selectedSession, end_time: e.target.value})}
                      className="w-full bg-surface-canvas border border-border-default rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:ring-1 focus:ring-action-primary focus:border-action-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Presenter</label>
                  <input
                    type="text"
                    value={selectedSession.presenter || ''}
                    onChange={(e) => setSelectedSession({...selectedSession, presenter: e.target.value})}
                    className="w-full bg-surface-canvas border border-border-default rounded-lg px-3 py-2 text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-action-primary focus:border-action-primary"
                    placeholder="Enter presenter name..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Location</label>
                  <input
                    type="text"
                    value={selectedSession.location || ''}
                    onChange={(e) => setSelectedSession({...selectedSession, location: e.target.value})}
                    className="w-full bg-surface-canvas border border-border-default rounded-lg px-3 py-2 text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-action-primary focus:border-action-primary"
                    placeholder="Enter session location..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Session Type</label>
                  <input
                    type="text"
                    value={selectedSession.session_type || ''}
                    onChange={(e) => setSelectedSession({...selectedSession, session_type: e.target.value})}
                    className="w-full bg-surface-canvas border border-border-default rounded-lg px-3 py-2 text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-action-primary focus:border-action-primary"
                    placeholder="e.g., Lecture, Workshop, Lab..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Color</label>
                  <input
                    type="color"
                    value={selectedSession.color_code || '#3B82F6'}
                    onChange={(e) => setSelectedSession({...selectedSession, color_code: e.target.value})}
                    className="w-full bg-surface-canvas border border-border-default rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:ring-1 focus:ring-action-primary focus:border-action-primary"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="attendance_required"
                    checked={selectedSession.attendance_required}
                    onChange={(e) => setSelectedSession({...selectedSession, attendance_required: e.target.checked})}
                    className="w-4 h-4 text-action-primary bg-surface-canvas border-border-default rounded focus:ring-action-primary"
                  />
                  <label htmlFor="attendance_required" className="text-sm font-medium text-text-secondary">
                    Attendance Required
                  </label>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowEditSessionModal(false)}
                    className="px-4 py-2.5 bg-surface-subtle border border-border-subtle rounded-lg text-text-secondary hover:bg-surface-canvas transition-colors"
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
                    className="px-4 py-2.5 bg-status-error text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                  >
                    Delete
                  </button>
                  <button
                    onClick={handleUpdateSession}
                    className="flex-1 px-4 py-2.5 bg-action-primary text-white rounded-lg hover:bg-action-primary-hover transition-colors font-medium"
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
          <div className="bg-surface-default border border-border-subtle rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-text-primary">Manage Sessions</h2>
                  <p className="text-text-muted mt-1">{selectedEvent.title}</p>
                </div>
                <button
                  onClick={() => setShowSessionModal(false)}
                  className="p-2 hover:bg-surface-subtle rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-text-muted" />
                </button>
              </div>

              {/* Session Form */}
              <div className="bg-surface-subtle rounded-lg p-4 mb-5">
                <h3 className="text-base font-semibold text-text-primary mb-3">Add New Session</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">Session Title</label>
                    <input
                      type="text"
                      value={sessionForm.title}
                      onChange={(e) => setSessionForm({...sessionForm, title: e.target.value})}
                      className="w-full px-3 py-2 bg-surface-canvas border border-border-default rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-action-primary"
                      placeholder="e.g., Introduction"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">Presenter</label>
                    <input
                      type="text"
                      value={sessionForm.presenter}
                      onChange={(e) => setSessionForm({...sessionForm, presenter: e.target.value})}
                      className="w-full px-3 py-2 bg-surface-canvas border border-border-default rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-action-primary"
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">Start Time</label>
                    <input
                      type="time"
                      value={sessionForm.start_time}
                      onChange={(e) => setSessionForm({...sessionForm, start_time: e.target.value})}
                      className="w-full px-3 py-2 bg-surface-canvas border border-border-default rounded-lg text-text-primary focus:outline-none focus:ring-1 focus:ring-action-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">End Time</label>
                    <input
                      type="time"
                      value={sessionForm.end_time}
                      onChange={(e) => setSessionForm({...sessionForm, end_time: e.target.value})}
                      className="w-full px-3 py-2 bg-surface-canvas border border-border-default rounded-lg text-text-primary focus:outline-none focus:ring-1 focus:ring-action-primary"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-text-secondary mb-2">Description</label>
                    <textarea
                      value={sessionForm.description}
                      onChange={(e) => setSessionForm({...sessionForm, description: e.target.value})}
                      className="w-full px-3 py-2 bg-surface-canvas border border-border-default rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-action-primary"
                      rows={2}
                      placeholder="Optional session description"
                    />
                  </div>
                </div>
                <div className="flex justify-end mt-4">
                  <button
                    onClick={() => handleCreateSession()}
                    className="px-4 py-2 bg-action-primary text-white rounded-lg hover:bg-action-primary-hover transition-colors text-sm font-medium"
                  >
                    Add Session
                  </button>
                </div>
              </div>

              {/* Sessions List */}
              <div>
                <h3 className="text-base font-semibold text-text-primary mb-4">
                  Sessions ({eventSessions.length})
                </h3>
                {eventSessions.length === 0 ? (
                  <p className="text-text-muted text-center py-8">No sessions created yet</p>
                ) : (
                  <div className="space-y-3">
                    {eventSessions.map((session, index) => (
                      <div
                        key={session.id}
                        className="bg-surface-subtle rounded-lg p-3.5 border border-border-subtle"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3">
                              <span className="text-base font-semibold text-text-primary">
                                {session.title}
                              </span>
                              <span className="text-sm text-text-muted">
                                {session.start_time} - {session.end_time}
                              </span>
                            </div>
                            {session.presenter && (
                              <p className="text-sm text-text-secondary mt-1">
                                Presenter: {session.presenter}
                              </p>
                            )}
                            {session.description && (
                              <p className="text-sm text-text-muted mt-2">
                                {session.description}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => handleDeleteSession(session.id)}
                            className="p-2 text-status-error hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors"
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
          <div className="bg-surface-default border border-border-subtle rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-text-primary">Create Session</h2>
                  <p className="text-text-muted mt-1">Creating a new session for {clickedDateForSession}</p>
                </div>
                <button
                  onClick={() => setShowCreateSessionModal(false)}
                  className="p-2 hover:bg-surface-subtle rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-text-muted" />
                </button>
              </div>

              {/* Session Form */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">Session Title *</label>
                    <input
                      type="text"
                      value={sessionForm.title}
                      onChange={(e) => setSessionForm({...sessionForm, title: e.target.value})}
                      className="w-full px-3 py-2 bg-surface-canvas border border-border-default rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-action-primary"
                      placeholder="e.g., Introduction to Programming"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">Session Type</label>
                    <select
                      value={sessionForm.session_type}
                      onChange={(e) => setSessionForm({...sessionForm, session_type: e.target.value})}
                      className="w-full px-3 py-2 bg-surface-canvas border border-border-default rounded-lg text-text-primary focus:outline-none focus:ring-1 focus:ring-action-primary"
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
                    <label className="block text-sm font-medium text-text-secondary mb-2">Start Time *</label>
                    <input
                      type="time"
                      value={sessionForm.start_time}
                      onChange={(e) => setSessionForm({...sessionForm, start_time: e.target.value})}
                      className="w-full px-3 py-2 bg-surface-canvas border border-border-default rounded-lg text-text-primary focus:outline-none focus:ring-1 focus:ring-action-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">End Time *</label>
                    <input
                      type="time"
                      value={sessionForm.end_time}
                      onChange={(e) => setSessionForm({...sessionForm, end_time: e.target.value})}
                      className="w-full px-3 py-2 bg-surface-canvas border border-border-default rounded-lg text-text-primary focus:outline-none focus:ring-1 focus:ring-action-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">Presenter</label>
                    <input
                      type="text"
                      value={sessionForm.presenter}
                      onChange={(e) => setSessionForm({...sessionForm, presenter: e.target.value})}
                      className="w-full px-3 py-2 bg-surface-canvas border border-border-default rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-action-primary"
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">Location</label>
                    <input
                      type="text"
                      value={sessionForm.location}
                      onChange={(e) => setSessionForm({...sessionForm, location: e.target.value})}
                      className="w-full px-3 py-2 bg-surface-canvas border border-border-default rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-action-primary"
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Description</label>
                  <textarea
                    value={sessionForm.description}
                    onChange={(e) => setSessionForm({...sessionForm, description: e.target.value})}
                    className="w-full px-3 py-2 bg-surface-canvas border border-border-default rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-action-primary"
                    rows={3}
                    placeholder="Optional session description"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    onClick={() => setShowCreateSessionModal(false)}
                    className="px-4 py-2 bg-surface-subtle border border-border-subtle text-text-secondary rounded-lg hover:bg-surface-canvas transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateSessionWithEvent}
                    className="px-6 py-2 bg-action-primary text-white rounded-lg hover:bg-action-primary-hover transition-colors text-sm font-medium"
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
