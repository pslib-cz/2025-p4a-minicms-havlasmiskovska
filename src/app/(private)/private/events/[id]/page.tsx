import { getServerSession } from "next-auth";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import styles from "./event-detail.module.css";

type EventDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

type StressRow = {
  pk_date: Date;
  userProfilePK: number;
  awake_averageStressLevel: number | null;
  awake_averageStressLevelIntensity: number | null;
  awake_highDuration: number | null;
  awake_lowDuration: number | null;
  awake_maxStressLevel: number | null;
  awake_mediumDuration: number | null;
  awake_restDuration: number | null;
  awake_stressDuration: number | null;
  awake_stressIntensityCount: number | null;
  awake_totalDuration: number | null;
  awake_totalStressCount: number | null;
  awake_totalStressIntensity: number | null;
};

type RespirationRow = {
  pk_date: Date;
  userProfilePK: number;
  avgWakingRespirationValue: number | null;
  highestRespirationValue: number | null;
  lowestRespirationValue: number | null;
};

type BodyBatteryRow = {
  pk_date: Date;
  userProfilePK: number;
  chargedValue: number | null;
  drainedValue: number | null;
  highest_statTimestamp: Date | null;
  highest_statsValue: number | null;
  lowest_statTimestamp: Date | null;
  lowest_statsValue: number | null;
  sleepend_statTimestamp: Date | null;
  sleepend_statsValue: number | null;
  sleepstart_statTimestamp: Date | null;
  sleepstart_statsValue: number | null;
};

type SeriesPoint = {
  date: string;
  value: number | null;
};

type HorizonResult = {
  percentChange: number;
  direction: "higher" | "lower" | "no meaningful change";
  interpretation: string;
};

type MediumHorizonResult = HorizonResult & {
  zScore: number | null;
};

type EventImpactAnalysis = {
  shortTerm: HorizonResult | null;
  mediumTerm: MediumHorizonResult | null;
  longTerm: HorizonResult | null;
  hasConflictingSignals: boolean;
};

function toDateLabel(value: Date) {
  return value.toISOString().slice(0, 10);
}

function toDisplayValue(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value === null || value === undefined) {
    return "-";
  }

  return String(value);
}

