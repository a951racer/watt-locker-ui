import { useMemo } from 'react';
import type { WorkoutRecord } from '../types/workout';

interface SummaryStatsProps {
  workouts: WorkoutRecord[];
}

function formatMiles(meters: number): string {
  return Math.round(meters / 1609.344).toLocaleString();
}

function formatFeet(meters: number): string {
  return Math.round(meters * 3.28084).toLocaleString();
}

export default function SummaryStats({ workouts }: SummaryStatsProps) {
  const stats = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const lastYear = currentYear - 1;

    console.log('[SummaryStats] Total workouts:', workouts.length);
    console.log('[SummaryStats] Sample startTime:', workouts[0]?.startTime);
    console.log('[SummaryStats] Current year:', currentYear, 'Last year:', lastYear);

    const monthStart = new Date(currentYear, now.getMonth(), 1);
    const prevMonthStart = new Date(currentYear, now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(currentYear, now.getMonth(), 0, 23, 59, 59, 999);

    // Week starts on Monday
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(currentYear, now.getMonth(), now.getDate() + mondayOffset);
    weekStart.setHours(0, 0, 0, 0);

    const wtdWorkouts = workouts.filter((w) => {
      const d = new Date(w.startTime);
      return d >= weekStart && d <= now;
    });
    const mtdWorkouts = workouts.filter((w) => {
      const d = new Date(w.startTime);
      return d >= monthStart && d <= now;
    });
    const prevMonthWorkouts = workouts.filter((w) => {
      const d = new Date(w.startTime);
      return d >= prevMonthStart && d <= prevMonthEnd;
    });
    const ytdWorkouts = workouts.filter((w) => {
      const d = new Date(w.startTime);
      return d.getFullYear() === currentYear;
    });
    const lastYearWorkouts = workouts.filter((w) => {
      const d = new Date(w.startTime);
      return d.getFullYear() === lastYear;
    });

    console.log('[SummaryStats] MTD count:', mtdWorkouts.length, 'YTD count:', ytdWorkouts.length, 'Last year count:', lastYearWorkouts.length);

    const sum = (arr: WorkoutRecord[], field: 'distanceMeters' | 'elevationGainMeters') =>
      arr.reduce((total, w) => {
        const val = Number(w[field]) || 0;
        return total + val;
      }, 0);

    const sumDurationRaw = (arr: WorkoutRecord[]) =>
      arr.reduce((total, w) => {
        const val = Number(w.movingTimeSeconds ?? w.durationSeconds) || 0;
        return total + val;
      }, 0);

    return {
      wtd: {
        miles: formatMiles(sum(wtdWorkouts, 'distanceMeters')),
        ascent: formatFeet(sum(wtdWorkouts, 'elevationGainMeters')),
        durationSeconds: sumDurationRaw(wtdWorkouts),
        count: wtdWorkouts.length,
      },
      mtd: {
        miles: formatMiles(sum(mtdWorkouts, 'distanceMeters')),
        ascent: formatFeet(sum(mtdWorkouts, 'elevationGainMeters')),
        durationSeconds: sumDurationRaw(mtdWorkouts),
        count: mtdWorkouts.length,
      },
      prevMonth: {
        miles: formatMiles(sum(prevMonthWorkouts, 'distanceMeters')),
        ascent: formatFeet(sum(prevMonthWorkouts, 'elevationGainMeters')),
        durationSeconds: sumDurationRaw(prevMonthWorkouts),
        count: prevMonthWorkouts.length,
      },
      ytd: {
        miles: formatMiles(sum(ytdWorkouts, 'distanceMeters')),
        ascent: formatFeet(sum(ytdWorkouts, 'elevationGainMeters')),
        durationSeconds: sumDurationRaw(ytdWorkouts),
        count: ytdWorkouts.length,
      },
      lastYear: {
        miles: formatMiles(sum(lastYearWorkouts, 'distanceMeters')),
        ascent: formatFeet(sum(lastYearWorkouts, 'elevationGainMeters')),
        durationSeconds: sumDurationRaw(lastYearWorkouts),
        count: lastYearWorkouts.length,
      },
      allTime: {
        miles: formatMiles(sum(workouts, 'distanceMeters')),
        ascent: formatFeet(sum(workouts, 'elevationGainMeters')),
        durationSeconds: sumDurationRaw(workouts),
        count: workouts.length,
      },
      currentYear,
      lastYearNum: lastYear,
      currentMonth: now.toLocaleString('default', { month: 'long' }),
      prevMonthName: prevMonthStart.toLocaleString('default', { month: 'long' }),
    };
  }, [workouts]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
      {/* WTD */}
      <div className="bg-midnightBlue/80 rounded-xl p-4 border border-steelBlue/50">
        <h3 className="text-sm font-bold text-lightSilver uppercase tracking-wide mb-3">
          This Week
        </h3>
        <div className="space-y-2">
          <StatRow label="Workouts" value={stats.wtd.count.toLocaleString()} />
          <StatRow label="Miles" value={stats.wtd.miles} unit="mi" />
          <DurationRow label="Duration" seconds={stats.wtd.durationSeconds} />
          <StatRow label="Ascent" value={stats.wtd.ascent} unit="ft" />
        </div>
      </div>

      {/* MTD */}
      <div className="bg-midnightBlue/80 rounded-xl p-4 border border-steelBlue/50">
        <h3 className="text-sm font-bold text-lightSilver uppercase tracking-wide mb-3">
          {stats.currentMonth}
        </h3>
        <div className="space-y-2">
          <StatRow label="Workouts" value={stats.mtd.count.toLocaleString()} />
          <StatRow label="Miles" value={stats.mtd.miles} unit="mi" />
          <DurationRow label="Duration" seconds={stats.mtd.durationSeconds} />
          <StatRow label="Ascent" value={stats.mtd.ascent} unit="ft" />
        </div>
      </div>

      {/* Previous Month */}
      <div className="bg-midnightBlue/80 rounded-xl p-4 border border-steelBlue/50">
        <h3 className="text-sm font-bold text-lightSilver uppercase tracking-wide mb-3">
          Previous Month
        </h3>
        <div className="space-y-2">
          <StatRow label="Workouts" value={stats.prevMonth.count.toLocaleString()} />
          <StatRow label="Miles" value={stats.prevMonth.miles} unit="mi" />
          <DurationRow label="Duration" seconds={stats.prevMonth.durationSeconds} />
          <StatRow label="Ascent" value={stats.prevMonth.ascent} unit="ft" />
        </div>
      </div>

      {/* YTD */}
      <div className="bg-midnightBlue/80 rounded-xl p-4 border border-steelBlue/50">
        <h3 className="text-sm font-bold text-lightSilver uppercase tracking-wide mb-3">
          {stats.currentYear} YTD
        </h3>
        <div className="space-y-2">
          <StatRow label="Workouts" value={stats.ytd.count.toLocaleString()} />
          <StatRow label="Miles" value={stats.ytd.miles} unit="mi" />
          <DurationRow label="Duration" seconds={stats.ytd.durationSeconds} />
          <StatRow label="Ascent" value={stats.ytd.ascent} unit="ft" />
        </div>
      </div>

      {/* Last Year */}
      <div className="bg-midnightBlue/80 rounded-xl p-4 border border-steelBlue/50">
        <h3 className="text-sm font-bold text-lightSilver uppercase tracking-wide mb-3">
          {stats.lastYearNum}
        </h3>
        <div className="space-y-2">
          <StatRow label="Workouts" value={stats.lastYear.count.toLocaleString()} />
          <StatRow label="Miles" value={stats.lastYear.miles} unit="mi" />
          <DurationRow label="Duration" seconds={stats.lastYear.durationSeconds} />
          <StatRow label="Ascent" value={stats.lastYear.ascent} unit="ft" />
        </div>
      </div>

      {/* All Time */}
      <div className="bg-midnightBlue/80 rounded-xl p-4 border border-steelBlue/50">
        <h3 className="text-sm font-bold text-lightSilver uppercase tracking-wide mb-3">
          All Time
        </h3>
        <div className="space-y-2">
          <StatRow label="Workouts" value={stats.allTime.count.toLocaleString()} />
          <StatRow label="Miles" value={stats.allTime.miles} unit="mi" />
          <DurationRow label="Duration" seconds={stats.allTime.durationSeconds} />
          <StatRow label="Ascent" value={stats.allTime.ascent} unit="ft" />
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-sm text-softFog">{label}</span>
      <span className="text-sm font-medium text-pureWhite">
        {value}{unit && <span className="text-softFog font-normal ml-1">{unit}</span>}
      </span>
    </div>
  );
}

function DurationRow({ label, seconds }: { label: string; seconds: number }) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-sm text-softFog">{label}</span>
      <span className="text-sm font-medium text-pureWhite">
        {hrs.toLocaleString()}<span className="text-softFog font-normal">h</span>
        {mins > 0 && <> {mins}<span className="text-softFog font-normal">m</span></>}
      </span>
    </div>
  );
}
