import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import MetricChart, { type MetricPoint } from "./metric-chart";
import CombinedChart from "./combined-chart";
import styles from "./private-page.module.css";

type PrivateSlug = "dashboard" | "stress" | "body-battery" | "respiration";
type MetricKey = "stress" | "respiration" | "bodyBattery";

type TrendSummary = {
  label: string;
  deltaText: string;
  tone: "up" | "down" | "flat";
};

type MetricDescriptor = {
  key: MetricKey;
  slug: Exclude<PrivateSlug, "dashboard">;
  label: string;
  unit: string;
  oneYearSmoothing: number;
  allTimeSmoothing: number;
  stableThreshold: number;
  upLabel: string;
  downLabel: string;
  colorStart: string;
  colorEnd: string;
  combinedColor: string;
};

type MetricSeries = {
  stress: MetricPoint[];
  respiration: MetricPoint[];
  bodyBattery: MetricPoint[];
};

type ImportantEventMarker = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  tags: string[];
  effect: "positive" | "negative";
};

type EventImpactInsight = {
  eventId: string;
  eventName: string;
  direction: "higher" | "lower";
  percent: number;
};

const METRICS: MetricDescriptor[] = [
  {
    key: "stress",
    slug: "stress",
    label: "Stress",
    unit: "pts",
    oneYearSmoothing: 7,
    allTimeSmoothing: 21,
    stableThreshold: 0.3,
    upLabel: "stress creeping up",
    downLabel: "stress easing down",
    colorStart: "#0ea5e9",
    colorEnd: "#16a34a",
    combinedColor: "#dc2626",
  },
  {
    key: "bodyBattery",
    slug: "body-battery",
    label: "Body Battery",
    unit: "pts",
    oneYearSmoothing: 7,
    allTimeSmoothing: 21,
    stableThreshold: 0.4,
    upLabel: "body battery climbing",
    downLabel: "body battery dropping",
    colorStart: "#14b8a6",
    colorEnd: "#0f766e",
    combinedColor: "#0891b2",
  },
  {
    key: "respiration",
    slug: "respiration",
    label: "Respiration",
    unit: "rpm",
    oneYearSmoothing: 7,
    allTimeSmoothing: 21,
    stableThreshold: 0.2,
    upLabel: "respiration trending up",
    downLabel: "respiration trending down",
    colorStart: "#22c55e",
    colorEnd: "#15803d",
    combinedColor: "#2563eb",
  },
];

function isValidSlug(slug: string): slug is PrivateSlug {
  return slug === "dashboard" || slug === "stress" || slug === "body-battery" || slug === "respiration";
}

async function resolveTargetUserProfilePK(email: string | null | undefined): Promise<number | null> {
  let targetUserProfilePK: number | null = null;

  if (email) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { userProfilePK: true },
    });

    targetUserProfilePK = user?.userProfilePK ?? null;
  }

  if (targetUserProfilePK === null) {
    const [stressFallback, respirationFallback, bodyBatteryFallback] = await Promise.all([
      prisma.stress.findFirst({
        select: { userProfilePK: true },
        orderBy: { pk_date: "desc" },
      }),
      prisma.respiration.findFirst({
        select: { userProfilePK: true },
        orderBy: { pk_date: "desc" },
      }),
      prisma.bodyBattery.findFirst({
        select: { userProfilePK: true },
        orderBy: { pk_date: "desc" },
      }),
    ]);

    targetUserProfilePK =
      stressFallback?.userProfilePK ??
      respirationFallback?.userProfilePK ??
      bodyBatteryFallback?.userProfilePK ??
      null;
  }

  return targetUserProfilePK;
}

