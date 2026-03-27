"use client";

import { useId } from "react";


export type MetricPoint = {
  date: string;
  value: number | null;
};

type MetricChartProps = {
  points: MetricPoint[];
  metricLabel: string;
  smoothingWindow?: number;
  colorStart?: string;
  colorEnd?: string;
  events?: Array<{
    id: string;
    name: string;
    startDate: string;
    effect: "positive" | "negative";
  }>;
};

type IndexedPoint = MetricPoint & {
  index: number;
};

type ChartTick = {
  index: number;
  label: string;
};

function movingAverage(points: IndexedPoint[], windowSize: number): IndexedPoint[] {
  const safeWindowSize = Math.max(windowSize, 2);
  const history: number[] = [];

  return points.map((point) => {
    if (point.value === null) {
      return point;
    }

    history.push(point.value);
    if (history.length > safeWindowSize) {
      history.shift();
    }

    const average = history.reduce((sum, value) => sum + value, 0) / history.length;

    return {
      ...point,
      value: Number(average.toFixed(3)),
    };
  });
}

function buildTicks(points: MetricPoint[]): ChartTick[] {
  if (points.length < 2) {
    return [];
  }

  const datedPoints = points
    .map((point, index) => {
      const parsed = new Date(point.date);
      if (Number.isNaN(parsed.getTime())) {
        return null;
      }
      return { index, date: parsed };
    })
    .filter((entry): entry is { index: number; date: Date } => entry !== null);

  if (datedPoints.length < 2) {
    return [];
  }

  const first = datedPoints[0].date.getTime();
  const last = datedPoints[datedPoints.length - 1].date.getTime();
  const spanDays = (last - first) / (1000 * 60 * 60 * 24);
  const useYearlyTicks = spanDays > 550;
  const useMonthlyTicks = spanDays <= 90;

  const seen = new Set<string>();
  const ticks: ChartTick[] = [];
  let lastIndex = -Infinity;
  const indexRange = datedPoints[datedPoints.length - 1].index - datedPoints[0].index || 1;

  for (const entry of datedPoints) {
    const year = entry.date.getUTCFullYear();
    const month = entry.date.getUTCMonth() + 1;
    const quarter = Math.floor((month - 1) / 3) + 1;

    let key = "";
    let label = "";

    if (useYearlyTicks) {
      key = `${year}`;
      label = `${year}`;
    } else if (useMonthlyTicks) {
      key = `${year}-${month}`;
      const monthName = entry.date.toLocaleString('en', { month: 'short' });
      label = `${monthName} ${year}`;
    } else {
      key = `${year}-Q${quarter}`;
      label = `Q${quarter} ${year}`;
    }

    if (seen.has(key)) {
      continue;
    }

    // Ensure at least 8% of the chart width distance between ticks
    if (lastIndex !== -Infinity && (entry.index - lastIndex) / indexRange < 0.08) {
      continue;
    }

    seen.add(key);
    ticks.push({
      index: entry.index,
      label,
    });
    lastIndex = entry.index;
  }

  return ticks;
}

function buildPath(points: IndexedPoint[], toX: (index: number) => number, toY: (value: number) => number) {
  let path = "";

  for (const point of points) {
    if (point.value === null) {
      continue;
    }

    const x = toX(point.index);
    const y = toY(point.value);
    path += path.length === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  }

  return path;
}

export default function MetricChart({
  points,
  metricLabel,
  smoothingWindow = 7,
  colorStart = "#0284c7",
  colorEnd = "#16a34a",
  events = [],
}: MetricChartProps) {
  const width = 1200;
  const height = 360;
  const padding = 38;
  const tickLabelY = height - padding + 18;
  const gradientId = useId().replace(/[:]/g, "");

  const indexedPoints = points.map((point, index) => ({
    ...point,
    index,
  }));
  const smoothedPoints = movingAverage(indexedPoints, smoothingWindow);
  const valuePoints = [...indexedPoints, ...smoothedPoints].filter(
    (point) => point.value !== null
  );

  if (valuePoints.length < 2) {
    return (
      <p className="text-muted fst-italic p-4 text-center border rounded">Not enough {metricLabel.toLowerCase()} data to render chart.</p>
    );
  }

  const minValue = Math.min(...valuePoints.map((point) => point.value as number));
  const maxValue = Math.max(...valuePoints.map((point) => point.value as number));
  const range = maxValue - minValue || 1;
  const xDenominator = Math.max(points.length - 1, 1);

  const toX = (index: number) => padding + (index / xDenominator) * (width - padding * 2);
  const toY = (value: number) =>
    height - padding - ((value - minValue) / range) * (height - padding * 2);

  const rawPath = buildPath(indexedPoints, toX, toY);
  const smoothPath = buildPath(smoothedPoints, toX, toY);
  const ticks = buildTicks(points);
  const eventLines = events
    .map((event) => {
      const eventTime = new Date(event.startDate).getTime();
      if (Number.isNaN(eventTime)) {
        return null;
      }

      const index = points.findIndex((point) => {
        const time = new Date(point.date).getTime();
        return !Number.isNaN(time) && time >= eventTime;
      });

      const resolvedIndex = index >= 0 ? index : points.length - 1;
      if (resolvedIndex < 0) {
        return null;
      }

      return {
        ...event,
        index: resolvedIndex,
      };
    })
    .filter((line): line is { id: string; name: string; startDate: string; effect: "positive" | "negative"; index: number } => line !== null);

  const firstLabel = points[0]?.date ?? "";
  const lastLabel = points[points.length - 1]?.date ?? "";

  return (
    <div className="position-relative w-100 mt-2 mb-4">
      <svg 
        viewBox={`0 0 ${width} ${height}`} 
        className="w-100 h-auto" 
        role="img" 
        aria-label={`${metricLabel} trend`}
        style={{ overflow: 'visible' }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor={colorStart} />
            <stop offset="100%" stopColor={colorEnd} />
          </linearGradient>
        </defs>

        {ticks.map((tick, idx) => {
          const x = toX(tick.index);
          const textAnchor = idx === 0 ? "start" : idx === ticks.length - 1 ? "end" : "middle";

          return (
            <g key={`${tick.label}-${tick.index}`}>
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
          const x = toX(event.index);
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

        <path
          d={rawPath}
          fill="none"
          stroke="#94a3b8"
          strokeOpacity="0.45"
          strokeWidth="1.4"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        <path
          d={smoothPath}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="3.4"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>

      <div className="d-flex justify-content-between text-muted small mt-2 px-1">
        <span>{firstLabel}</span>
        <span>{lastLabel}</span>
      </div>
    </div>
  );
}
