import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts';
import { getPerformanceMetrics, type PerformanceMetric } from '../api/workouts';

export default function PerformanceChart() {
  const [data, setData] = useState<PerformanceMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      try {
        const metrics = await getPerformanceMetrics(90);
        setData(metrics);
      } catch {
        // Silently fail — chart just won't render data
      } finally {
        setIsLoading(false);
      }
    }
    fetch();
  }, []);

  if (isLoading) {
    return (
      <div className="bg-midnightBlue/80 rounded-xl p-4 border border-steelBlue/50 flex items-center justify-center min-h-[250px]">
        <p className="text-softFog text-sm">Loading performance data...</p>
      </div>
    );
  }

  return (
    <div className="bg-midnightBlue/80 rounded-xl p-4 border border-steelBlue/50">
      <h3 className="text-sm font-semibold text-softFog uppercase tracking-wide mb-3">
        Fitness / Fatigue / Form (90 Days)
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2E4767" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#7E93AD', fontSize: 10 }}
            axisLine={{ stroke: '#2E4767' }}
            tickLine={false}
            interval={Math.floor(data.length / 6)}
            tickFormatter={(val) => {
              const d = new Date(val);
              return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }}
          />
          <YAxis
            tick={{ fill: '#7E93AD', fontSize: 11 }}
            axisLine={{ stroke: '#2E4767' }}
            tickLine={false}
            width={40}
          />
          <ReferenceLine y={0} stroke="#4B5563" strokeDasharray="3 3" />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0D2A4F',
              border: '1px solid #2E4767',
              borderRadius: '8px',
              color: '#D9E1EA',
            }}
            labelFormatter={(label) => {
              const d = new Date(label);
              return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: '11px', color: '#7E93AD' }}
          />
          <Line
            type="monotone"
            dataKey="ctl"
            name="Fitness (CTL)"
            stroke="#1E7EF2"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="atl"
            name="Fatigue (ATL)"
            stroke="#EF4444"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="tsb"
            name="Form (TSB)"
            stroke="#10B981"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
