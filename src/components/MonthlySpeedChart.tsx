import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { WorkoutRecord } from '../types/workout';

interface MonthlySpeedChartProps {
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

export default function MonthlySpeedChart({ workouts }: MonthlySpeedChartProps) {
  const data = useMemo(() => {
    const now = new Date();
    const currentMonday = getMonday(now);

    // 13 weeks = ~3 months
    const weeks: Date[] = [];
    for (let i = 12; i >= 0; i--) {
      const monday = new Date(currentMonday);
      monday.setDate(monday.getDate() - i * 7);
      weeks.push(monday);
    }

    return weeks.map((weekStart) => {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const weekWorkouts = workouts.filter((w) => {
        const d = new Date(w.startTime);
        return d >= weekStart && d < weekEnd && w.avgSpeedMps != null;
      });

      const avg = weekWorkouts.length > 0
        ? Math.round(weekWorkouts.reduce((sum, w) => sum + (Number(w.avgSpeedMps) || 0) * 2.23694, 0) / weekWorkouts.length * 10) / 10
        : 0;

      return { week: formatWeekLabel(weekStart), speed: avg };
    });
  }, [workouts]);

  return (
    <div className="bg-midnightBlue/80 rounded-xl p-4 border border-steelBlue/50">
      <h3 className="text-sm font-semibold text-softFog uppercase tracking-wide mb-3">
        Avg Speed per Week (3 Months)
      </h3>
      <ResponsiveContainer width="100%" height={270}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2E4767" />
          <XAxis dataKey="week" tick={{ fill: '#7E93AD', fontSize: 10 }} axisLine={{ stroke: '#2E4767' }} tickLine={false} interval={2} />
          <YAxis tick={{ fill: '#7E93AD', fontSize: 11 }} axisLine={{ stroke: '#2E4767' }} tickLine={false} width={40} domain={['dataMin - 1', 'dataMax + 1']} />
          <Tooltip
            contentStyle={{ backgroundColor: '#0D2A4F', border: '1px solid #2E4767', borderRadius: '8px', color: '#D9E1EA' }}
            formatter={(value) => [`${value} mph`, 'Avg Speed']}
          />
          <Line type="monotone" dataKey="speed" stroke="#06B6D4" strokeWidth={2} dot={{ fill: '#06B6D4', r: 3 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
