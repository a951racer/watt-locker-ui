import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { WorkoutRecord } from '../types/workout';

interface WeeklyNPvsHRChartProps {
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

export default function WeeklyNPvsHRChart({ workouts }: WeeklyNPvsHRChartProps) {
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

      const weekWorkouts = workouts.filter((w) => {
        const d = new Date(w.startTime);
        return d >= weekStart && d < weekEnd;
      });

      const npWorkouts = weekWorkouts.filter((w) => w.normalizedPowerWatts != null);
      const hrWorkouts = weekWorkouts.filter((w) => w.avgHeartRateBpm != null);

      const avgNP =
        npWorkouts.length > 0
          ? Math.round(npWorkouts.reduce((sum, w) => sum + (w.normalizedPowerWatts ?? 0), 0) / npWorkouts.length)
          : 0;

      const avgHR =
        hrWorkouts.length > 0
          ? Math.round(hrWorkouts.reduce((sum, w) => sum + (w.avgHeartRateBpm ?? 0), 0) / hrWorkouts.length)
          : 0;

      return {
        week: formatWeekLabel(weekStart),
        np: avgNP,
        hr: avgHR,
      };
    });
  }, [workouts]);

  return (
    <div className="bg-midnightBlue/80 rounded-xl p-4 border border-steelBlue/50">
      <h3 className="text-sm font-semibold text-softFog uppercase tracking-wide mb-3">
        Avg NP vs Avg HR (Last 8 Weeks)
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
            yAxisId="left"
            tick={{ fill: '#7E93AD', fontSize: 11 }}
            axisLine={{ stroke: '#2E4767' }}
            tickLine={false}
            width={40}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
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
            formatter={(value, name) => [
              `${value} ${name === 'np' ? 'W' : 'bpm'}`,
              name === 'np' ? 'Avg NP' : 'Avg HR',
            ]}
          />
          <Legend
            wrapperStyle={{ fontSize: '11px', color: '#7E93AD' }}
            formatter={(value) => (value === 'np' ? 'Avg NP (W)' : 'Avg HR (bpm)')}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="np"
            stroke="#F59E0B"
            strokeWidth={2}
            dot={{ fill: '#F59E0B', r: 3 }}
            activeDot={{ fill: '#FBBF24', r: 5 }}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="hr"
            stroke="#EF4444"
            strokeWidth={2}
            dot={{ fill: '#EF4444', r: 3 }}
            activeDot={{ fill: '#F87171', r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