async function getMetricSeries(email: string | null | undefined): Promise<MetricSeries> {
  const targetUserProfilePK = await resolveTargetUserProfilePK(email);

  if (targetUserProfilePK === null) {
    return {
      stress: [],
      respiration: [],
      bodyBattery: [],
    };
  }

  const [stressRows, respirationRows, bodyBatteryRows] = await Promise.all([
    prisma.stress.findMany({
      where: { userProfilePK: targetUserProfilePK },
      orderBy: { pk_date: "asc" },
      select: {
        pk_date: true,
        awake_averageStressLevel: true,
      },
    }),
    prisma.respiration.findMany({
      where: { userProfilePK: targetUserProfilePK },
      orderBy: { pk_date: "asc" },
      select: {
        pk_date: true,
        avgWakingRespirationValue: true,
      },
    }),
    prisma.bodyBattery.findMany({
      where: { userProfilePK: targetUserProfilePK },
      orderBy: { pk_date: "asc" },
      select: {
        pk_date: true,
        highest_statsValue: true,
        sleepend_statsValue: true,
        sleepstart_statsValue: true,
        chargedValue: true,
      },
    }),
  ]);

  return {
    stress: stressRows.map((row) => ({
      date: row.pk_date.toISOString().slice(0, 10),
      value: row.awake_averageStressLevel,
    })),
    respiration: respirationRows.map((row) => ({
      date: row.pk_date.toISOString().slice(0, 10),
      value: row.avgWakingRespirationValue,
    })),
    bodyBattery: bodyBatteryRows.map((row) => ({
      date: row.pk_date.toISOString().slice(0, 10),
      value:
        row.highest_statsValue ??
        row.sleepend_statsValue ??
        row.sleepstart_statsValue ??
        row.chargedValue,
    })),
  };
}

async function getImportantEvents(userProfilePK: number | null): Promise<ImportantEventMarker[]> {
  if (userProfilePK === null) {
    return [];
  }

  try {
    const rows = await (prisma as any).importantEvent.findMany({
      where: { userProfilePK },
      orderBy: { startDate: "asc" },
      select: {
        id: true,
        name: true,
        tags: true,
        expectedEffect: true,
        startDate: true,
        endDate: true,
      },
    });

    return rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      tags: row.tags,
      startDate: row.startDate.toISOString().slice(0, 10),
      endDate: row.endDate.toISOString().slice(0, 10),
      effect: row.expectedEffect === "POSITIVE" ? "positive" : "negative",
    }));
  } catch {
    return [];
  }
}

function averageInRange(points: MetricPoint[], start: Date, end: Date) {
  const values = points
    .filter((point) => {
      const date = new Date(point.date);
      return !Number.isNaN(date.getTime()) && date >= start && date <= end;
    })
    .map((point) => point.value)
    .filter((value): value is number => value !== null);

  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function calculateEventImpactInsights(
  points: MetricPoint[],
  events: ImportantEventMarker[],
): EventImpactInsight[] {
  const insights: EventImpactInsight[] = [];

  for (const event of events) {
    const startDate = new Date(`${event.startDate}T00:00:00.000Z`);
    const endDate = new Date(`${event.endDate}T00:00:00.000Z`);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      continue;
    }

    const beforeEnd = new Date(startDate);
    beforeEnd.setUTCDate(beforeEnd.getUTCDate() - 1);
    const beforeStart = new Date(beforeEnd);
    beforeStart.setUTCDate(beforeStart.getUTCDate() - 6);

    const afterStart = new Date(endDate);
    afterStart.setUTCDate(afterStart.getUTCDate() + 1);
    const afterEnd = new Date(afterStart);
    afterEnd.setUTCDate(afterEnd.getUTCDate() + 6);

    const beforeAvg = averageInRange(points, beforeStart, beforeEnd);
    const afterAvg = averageInRange(points, afterStart, afterEnd);

    if (beforeAvg === null || afterAvg === null || beforeAvg === 0) {
      continue;
    }

    const delta = ((afterAvg - beforeAvg) / Math.abs(beforeAvg)) * 100;
    insights.push({
      eventId: event.id,
      eventName: event.name,
      direction: delta >= 0 ? "higher" : "lower",
      percent: Math.abs(delta),
    });
  }

  return insights.sort((a, b) => b.percent - a.percent).slice(0, 5);
}

function getOneYearSubset(points: MetricPoint[]): MetricPoint[] {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  return points.filter((point) => new Date(point.date) >= oneYearAgo);
}

