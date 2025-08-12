import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Award, Medal, Star, Flame, Calendar, Target } from 'lucide-react';

interface AttendanceRecord {
  date: string;
  subject: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  time: string;
}

interface AttendanceStreakProps {
  attendanceData: AttendanceRecord[];
}

const AttendanceStreak: React.FC<AttendanceStreakProps> = ({ attendanceData }) => {
  // Calculate streaks and achievements
  const streakData = useMemo(() => {
    if (!attendanceData.length) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        totalPresent: 0,
        totalDays: 0,
        percentage: 0,
        achievements: []
      };
    }

    // Sort by date (newest first)
    const sortedData = [...attendanceData].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // Group by day to handle multiple classes per day
    const dayGroups = sortedData.reduce((groups, record) => {
      const day = record.date.split('T')[0];
      if (!groups[day]) {
        groups[day] = [];
      }
      groups[day].push(record);
      return groups;
    }, {} as Record<string, AttendanceRecord[]>);

    // Calculate day-level attendance (present if at least 50% of classes attended or excused)
    const dayAttendance = Object.entries(dayGroups).map(([day, records]) => {
      const presentCount = records.filter(r => r.status === 'present').length;
      const excusedCount = records.filter(r => r.status === 'excused').length;
      const totalCount = records.length;
      const dayStatus = (presentCount + excusedCount) >= totalCount * 0.5 ? 'present' : 'absent';
      
      return {
        day,
        status: dayStatus,
        records
      };
    }).sort((a, b) => new Date(b.day).getTime() - new Date(a.day).getTime());

    // Calculate current streak (consecutive present days from today backwards)
    let currentStreak = 0;
    for (const dayData of dayAttendance) {
      if (dayData.status === 'present') {
        currentStreak++;
      } else {
        break;
      }
    }

    // Calculate longest streak
    let longestStreak = 0;
    let tempStreak = 0;
    
    for (const dayData of dayAttendance.reverse()) {
      if (dayData.status === 'present') {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    }

    // Calculate overall stats (count excused as present for percentage)
    const totalPresent = attendanceData.filter(r => r.status === 'present' || r.status === 'excused').length;
    const totalDays = attendanceData.length;
    const percentage = Math.round((totalPresent / totalDays) * 100);

    // Define achievements
    const achievements = [];
    
    if (percentage >= 100) {
      achievements.push({
        icon: Trophy,
        title: 'Perfect Attendance',
        description: '100% attendance rate',
        color: 'text-yellow-500',
        bgColor: 'bg-yellow-500/10',
        borderColor: 'border-yellow-500/30'
      });
    } else if (percentage >= 95) {
      achievements.push({
        icon: Award,
        title: 'Excellent Attendance',
        description: '95%+ attendance rate',
        color: 'text-purple-500',
        bgColor: 'bg-purple-500/10',
        borderColor: 'border-purple-500/30'
      });
    } else if (percentage >= 90) {
      achievements.push({
        icon: Medal,
        title: 'Great Attendance',
        description: '90%+ attendance rate',
        color: 'text-blue-500',
        bgColor: 'bg-blue-500/10',
        borderColor: 'border-blue-500/30'
      });
    } else if (percentage >= 80) {
      achievements.push({
        icon: Star,
        title: 'Good Attendance',
        description: '80%+ attendance rate',
        color: 'text-green-500',
        bgColor: 'bg-green-500/10',
        borderColor: 'border-green-500/30'
      });
    } else if (percentage >= 70) {
      achievements.push({
        icon: Target,
        title: 'Steady Attendance',
        description: '70%+ attendance rate',
        color: 'text-orange-500',
        bgColor: 'bg-orange-500/10',
        borderColor: 'border-orange-500/30'
      });
    }

    // Streak achievements
    if (currentStreak >= 30) {
      achievements.push({
        icon: Flame,
        title: 'Super Streak',
        description: '30+ consecutive days',
        color: 'text-red-500',
        bgColor: 'bg-red-500/10',
        borderColor: 'border-red-500/30'
      });
    } else if (currentStreak >= 14) {
      achievements.push({
        icon: Flame,
        title: 'Hot Streak',
        description: '14+ consecutive days',
        color: 'text-orange-500',
        bgColor: 'bg-orange-500/10',
        borderColor: 'border-orange-500/30'
      });
    } else if (currentStreak >= 7) {
      achievements.push({
        icon: Flame,
        title: 'Weekly Streak',
        description: '7+ consecutive days',
        color: 'text-yellow-500',
        bgColor: 'bg-yellow-500/10',
        borderColor: 'border-yellow-500/30'
      });
    }

    return {
      currentStreak,
      longestStreak,
      totalPresent,
      totalDays,
      percentage,
      achievements
    };
  }, [attendanceData]);

  return (
    <div className="space-y-6">
      {/* Streak Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" />
              Current Streak
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-500 mb-1">
              {streakData.currentStreak}
            </div>
            <p className="text-sm text-slate-300">
              consecutive days
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              Best Streak
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-500 mb-1">
              {streakData.longestStreak}
            </div>
            <p className="text-sm text-slate-300">
              longest streak
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-500" />
              Overall Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold mb-1 ${
              streakData.percentage >= 90 ? 'text-green-500' :
              streakData.percentage >= 75 ? 'text-yellow-500' : 'text-red-500'
            }`}>
              {streakData.percentage}%
            </div>
            <p className="text-sm text-slate-300">
              {streakData.totalPresent}/{streakData.totalDays} classes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Achievement Badges */}
      {streakData.achievements.length > 0 && (
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-purple-500" />
              Achievements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {streakData.achievements.map((achievement, index) => {
                const IconComponent = achievement.icon;
                return (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border ${achievement.bgColor} ${achievement.borderColor} transition-all hover:scale-105`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${achievement.bgColor}`}>
                        <IconComponent className={`w-6 h-6 ${achievement.color}`} />
                      </div>
                      <div>
                        <h4 className={`font-semibold ${achievement.color}`}>
                          {achievement.title}
                        </h4>
                        <p className="text-sm text-slate-300">
                          {achievement.description}
                        </p>
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
            {streakData.currentStreak === 0 ? (
              <div>
                <div className="text-2xl mb-2">🎯</div>
                <p className="text-slate-300">
                  Start your attendance streak today! Every journey begins with a single step.
                </p>
              </div>
            ) : streakData.currentStreak < 7 ? (
              <div>
                <div className="text-2xl mb-2">🔥</div>
                <p className="text-slate-300">
                  Great start! Keep going to reach a 7-day streak and earn your first badge.
                </p>
              </div>
            ) : streakData.currentStreak < 14 ? (
              <div>
                <div className="text-2xl mb-2">⚡</div>
                <p className="text-slate-300">
                  You're on fire! Just {14 - streakData.currentStreak} more days to reach a Hot Streak.
                </p>
              </div>
            ) : streakData.currentStreak < 30 ? (
              <div>
                <div className="text-2xl mb-2">🚀</div>
                <p className="text-slate-300">
                  Amazing consistency! {30 - streakData.currentStreak} more days for a Super Streak achievement.
                </p>
              </div>
            ) : (
              <div>
                <div className="text-2xl mb-2">👑</div>
                <p className="text-slate-300">
                  Incredible! You're maintaining an outstanding attendance record. Keep it up!
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AttendanceStreak;
