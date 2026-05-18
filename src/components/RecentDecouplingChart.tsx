import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { WorkoutRecord } from '../types/workout';

interface RecentDecouplingChartProps {
  workouts: WorkoutRecord[];
}

export default function RecentDecouplingChart({ workouts }: RecentDecouplingChartProps) {
  const data = useMemo(() => {
    // Get the 10 most recent workouts that have decoupling data, sorted by date
    const withDecoupling = workouts
      .filter((w) => w.aerobicDecoupling != null)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(0, 10)
      .reverse(); // oldest first for left-to-right display

    return withDecoupling.map((w) => ({
      label: new Date(w.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      decoupling: w.aerobicDecoupling!,
      title: w.title || w.activityType,
    }));
  }, [workouts]);

  return (
    <div className="bg-midnightBlue/80 rounded-xl p-4 border border-steelBlue/50">
      <h3 className="text-sm font-semibold text-softFog uppercase tracking-wide mb-3">
        Pw:Hr Decoupling (Last 10 Workouts)
      </h3>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2E4767" />
          <XAxis
            dataKey="label"
            tick={{ fill: '#7E93AD', fontSize: 11 }}
            axisLine={{ stroke: '#2E4767' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#7E93AD', fontSize: 11 }}
            axisLine={{ stroke: '#2E4767' }}
            tickLine={false}
            width={40}
            unit="%"
          />
          <ReferenceLine y={0} stroke="#22C55E" strokeDasharray="3 3" label={{ value: '0%', fill: '#22C55E', fontSize: 10 }} />
          <ReferenceLine y={5} stroke="#EAB308" strokeDasharray="3 3" label={{ value: '5%', fill: '#EAB308', fontSize: 10 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0D2A4F',
              border: '1px solid #2E4767',
              borderRadius: '8px',
              color: '#D9E1EA',
            }}
            formatter={(value, _name, props) => [`${value}%`, (props.payload as { title: string }).title]}
          />
          <Line
            type="monotone"
            dataKey="decoupling"
            stroke="#A78BFA"
            strokeWidth={2}
            dot={{ fill: '#A78BFA', r: 4 }}
            activeDot={{ fill: '#C4B5FD', r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
