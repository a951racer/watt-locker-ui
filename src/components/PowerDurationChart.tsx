import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { PowerCurveEntry } from '../api/workouts';

interface PowerDurationChartProps {
  data: PowerCurveEntry[];
  duration: string; // seconds as string key
  title: string;
  color: string;
}

/**
 * Simple linear regression: returns slope and intercept for y = mx + b
 */
function linearRegression(values: number[]): { slope: number; intercept: number } {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] || 0 };

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

export default function PowerDurationChart({ data, duration, title, color }: PowerDurationChartProps) {
  const chartData = useMemo(() => {
    const entries = data
      .filter((entry) => entry.maxPowers[duration] != null)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Group by week (Monday start) and take the max per week
    const weeklyMax: Map<string, { weekLabel: string; watts: number }> = new Map();
    for (const entry of entries) {
      const d = new Date(entry.date);
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      const monday = new Date(d);
      monday.setDate(monday.getDate() + diff);
      const weekKey = monday.toISOString().split('T')[0];
      const weekLabel = monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const watts = entry.maxPowers[duration];

      const existing = weeklyMax.get(weekKey);
      if (!existing || watts > existing.watts) {
        weeklyMax.set(weekKey, { weekLabel, watts });
      }
    }

    const sorted = [...weeklyMax.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, { weekLabel, watts }]) => ({ week: weekLabel, watts }));

    // Compute linear regression trend line
    if (sorted.length >= 2) {
      const values = sorted.map((d) => d.watts);
      const { slope, intercept } = linearRegression(values);
      return sorted.map((d, i) => ({
        ...d,
        trend: Math.round(intercept + slope * i),
      }));
    }

    return sorted.map((d) => ({ ...d, trend: d.watts }));
  }, [data, duration]);

  if (chartData.length === 0) {
    return (
      <div className="bg-midnightBlue/80 rounded-xl p-4 border border-steelBlue/50 flex items-center justify-center min-h-[270px]">
        <p className="text-softFog text-sm">No data for {title}</p>
      </div>
    );
  }

  return (
    <div className="bg-midnightBlue/80 rounded-xl p-4 border border-steelBlue/50">
      <h3 className="text-sm font-semibold text-softFog uppercase tracking-wide mb-3">
        {title}
      </h3>
      <ResponsiveContainer width="100%" height={270}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2E4767" />
          <XAxis
            dataKey="week"
            tick={{ fill: '#7E93AD', fontSize: 10 }}
            axisLine={{ stroke: '#2E4767' }}
            tickLine={false}
            interval={Math.max(0, Math.floor(chartData.length / 5) - 1)}
          />
          <YAxis
            tick={{ fill: '#7E93AD', fontSize: 11 }}
            axisLine={{ stroke: '#2E4767' }}
            tickLine={false}
            width={45}
            unit=" W"
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#0D2A4F', border: '1px solid #2E4767', borderRadius: '8px', color: '#D9E1EA' }}
            formatter={(value, name) => [`${value} W`, name === 'trend' ? 'Trend' : 'Max']}
          />
          <Line type="monotone" dataKey="watts" stroke={color} strokeWidth={2} dot={{ fill: color, r: 3 }} activeDot={{ r: 5 }} />
          <Line type="linear" dataKey="trend" stroke="#7E93AD" strokeWidth={1.5} strokeDasharray="5 5" dot={false} activeDot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
