import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SignOutButton from "./sign-out-button";
import MetricChart from "./stress-chart";
import styles from "./dashboard.module.css";

type MetricPoint = {
  date: string;
  value: number | null;
};

type TrendSummary = {
  label: string;
  deltaText: string;
  tone: "up" | "down" | "flat";
};

type MetricDescriptor = {
  key: "stress" | "respiration" | "bodyBattery";
  label: string;
  unit: string;
  oneYearSmoothing: number;
  allTimeSmoothing: number;
  stableThreshold: number;
  upLabel: string;
  downLabel: string;
};

type MetricSeries = {
  stress: MetricPoint[];
  respiration: MetricPoint[];
  bodyBattery: MetricPoint[];
};

const METRICS: MetricDescriptor[] = [
  {
    key: "stress",
    label: "Stress",
    unit: "pts",
    oneYearSmoothing: 7,
    allTimeSmoothing: 21,
    stableThreshold: 0.3,
    upLabel: "stress creeping up",
    downLabel: "stress easing down",
  },
  {
    key: "respiration",
    label: "Respiration",
    unit: "rpm",
    oneYearSmoothing: 7,
    allTimeSmoothing: 21,
    stableThreshold: 0.2,
    upLabel: "respiration trending up",
    downLabel: "respiration trending down",
  },
  {
    key: "bodyBattery",
    label: "Body Battery",
    unit: "pts",
    oneYearSmoothing: 7,
    allTimeSmoothing: 21,
    stableThreshold: 0.4,
    upLabel: "body battery climbing",
    downLabel: "body battery dropping",
  },
];

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

function getOneYearSubset(points: MetricPoint[]): MetricPoint[] {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  return points.filter((point) => new Date(point.date) >= oneYearAgo);
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

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const series = await getMetricSeries(session.user?.email);

  const trendToneClass = {
    up: styles.trendUp,
    down: styles.trendDown,
    flat: styles.trendFlat,
  };

  return (
    <main className={styles.page}>
      <section className={styles.container}>
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>Private</p>
            <h1 className={styles.title}>Dashboard</h1>
            <p className={styles.subtitle}>Signed in as {session.user?.email ?? "unknown"}</p>
          </div>
          <SignOutButton />
        </header>

        <div className={styles.metricsStack}>
          {METRICS.map((metric) => {
            const allPoints = series[metric.key];
            const oneYearPoints = getOneYearSubset(allPoints);
            const oneYearAverage = averageMetric(oneYearPoints);
            const allAverage = averageMetric(allPoints);
            const oneYearTrend = calculateTrend(oneYearPoints, metric);
            const allTrend = calculateTrend(allPoints, metric);

            return (
              <section key={metric.key} className={styles.metricSection}>
                <h2 className={styles.metricSectionTitle}>{metric.label}</h2>

                <div className={styles.panelsGrid}>
                  <article className={styles.panel}>
                    <div className={styles.panelTopRow}>
                      <h3 className={styles.panelTitle}>{metric.label} Trend - 1 Year</h3>
                      <p className={styles.metric}>Average: {oneYearAverage}</p>
                    </div>
                    <div className={styles.trendRow}>
                      <p className={`${styles.trendBadge} ${trendToneClass[oneYearTrend.tone]}`}>
                        {oneYearTrend.label}
                      </p>
                      <p className={styles.trendDelta}>{oneYearTrend.deltaText}</p>
                    </div>
                    <p className={styles.panelHint}>
                      Smoothed line with a {metric.oneYearSmoothing}-point moving average over the
                      last year.
                    </p>

                    <MetricChart
                      points={oneYearPoints}
                      smoothingWindow={metric.oneYearSmoothing}
                      metricLabel={metric.label}
                    />
                  </article>

                  <article className={styles.panel}>
                    <div className={styles.panelTopRow}>
                      <h3 className={styles.panelTitle}>{metric.label} Trend - All Time</h3>
                      <p className={styles.metric}>Average: {allAverage}</p>
                    </div>
                    <div className={styles.trendRow}>
                      <p className={`${styles.trendBadge} ${trendToneClass[allTrend.tone]}`}>
                        {allTrend.label}
                      </p>
                      <p className={styles.trendDelta}>{allTrend.deltaText}</p>
                    </div>
                    <p className={styles.panelHint}>
                      Smoothed line with a {metric.allTimeSmoothing}-point moving average across
                      the full history.
                    </p>

                    <MetricChart
                      points={allPoints}
                      smoothingWindow={metric.allTimeSmoothing}
                      metricLabel={metric.label}
                    />
                  </article>
                </div>
              </section>
            );
          })}
        </div>
      </section>
    </main>
  );
}
