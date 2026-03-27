"use client";

import { useId } from "react";


type MetricPoint = {
  date: string;
  value: number | null;
};

type MetricChartProps = {
  points: MetricPoint[];
  smoothingWindow?: number;
  metricLabel: string;
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

      return {
        index,
        date: parsed,
      };
    })
    .filter((entry): entry is { index: number; date: Date } => entry !== null);

  if (datedPoints.length < 2) {
    return [];
  }

  const first = datedPoints[0].date.getTime();
  const last = datedPoints[datedPoints.length - 1].date.getTime();
  const spanDays = (last - first) / (1000 * 60 * 60 * 24);
  const useYearlyTicks = spanDays > 550;

  const seen = new Set<string>();
  const ticks: ChartTick[] = [];

  for (const entry of datedPoints) {
    const year = entry.date.getUTCFullYear();
    const quarter = Math.floor(entry.date.getUTCMonth() / 3) + 1;
    const key = useYearlyTicks ? `${year}` : `${year}-Q${quarter}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    ticks.push({
      index: entry.index,
      label: useYearlyTicks ? `${year}` : `Q${quarter} ${year}`,
    });
  }

  if (ticks.length <= 8) {
    return ticks;
  }

  const step = Math.ceil((ticks.length - 1) / 7);
  return ticks.filter((_, idx) => idx % step === 0 || idx === ticks.length - 1);
}

export default function MetricChart({
  points,
  smoothingWindow = 7,
  metricLabel,
}: MetricChartProps) {
  const width = 920;
  const height = 300;
  const padding = 34;
  const tickLabelY = height - padding + 16;
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
    return <p className="text-muted fst-italic p-4 text-center border rounded">Not enough stress data to render a chart yet.</p>;
  }

  const minValue = Math.min(...valuePoints.map((point) => point.value as number));
  const maxValue = Math.max(...valuePoints.map((point) => point.value as number));
  const range = maxValue - minValue || 1;
  const xDenominator = Math.max(points.length - 1, 1);

  const toX = (index: number) =>
    padding + (index / xDenominator) * (width - padding * 2);

  const toY = (value: number) =>
    height - padding - ((value - minValue) / range) * (height - padding * 2);

  const rawPath = buildPath(indexedPoints, toX, toY);
  const smoothPath = buildPath(smoothedPoints, toX, toY);
  const ticks = buildTicks(points);

  const firstLabel = points[0]?.date ?? "";
  const lastLabel = points[points.length - 1]?.date ?? "";

  return (
    <div className="chartWrap">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="chart"
        role="img"
        aria-label={`${metricLabel} trend`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#0ea5e9" />
            <stop offset="100%" stopColor="#10b981" />
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
                className="chartTickLabel"
              >
                {tick.label}
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
          strokeWidth="3.2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>

      <div className="chartLabels">
        <span>{firstLabel}</span>
        <span>{lastLabel}</span>
      </div>
    </div>
  );
}
