import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { WorkoutRecord } from '../types/workout';

interface WeeklyMilesChartProps {
  workouts: WorkoutRecord[];
}

/**
 * Get the Monday of the week for a given date.
 */
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday = 1, Sunday = 0 → shift back 6
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Format a date as "MMM D" (e.g., "May 5")
 */
function formatWeekLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function WeeklyMilesChart({ workouts }: WeeklyMilesChartProps) {
  const data = useMemo(() => {
    // Get the Monday of the current week
    const now = new Date();
    const currentMonday = getMonday(now);

    // Generate the last 8 week start dates (Mondays)
    const weeks: Date[] = [];
    for (let i = 7; i >= 0; i--) {
      const monday = new Date(currentMonday);
      monday.setDate(monday.getDate() - i * 7);
      weeks.push(monday);
    }

    // Bucket workouts into weeks
    const weeklyMiles = weeks.map((weekStart) => {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const totalMeters = workouts
        .filter((w) => {
          const d = new Date(w.startTime);
          return d >= weekStart && d < weekEnd;
        })
        .reduce((sum, w) => sum + (w.distanceMeters || 0), 0);

      const miles = totalMeters / 1609.344;

      return {
        week: formatWeekLabel(weekStart),
        miles: Math.round(miles * 10) / 10,
      };
    });

    return weeklyMiles;
  }, [workouts]);

  return (
    <div className="bg-midnightBlue/80 rounded-xl p-4 border border-steelBlue/50">
      <h3 className="text-sm font-semibold text-softFog uppercase tracking-wide mb-3">
        Weekly Miles (Last 8 Weeks)
      </h3>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2E4767" />
          <XAxis
            dataKey="week"
            tick={{ fill: '#7E93AD', fontSize: 11 }}
            axisLine={{ stroke: '#2E4767' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#7E93AD', fontSize: 11 }}
            axisLine={{ stroke: '#2E4767' }}
            tickLine={false}
            width={40}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0D2A4F',
              border: '1px solid #2E4767',
              borderRadius: '8px',
              color: '#D9E1EA',
            }}
            formatter={(value) => [`${value} mi`, 'Miles']}
          />
          <Line
            type="monotone"
            dataKey="miles"
            stroke="#1E7EF2"
            strokeWidth={2}
            dot={{ fill: '#3FA9FF', r: 4 }}
            activeDot={{ fill: '#3FA9FF', r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
