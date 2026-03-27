"use client";

import { useId } from "react";
import type { MetricPoint } from "./metric-chart";


type CombinedSeries = {
  label: string;
  points: MetricPoint[];
  color: string;
};

type CombinedChartProps = {
  series: CombinedSeries[];
  chartLabel: string;
  smoothingWindow?: number;
  events?: Array<{
    id: string;
    name: string;
    startDate: string;
    effect: "positive" | "negative";
  }>;
};

type NormalizedPoint = {
  timestamp: number;
  value: number;
};

type ChartTick = {
  timestamp: number;
  label: string;
};

function movingAverage(points: NormalizedPoint[], windowSize: number): NormalizedPoint[] {
  const safeWindowSize = Math.max(windowSize, 2);
  const history: number[] = [];

  return points.map((point) => {
    history.push(point.value);
    if (history.length > safeWindowSize) {
      history.shift();
    }

    const average = history.reduce((sum, value) => sum + value, 0) / history.length;

    return {
      timestamp: point.timestamp,
      value: Number(average.toFixed(3)),
    };
  });
}

function normalizeSeries(points: MetricPoint[]): NormalizedPoint[] {
  const parsed = points
    .map((point) => {
      if (point.value === null) {
        return null;
      }

      const date = new Date(point.date);
      if (Number.isNaN(date.getTime())) {
        return null;
      }

      return {
        timestamp: date.getTime(),
        value: point.value,
      };
    })
    .filter((entry): entry is { timestamp: number; value: number } => entry !== null)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (parsed.length < 2) {
    return [];
  }

  const min = Math.min(...parsed.map((point) => point.value));
  const max = Math.max(...parsed.map((point) => point.value));
  const range = max - min || 1;

  return parsed.map((point) => ({
    timestamp: point.timestamp,
    value: ((point.value - min) / range) * 100,
  }));
}

function buildPath(points: NormalizedPoint[], toX: (timestamp: number) => number, toY: (value: number) => number) {
  let path = "";

  for (const point of points) {
    const x = toX(point.timestamp);
    const y = toY(point.value);
    path += path.length === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  }

  return path;
}

function buildTicks(timestamps: number[]): ChartTick[] {
  if (timestamps.length < 2) {
    return [];
  }

  const sorted = [...timestamps].sort((a, b) => a - b);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const tsRange = last - first || 1;
  const spanDays = tsRange / (1000 * 60 * 60 * 24);
  const useYearlyTicks = spanDays > 550;
  const useMonthlyTicks = spanDays <= 90;

  const seen = new Set<string>();
  const ticks: ChartTick[] = [];
  let lastTimestamp = -Infinity;

  for (const timestamp of sorted) {
    const date = new Date(timestamp);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const quarter = Math.floor((month - 1) / 3) + 1;
    
    let key = "";
    let label = "";
    
    if (useYearlyTicks) {
      key = `${year}`;
      label = `${year}`;
    } else if (useMonthlyTicks) {
      key = `${year}-${month}`;
      const monthName = date.toLocaleString('en', { month: 'short' });
      label = `${monthName} ${year}`;
    } else {
      key = `${year}-Q${quarter}`;
      label = `Q${quarter} ${year}`;
    }

    if (seen.has(key)) {
      continue;
    }

    // Ensure at least 8% of the chart width distance between ticks
    if (lastTimestamp !== -Infinity && (timestamp - lastTimestamp) / tsRange < 0.08) {
      continue;
    }

    seen.add(key);
    ticks.push({
      timestamp,
      label,
    });
    lastTimestamp = timestamp;
  }

  return ticks;
}

