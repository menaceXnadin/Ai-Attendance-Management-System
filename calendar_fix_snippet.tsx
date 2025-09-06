            <div 
              style={{ height: '600px' }} 
              className="calendar-dark"
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