import { useState, useEffect, useCallback } from 'react';
import {
  isFaceVerificationAllowed,
  getCurrentActivePeriod,
  generatePeriodKey,
  hasVerifiedForPeriod,
  DEFAULT_TIME_CONFIG,
  type TimeRestrictionConfig,
  type ClassPeriod
} from '@/utils/timeRestrictions';

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
  timeConfig: TimeRestrictionConfig;
}

/**
 * Hook to manage time-based face verification restrictions
 */
export const useTimeRestrictions = (
  config: TimeRestrictionConfig = DEFAULT_TIME_CONFIG
): UseTimeRestrictionsReturn => {
  const [verificationHistory, setVerificationHistory] = useState<string[]>([]);
  const [timeConfig] = useState(config);
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
    timeConfig,
  };
};
