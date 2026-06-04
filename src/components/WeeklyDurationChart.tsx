import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { WorkoutRecord } from '../types/workout';

interface WeeklyDurationChartProps {
  workouts: WorkoutRecord[];
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatWeekLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function WeeklyDurationChart({ workouts }: WeeklyDurationChartProps) {
  const data = useMemo(() => {
    const now = new Date();
    const currentMonday = getMonday(now);

    const weeks: Date[] = [];
    for (let i = 7; i >= 0; i--) {
      const monday = new Date(currentMonday);
      monday.setDate(monday.getDate() - i * 7);
      weeks.push(monday);
    }

    return weeks.map((weekStart) => {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const totalSeconds = workouts
        .filter((w) => {
          const d = new Date(w.startTime);
          return d >= weekStart && d < weekEnd;
        })
        .reduce((sum, w) => sum + (w.durationSeconds || 0), 0);

      const hours = Math.round((totalSeconds / 3600) * 10) / 10;

      return {
        week: formatWeekLabel(weekStart),
        hours,
      };
    });
  }, [workouts]);

  return (
    <div className="bg-midnightBlue/80 rounded-xl p-4 border border-steelBlue/50">
      <h3 className="text-sm font-semibold text-softFog uppercase tracking-wide mb-3">
        Weekly Duration (Last 8 Weeks)
      </h3>
      <ResponsiveContainer width="100%" height={270}>
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
            formatter={(value) => [formatHours(value as number), 'Duration']}
          />
          <Line
            type="monotone"
            dataKey="hours"
            stroke="#3FA9FF"
            strokeWidth={2}
            dot={{ fill: '#3FA9FF', r: 4 }}
            activeDot={{ fill: '#1E7EF2', r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