export default function CombinedChart({
  series,
  chartLabel,
  smoothingWindow = 7,
  events = [],
}: CombinedChartProps) {
  const width = 1200;
  const height = 360;
  const padding = 38;
  const tickLabelY = height - padding + 18;
  const idPrefix = useId().replace(/[:]/g, "");

  const normalized = series
    .map((item) => ({
      ...item,
      points: movingAverage(normalizeSeries(item.points), smoothingWindow),
    }))
    .filter((item) => item.points.length >= 2);

  const allTimestamps = normalized.flatMap((item) => item.points.map((point) => point.timestamp));
  if (allTimestamps.length < 2) {
    return <p className="text-muted fst-italic p-4 text-center border rounded">Not enough data to render combined chart.</p>;
  }

  const minTimestamp = Math.min(...allTimestamps);
  const maxTimestamp = Math.max(...allTimestamps);
  const tsRange = maxTimestamp - minTimestamp || 1;

  const toX = (timestamp: number) =>
    padding + ((timestamp - minTimestamp) / tsRange) * (width - padding * 2);

  const toY = (value: number) => height - padding - (value / 100) * (height - padding * 2);
  const ticks = buildTicks(allTimestamps);
  const eventLines = events
    .map((event) => {
      const timestamp = new Date(event.startDate).getTime();
      if (Number.isNaN(timestamp)) {
        return null;
      }

      return {
        ...event,
        timestamp,
      };
    })
    .filter((event): event is { id: string; name: string; startDate: string; effect: "positive" | "negative"; timestamp: number } => event !== null)
    .filter((event) => event.timestamp >= minTimestamp && event.timestamp <= maxTimestamp);

  return (
    <div className="position-relative w-100 mt-2 mb-4">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-100 h-auto"
        role="img"
        aria-label={chartLabel}
        style={{ overflow: 'visible' }}
      >
        {ticks.map((tick, idx) => {
          const x = toX(tick.timestamp);
          const textAnchor = idx === 0 ? "start" : idx === ticks.length - 1 ? "end" : "middle";

          return (
            <g key={`${tick.label}-${tick.timestamp}`}>
              <line
                x1={x}
                y1={padding}
                x2={x}
                y2={height - padding}
                stroke="#cbd5e1"
                strokeWidth="1"
                strokeDasharray="4 5"
              />
              <text 
                x={x} 
                y={tickLabelY} 
                textAnchor={textAnchor} 
                fill="#64748b" 
                fontSize="12"
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                {tick.label}
              </text>
            </g>
          );
        })}

        {eventLines.map((event) => {
          const x = toX(event.timestamp);
          const markerColor = event.effect === "positive" ? "#15803d" : "#b91c1c";

          return (
            <g key={event.id}>
              <line
                x1={x}
                y1={padding}
                x2={x}
                y2={height - padding}
                stroke={markerColor}
                strokeWidth="1.5"
                strokeDasharray="6 5"
              />
              <text 
                x={x + 4} 
                y={padding + 12} 
                fill={markerColor} 
                fontSize="11" 
                fontWeight="bold"
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                {event.name}
              </text>
            </g>
          );
        })}

        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="#94a3b8"
          strokeWidth="1"
        />

        <line
          x1={padding}
          y1={padding}
          x2={padding}
          y2={height - padding}
          stroke="#94a3b8"
          strokeWidth="1"
        />

        {normalized.map((item, idx) => {
          const lineId = `${idPrefix}-${idx}`;
          const path = buildPath(item.points, toX, toY);

          return (
            <g key={item.label}>
              <defs>
                <linearGradient id={lineId} x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor={item.color} stopOpacity="0.55" />
                  <stop offset="100%" stopColor={item.color} stopOpacity="1" />
                </linearGradient>
              </defs>
              <path
                d={path}
                fill="none"
                stroke={`url(#${lineId})`}
                strokeWidth="3.2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </g>
          );
        })}
      </svg>

      <div className="d-flex flex-wrap justify-content-center gap-4 mt-3">
        {normalized.map((item) => (
          <span key={item.label} className="d-flex align-items-center fw-bold text-secondary small">
            <span className="rounded-circle me-2 shadow-sm" style={{ backgroundColor: item.color, width: '12px', height: '12px' }} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
