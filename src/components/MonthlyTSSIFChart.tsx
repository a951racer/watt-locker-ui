import { useMemo } from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { WorkoutRecord } from '../types/workout';

interface MonthlyTSSIFChartProps {
  workouts: WorkoutRecord[];
}

export default function MonthlyTSSIFChart({ workouts }: MonthlyTSSIFChartProps) {
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
      const tssWorkouts = workouts.filter((w) => {
        const d = new Date(w.startTime);
        return d.getFullYear() === year && d.getMonth() === month && w.tss != null;
      });
      const ifWorkouts = workouts.filter((w) => {
        const d = new Date(w.startTime);
        return d.getFullYear() === year && d.getMonth() === month && w.intensityFactor != null;
      });

      const avgTSS = tssWorkouts.length > 0
        ? Math.round(tssWorkouts.reduce((sum, w) => sum + (Number(w.tss) || 0), 0) / tssWorkouts.length)
        : 0;
      const avgIF = ifWorkouts.length > 0
        ? Math.round(ifWorkouts.reduce((sum, w) => sum + (Number(w.intensityFactor) || 0), 0) / ifWorkouts.length * 1000) / 1000
        : 0;

      return { month: label, tss: avgTSS, if: avgIF };
    });
  }, [workouts]);

  return (
    <div className="bg-midnightBlue/80 rounded-xl p-4 border border-steelBlue/50">
      <h3 className="text-sm font-semibold text-softFog uppercase tracking-wide mb-3">
        Avg TSS & IF per Month (6 Months)
      </h3>
      <ResponsiveContainer width="100%" height={270}>
        <ComposedChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2E4767" />
          <XAxis dataKey="month" tick={{ fill: '#7E93AD', fontSize: 11 }} axisLine={{ stroke: '#2E4767' }} tickLine={false} />
          <YAxis
            yAxisId="left"
            tick={{ fill: '#7E93AD', fontSize: 11 }}
            axisLine={{ stroke: '#2E4767' }}
            tickLine={false}
            width={40}
            label={{ value: 'TSS', angle: -90, position: 'insideLeft', fill: '#3FA9FF', fontSize: 10 }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fill: '#7E93AD', fontSize: 11 }}
            axisLine={{ stroke: '#2E4767' }}
            tickLine={false}
            width={40}
            domain={[0, 1]}
            label={{ value: 'IF', angle: 90, position: 'insideRight', fill: '#EF4444', fontSize: 10 }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#0D2A4F', border: '1px solid #2E4767', borderRadius: '8px', color: '#D9E1EA' }}
            formatter={(value, name) => [
              name === 'tss' ? `${value}` : `${value}`,
              name === 'tss' ? 'Avg TSS' : 'Avg IF',
            ]}
          />
          <Legend
            wrapperStyle={{ fontSize: '11px', color: '#7E93AD' }}
            formatter={(value) => value === 'tss' ? 'Avg TSS' : 'Avg IF'}
          />
          <Bar yAxisId="left" dataKey="tss" fill="#3FA9FF" radius={[4, 4, 0, 0]} />
          <Line yAxisId="right" type="monotone" dataKey="if" stroke="#EF4444" strokeWidth={2} dot={{ fill: '#EF4444', r: 4 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