function averageStressInRange(points: StressRow[], start: Date, end: Date) {
  const values = points
    .filter((point) => point.pk_date >= start && point.pk_date <= end)
    .map((point) => point.awake_averageStressLevel)
    .filter((value): value is number => value !== null);

  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function toValidSeries(points: SeriesPoint[]) {
  return points
    .map((point) => {
      const time = new Date(`${point.date}T00:00:00.000Z`).getTime();
      if (Number.isNaN(time) || point.value === null) {
        return null;
      }

      return {
        time,
        value: point.value,
      };
    })
    .filter((entry): entry is { time: number; value: number } => entry !== null)
    .sort((a, b) => a.time - b.time);
}

function averageByTimeRange(
  series: Array<{ time: number; value: number }>,
  fromTime: number,
  toTime: number,
) {
  const values = series
    .filter((entry) => entry.time >= fromTime && entry.time <= toTime)
    .map((entry) => entry.value);

  if (values.length === 0) {
    return null;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function percentageChange(beforeValue: number, afterValue: number) {
  if (beforeValue === 0) {
    return null;
  }

  return ((afterValue - beforeValue) / Math.abs(beforeValue)) * 100;
}

function describeShortTermChange(percent: number) {
  if (Math.abs(percent) < 5) {
    return "Change is smaller than 5%, so this looks more like noise than a clear immediate reaction.";
  }

  return "Change is above the 5% noise threshold, so this likely reflects an immediate reaction.";
}

function describeMediumTermChange(percent: number, zScore: number | null) {
  const magnitudeText = Math.abs(percent) < 5
    ? "The percentage shift is below 5%, which suggests only a mild temporary shift."
    : "The percentage shift is above 5%, which suggests a meaningful temporary shift.";

  if (zScore === null) {
    return `${magnitudeText} Z-score was not available due to near-zero variance.`;
  }

  if (Math.abs(zScore) >= 1) {
    return `${magnitudeText} Z-score confirms a notable deviation from normal behavior.`;
  }

  return `${magnitudeText} Z-score is small, so deviation from normal behavior appears limited.`;
}

function describeLongTermChange(percent: number) {
  if (Math.abs(percent) < 5) {
    return "Long-term change is below 5%, so there is no meaningful structural change.";
  }

  if (percent > 0) {
    return "Metric remains elevated in the long run, indicating a lasting increase.";
  }

  return "Metric remains lower in the long run, indicating a lasting decrease.";
}

function resolveDirection(percent: number, lowerIsBetter: boolean): "higher" | "lower" | "no meaningful change" {
  if (Math.abs(percent) < 5) {
    return "no meaningful change";
  }

  const improved = lowerIsBetter ? percent < 0 : percent > 0;
  return improved ? "lower" : "higher";
}

function analyzeSingleEventImpact(
  points: SeriesPoint[],
  eventStartDate: Date,
  eventEndDate: Date,
  lowerIsBetter: boolean,
): EventImpactAnalysis | null {
  const dayMs = 24 * 60 * 60 * 1000;
  const series = toValidSeries(points);

  if (series.length < 20) {
    return null;
  }

  const allValues = series.map((entry) => entry.value);
  const fullMean = allValues.reduce((sum, value) => sum + value, 0) / allValues.length;
  const fullVariance =
    allValues.reduce((sum, value) => sum + (value - fullMean) ** 2, 0) / allValues.length;
  const fullStd = Math.sqrt(fullVariance);

  const startTime = eventStartDate.getTime();
  const endTime = eventEndDate.getTime();

  const shortBeforeAvg = averageByTimeRange(series, startTime - 7 * dayMs, startTime - dayMs);
  const shortAfterAvg = averageByTimeRange(series, endTime + dayMs, endTime + 7 * dayMs);

  let shortTerm: HorizonResult | null = null;
  if (shortBeforeAvg !== null && shortAfterAvg !== null) {
    const pct = percentageChange(shortBeforeAvg, shortAfterAvg);
    if (pct !== null) {
      shortTerm = {
        percentChange: Math.abs(pct),
        direction: resolveDirection(pct, lowerIsBetter),
        interpretation: describeShortTermChange(pct),
      };
    }
  }

  const baselineValues = series
    .filter((entry) => entry.time < startTime)
    .map((entry) => entry.value);
  const baselineAvg =
    baselineValues.length === 0
      ? null
      : baselineValues.reduce((sum, value) => sum + value, 0) / baselineValues.length;

  const mediumPostAvg = averageByTimeRange(series, endTime, endTime + 30 * dayMs);

  let mediumTerm: MediumHorizonResult | null = null;
  if (baselineAvg !== null && mediumPostAvg !== null) {
    const pct = percentageChange(baselineAvg, mediumPostAvg);
    if (pct !== null) {
      const zScore = fullStd > 0 ? (mediumPostAvg - fullMean) / fullStd : null;
      mediumTerm = {
        percentChange: Math.abs(pct),
        direction: resolveDirection(pct, lowerIsBetter),
        zScore,
        interpretation: describeMediumTermChange(pct, zScore),
      };
    }
  }

  const longBeforeAvg = averageByTimeRange(series, startTime - 90 * dayMs, startTime - dayMs);
  const longAfterValues = series
    .filter((entry) => entry.time >= endTime + 30 * dayMs)
    .map((entry) => entry.value);
  const longAfterAvg =
    longAfterValues.length === 0
      ? null
      : longAfterValues.reduce((sum, value) => sum + value, 0) / longAfterValues.length;

  let longTerm: HorizonResult | null = null;
  if (longBeforeAvg !== null && longAfterAvg !== null) {
    const pct = percentageChange(longBeforeAvg, longAfterAvg);
    if (pct !== null) {
      longTerm = {
        percentChange: Math.abs(pct),
        direction: resolveDirection(pct, lowerIsBetter),
        interpretation: describeLongTermChange(pct),
      };
    }
  }

  if (!shortTerm && !mediumTerm && !longTerm) {
    return null;
  }

  const meaningfulDirections = [shortTerm, mediumTerm, longTerm]
    .filter((result): result is HorizonResult => result !== null)
    .filter((result) => result.direction !== "no meaningful change")
    .map((result) => result.direction);

  return {
    shortTerm,
    mediumTerm,
    longTerm,
    hasConflictingSignals:
      meaningfulDirections.includes("higher") && meaningfulDirections.includes("lower"),
  };
}

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const { id } = await params;

  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  const email = session.user?.email;
  if (!email) {
    redirect("/login?error=Callback");
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      userProfilePK: true,
      importantEvents: {
        where: { id },
        select: {
          id: true,
          name: true,
          tags: true,
          expectedEffect: true,
          startDate: true,
          endDate: true,
          descriptionHtml: true,
        },
      },
    },
  });

  if (!user?.userProfilePK) {
    redirect("/register");
  }

  const event = user.importantEvents[0];
  if (!event) {
    notFound();
  }

  const [stressRows, respirationRows, bodyBatteryRows, stressSeriesRows, respirationSeriesRows, bodyBatterySeriesRows] = await Promise.all([
    prisma.stress.findMany({
      where: {
        userProfilePK: user.userProfilePK,
        pk_date: {
          gte: event.startDate,
          lte: event.endDate,
        },
      },
      orderBy: { pk_date: "asc" },
      select: {
        pk_date: true,
        userProfilePK: true,
        awake_averageStressLevel: true,
        awake_averageStressLevelIntensity: true,
        awake_highDuration: true,
        awake_lowDuration: true,
        awake_maxStressLevel: true,
        awake_mediumDuration: true,
        awake_restDuration: true,
        awake_stressDuration: true,
        awake_stressIntensityCount: true,
        awake_totalDuration: true,
        awake_totalStressCount: true,
        awake_totalStressIntensity: true,
      },
    }),
    prisma.respiration.findMany({
      where: {
        userProfilePK: user.userProfilePK,
        pk_date: {
          gte: event.startDate,
          lte: event.endDate,
        },
      },
      orderBy: { pk_date: "asc" },
      select: {
        pk_date: true,
        userProfilePK: true,
        avgWakingRespirationValue: true,
        highestRespirationValue: true,
        lowestRespirationValue: true,
      },
    }),
    prisma.bodyBattery.findMany({
      where: {
        userProfilePK: user.userProfilePK,
        pk_date: {
          gte: event.startDate,
          lte: event.endDate,
        },
      },
      orderBy: { pk_date: "asc" },
      select: {
        pk_date: true,
        userProfilePK: true,
        chargedValue: true,
        drainedValue: true,
        highest_statTimestamp: true,
        highest_statsValue: true,
        lowest_statTimestamp: true,
        lowest_statsValue: true,
        sleepend_statTimestamp: true,
        sleepend_statsValue: true,
        sleepstart_statTimestamp: true,
        sleepstart_statsValue: true,
      },
    }),
    prisma.stress.findMany({
      where: { userProfilePK: user.userProfilePK },
      orderBy: { pk_date: "asc" },
      select: {
        pk_date: true,
        awake_averageStressLevel: true,
      },
    }),
    prisma.respiration.findMany({
      where: { userProfilePK: user.userProfilePK },
      orderBy: { pk_date: "asc" },
      select: {
        pk_date: true,
        avgWakingRespirationValue: true,
      },
    }),
    prisma.bodyBattery.findMany({
      where: { userProfilePK: user.userProfilePK },
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

  const stressSeries: SeriesPoint[] = stressSeriesRows.map((row) => ({
    date: row.pk_date.toISOString().slice(0, 10),
    value: row.awake_averageStressLevel,
  }));

  const respirationSeries: SeriesPoint[] = respirationSeriesRows.map((row) => ({
    date: row.pk_date.toISOString().slice(0, 10),
    value: row.avgWakingRespirationValue,
  }));

  const bodyBatterySeries: SeriesPoint[] = bodyBatterySeriesRows.map((row) => ({
    date: row.pk_date.toISOString().slice(0, 10),
    value:
      row.highest_statsValue ??
      row.sleepend_statsValue ??
      row.sleepstart_statsValue ??
      row.chargedValue,
  }));

  const stressImpact = analyzeSingleEventImpact(stressSeries, event.startDate, event.endDate, true);
  const respirationImpact = analyzeSingleEventImpact(respirationSeries, event.startDate, event.endDate, true);
  const bodyBatteryImpact = analyzeSingleEventImpact(bodyBatterySeries, event.startDate, event.endDate, false);

  return (
    <main className={styles.page}>
      <section className={styles.container}>
        <header className={styles.header}>
          <p className={styles.kicker}>Important Days</p>
          <h1 className={styles.title}>{event.name}</h1>
          <p className={styles.subtitle}>
            {toDateLabel(event.startDate)}
            {toDateLabel(event.startDate) !== toDateLabel(event.endDate)
              ? ` - ${toDateLabel(event.endDate)}`
              : ""}
          </p>
        </header>

        <section className={styles.metaCard}>
          <p className={styles.metaRow}>
            <span className={styles.metaLabel}>Expected effect:</span>{" "}
            {event.expectedEffect === "POSITIVE" ? "Positive" : "Negative"}
          </p>

          <p className={styles.insightMuted}>
            Multi-horizon impact details are available below for stress, respiration, and body battery.
          </p>

          <div className={styles.tagsRow}>
            {event.tags.map((tag) => (
              <span key={tag} className={styles.tag}>{tag}</span>
            ))}
          </div>
        </section>

        <section className={styles.contentCard}>
          <h2 className={styles.sectionTitle}>What Happened</h2>
          <div className={styles.richText} dangerouslySetInnerHTML={{ __html: event.descriptionHtml }} />
        </section>

        <section className={styles.contentCard}>
          <h2 className={styles.sectionTitle}>Impact Analysis (Short / Medium / Long)</h2>

          <div className={styles.metricsBlock}>
            <h3 className={styles.metricsTitle}>Stress</h3>
            {stressImpact ? (
              <div className={styles.impactGrid}>
                <p className={styles.impactSectionTitle}>Short-term:</p>
                {stressImpact.shortTerm ? (
                  <>
                    <p>Stress became {stressImpact.shortTerm.direction} by {stressImpact.shortTerm.percentChange.toFixed(1)}%.</p>
                    <p>Interpretation: {stressImpact.shortTerm.interpretation}</p>
                  </>
                ) : <p>Insufficient data for 7 days before or 7 days after the event.</p>}

                <p className={styles.impactSectionTitle}>Medium-term:</p>
                {stressImpact.mediumTerm ? (
                  <>
                    <p>Stress was {stressImpact.mediumTerm.direction} by {stressImpact.mediumTerm.percentChange.toFixed(1)}% compared to baseline.</p>
                    <p>Z-score: {stressImpact.mediumTerm.zScore === null ? "n/a" : stressImpact.mediumTerm.zScore.toFixed(2)}</p>
                    <p>Interpretation: {stressImpact.mediumTerm.interpretation}</p>
                  </>
                ) : <p>Insufficient baseline or 0-30 day post-event data.</p>}

                <p className={styles.impactSectionTitle}>Long-term:</p>
                {stressImpact.longTerm ? (
                  <>
                    <p>Stress is {stressImpact.longTerm.direction} by {stressImpact.longTerm.percentChange.toFixed(1)}%.</p>
                    <p>Interpretation: {stressImpact.longTerm.interpretation}</p>
                  </>
                ) : <p>Insufficient long-term windows for structural change analysis.</p>}

                {stressImpact.hasConflictingSignals ? (
                  <p className={styles.impactConflict}>Signals conflict across time horizons.</p>
                ) : null}
              </div>
            ) : (
              <p className={styles.emptyText}>Not enough stress data for multi-horizon analysis.</p>
            )}
          </div>

          <div className={styles.metricsBlock}>
            <h3 className={styles.metricsTitle}>Respiration</h3>
            {respirationImpact ? (
              <div className={styles.impactGrid}>
                <p className={styles.impactSectionTitle}>Short-term:</p>
                {respirationImpact.shortTerm ? (
                  <>
                    <p>Respiration became {respirationImpact.shortTerm.direction} by {respirationImpact.shortTerm.percentChange.toFixed(1)}%.</p>
                    <p>Interpretation: {respirationImpact.shortTerm.interpretation}</p>
                  </>
                ) : <p>Insufficient data for 7 days before or 7 days after the event.</p>}

                <p className={styles.impactSectionTitle}>Medium-term:</p>
                {respirationImpact.mediumTerm ? (
                  <>
                    <p>Respiration was {respirationImpact.mediumTerm.direction} by {respirationImpact.mediumTerm.percentChange.toFixed(1)}% compared to baseline.</p>
                    <p>Z-score: {respirationImpact.mediumTerm.zScore === null ? "n/a" : respirationImpact.mediumTerm.zScore.toFixed(2)}</p>
                    <p>Interpretation: {respirationImpact.mediumTerm.interpretation}</p>
                  </>
                ) : <p>Insufficient baseline or 0-30 day post-event data.</p>}

                <p className={styles.impactSectionTitle}>Long-term:</p>
                {respirationImpact.longTerm ? (
                  <>
                    <p>Respiration is {respirationImpact.longTerm.direction} by {respirationImpact.longTerm.percentChange.toFixed(1)}%.</p>
                    <p>Interpretation: {respirationImpact.longTerm.interpretation}</p>
                  </>
                ) : <p>Insufficient long-term windows for structural change analysis.</p>}

                {respirationImpact.hasConflictingSignals ? (
                  <p className={styles.impactConflict}>Signals conflict across time horizons.</p>
                ) : null}
              </div>
            ) : (
              <p className={styles.emptyText}>Not enough respiration data for multi-horizon analysis.</p>
            )}
          </div>

          <div className={styles.metricsBlock}>
            <h3 className={styles.metricsTitle}>Body Battery</h3>
            {bodyBatteryImpact ? (
              <div className={styles.impactGrid}>
                <p className={styles.impactSectionTitle}>Short-term:</p>
                {bodyBatteryImpact.shortTerm ? (
                  <>
                    <p>Body battery became {bodyBatteryImpact.shortTerm.direction} by {bodyBatteryImpact.shortTerm.percentChange.toFixed(1)}%.</p>
                    <p>Interpretation: {bodyBatteryImpact.shortTerm.interpretation}</p>
                  </>
                ) : <p>Insufficient data for 7 days before or 7 days after the event.</p>}

                <p className={styles.impactSectionTitle}>Medium-term:</p>
                {bodyBatteryImpact.mediumTerm ? (
                  <>
                    <p>Body battery was {bodyBatteryImpact.mediumTerm.direction} by {bodyBatteryImpact.mediumTerm.percentChange.toFixed(1)}% compared to baseline.</p>
                    <p>Z-score: {bodyBatteryImpact.mediumTerm.zScore === null ? "n/a" : bodyBatteryImpact.mediumTerm.zScore.toFixed(2)}</p>
                    <p>Interpretation: {bodyBatteryImpact.mediumTerm.interpretation}</p>
                  </>
                ) : <p>Insufficient baseline or 0-30 day post-event data.</p>}

                <p className={styles.impactSectionTitle}>Long-term:</p>
                {bodyBatteryImpact.longTerm ? (
                  <>
                    <p>Body battery is {bodyBatteryImpact.longTerm.direction} by {bodyBatteryImpact.longTerm.percentChange.toFixed(1)}%.</p>
                    <p>Interpretation: {bodyBatteryImpact.longTerm.interpretation}</p>
                  </>
                ) : <p>Insufficient long-term windows for structural change analysis.</p>}

                {bodyBatteryImpact.hasConflictingSignals ? (
                  <p className={styles.impactConflict}>Signals conflict across time horizons.</p>
                ) : null}
              </div>
            ) : (
              <p className={styles.emptyText}>Not enough body battery data for multi-horizon analysis.</p>
            )}
          </div>
        </section>

        <section className={styles.contentCard}>
          <h2 className={styles.sectionTitle}>Detailed Metrics During This Important Day</h2>

          <article className={styles.metricsBlock}>
            <h3 className={styles.metricsTitle}>Stress (all properties)</h3>
            {stressRows.length === 0 ? (
              <p className={styles.emptyText}>No stress rows found for this date range.</p>
            ) : (
              stressRows.map((row) => (
                <div key={`stress-${row.pk_date.toISOString()}`} className={styles.metricRow}>
                  <p className={styles.metricRowTitle}>{toDateLabel(row.pk_date)}</p>
                  <dl className={styles.kvGrid}>
                    {Object.entries(row).map(([key, value]) => (
                      <div key={key} className={styles.kvItem}>
                        <dt>{key}</dt>
                        <dd>{toDisplayValue(value)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))
            )}
          </article>

          <article className={styles.metricsBlock}>
            <h3 className={styles.metricsTitle}>Respiration (all properties)</h3>
            {respirationRows.length === 0 ? (
              <p className={styles.emptyText}>No respiration rows found for this date range.</p>
            ) : (
              respirationRows.map((row) => (
                <div key={`respiration-${row.pk_date.toISOString()}`} className={styles.metricRow}>
                  <p className={styles.metricRowTitle}>{toDateLabel(row.pk_date)}</p>
                  <dl className={styles.kvGrid}>
                    {Object.entries(row).map(([key, value]) => (
                      <div key={key} className={styles.kvItem}>
                        <dt>{key}</dt>
                        <dd>{toDisplayValue(value)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))
            )}
          </article>

          <article className={styles.metricsBlock}>
            <h3 className={styles.metricsTitle}>Body Battery (all properties)</h3>
            {bodyBatteryRows.length === 0 ? (
              <p className={styles.emptyText}>No body battery rows found for this date range.</p>
            ) : (
              bodyBatteryRows.map((row) => (
                <div key={`body-battery-${row.pk_date.toISOString()}`} className={styles.metricRow}>
                  <p className={styles.metricRowTitle}>{toDateLabel(row.pk_date)}</p>
                  <dl className={styles.kvGrid}>
                    {Object.entries(row).map(([key, value]) => (
                      <div key={key} className={styles.kvItem}>
                        <dt>{key}</dt>
                        <dd>{toDisplayValue(value)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))
            )}
          </article>
        </section>

        <Link href="/private/events" className={styles.backLink}>
          Back To Events
        </Link>
      </section>
    </main>
  );
}
