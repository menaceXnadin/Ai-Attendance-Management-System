import React, { useState, useEffect } from 'react';
import { Calendar, momentLocalizer, Views, View, type SlotInfo } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
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
  TrendingUp
} from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';

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

interface CalendarDisplayEvent {
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
}

const AcademicCalendar: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // State management
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarDisplayEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<View>('month');
  const [filterType, setFilterType] = useState<string>('all');
  const [showEventModal, setShowEventModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
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

  // Filter events based on type
  const filteredEvents = calendarEvents.filter(event => {
    if (filterType === 'all') return true;
    return event.resource?.event_type === filterType;
  });

  // Fetch events from API
  const fetchEvents = React.useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const startDate = moment(currentDate).startOf('month').format('YYYY-MM-DD');
      const endDate = moment(currentDate).endOf('month').format('YYYY-MM-DD');
      
      const response = await fetch(
        `http://localhost:8000/api/calendar/events?start_date=${startDate}&end_date=${endDate}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setEvents(data);
        
        // Convert to react-big-calendar format
        const formattedEvents: CalendarDisplayEvent[] = data.map((event: CalendarEvent) => ({
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
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  }, [currentDate]);

  // Fetch calendar stats
  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8000/api/calendar/stats', {
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
  const handleEventClick = (event: CalendarDisplayEvent) => {
    setSelectedEvent(event.resource);
    setShowEventModal(true);
  };

  // Handle slot selection for creating events
  const handleSlotSelect = (_slotInfo: SlotInfo) => {
    if (isAdmin) {
      // Handle creating new event
      setShowCreateModal(true);
    }
  };

  // Get event type info
  const getEventTypeInfo = (type: string) => {
    const types: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; label: string }> = {
      class: { icon: BookOpen, color: '#10B981', label: 'Class' },
      exam: { icon: AlertCircle, color: '#F59E0B', label: 'Exam' },
      holiday: { icon: CalendarDays, color: '#EF4444', label: 'Holiday' },
      special_event: { icon: Users, color: '#3B82F6', label: 'Special Event' },
      cancelled_class: { icon: X, color: '#6B7280', label: 'Cancelled' }
    };
    return types[type] || types.special_event;
  };

  // Navigation handlers
  const navigateToday = () => setCurrentDate(new Date());
  const navigateBack = () => {
    const view = currentView === 'work_week' ? 'week' : currentView;
    const newDate = moment(currentDate).subtract(1, view as moment.unitOfTime.DurationConstructor).toDate();
    setCurrentDate(newDate);
  };
  const navigateNext = () => {
    const view = currentView === 'work_week' ? 'week' : currentView;
    const newDate = moment(currentDate).add(1, view as moment.unitOfTime.DurationConstructor).toDate();
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

  useEffect(() => {
    fetchEvents();
    fetchStats();
  }, [fetchEvents]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="bg-slate-900/60 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Academic Calendar</h1>
              <p className="text-slate-400">Manage your academic schedule and events</p>
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
                  <option value="class">Classes</option>
                  <option value="exam">Exams</option>
                  <option value="holiday">Holidays</option>
                  <option value="special_event">Special Events</option>
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
                <p className="text-sm font-medium text-slate-400">Today's Classes</p>
                <p className="text-2xl font-bold text-white mt-1">{stats.classes_today || 0}</p>
              </div>
              <div className="p-3 bg-green-500/20 rounded-xl">
                <BookOpen className="w-6 h-6 text-green-400" />
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
            <div style={{ height: '600px' }} className="calendar-dark">
              <Calendar
                localizer={localizer}
                events={filteredEvents}
                startAccessor="start"
                endAccessor="end"
                style={{ height: '100%' }}
                views={['month', 'week', 'day']}
                view={currentView}
                onView={setCurrentView}
                date={currentDate}
                onNavigate={setCurrentDate}
                onSelectEvent={handleEventClick}
                onSelectSlot={isAdmin ? handleSlotSelect : undefined}
                selectable={isAdmin}
                eventPropGetter={(event) => ({
                  style: {
                    backgroundColor: event.resource?.color_code || '#3B82F6',
                    borderColor: event.resource?.color_code || '#3B82F6',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '500'
                  }
                })}
                components={{
                  toolbar: () => null, // Hide default toolbar since we have custom controls
                }}
                popup
              />
            </div>
          )}
        </div>

        {/* Event Types Legend */}
        <div className="bg-slate-900/60 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Filter className="w-5 h-5 text-blue-400" />
            Event Types
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries({
              class: { color: '#10B981', icon: BookOpen, label: 'Classes' },
              holiday: { color: '#EF4444', icon: CalendarDays, label: 'Holidays' },
              exam: { color: '#F59E0B', icon: AlertCircle, label: 'Exams' },
              special_event: { color: '#3B82F6', icon: Users, label: 'Special Events' },
              cancelled_class: { color: '#6B7280', icon: X, label: 'Cancelled' }
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
                    style={{ 
                      backgroundColor: selectedEvent.color_code + '20',
                      color: selectedEvent.color_code
                    }}
                  >
                    {React.createElement(getEventTypeInfo(selectedEvent.event_type).icon, {
                      className: "w-6 h-6",
                    })}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">{selectedEvent.title}</h2>
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
            </div>
          </div>
        </div>
      )}

      {/* Create Event Modal - Placeholder */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/50 rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">Create New Event</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 hover:bg-slate-800/60 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <p className="text-slate-400">Event creation form coming soon...</p>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal - Placeholder */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/50 rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">Calendar Settings</h2>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="p-2 hover:bg-slate-800/60 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <p className="text-slate-400">Settings panel coming soon...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AcademicCalendar;
