import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import PowerDurationChart from '../components/PowerDurationChart';
import { getPowerCurve, computePowerCurves, type PowerCurveEntry } from '../api/workouts';

const DURATIONS = [
  { key: '1', label: 'Max 1 Second Power', color: '#F87171' },
  { key: '5', label: 'Max 5 Second Power', color: '#EF4444' },
  { key: '10', label: 'Max 10 Second Power', color: '#DC2626' },
  { key: '20', label: 'Max 20 Second Power', color: '#F59E0B' },
  { key: '30', label: 'Max 30 Second Power', color: '#D97706' },
  { key: '60', label: 'Max 1 Minute Power', color: '#FBBF24' },
  { key: '120', label: 'Max 2 Minute Power', color: '#10B981' },
  { key: '300', label: 'Max 5 Minute Power', color: '#059669' },
  { key: '600', label: 'Max 10 Minute Power', color: '#06B6D4' },
  { key: '1200', label: 'Max 20 Minute Power', color: '#1E7EF2' },
  { key: '1800', label: 'Max 30 Minute Power', color: '#3B82F6' },
  { key: '3600', label: 'Max 60 Minute Power', color: '#8B5CF6' },
  { key: '7200', label: 'Max 2 Hour Power', color: '#A78BFA' },
];

export default function PowerPage() {
  const [data, setData] = useState<PowerCurveEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isComputing, setIsComputing] = useState(false);
  const [computeResult, setComputeResult] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const result = await getPowerCurve(6);
      setData(result);
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCompute = async () => {
    setIsComputing(true);
    setComputeResult(null);
    try {
      const result = await computePowerCurves();
      setComputeResult(`${result.computed} computed, ${result.skipped} skipped, ${result.failed} failed`);
      if (result.computed > 0) fetchData();
    } catch {
      setComputeResult('Computation failed');
    } finally {
      setIsComputing(false);
    }
  };

  // Build power curve data (best at each duration)
  const powerCurveData = DURATIONS.map(({ key, label }) => {
    const values = data
      .filter((e) => e.maxPowers[key] != null)
      .map((e) => e.maxPowers[key]);
    const best = values.length > 0 ? Math.max(...values) : 0;
    return { duration: label.replace('Max ', '').replace(' Power', ''), watts: best };
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-lightSilver text-lg">Loading power data...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-pureWhite">Power</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCompute}
            disabled={isComputing}
            className="text-sm px-4 py-2 rounded bg-steelBlue text-lightSilver hover:bg-softFog disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isComputing ? 'Computing...' : 'Compute Missing'}
          </button>
          {computeResult && <span className="text-sm text-lightSilver">{computeResult}</span>}
        </div>
      </div>

      {/* Power Curve - Best at each duration */}
      <div className="bg-midnightBlue/80 rounded-xl p-4 border border-steelBlue/50">
        <h3 className="text-sm font-semibold text-softFog uppercase tracking-wide mb-3">
          Power Curve (6-Month Best)
        </h3>
        <ResponsiveContainer width="100%" height={440}>
          <LineChart data={powerCurveData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2E4767" />
            <XAxis dataKey="duration" tick={{ fill: '#7E93AD', fontSize: 11 }} axisLine={{ stroke: '#2E4767' }} tickLine={false} />
            <YAxis tick={{ fill: '#7E93AD', fontSize: 11 }} axisLine={{ stroke: '#2E4767' }} tickLine={false} width={50} unit=" W" />
            <Tooltip
              contentStyle={{ backgroundColor: '#0D2A4F', border: '1px solid #2E4767', borderRadius: '8px', color: '#D9E1EA' }}
              formatter={(value) => [`${value} W`, 'Best']}
            />
            <Line type="monotone" dataKey="watts" stroke="#1E7EF2" strokeWidth={3} dot={{ fill: '#3FA9FF', r: 6 }} activeDot={{ r: 8 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Individual duration charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {DURATIONS.map(({ key, label, color }) => (
          <PowerDurationChart key={key} data={data} duration={key} title={label} color={color} />
        ))}
      </div>
    </div>
  );
}
