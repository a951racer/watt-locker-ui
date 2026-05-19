import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { WorkoutRecord } from '../types/workout';

interface WeeklyTSSChartProps {
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

export default function WeeklyTSSChart({ workouts }: WeeklyTSSChartProps) {
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
        return d >= weekStart && d < weekEnd && w.tss != null;
      });

      const totalTSS =
        weekWorkouts.length > 0
          ? Math.round(weekWorkouts.reduce((sum, w) => sum + (w.tss ?? 0), 0))
          : 0;

      return {
        week: formatWeekLabel(weekStart),
        tss: totalTSS,
      };
    });
  }, [workouts]);

  return (
    <div className="bg-midnightBlue/80 rounded-xl p-4 border border-steelBlue/50">
      <h3 className="text-sm font-semibold text-softFog uppercase tracking-wide mb-3">
        Total TSS per Week (Last 8 Weeks)
      </h3>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
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
            formatter={(value) => [`${value}`, 'Total TSS']}
          />
          <Bar dataKey="tss" fill="#10B981" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
