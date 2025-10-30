/**
 * Date utility functions to handle timezone issues
 */

/**
 * Get today's date in YYYY-MM-DD format using LOCAL timezone
 * (not UTC, which causes off-by-one day errors in timezones ahead of UTC)
 * 
 * @returns Date string in YYYY-MM-DD format (e.g., "2025-10-30")
 */
export function getTodayLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Convert a Date object to YYYY-MM-DD format using LOCAL timezone
 * 
 * @param date - Date object to convert
 * @returns Date string in YYYY-MM-DD format
 */
export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get current time in HH:MM:SS format using LOCAL timezone
 * 
 * @returns Time string in HH:MM:SS format (e.g., "14:30:00")
 */
export function getCurrentLocalTime(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Get current date and time in local timezone
 * 
 * @returns Object with date and time strings
 */
export function getCurrentLocalDateTime() {
  return {
    date: getTodayLocalDate(),
    time: getCurrentLocalTime(),
    timestamp: new Date()
  };
}

/**
 * Parse a date string (YYYY-MM-DD) and return a Date object at midnight local time
 * 
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Date object
 */
export function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Check if two date strings represent the same day
 * 
 * @param date1 - First date string (YYYY-MM-DD)
 * @param date2 - Second date string (YYYY-MM-DD)
 * @returns true if dates are the same
 */
export function isSameDay(date1: string, date2: string): boolean {
  return date1 === date2;
}

/**
 * Check if a date string represents today
 * 
 * @param dateString - Date string (YYYY-MM-DD)
 * @returns true if date is today
 */
export function isToday(dateString: string): boolean {
  return dateString === getTodayLocalDate();
}
