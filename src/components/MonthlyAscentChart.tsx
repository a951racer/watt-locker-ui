import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { WorkoutRecord } from '../types/workout';

interface MonthlyAscentChartProps {
  workouts: WorkoutRecord[];
}

export default function MonthlyAscentChart({ workouts }: MonthlyAscentChartProps) {
  const data = useMemo(() => {
    const now = new Date();
    const months: Array<{ label: string; year: number; month: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        label: d.toLocaleDateString('en-US', { month: 'short' }),
        year: d.getFullYear(),
        month: d.getMonth(),
      });
    }

    return months.map(({ label, year, month }) => {
      const total = workouts
        .filter((w) => {
          const d = new Date(w.startTime);
          return d.getFullYear() === year && d.getMonth() === month;
        })
        .reduce((sum, w) => sum + (Number(w.elevationGainMeters) || 0), 0);
      const feet = Math.round(total * 3.28084);
      return { month: label, feet };
    });
  }, [workouts]);

  return (
    <div className="bg-midnightBlue/80 rounded-xl p-4 border border-steelBlue/50">
      <h3 className="text-sm font-semibold text-softFog uppercase tracking-wide mb-3">
        Total Ascent per Month (6 Months)
      </h3>
      <ResponsiveContainer width="100%" height={270}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2E4767" />
          <XAxis dataKey="month" tick={{ fill: '#7E93AD', fontSize: 11 }} axisLine={{ stroke: '#2E4767' }} tickLine={false} />
          <YAxis tick={{ fill: '#7E93AD', fontSize: 11 }} axisLine={{ stroke: '#2E4767' }} tickLine={false} width={55} tickFormatter={(v) => v.toLocaleString()} />
          <Tooltip
            contentStyle={{ backgroundColor: '#0D2A4F', border: '1px solid #2E4767', borderRadius: '8px', color: '#D9E1EA' }}
            formatter={(value) => [`${Number(value).toLocaleString()} ft`, 'Ascent']}
          />
          <Bar dataKey="feet" fill="#10B981" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
