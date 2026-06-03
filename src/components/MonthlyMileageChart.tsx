import { useMemo } from 'react';
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts';
import type { WorkoutRecord } from '../types/workout';

interface MonthlyMileageChartProps {
  workouts: WorkoutRecord[];
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getMonthLabel(year: number, month: number): string {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  const monthName = start.toLocaleDateString('en-US', { month: 'short' });
  return `${monthName} 1-${end.getDate()}`;
}

export default function MonthlyMileageChart({ workouts }: MonthlyMileageChartProps) {
  const data = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDay = now.getDate();

    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    const daysInCurrentMonth = getDaysInMonth(currentYear, currentMonth);
    const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth);
    const maxDays = Math.max(daysInCurrentMonth, daysInPrevMonth);

    // Bucket daily miles for current month
    const currentMonthDaily: number[] = new Array(daysInCurrentMonth).fill(0);
    // Bucket daily miles for previous month
    const prevMonthDaily: number[] = new Array(daysInPrevMonth).fill(0);

    for (const w of workouts) {
      const d = new Date(w.startTime);
      const miles = (w.distanceMeters ?? 0) / 1609.344;

      if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
        const day = d.getDate() - 1;
        currentMonthDaily[day] += miles;
      } else if (d.getFullYear() === prevYear && d.getMonth() === prevMonth) {
        const day = d.getDate() - 1;
        prevMonthDaily[day] += miles;
      }
    }

    // Build cumulative data
    const chartData: Array<{ day: number; currentMonth?: number; prevMonth: number }> = [];
    let cumCurrent = 0;
    let cumPrev = 0;

    for (let i = 0; i < maxDays; i++) {
      if (i < prevMonthDaily.length) {
        cumPrev += prevMonthDaily[i];
      }
      if (i < currentMonthDaily.length && i < currentDay) {
        cumCurrent += currentMonthDaily[i];
      }

      chartData.push({
        day: i + 1,
        currentMonth: i < currentDay ? Math.round(cumCurrent * 10) / 10 : undefined,
        prevMonth: Math.round(cumPrev * 10) / 10,
      });
    }

    const prevMonthTotal = cumPrev;

    return { chartData, prevMonthTotal, currentMonthLabel: getMonthLabel(currentYear, currentMonth), prevMonthLabel: getMonthLabel(prevYear, prevMonth) };
  }, [workouts]);

  return (
    <div className="bg-midnightBlue/80 rounded-xl p-4 border border-steelBlue/50">
      <h3 className="text-sm font-semibold text-softFog uppercase tracking-wide mb-3">
        Monthly Mileage Comparison
      </h3>
      <ResponsiveContainer width="100%" height={440}>
        <ComposedChart data={data.chartData} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2E4767" />
          <XAxis
            dataKey="day"
            tick={{ fill: '#7E93AD', fontSize: 11 }}
            axisLine={{ stroke: '#2E4767' }}
            tickLine={false}
            interval={4}
          />
          <YAxis
            tick={{ fill: '#7E93AD', fontSize: 11 }}
            axisLine={{ stroke: '#2E4767' }}
            tickLine={false}
            width={45}
            label={{ value: 'Miles', angle: -90, position: 'insideLeft', fill: '#7E93AD', fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0D2A4F',
              border: '1px solid #2E4767',
              borderRadius: '8px',
              color: '#D9E1EA',
            }}
            formatter={(value, name) => [
              `${Math.round(value as number)} mi`,
              name === 'prevMonth' ? data.prevMonthLabel : data.currentMonthLabel,
            ]}
            labelFormatter={(label) => `Day ${label}`}
          />
          <Legend
            wrapperStyle={{ fontSize: '11px', color: '#7E93AD' }}
            formatter={(value) => value === 'prevMonth' ? data.prevMonthLabel : data.currentMonthLabel}
          />
          <ReferenceLine
            y={data.prevMonthTotal}
            stroke="#6B7280"
            strokeDasharray="5 5"
            label={{ value: `${Math.round(data.prevMonthTotal)} mi · ${data.prevMonthLabel}`, fill: '#7E93AD', fontSize: 10, position: 'insideTopLeft' }}
          />
          <Area
            type="monotone"
            dataKey="prevMonth"
            fill="#4B5563"
            fillOpacity={0.3}
            stroke="#6B7280"
            strokeWidth={1}
            name="prevMonth"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="currentMonth"
            stroke="#1E7EF2"
            strokeWidth={2.5}
            name="currentMonth"
            dot={false}
            connectNulls={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
