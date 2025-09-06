// Time-based access control for face verification
// Ensures attendance can only be marked during valid periods

// � TIME RESTRICTIONS DISABLED - Always allow face verification for easier development
export const DEVELOPMENT_MODE = true;
export const FORCE_DEVELOPMENT_OVERRIDE = true; 
export const TIME_RESTRICTIONS_ENABLED = true; // Master switch to enable time restrictions

import { isDevelopmentOverrideEnabled } from './developmentOverride';

export interface ClassPeriod {
  id: string;
  name: string;
  startTime: string; // HH:MM format
  endTime: string;   // HH:MM format
  subjectId?: number;
}

export interface SchoolHours {
  startTime: string; // HH:MM format
  endTime: string;   // HH:MM format
}

export interface TimeRestrictionConfig {
  schoolHours: SchoolHours;
  classPeriods: ClassPeriod[];
}

// Default school hours and periods configuration
export const DEFAULT_TIME_CONFIG: TimeRestrictionConfig = {
  schoolHours: {
    startTime: "08:00",
    endTime: "17:00"
  },
  classPeriods: [
    { id: "period-1", name: "First Period", startTime: "08:30", endTime: "10:00" },
    { id: "period-2", name: "Second Period", startTime: "10:15", endTime: "11:45" },
    { id: "period-3", name: "Third Period", startTime: "12:00", endTime: "13:30" },
    { id: "period-4", name: "Fourth Period", startTime: "14:00", endTime: "15:30" },
    { id: "period-5", name: "Fifth Period", startTime: "15:45", endTime: "17:15" }
  ]
};

/**
 * Convert HH:MM time string to minutes from midnight
 */
export const timeToMinutes = (timeStr: string): number => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * Get current time in minutes from midnight
 */
export const getCurrentTimeInMinutes = (): number => {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
};

/**
 * Check if current time is within school hours
 */
export const isWithinSchoolHours = (config: TimeRestrictionConfig = DEFAULT_TIME_CONFIG): boolean => {
  const currentMinutes = getCurrentTimeInMinutes();
  const schoolStart = timeToMinutes(config.schoolHours.startTime);
  const schoolEnd = timeToMinutes(config.schoolHours.endTime);
  
  return currentMinutes >= schoolStart && currentMinutes <= schoolEnd;
};

/**
 * Get the current active class period, if any
 */
export const getCurrentActivePeriod = (config: TimeRestrictionConfig = DEFAULT_TIME_CONFIG): ClassPeriod | null => {
  const currentMinutes = getCurrentTimeInMinutes();
  
  for (const period of config.classPeriods) {
    const periodStart = timeToMinutes(period.startTime);
    const periodEnd = timeToMinutes(period.endTime);
    
    if (currentMinutes >= periodStart && currentMinutes <= periodEnd) {
      return period;
    }
  }
  
  return null;
};

/**
 * Get the next upcoming period
 */
export const getNextPeriod = (config: TimeRestrictionConfig = DEFAULT_TIME_CONFIG): ClassPeriod | null => {
  const currentMinutes = getCurrentTimeInMinutes();
  
  for (const period of config.classPeriods) {
    const periodStart = timeToMinutes(period.startTime);
    
    if (currentMinutes < periodStart) {
      return period;
    }
  }
  
  return null;
};

/**
 * Check if face verification is currently allowed
 */