function averageMetric(points: MetricPoint[]): string {
  const values = points
    .map((point) => point.value)
    .filter((value): value is number => value !== null);

  if (values.length === 0) {
    return "n/a";
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return (total / values.length).toFixed(1);
}

function calculateTrend(points: MetricPoint[], metric: MetricDescriptor): TrendSummary {
  const values = points
    .map((point) => point.value)
    .filter((value): value is number => value !== null);

  if (values.length < 20) {
    return {
      label: "Trend: not enough data",
      deltaText: "n/a",
      tone: "flat",
    };
  }

  const windowSize = Math.min(14, Math.floor(values.length / 2));
  const previous = values.slice(-(windowSize * 2), -windowSize);
  const recent = values.slice(-windowSize);

  if (previous.length === 0 || recent.length === 0) {
    return {
      label: "Trend: not enough data",
      deltaText: "n/a",
      tone: "flat",
    };
  }

  const previousAvg = previous.reduce((sum, value) => sum + value, 0) / previous.length;
  const recentAvg = recent.reduce((sum, value) => sum + value, 0) / recent.length;
  const delta = recentAvg - previousAvg;
  const deltaText = `${delta >= 0 ? "+" : ""}${delta.toFixed(1)} ${metric.unit}`;

  if (Math.abs(delta) < metric.stableThreshold) {
    return {
      label: "Trend: stable lately",
      deltaText,
      tone: "flat",
    };
  }

  if (delta > 0) {
    return {
      label: `Trend: ${metric.upLabel}`,
      deltaText,
      tone: "up",
    };
  }

  return {
    label: `Trend: ${metric.downLabel}`,
    deltaText,
    tone: "down",
  };
}

type MetricPanelProps = {
  title: string;
  average: string;
  trend: TrendSummary;
  hint: string;
  children: React.ReactNode;
};

function MetricPanel({ title, average, trend, hint, children }: MetricPanelProps) {
  const trendToneClass = {
    up: styles.trendUp,
    down: styles.trendDown,
    flat: styles.trendFlat,
  };

  return (
    <article className={styles.panel}>
      <div className={styles.panelTopRow}>
        <h2 className={styles.panelTitle}>{title}</h2>
        <p className={styles.metric}>Average: {average}</p>
      </div>
      <div className={styles.trendRow}>
        <p className={`${styles.trendBadge} ${trendToneClass[trend.tone]}`}>{trend.label}</p>
        <p className={styles.trendDelta}>{trend.deltaText}</p>
      </div>
      <p className={styles.panelHint}>{hint}</p>
      {children}
    </article>
  );
}

type PrivateSlugPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function PrivateSlugPage({ params }: PrivateSlugPageProps) {
  const { slug } = await params;

  if (!isValidSlug(slug)) {
    notFound();
  }

  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  const userProfilePK = await resolveTargetUserProfilePK(session.user?.email);
  const [series, importantEvents] = await Promise.all([
    getMetricSeries(session.user?.email),
    getImportantEvents(userProfilePK),
  ]);

  if (slug === "dashboard") {
    const oneYearSeries = METRICS.map((metric) => ({
      label: metric.label,
      color: metric.combinedColor,
      points: getOneYearSubset(series[metric.key]),
    }));

    const allTimeSeries = METRICS.map((metric) => ({
      label: metric.label,
      color: metric.combinedColor,
      points: series[metric.key],
    }));

    return (
      <main className={styles.page}>
        <section className={styles.container}>
          <header className={styles.header}>
            <p className={styles.kicker}>Private</p>
            <h1 className={styles.title}>Dashboard</h1>
            <p className={styles.subtitle}>
              Combined view of stress, body battery, and respiration. Values are normalized so their
              lines can be connected and compared on the same timeline.
            </p>
          </header>

          <section className={styles.summaryGrid}>
            {METRICS.map((metric) => {
              const oneYearPoints = getOneYearSubset(series[metric.key]);
              const oneYearTrend = calculateTrend(oneYearPoints, metric);
              const oneYearAverage = averageMetric(oneYearPoints);

              return (
                <article key={metric.key} className={styles.summaryCard}>
                  <p className={styles.summaryTitle}>{metric.label}</p>
                  <p className={styles.summaryValue}>{oneYearAverage}</p>
                  <p className={styles.summaryTrend}>{oneYearTrend.label}</p>
                </article>
              );
            })}
          </section>

          <section className={styles.panelsStack}>
            <article className={styles.panel}>
              <h2 className={styles.panelTitle}>Combined Trend - 1 Year</h2>
              <p className={styles.panelHint}>
                7-point smoothing with normalized values to compare all three metrics together.
              </p>
              <CombinedChart
                series={oneYearSeries}
                chartLabel="Combined one-year trend"
                smoothingWindow={7}
                events={importantEvents}
              />
            </article>

            <article className={styles.panel}>
              <h2 className={styles.panelTitle}>Combined Trend - All Time</h2>
              <p className={styles.panelHint}>
                21-point smoothing across full history with connected lines for each metric.
              </p>
              <CombinedChart
                series={allTimeSeries}
                chartLabel="Combined all-time trend"
                smoothingWindow={21}
                events={importantEvents}
              />
            </article>
          </section>
        </section>
      </main>
    );
  }

  const metric = METRICS.find((item) => item.slug === slug);
  if (!metric) {
    notFound();
  }

  const allPoints = series[metric.key];
  const oneYearPoints = getOneYearSubset(allPoints);

  const oneYearAverage = averageMetric(oneYearPoints);
  const allAverage = averageMetric(allPoints);

  const oneYearTrend = calculateTrend(oneYearPoints, metric);
  const allTrend = calculateTrend(allPoints, metric);
  const impactInsights = calculateEventImpactInsights(allPoints, importantEvents);

  return (
    <main className={styles.page}>
      <section className={styles.container}>
        <header className={styles.header}>
          <p className={styles.kicker}>Private</p>
          <h1 className={styles.title}>{metric.label}</h1>
          <p className={styles.subtitle}>
            Dedicated {metric.label.toLowerCase()} page with two large graphs for yearly and all-time
            analysis.
          </p>
        </header>

        <section className={styles.panelsStack}>
          <MetricPanel
            title={`${metric.label} Trend - 1 Year`}
            average={oneYearAverage}
            trend={oneYearTrend}
            hint={`Smoothed line with a ${metric.oneYearSmoothing}-point moving average over the last year.`}
          >
            <MetricChart
              points={oneYearPoints}
              metricLabel={metric.label}
              smoothingWindow={metric.oneYearSmoothing}
              colorStart={metric.colorStart}
              colorEnd={metric.colorEnd}
              events={importantEvents}
            />
          </MetricPanel>

          <MetricPanel
            title={`${metric.label} Trend - All Time`}
            average={allAverage}
            trend={allTrend}
            hint={`Smoothed line with a ${metric.allTimeSmoothing}-point moving average across the full history.`}
          >
            <MetricChart
              points={allPoints}
              metricLabel={metric.label}
              smoothingWindow={metric.allTimeSmoothing}
              colorStart={metric.colorStart}
              colorEnd={metric.colorEnd}
              events={importantEvents}
            />
          </MetricPanel>

          <article className={styles.panel}>
            <h2 className={styles.panelTitle}>Event Impact</h2>
            <p className={styles.panelHint}>
              Estimated 7-day average change after each important day.
            </p>

            {impactInsights.length === 0 ? (
              <p className={styles.emptyState}>Not enough data around events to estimate impact yet.</p>
            ) : (
              <div className={styles.eventImpactList}>
                {impactInsights.map((insight) => (
                  <p key={insight.eventId} className={styles.eventImpactItem}>
                    From event <strong>{insight.eventName}</strong>, your {metric.label.toLowerCase()} became {insight.direction} by {insight.percent.toFixed(1)}%.
                  </p>
                ))}
              </div>
            )}
          </article>
        </section>
      </section>
    </main>
  );
}
