/**
 * Enhanced Attendance Streak & Badges Component
 * Uses the new robust backend API for accurate calculations
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Trophy, Award, Medal, Star, Flame, Calendar, Target, Loader2, TrendingUp, Zap } from 'lucide-react';

interface StreakData {
  current_streak: number;
  longest_streak: number;
  current_week_streak: number;
  is_streak_active: boolean;
  total_class_days: number;
  total_present_days: number;
  calculation_period_days: number;
}

interface BadgeData {
  id: string;
  name: string;
  description: string;
  tier: 'legendary' | 'epic' | 'rare' | 'uncommon' | 'common';
  icon: string;
  color: string;
}

interface BadgesResponse {
  badges: BadgeData[];
  total_earned: number;
  streak_summary: {
    current_streak: number;
    longest_streak: number;
    is_active: boolean;
  };
}

const EnhancedAttendanceStreak: React.FC = () => {
  // Fetch streak data from new robust API
  const { data: streakData, isLoading: streakLoading, error: streakError } = useQuery<StreakData>({
    queryKey: ['my-streaks'],
    queryFn: async () => {
      const response = await fetch('http://127.0.0.1:8000/api/streaks-badges/my-streaks?period_days=180', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch streak data');
      }
      
      return response.json();
    },
    staleTime: 60000, // Cache for 1 minute
    retry: 2
  });

  // Fetch badges from new robust API
  const { data: badgesData, isLoading: badgesLoading } = useQuery<BadgesResponse>({
    queryKey: ['my-badges'],
    queryFn: async () => {
      const response = await fetch('http://127.0.0.1:8000/api/streaks-badges/my-badges', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch badges');
      }
      
      return response.json();
    },
    staleTime: 60000,
    retry: 2
  });

  // Loading state
  if (streakLoading || badgesLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <Loader2 className="h-12 w-12 animate-spin text-blue-400 mb-4" />
        <p className="text-slate-300">Loading your achievements...</p>
      </div>
    );
  }

  // Error state
  if (streakError) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-400">Failed to load streak data. Please try again.</p>
      </div>
    );
  }

  const attendance_rate = streakData ? 
    Math.round((streakData.total_present_days / streakData.total_class_days) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Streak Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Current Streak */}
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 overflow-hidden">
          <div className={`absolute top-0 left-0 right-0 h-1 ${
            streakData?.is_streak_active ? 'bg-gradient-to-r from-orange-500 to-red-500' : 'bg-gray-600'
          }`}></div>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-lg text-white flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Flame className={`w-5 h-5 ${streakData?.is_streak_active ? 'text-orange-500' : 'text-gray-500'}`} />
                Current Streak
              </span>
              {streakData?.is_streak_active && (
                <Badge className="bg-green-500/20 text-green-300 border-green-400/30">
                  Active
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-4xl font-bold mb-1 ${
              streakData?.is_streak_active ? 'text-orange-500' : 'text-gray-500'
            }`}>
              {streakData?.current_streak || 0}
            </div>
            <p className="text-sm text-slate-300">
              consecutive days
            </p>
          </CardContent>
        </Card>

        {/* Best Streak */}
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-500 to-amber-500"></div>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              Best Streak
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-yellow-500 mb-1">
              {streakData?.longest_streak || 0}
            </div>
            <p className="text-sm text-slate-300">
              longest streak
            </p>
          </CardContent>
        </Card>

        {/* Overall Rate */}
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-cyan-500"></div>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-500" />
              Overall Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-4xl font-bold mb-1 ${
              attendance_rate >= 90 ? 'text-green-500' :
              attendance_rate >= 75 ? 'text-yellow-500' : 'text-red-500'
            }`}>
              {attendance_rate}%
            </div>
            <p className="text-sm text-slate-300">
              {streakData?.total_present_days || 0}/{streakData?.total_class_days || 0} classes
            </p>
            <Progress value={attendance_rate} className="h-2 mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">
              {streakData?.current_week_streak || 0}
            </div>
            <p className="text-xs text-slate-400">Days present this week</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-400" />
              Calculation Period
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-400">
              {streakData?.calculation_period_days || 0}
            </div>
            <p className="text-xs text-slate-400">Days analyzed</p>
          </CardContent>
        </Card>
      </div>

      {/* Achievement Badges */}
      {badgesData && badgesData.badges.length > 0 && (
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Award className="w-5 h-5 text-purple-500" />
                Achievements
              </span>
              <Badge className="bg-purple-500/20 text-purple-300 border-purple-400/30">
                {badgesData.total_earned} Earned
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {badgesData.badges.map((badge, index) => {
                const tierColors = {
                  legendary: 'border-yellow-500/50 bg-yellow-500/10',
                  epic: 'border-purple-500/50 bg-purple-500/10',
                  rare: 'border-blue-500/50 bg-blue-500/10',
                  uncommon: 'border-green-500/50 bg-green-500/10',
                  common: 'border-gray-500/50 bg-gray-500/10'
                };
                
                const tierTextColors = {
                  legendary: 'text-yellow-400',
                  epic: 'text-purple-400',
                  rare: 'text-blue-400',
                  uncommon: 'text-green-400',
                  common: 'text-gray-400'
                };

                return (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border-2 ${tierColors[badge.tier]} transition-all hover:scale-105 hover:shadow-lg`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`text-3xl`}>
                        {badge.icon}
                      </div>
                      <div className="flex-1">
                        <h4 className={`font-semibold ${tierTextColors[badge.tier]} mb-1`}>
                          {badge.name}
                        </h4>
                        <p className="text-xs text-slate-300 mb-2">
                          {badge.description}
                        </p>
                        <Badge className="text-xs" variant="outline">
                          {badge.tier}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Motivation Messages */}
      <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
        <CardContent className="pt-6">
          <div className="text-center">
            {!streakData?.is_streak_active ? (
              <div>
                <div className="text-4xl mb-3">🎯</div>
                <h3 className="text-xl font-semibold text-white mb-2">Start Your Streak!</h3>
                <p className="text-slate-300">
                  Your next attendance will begin a new streak. Every journey starts with a single step.
                </p>
              </div>
            ) : (streakData?.current_streak || 0) < 7 ? (
              <div>
                <div className="text-4xl mb-3">🔥</div>
                <h3 className="text-xl font-semibold text-white mb-2">Great Start!</h3>
                <p className="text-slate-300">
                  Keep going to reach a 7-day streak and earn your Weekly Streak badge.
                </p>
              </div>
            ) : (streakData?.current_streak || 0) < 14 ? (
              <div>
                <div className="text-4xl mb-3">⚡</div>
                <h3 className="text-xl font-semibold text-white mb-2">You're On Fire!</h3>
                <p className="text-slate-300">
                  Just {14 - (streakData?.current_streak || 0)} more days to reach a Hot Streak!
                </p>
              </div>
            ) : (streakData?.current_streak || 0) < 30 ? (
              <div>
                <div className="text-4xl mb-3">🚀</div>
                <h3 className="text-xl font-semibold text-white mb-2">Amazing Consistency!</h3>
                <p className="text-slate-300">
                  {30 - (streakData?.current_streak || 0)} more days for a Super Streak achievement!
                </p>
              </div>
            ) : (
              <div>
                <div className="text-4xl mb-3">👑</div>
                <h3 className="text-xl font-semibold text-white mb-2">Legendary Performance!</h3>
                <p className="text-slate-300">
                  You're maintaining an outstanding attendance record. Keep it up, champion!
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EnhancedAttendanceStreak;