export const isFaceVerificationAllowed = (
  config: TimeRestrictionConfig = DEFAULT_TIME_CONFIG,
  hasVerifiedThisPeriod: boolean = false
): {
  allowed: boolean;
  reason: string;
  currentPeriod?: ClassPeriod;
  nextPeriod?: ClassPeriod;
  timeUntilNext?: string;
} => {
  // � TIME RESTRICTIONS DISABLED - Always allow access
  if (!TIME_RESTRICTIONS_ENABLED) {
    const mockPeriod: ClassPeriod = {
      id: 'always-available',
      name: 'Always Available',
      startTime: '00:00',
      endTime: '23:59'
    };
    
    return {
      allowed: true,
      reason: "✅ Face verification available - Time restrictions disabled",
      currentPeriod: mockPeriod
    };
  }

  // Legacy development overrides (kept for reference but not needed)
  const isOverrideEnabled = isDevelopmentOverrideEnabled();
  if (isOverrideEnabled || DEVELOPMENT_MODE || FORCE_DEVELOPMENT_OVERRIDE) {
    const mockPeriod: ClassPeriod = {
      id: 'dev-period',
      name: 'Development Period',
      startTime: '00:00',
      endTime: '23:59'
    };
    
    let reasonText = "🔧 DEVELOPMENT MODE: All restrictions bypassed for testing";
    if (isOverrideEnabled) {
      reasonText = "🔧 DEVELOPMENT OVERRIDE: All restrictions bypassed (toggle active)";
    } else if (FORCE_DEVELOPMENT_OVERRIDE) {
      reasonText = "🔧 FORCE OVERRIDE: All restrictions bypassed for immediate testing";
    }
    
    return {
      allowed: true,
      reason: reasonText,
      currentPeriod: mockPeriod,
    };
  }

  // First check if we're within school hours
  if (!isWithinSchoolHours(config)) {
    const schoolStart = config.schoolHours.startTime;
    const schoolEnd = config.schoolHours.endTime;
    return {
      allowed: false,
      reason: `Face verification is only available during school hours (${schoolStart} - ${schoolEnd})`,
    };
  }

  // Check if we're within an active period
  const currentPeriod = getCurrentActivePeriod(config);
  if (!currentPeriod) {
    const nextPeriod = getNextPeriod(config);
    const timeUntilNext = nextPeriod ? calculateTimeUntil(nextPeriod.startTime) : null;
    
    return {
      allowed: false,
      reason: "No class period is currently active",
      nextPeriod,
      timeUntilNext: timeUntilNext || undefined,
    };
  }

  // Check if already verified for this period
  if (hasVerifiedThisPeriod) {
    const nextPeriod = getNextPeriod(config);
    const timeUntilNext = nextPeriod ? calculateTimeUntil(nextPeriod.startTime) : null;
    
    return {
      allowed: false,
      reason: `Already verified for ${currentPeriod.name}. Wait for the next period.`,
      currentPeriod,
      nextPeriod,
      timeUntilNext: timeUntilNext || undefined,
    };
  }

  // All checks passed - verification is allowed
  return {
    allowed: true,
    reason: `Face verification available for ${currentPeriod.name}`,
    currentPeriod,
  };
};

/**
 * Calculate time until a specific time (HH:MM)
 */
export const calculateTimeUntil = (targetTime: string): string => {
  const currentMinutes = getCurrentTimeInMinutes();
  const targetMinutes = timeToMinutes(targetTime);
  
  let diffMinutes = targetMinutes - currentMinutes;
  
  // If target is tomorrow (past midnight)
  if (diffMinutes < 0) {
    diffMinutes += 24 * 60;
  }
  
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
};

/**
 * Format time string for display (convert 24h to 12h format)
 */
export const formatTimeForDisplay = (timeStr: string): string => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
};

/**
 * Generate a unique period key for tracking verifications
 * Format: YYYY-MM-DD-PERIOD_ID
 */
export const generatePeriodKey = (period: ClassPeriod, date?: Date): string => {
  const targetDate = date || new Date();
  const dateStr = targetDate.toISOString().split('T')[0];
  return `${dateStr}-${period.id}`;
};

/**
 * Check if user has already verified for a specific period today
 */
export const hasVerifiedForPeriod = (
  periodKey: string,
  verificationHistory: string[]
): boolean => {
  return verificationHistory.includes(periodKey);
};

/**
 * Get time remaining in current period
 */
export const getTimeRemainingInPeriod = (period: ClassPeriod): string => {
  const currentMinutes = getCurrentTimeInMinutes();
  const periodEnd = timeToMinutes(period.endTime);
  const remainingMinutes = periodEnd - currentMinutes;
  
  if (remainingMinutes <= 0) {
    return "Period ended";
  }
  
  const hours = Math.floor(remainingMinutes / 60);
  const minutes = remainingMinutes % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  } else {
    return `${minutes}m remaining`;
  }
};
