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
  { key: '10800', label: 'Max 3 Hour Power', color: '#7C3AED' },
  { key: '14400', label: 'Max 4 Hour Power', color: '#6D28D9' },
  { key: '18000', label: 'Max 5 Hour Power', color: '#5B21B6' },
];

export default function PowerPage() {
  const [data, setData] = useState<PowerCurveEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isComputing, setIsComputing] = useState(false);
  const [isRecomputing, setIsRecomputing] = useState(false);
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
    let totalComputed = 0;
    let totalSkipped = 0;
    let totalFailed = 0;
    try {
      let remaining = 1;
      let skip = 0;
      while (remaining > 0) {
        const result = await computePowerCurves(false, skip);
        totalComputed += result.computed;
        totalSkipped += result.skipped;
        totalFailed += result.failed;
        remaining = result.remaining;
        skip += result.computed + result.skipped + result.failed;
        setComputeResult(`${totalComputed} computed, ${totalSkipped} skipped, ${totalFailed} failed${remaining > 0 ? ` (${remaining} remaining...)` : ''}`);
        if (remaining > 0) await new Promise((r) => setTimeout(r, 1000));
      }
      if (totalComputed > 0) fetchData();
    } catch {
      setComputeResult(`${totalComputed} computed, ${totalSkipped} skipped, ${totalFailed} failed (error, retry for more)`);
    } finally {
      setIsComputing(false);
    }
  };

  const handleRecompute = async () => {
    setIsRecomputing(true);
    setComputeResult(null);
    let totalComputed = 0;
    let totalSkipped = 0;
    let totalFailed = 0;
    try {
      let remaining = 1;
      let skip = 0;
      while (remaining > 0) {
        const result = await computePowerCurves(true, skip);
        totalComputed += result.computed;
        totalSkipped += result.skipped;
        totalFailed += result.failed;
        remaining = result.remaining;
        skip += result.computed + result.skipped + result.failed;
        setComputeResult(`${totalComputed} recomputed, ${totalSkipped} skipped, ${totalFailed} failed${remaining > 0 ? ` (${remaining} remaining...)` : ''}`);
        if (remaining > 0) await new Promise((r) => setTimeout(r, 1000));
      }
      if (totalComputed > 0) fetchData();
    } catch {
      setComputeResult(`${totalComputed} recomputed, ${totalSkipped} skipped, ${totalFailed} failed (error, retry for more)`);
    } finally {
      setIsRecomputing(false);
    }
  };

  // Build power curve data (best at each duration)
  const powerCurveData = DURATIONS.map(({ key }) => {
    const values = data
      .filter((e) => e.maxPowers[key] != null)
      .map((e) => e.maxPowers[key]);
    const best = values.length > 0 ? Math.max(...values) : 0;
    return { seconds: Number(key), watts: best };
  });

  const formatDurationTick = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${seconds / 60}m`;
    return `${seconds / 3600}h`;
  };

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
            disabled={isComputing || isRecomputing}
            className="text-sm px-4 py-2 rounded bg-steelBlue text-lightSilver hover:bg-softFog disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isComputing ? 'Computing...' : 'Compute Missing'}
          </button>
          <button
            onClick={handleRecompute}
            disabled={isComputing || isRecomputing}
            className="text-sm px-4 py-2 rounded bg-steelBlue text-lightSilver hover:bg-softFog disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isRecomputing ? 'Recomputing...' : 'Recompute All'}
          </button>
          {computeResult && <span className="text-sm text-lightSilver">{computeResult}</span>}
        </div>
      </div>

      {/* Power Curve - Best at each duration */}
      <div className="bg-midnightBlue/80 rounded-xl p-4 border border-steelBlue/50">
        <h3 className="text-sm font-semibold text-softFog uppercase tracking-wide mb-3">
          Power Curve (6-Month Best)
        </h3>
        <ResponsiveContainer width="100%" height={880}>
          <LineChart data={powerCurveData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2E4767" />
            <XAxis
              dataKey="seconds"
              type="number"
              scale="log"
              domain={[1, 18000]}
              ticks={[1, 5, 10, 20, 30, 60, 120, 300, 600, 1200, 1800, 3600, 7200, 10800, 14400, 18000]}
              tickFormatter={formatDurationTick}
              tick={{ fill: '#7E93AD', fontSize: 11 }}
              axisLine={{ stroke: '#2E4767' }}
              tickLine={false}
            />
            <YAxis tick={{ fill: '#7E93AD', fontSize: 11 }} axisLine={{ stroke: '#2E4767' }} tickLine={false} width={50} unit=" W" />
            <Tooltip
              contentStyle={{ backgroundColor: '#0D2A4F', border: '1px solid #2E4767', borderRadius: '8px', color: '#D9E1EA' }}
              labelFormatter={(seconds) => formatDurationTick(seconds as number)}
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
