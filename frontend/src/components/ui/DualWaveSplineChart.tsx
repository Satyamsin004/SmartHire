import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
} from 'recharts';

export interface DualWaveDataPoint {
  label: string;
  primaryValue: number;
  secondaryValue: number;
  [key: string]: any;
}

interface DualWaveSplineChartProps {
  data: DualWaveDataPoint[];
  title?: string;
  subtitle?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  primaryColor?: string;
  secondaryColor?: string;
  height?: number;
  className?: string;
  valueFormatter?: (val: number) => string;
}

export const DualWaveSplineChart: React.FC<DualWaveSplineChartProps> = ({
  data,
  title,
  subtitle,
  primaryLabel = 'Primary Wave',
  secondaryLabel = 'Secondary Wave',
  primaryColor = '#818CF8', // Vibrant Glowing Indigo/Purple (Image 3)
  secondaryColor = '#3B82F6', // Deep Dark Navy/Blue (Image 3)
  height = 240,
  className = '',
  valueFormatter = (v) => `${v}%`,
}) => {
  if (!data || data.length === 0) {
    return (
      <div className={`relative overflow-hidden rounded-3xl bg-[#0B0F19] border border-slate-800/80 p-5 text-white shadow-2xl flex flex-col items-center justify-center text-center ${className}`} style={{ minHeight: height }}>
        <p className="text-xs font-bold text-slate-400">No performance data recorded yet</p>
        <p className="text-[11px] text-slate-500 mt-1">Complete your first interview to see your performance trend.</p>
      </div>
    );
  }

  const chartData = data.length === 1 ? [data[0], data[0]] : data;

  return (
    <div className={`relative overflow-hidden rounded-3xl bg-[#0B0F19] border border-slate-800/80 p-5 text-white shadow-2xl ${className}`}>
      {/* Subtle Ambient Radial Glow */}
      <div className="pointer-events-none absolute -top-16 -right-16 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 w-60 h-60 bg-blue-600/10 rounded-full blur-3xl" />

      {/* Header with Title & Legend */}
      {(title || primaryLabel) && (
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            {title && (
              <h3 className="text-sm sm:text-base font-black text-white tracking-tight flex items-center gap-2">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                {subtitle}
              </p>
            )}
          </div>

          {/* Minimalist Legend Pills */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: primaryColor, boxShadow: `0 0 8px ${primaryColor}` }} />
              <span>{primaryLabel}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
              <span className="w-2.5 h-2.5 rounded-full opacity-70" style={{ backgroundColor: secondaryColor }} />
              <span>{secondaryLabel}</span>
            </div>
          </div>
        </div>
      )}

      {/* Recharts Smooth Dual-Wave Spline Line Chart */}
      <div className="relative w-full" style={{ height, minHeight: height }}>
        <ResponsiveContainer width="100%" height={height} minHeight={height}>
          <LineChart data={chartData} margin={{ top: 15, right: 15, left: -25, bottom: 5 }}>
            <defs>
              {/* Primary Line Glow Filter */}
              <filter id="waveGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor={primaryColor} floodOpacity="0.6" />
              </filter>
            </defs>

            <XAxis
              dataKey="label"
              stroke="#334155"
              tick={{ fill: '#64748B', fontSize: 10, fontWeight: 600 }}
              tickLine={false}
              axisLine={{ stroke: '#1E293B' }}
            />
            <YAxis
              stroke="#334155"
              tick={{ fill: '#64748B', fontSize: 10, fontWeight: 600 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={valueFormatter}
            />

            <RechartsTooltip
              content={({ active, payload, label }: any) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-[#0F172A]/95 backdrop-blur-md text-white p-3 rounded-xl border border-slate-700/80 shadow-2xl text-xs space-y-1.5 min-w-[150px]">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 pb-1 border-b border-slate-800">
                        {label}
                      </p>
                      <div className="flex items-center justify-between font-extrabold text-indigo-300">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#818CF8]" />
                          {primaryLabel}:
                        </span>
                        <span>{valueFormatter(payload[0]?.value)}</span>
                      </div>
                      {payload[1] && (
                        <div className="flex items-center justify-between font-bold text-slate-300">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-[#3B82F6]" />
                            {secondaryLabel}:
                          </span>
                          <span>{valueFormatter(payload[1]?.value)}</span>
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />

            {/* Secondary Wave: Deep Dark Navy/Indigo Monotone Curve */}
            <Line
              type="monotone"
              dataKey="secondaryValue"
              stroke={secondaryColor}
              strokeWidth={2.5}
              strokeOpacity={0.65}
              dot={false}
              activeDot={{ r: 4, fill: secondaryColor, stroke: '#FFFFFF', strokeWidth: 1.5 }}
              isAnimationActive={true}
              animationDuration={1500}
            />

            {/* Primary Wave: Glowing Vibrant Purple/Indigo Monotone Curve (Matching Image 3) */}
            <Line
              type="monotone"
              dataKey="primaryValue"
              stroke={primaryColor}
              strokeWidth={3.5}
              filter="url(#waveGlow)"
              dot={false}
              activeDot={{ r: 5, fill: primaryColor, stroke: '#FFFFFF', strokeWidth: 2 }}
              isAnimationActive={true}
              animationDuration={1200}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
