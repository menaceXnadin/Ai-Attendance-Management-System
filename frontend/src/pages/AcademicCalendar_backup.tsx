import React, { useState, useEffect, useCallback, useMemo, createContext, useContext } from 'react';
import { Calendar, momentLocalizer, Views, View, Event, DateCellWrapperProps } from 'react-big-calendar';
// ...existing code...
// Context to provide calendar events to wrappers
import type { CSSProperties } from 'react';
type CalendarEventType = {
  id: number;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  resource?: unknown;
  style?: CSSProperties;
};
const CalendarEventsContext = createContext<CalendarEventType[]>([]);

// Custom date cell wrapper to fill cell background with event color
const CustomDateCellWrapper = (props: DateCellWrapperProps) => {
  const events = useContext(CalendarEventsContext);
  const { value, children } = props;

  const dayOfWeek = value.getDay();
  // Nepal calendar: Only Saturday (6) is weekend/holiday, Sunday (0) is a working day
  const isWeekend = dayOfWeek === 6; // Only Saturday is weekend in Nepal

  // Use CSS variables to prevent style overriding
  const cellStyle: React.CSSProperties = {
    width: '100%', 
    height: '100%', 
    minHeight: 120, 
    position: 'relative',
    border: '1px solid rgba(71, 85, 105, 0.3)'
  };

  const eventOnDate = events.find(e => {
    const d = new Date(e.start);
    return d.getFullYear() === value.getFullYear() && d.getMonth() === value.getMonth() && d.getDate() === value.getDate();
  });

  const resource = eventOnDate?.resource as CalendarEvent | undefined;
  const isHoliday = resource && (resource.event_type?.toLowerCase() === 'holiday' || resource.title?.toLowerCase().includes('holiday'));

  if (isHoliday || isWeekend) {
    // Only holidays and Saturday (Nepal weekend) get a red tint
    cellStyle['--cell-bg-color'] = 'rgba(239, 68, 68, 0.1)';
  } else if (eventOnDate) {
    const originalColor = resource?.color_code;
    if (originalColor) {
      cellStyle['--cell-bg-color'] = originalColor + '20';
    }
  }

  // Apply background through CSS variable
  if (cellStyle['--cell-bg-color']) {
    cellStyle.background = `var(--cell-bg-color, ${cellStyle['--cell-bg-color']})`;
  }

  return (
    <div style={cellStyle} className="calendar-cell-wrapper">
      {children}
    </div>
  );
};
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
    style: {
      backgroundColor: string;
      borderColor: string;
      color: string;
    };
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<View>('month');
  const [filterType, setFilterType] = useState<string>('all');
  const [showEventModal, setShowEventModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
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
    if (filterType === 'all') return calendarEvents;
    return calendarEvents.filter(event => {
      const eventType = event.resource?.event_type?.toLowerCase();
      const filterTypeLower = filterType.toLowerCase();
      return eventType === filterTypeLower;
    });
  }, [calendarEvents, filterType]);

  // Debug: Log filtered events when they change
  useEffect(() => {
    console.log('🎯 Filtered events for calendar:', filteredEvents);
    console.log('🎯 Number of filtered events:', filteredEvents.length);
    if (filteredEvents.length > 0) {
      console.log('🎯 First filtered event structure:', filteredEvents[0]);
      console.log('🎯 First event has resource?', !!filteredEvents[0]?.resource);
    }
  }, [filteredEvents]);

  // Fetch events from API
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('authToken'); // Use authToken instead of token
      const startDate = moment(currentDate).startOf('month').format('YYYY-MM-DD');
      const endDate = moment(currentDate).endOf('month').format('YYYY-MM-DD');
      
      console.log('📡 Fetching events for:', { startDate, endDate, token: !!token });
      console.log('👤 Current user role from context:', user?.role);
      console.log('👤 Is admin from context:', isAdmin);
      console.log('👤 User ID from context:', user?.id);
      
      if (!token) {
        console.warn('🚫 No auth token found, skipping fetch');
        setLoading(false);
        return;
      }

      // First, verify user authentication
      try {
        const userVerifyResponse = await fetch('http://localhost:8000/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (userVerifyResponse.ok) {
          const userData = await userVerifyResponse.json();
          console.log('✅ User verification successful:', userData);
        } else {
          console.error('❌ User verification failed:', userVerifyResponse.status);
        }
      } catch (verifyError) {
        console.error('❌ User verification error:', verifyError);
      }
      
      const response = await fetch(
        `http://localhost:8000/api/calendar/events?start_date=${startDate}&end_date=${endDate}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('📡 API Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('📊 Raw events from API:', data);
        console.log('📅 Number of events:', data.length);
        
        // Check for Saturday events specifically
        const saturdayEvents = data.filter(event => 
          event.title && event.title.toLowerCase().includes('saturday')
        );
        console.log('🔍 Saturday events found:', saturdayEvents);
        
        // Check for Sunday events to confirm Nepal calendar
        const sundayEvents = data.filter(event => {
          const eventDate = new Date(event.start_date);
          return eventDate.getDay() === 0; // Sunday
        });
        console.log('☀️ Sunday events found:', sundayEvents);
        
        // Debug: Check what event types we're getting
        const eventTypes = [...new Set(data.map(event => event.event_type))];
        console.log('🏷️ Unique event types received:', eventTypes);
        
        // Debug: Check weekend pattern
        const weekendEvents = data.filter(event => {
          const eventDate = new Date(event.start_date);
          const dayOfWeek = eventDate.getDay();
          return dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
        });
        console.log('🗓️ Weekend events (Sun/Sat):', weekendEvents.map(e => ({
          date: e.start_date,
          day: new Date(e.start_date).getDay(),
          dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(e.start_date).getDay()],
          title: e.title,
          type: e.event_type
        })));
        
        // Filter out only specific individual subject classes, not general CLASS events
        const filteredEvents = data.filter(event => {
          console.log('🔍 Checking event:', event.title, 'Type:', event.event_type);
          
          // Include ALL event types - no filtering based on type
          // Just show everything that the backend sends
          console.log('✅ Including event:', event.title, 'Type:', event.event_type);
          return true;
        });
        
        console.log('📊 Filtered events (excluding individual classes):', filteredEvents.length);
        console.log('📊 Original events:', data.length);
        
        // Remove duplicate events for the same date (e.g., "Holiday" and "Saturday Holiday" on same day)
        const uniqueEvents = filteredEvents.reduce((acc, event) => {
          const dateKey = event.start_date;
          const existingEvent = acc.find(e => e.start_date === dateKey);
          
          if (!existingEvent) {
            acc.push(event);
          } else {
            // If there's already an event for this date, keep the more general one
            if (event.title.toLowerCase().includes('holiday') && !event.title.toLowerCase().includes('saturday')) {
              // Replace Saturday Holiday with general Holiday
              const index = acc.findIndex(e => e.start_date === dateKey);
              acc[index] = event;
            }
          }
          
          return acc;
        }, [] as CalendarEvent[]);
        
        console.log('📊 Unique events after deduplication:', uniqueEvents.length);
        setEvents(uniqueEvents);
        
        // Convert to react-big-calendar format
        const formattedEvents = uniqueEvents.map((event: CalendarEvent) => ({
          id: event.id,
          title: event.title,
          start: event.is_all_day 
            ? moment(event.start_date).toDate()
            : moment(`${event.start_date} ${event.start_time || '00:00'}`).toDate(),
          end: event.end_date 
            ? (event.is_all_day 
                ? moment(event.end_date).toDate()
                : moment(`${event.end_date} ${event.end_time || '23:59'}`).toDate())
            : (event.is_all_day
                ? moment(event.start_date).toDate()
                : moment(`${event.start_date} ${event.end_time || event.start_time || '00:00'}`).toDate()),
          allDay: event.is_all_day,
          resource: event,
          style: {
            backgroundColor: event.color_code,
            borderColor: event.color_code,
            color: '#ffffff'
          }
        }));
        
        setCalendarEvents(formattedEvents);
        console.log('📅 Formatted events for calendar:', formattedEvents);
        console.log('📅 First event example:', formattedEvents[0]);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  }, [currentDate, isAdmin, user?.id, user?.role]);

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

  // Handle event click
  // Custom event component to ensure clicks work
  const CustomEvent = ({ event }: { event: Event }) => {
    console.log('🎨 CustomEvent rendering:', event.title);
    
    const handleCustomClick = (e: React.MouseEvent) => {
      console.log('🔥 CustomEvent click triggered!');
      console.log('🔥 User role:', user?.role);
      console.log('🔥 Is admin:', isAdmin);
      console.log('🔥 Event data:', event);
      
      e.preventDefault();
      e.stopPropagation();
      
      // Call the main handler
      handleEventClick(event);
    };

    return (
      <div 
        onClick={handleCustomClick}
        onDoubleClick={handleCustomClick}
        style={{
          height: '100%',
          width: '100%',
          cursor: 'pointer',
          padding: '2px 4px',
          fontSize: '12px',
          color: 'white',
          userSelect: 'none',
          pointerEvents: 'auto',
          position: 'relative',
          zIndex: 1000,
          background: 'rgba(0,0,0,0.1)',
          border: '1px solid rgba(255,255,255,0.3)',
          borderRadius: '2px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          overflow: 'hidden'
        }}
        title={`Click to view: ${event.title} (Role: ${user?.role})`}
      >
        <span style={{ 
          fontSize: '11px', 
          fontWeight: 'bold',
          textShadow: '1px 1px 1px rgba(0,0,0,0.5)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {event.title}
        </span>
      </div>
    );
  };

  const handleEventClick = (event: Event) => {
    console.log('🔥 EVENT CLICKED!!! This handler is working!');
    console.log('Event clicked:', event);
    console.log('Event resource:', event.resource);
    console.log('Event title:', event.title);
    console.log('Event resource id:', (event.resource as CalendarEvent)?.id);
    alert('Event clicked: ' + event.title); // Visual confirmation
    
    // Set the selected event from the resource
    const eventData = event.resource || event;
    setSelectedEvent(eventData);
    setShowEventModal(true);
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
        console.log('Event updated successfully:', updatedEvent);
        
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
      } else {
        console.error('Failed to update event');
      }
    } catch (error) {
      console.error('Error updating event:', error);
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

  // Handle slot selection for creating events
  const handleSlotSelect = (slotInfo: { start: Date; end: Date }) => {
    if (isAdmin) {
      // Pre-fill form with selected slot info
      setEventForm(prev => ({
        ...prev,
        start_date: moment(slotInfo.start).format('YYYY-MM-DD'),
        end_date: moment(slotInfo.end).format('YYYY-MM-DD'),
        start_time: moment(slotInfo.start).format('HH:mm'),
        end_time: moment(slotInfo.end).format('HH:mm')
      }));
      setShowCreateModal(true);
    }
  };

  // Handle form input changes
  const handleFormChange = (field: string, value: string | boolean) => {
    setEventForm(prev => ({
      ...prev,
      [field]: value
    }));
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
      class: { icon: BookOpen, color: '#22C55E', label: 'Academic Day' },
      exam: { icon: AlertCircle, color: '#F97316', label: 'Exam' },
      holiday: { icon: CalendarDays, color: '#EF4444', label: 'Holiday' },
      special_event: { icon: Users, color: '#8B5CF6', label: 'Special Event' },
      cancelled_class: { icon: X, color: '#64748B', label: 'Cancelled' }
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
  const handlePrev = () => {
    const view = currentView === 'work_week' ? 'week' : currentView;
    const newDate = moment(currentDate).subtract(1, view as moment.unitOfTime.DurationConstructor).toDate();
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const view = currentView === 'work_week' ? 'week' : currentView;
    const newDate = moment(currentDate).add(1, view as moment.unitOfTime.DurationConstructor).toDate();
    setCurrentDate(newDate);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
    setCurrentView('month');
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

  const dayPropGetter = (date: Date) => {
    const dayOfWeek = date.getDay();
    
    // Nepal calendar: Only Saturday (6) is weekend/holiday
    const isNepalWeekend = dayOfWeek === 6; // Only Saturday
    
    // Return different classes for Nepal calendar system
    if (isNepalWeekend) {
      return {
        className: 'nepal-weekend-day',
        style: {
          backgroundColor: 'rgba(239, 68, 68, 0.05)', // Light red for Saturday
        }
      };
    }
    
    // Sunday and other weekdays are working days in Nepal
    return {
      className: 'nepal-working-day',
      style: {
        backgroundColor: 'transparent',
      }
    };
  };

  // Event styling that fills the entire calendar cell background
  const eventPropGetter = (event: { resource?: CalendarEvent }) => {
    const eventData = event.resource;
    
    console.log('🎨 Styling event:', eventData?.title, 'Type:', eventData?.event_type, 'Color:', eventData?.color_code);
    
    // Use the color_code from the database, fallback to purple if not available
    const backgroundColor = eventData?.color_code || '#8B5CF6';
    
    // Prevent style overriding by using CSS classes instead of inline styles where possible
    return {
      style: {
        '--event-bg-color': backgroundColor,
        '--event-text-color': '#ffffff',
        backgroundColor: backgroundColor,
        borderColor: backgroundColor,
        color: '#ffffff',
        border: '2px solid',
        borderRadius: '6px',
        padding: '2px 6px',
        fontSize: '12px',
        fontWeight: '500'
      } as React.CSSProperties,
      className: `cell-filling-event event-${(eventData?.event_type || 'default').toLowerCase()}`
    };
  };

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
                  onClick={handlePrev}
                  className="p-2 hover:bg-slate-700/60 rounded-lg transition-all duration-200"
                >
                  <ChevronLeft className="w-5 h-5 text-slate-300" />
                </button>
                
                <div className="px-4 py-2 text-white font-medium min-w-[200px] text-center">
                  {formatDisplayDate()}
                </div>
                
                <button
                  onClick={handleNext}
                  className="p-2 hover:bg-slate-700/60 rounded-lg transition-all duration-200"
                >
                  <ChevronRight className="w-5 h-5 text-slate-300" />
                </button>
                
                <button
                  onClick={handleToday}
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

        {/* Calendar */}
        <div className="bg-slate-900/60 backdrop-blur-md border border-slate-700/50 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-96">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mb-4"></div>
              <p className="text-slate-400">Loading calendar events...</p>
            </div>
          ) : (
            <div 
              style={{ height: '600px' }} 
              className="calendar-dark"
              onClick={(e) => {
                const target = e.target as HTMLElement;
                console.log('🚨 CALENDAR CLICKED!');
                console.log('🚨 Target:', target.textContent?.substring(0, 50));
                console.log('🚨 Classes:', target.className);
                
                // Check if it's September 3rd (today)
                if (target.textContent?.includes('03') || target.className.includes('rbc-now')) {
                  console.log('🎯 CLICKED ON SEPTEMBER 3RD!');
                  // Since there's an event on this date, open the event modal
                  if (filteredEvents.length > 0) {
                    const todayEvent = filteredEvents[0]; // We know there's 1 event today
                    console.log('� Opening event:', todayEvent.title);
                    setSelectedEvent(todayEvent.resource as CalendarEvent);
                    setShowEventModal(true);
                  }
                }
              }}
            >
                <CalendarEventsContext.Provider value={filteredEvents}>
                  <Calendar
                    localizer={localizer}
                    events={filteredEvents} 
                    style={{ height: '100%' }}
                    views={['month']}
                    view="month"
                    onView={(view) => setCurrentView(view)}
                    date={currentDate}
                    onNavigate={setCurrentDate}
                    selectable={isAdmin}
                    onSelectSlot={handleSlotSelect}
                    onSelectEvent={handleEventClick}
                    eventPropGetter={eventPropGetter}
                    dayPropGetter={dayPropGetter}
                    components={{
                      toolbar: () => null,
                    }}
                  />
                </CalendarEventsContext.Provider>
              </div>
            )
          }
        </div>

        {/* Event Types Legend */}
        <div className="bg-slate-900/60 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Filter className="w-5 h-5 text-blue-400" />
            Event Types (Nepal Calendar System)
          </h3>
          <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <p className="text-sm text-blue-300 font-medium">
              🇳🇵 <strong>Nepal Academic Calendar:</strong> Saturday is weekend holiday, Sunday-Friday are working days
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries({
              class: { color: '#22C55E', icon: BookOpen, label: 'Academic Days' },
              holiday: { color: '#EF4444', icon: CalendarDays, label: 'Holidays (Saturdays)' },
              exam: { color: '#F97316', icon: AlertCircle, label: 'Exams' },
              special_event: { color: '#8B5CF6', icon: Users, label: 'Special Events' },
              cancelled_class: { color: '#64748B', icon: X, label: 'Cancelled Classes' }
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
                  <div className="flex gap-3">
                    <button
                      onClick={handleEditEvent}
                      className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-teal-400 text-white rounded-xl hover:from-blue-600 hover:to-teal-500 transition-all duration-200 font-medium"
                    >
                      Edit Event
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
                <h2 className="text-xl font-bold text-white">Create New Event</h2>
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Color</label>
                    <div className="flex gap-2">
                      {['#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6'].map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => handleFormChange('color_code', color)}
                          className={`w-8 h-8 rounded-lg border-2 transition-colors ${
                            eventForm.color_code === color 
                              ? 'border-white' 
                              : 'border-slate-600/50 hover:border-slate-400/50'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Color</label>
                    <div className="flex gap-2">
                      {['#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6'].map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => handleFormChange('color_code', color)}
                          className={`w-8 h-8 rounded-lg border-2 transition-colors ${
                            eventForm.color_code === color 
                              ? 'border-white' 
                              : 'border-slate-600/50 hover:border-slate-400/50'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
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
    </div>
  );
};

export default AcademicCalendar;
