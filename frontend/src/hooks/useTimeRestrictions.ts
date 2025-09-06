import { useState, useEffect, useCallback } from 'react';
import React from 'react';
import {
  isFaceVerificationAllowed,
  getCurrentActivePeriod,
  generatePeriodKey,
  hasVerifiedForPeriod,
  DEFAULT_TIME_CONFIG,
  type TimeRestrictionConfig,
  type ClassPeriod
} from '@/utils/timeRestrictions';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/integrations/api/client';

const VERIFICATION_HISTORY_KEY = 'face_verification_history';

interface UseTimeRestrictionsReturn {
  isAllowed: boolean;
  reason: string;
  currentPeriod: ClassPeriod | null;
  nextPeriod?: ClassPeriod;
  timeUntilNext?: string;
  markVerificationComplete: () => void;
  clearTodayHistory: () => void;
  verificationHistory: string[];
}

/**
 * Hook to manage time-based face verification restrictions
 * Dynamically fetches real schedule data instead of using hardcoded periods
 */
export const useTimeRestrictions = (): UseTimeRestrictionsReturn => {
  const [verificationHistory, setVerificationHistory] = useState<string[]>([]);
  const [currentCheck, setCurrentCheck] = useState<{
    isAllowed: boolean;
    reason: string;
    currentPeriod: ClassPeriod | null;
    nextPeriod?: ClassPeriod;
    timeUntilNext?: string;
  }>({
    isAllowed: false,
    reason: "Loading...",
    currentPeriod: null,
  });

  // Fetch today's actual schedule to create dynamic time periods
  const { data: todaySchedule = [] } = useQuery({
    queryKey: ['today-schedule-for-restrictions'],
    queryFn: async () => {
      try {
        console.log('[DEBUG] Fetching schedule for time restrictions...');
        const schedule = await api.schedules.getStudentToday();
        console.log('[DEBUG] Schedule fetched for restrictions:', schedule);
        return schedule;
      } catch (error) {
        console.error('Error fetching schedule for time restrictions:', error);
        return [];
      }
    },
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    staleTime: 60 * 1000, // Consider data stale after 1 minute
  });

  // Convert real schedule to time config dynamically
  const timeConfig: TimeRestrictionConfig = React.useMemo(() => {
    if (todaySchedule.length === 0) {
      console.log('[DEBUG] No schedule data, using default config');
      return DEFAULT_TIME_CONFIG;
    }

    // Convert database schedules to ClassPeriod format
    const classPeriods: ClassPeriod[] = todaySchedule.map((schedule) => ({
      id: `period-${schedule.subject_id}`,
      name: schedule.subject_name,
      startTime: schedule.start_time,
      endTime: schedule.end_time,
    }));

    // Determine school hours from first and last classes
    const startTimes = todaySchedule.map(s => s.start_time).sort();
    const endTimes = todaySchedule.map(s => s.end_time).sort();

    const dynamicConfig = {
      schoolHours: {
        startTime: startTimes[0] || "08:00",
        endTime: endTimes[endTimes.length - 1] || "16:00"
      },
      classPeriods
    };

    console.log('[DEBUG] Dynamic time config created:', dynamicConfig);
    return dynamicConfig;
  }, [todaySchedule]);

  // Load verification history from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(VERIFICATION_HISTORY_KEY);
      if (stored) {
        const history = JSON.parse(stored);
        // Filter out old entries (keep only today's)
        const today = new Date().toISOString().split('T')[0];
        const todayHistory = history.filter((key: string) => key.startsWith(today));
        setVerificationHistory(todayHistory);
        
        // Update localStorage with filtered history
        localStorage.setItem(VERIFICATION_HISTORY_KEY, JSON.stringify(todayHistory));
      }
    } catch (error) {
      console.error('Error loading verification history:', error);
      setVerificationHistory([]);
    }
  }, []);

  // Check current time restrictions
  const checkRestrictions = useCallback(() => {
    const activePeriod = getCurrentActivePeriod(timeConfig);
    const hasVerified = activePeriod 
      ? hasVerifiedForPeriod(generatePeriodKey(activePeriod), verificationHistory)
      : false;

    const result = isFaceVerificationAllowed(timeConfig, hasVerified);
    
    setCurrentCheck({
      isAllowed: result.allowed,
      reason: result.reason,
      currentPeriod: activePeriod,
      nextPeriod: result.nextPeriod,
      timeUntilNext: result.timeUntilNext,
    });
  }, [timeConfig, verificationHistory]);

  // Update restrictions every minute
  useEffect(() => {
    checkRestrictions();
    const interval = setInterval(checkRestrictions, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [checkRestrictions]);

  // Mark verification as complete for current period
  const markVerificationComplete = useCallback(() => {
    const activePeriod = getCurrentActivePeriod(timeConfig);
    if (!activePeriod) {
      console.warn('No active period to mark verification for');
      return;
    }

    const periodKey = generatePeriodKey(activePeriod);
    const newHistory = [...verificationHistory, periodKey];
    
    setVerificationHistory(newHistory);
    
    try {
      localStorage.setItem(VERIFICATION_HISTORY_KEY, JSON.stringify(newHistory));
    } catch (error) {
      console.error('Error saving verification history:', error);
    }

    // Immediately recheck restrictions
    checkRestrictions();
  }, [timeConfig, verificationHistory, checkRestrictions]);

  // Clear today's verification history (for testing/admin purposes)
  const clearTodayHistory = useCallback(() => {
    setVerificationHistory([]);
    try {
      localStorage.removeItem(VERIFICATION_HISTORY_KEY);
    } catch (error) {
      console.error('Error clearing verification history:', error);
    }
    checkRestrictions();
  }, [checkRestrictions]);

  return {
    isAllowed: currentCheck.isAllowed,
    reason: currentCheck.reason,
    currentPeriod: currentCheck.currentPeriod,
    nextPeriod: currentCheck.nextPeriod,
    timeUntilNext: currentCheck.timeUntilNext,
    markVerificationComplete,
    clearTodayHistory,
    verificationHistory,
  };
};
