import React from 'react';

interface SemiCircularGaugeProps {
  value: number;
  maxValue?: number;
  title?: string;
  subtitle?: string;
  unit?: string;
  size?: number;
  className?: string;
  showIndicator?: boolean;
}

export const SemiCircularGauge: React.FC<SemiCircularGaugeProps> = ({
  value,
  maxValue = 300,
  title,
  subtitle,
  unit,
  size = 220,
  className = '',
  showIndicator = true,
}) => {
  const safeVal = typeof value === 'number' && !isNaN(value) ? value : 0;
  const safeMax = typeof maxValue === 'number' && !isNaN(maxValue) && maxValue > 0 ? maxValue : 300;
  const normalizedValue = Math.min(safeMax, Math.max(0, safeVal));
  const percentage = (normalizedValue / safeMax) * 100;
  
  // Dimensions
  const strokeWidth = 14;
  const viewBoxWidth = 240;
  const viewBoxHeight = 150;
  const cx = viewBoxWidth / 2;
  const cy = 125;
  const radius = 88;

  // 5 Segments matching reference design
  // Colors: Pink, Golden Yellow, Dark Charcoal, Slate Teal, Bright Cyan
  const segmentColors = [
    '#F43F5E', // Warm Pink
    '#FBBF24', // Golden Yellow
    '#2E3748', // Charcoal / Dark Grey
    '#1A365D', // Dark Slate / Deep Teal
    '#06B6D4', // Bright Cyan
  ];

  const numSegments = 5;
  const gapAngle = 4; // degrees
  const totalGaps = (numSegments - 1) * gapAngle;
  const segmentSpan = (180 - totalGaps) / numSegments;

  // Helper to convert polar to cartesian coordinates
  const polarToCartesian = (centerX: number, centerY: number, r: number, angleInDegrees: number) => {
    const angleInRadians = (angleInDegrees * Math.PI) / 180.0;
    return {
      x: centerX + r * Math.cos(angleInRadians),
      y: centerY - r * Math.sin(angleInRadians),
    };
  };

  // Helper to build SVG arc path
  const describeArc = (x: number, y: number, r: number, startAngle: number, endAngle: number) => {
    const start = polarToCartesian(x, y, r, startAngle);
    const end = polarToCartesian(x, y, r, endAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

    return [
      'M', start.x, start.y,
      'A', r, r, 0, largeArcFlag, 0, end.x, end.y,
    ].join(' ');
  };

  // Calculate segments
  const segments = segmentColors.map((color, i) => {
    const startAngle = 180 - i * (segmentSpan + gapAngle);
    const endAngle = startAngle - segmentSpan;
    const path = describeArc(cx, cy, radius, startAngle, endAngle);
    return { color, startAngle, endAngle, path };
  });

  // Calculate needle/indicator position (0% = 180 deg, 100% = 0 deg)
  const currentAngle = 180 - (percentage / 100) * 180;
  const indicatorPos = polarToCartesian(cx, cy, radius, currentAngle);

  return (
    <div className={`flex flex-col items-center justify-center select-none ${className}`}>
      {title && (
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-400 mb-1">
          {title}
        </p>
      )}

      <div className="relative flex flex-col items-center" style={{ width: size, height: size * 0.65 }}>
        <svg
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          className="w-full h-full overflow-visible"
        >
          <defs>
            <filter id="gaugeGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.35" />
            </filter>
            <filter id="indicatorGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#FFFFFF" floodOpacity="0.8" />
            </filter>
          </defs>

          {/* Render 5 arc segments */}
          {segments.map((seg, idx) => (
            <path
              key={idx}
              d={seg.path}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              className="transition-all duration-500 hover:opacity-90"
            />
          ))}

          {/* Active indicator dot / needle */}
          {showIndicator && (
            <g className="transition-all duration-700 ease-out">
              {/* Outer glow ring */}
              <circle
                cx={indicatorPos.x}
                cy={indicatorPos.y}
                r={strokeWidth / 2 + 3}
                fill="none"
                stroke="white"
                strokeWidth={2}
                opacity={0.8}
                filter="url(#indicatorGlow)"
              />
              {/* Center point */}
              <circle
                cx={indicatorPos.x}
                cy={indicatorPos.y}
                r={strokeWidth / 2 - 2}
                fill="white"
                className="animate-pulse"
              />
            </g>
          )}
        </svg>

        {/* Large Center Number */}
        <div className="absolute bottom-1 flex flex-col items-center justify-center">
          <div className="flex items-baseline gap-1">
            <span className="text-3xl sm:text-4xl font-black text-white tracking-tight drop-shadow-md">
              {normalizedValue}
            </span>
            {unit && (
              <span className="text-xs font-bold text-slate-400">
                {unit}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-[10px] font-semibold text-slate-400 mt-0.5 tracking-wide">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
