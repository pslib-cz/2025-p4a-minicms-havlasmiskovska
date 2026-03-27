import { getServerSession } from "next-auth";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import VisibilitySelector from "./visibility-selector";
import { BSCard, BSBadge } from "@/components/BootstrapUI";


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
          visibility: true,
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
    <main className="min-vh-100 bg-light py-5">
      <div className="container">
        <header className="mb-5">
          <p className="text-uppercase text-primary fw-bold mb-1">Important Days</p>
          <h1 className="display-5 fw-bold mb-3">{event.name}</h1>
          <p className="lead text-muted">
            {toDateLabel(event.startDate)}
            {toDateLabel(event.startDate) !== toDateLabel(event.endDate)
              ? ` - ${toDateLabel(event.endDate)}`
              : ""}
          </p>
        </header>

        <BSCard className="mb-4 shadow-sm border-0">
          <div className="d-flex flex-wrap align-items-center mb-2">
            <span className="fw-bold d-inline-block me-2" style={{ minWidth: '130px' }}>Expected effect:</span>
            <BSBadge bg={event.expectedEffect === "POSITIVE" ? "success" : "danger"}>
              {event.expectedEffect === "POSITIVE" ? "Positive" : "Negative"}
            </BSBadge>
          </div>

          <VisibilitySelector eventId={event.id} currentVisibility={event.visibility} />

          <p className="text-muted small mt-2 mb-3">
            Multi-horizon impact details are available below for stress, respiration, and body battery.
          </p>

          <div className="d-flex flex-wrap gap-2 mt-3">
            {event.tags.map((tag) => (
              <BSBadge key={tag} bg="primary" className="badge bg-secondary">{tag}</BSBadge>
            ))}
          </div>
        </BSCard>

        <BSCard className="mb-4 shadow-sm border-0">
          <h2 className="h4 mb-4 border-bottom pb-2">What Happened</h2>
          <div className="mb-3" dangerouslySetInnerHTML={{ __html: event.descriptionHtml }} />
        </BSCard>

        <BSCard className="mb-4 shadow-sm border-0">
          <h2 className="h4 mb-4 border-bottom pb-2">Impact Analysis (Short / Medium / Long)</h2>

          <div className="mb-4 p-3 border rounded bg-white shadow-sm">
            <h3 className="h5 mb-3 text-secondary">Stress</h3>
            {stressImpact ? (
              <div className="row g-2 mb-3">
                <p className="fw-bold text-dark mt-2 mb-1">Short-term:</p>
                {stressImpact.shortTerm ? (
                  <>
                    <p>Stress became <BSBadge bg={stressImpact.shortTerm.direction === "higher" ? "danger" : "success"}>{stressImpact.shortTerm.direction}</BSBadge> by {stressImpact.shortTerm.percentChange.toFixed(1)}%.</p>
                    <p>Interpretation: {stressImpact.shortTerm.interpretation}</p>
                  </>
                ) : <p>Insufficient data for 7 days before or 7 days after the event.</p>}

                <p className="fw-bold text-dark mt-2 mb-1">Medium-term:</p>
                {stressImpact.mediumTerm ? (
                  <>
                    <p>Stress was <BSBadge bg={stressImpact.mediumTerm.direction === "higher" ? "danger" : "success"}>{stressImpact.mediumTerm.direction}</BSBadge> by {stressImpact.mediumTerm.percentChange.toFixed(1)}% compared to baseline.</p>
                    <p>Z-score: {stressImpact.mediumTerm.zScore === null ? "n/a" : stressImpact.mediumTerm.zScore.toFixed(2)}</p>
                    <p>Interpretation: {stressImpact.mediumTerm.interpretation}</p>
                  </>
                ) : <p>Insufficient baseline or 0-30 day post-event data.</p>}

                <p className="fw-bold text-dark mt-2 mb-1">Long-term:</p>
                {stressImpact.longTerm ? (
                  <>
                    <p>Stress is <BSBadge bg={stressImpact.longTerm.direction === "higher" ? "danger" : "success"}>{stressImpact.longTerm.direction}</BSBadge> by {stressImpact.longTerm.percentChange.toFixed(1)}%.</p>
                    <p>Interpretation: {stressImpact.longTerm.interpretation}</p>
                  </>
                ) : <p>Insufficient long-term windows for structural change analysis.</p>}

                {stressImpact.hasConflictingSignals ? (
                  <p className="alert alert-warning mt-3">Signals conflict across time horizons.</p>
                ) : null}
              </div>
            ) : (
              <p className="text-muted fst-italic">Not enough stress data for multi-horizon analysis.</p>
            )}
          </div>

          <div className="mb-4 p-3 border rounded bg-white shadow-sm">
            <h3 className="h5 mb-3 text-secondary">Respiration</h3>
            {respirationImpact ? (
              <div className="row g-2 mb-3">
                <p className="fw-bold text-dark mt-2 mb-1">Short-term:</p>
                {respirationImpact.shortTerm ? (
                  <>
                    <p>Respiration became <BSBadge bg={respirationImpact.shortTerm.direction === "higher" ? "danger" : "success"}>{respirationImpact.shortTerm.direction}</BSBadge> by {respirationImpact.shortTerm.percentChange.toFixed(1)}%.</p>
                    <p>Interpretation: {respirationImpact.shortTerm.interpretation}</p>
                  </>
                ) : <p>Insufficient data for 7 days before or 7 days after the event.</p>}

                <p className="fw-bold text-dark mt-2 mb-1">Medium-term:</p>
                {respirationImpact.mediumTerm ? (
                  <>
                    <p>Respiration was <BSBadge bg={respirationImpact.mediumTerm.direction === "higher" ? "danger" : "success"}>{respirationImpact.mediumTerm.direction}</BSBadge> by {respirationImpact.mediumTerm.percentChange.toFixed(1)}% compared to baseline.</p>
                    <p>Z-score: {respirationImpact.mediumTerm.zScore === null ? "n/a" : respirationImpact.mediumTerm.zScore.toFixed(2)}</p>
                    <p>Interpretation: {respirationImpact.mediumTerm.interpretation}</p>
                  </>
                ) : <p>Insufficient baseline or 0-30 day post-event data.</p>}

                <p className="fw-bold text-dark mt-2 mb-1">Long-term:</p>
                {respirationImpact.longTerm ? (
                  <>
                    <p>Respiration is <BSBadge bg={respirationImpact.longTerm.direction === "higher" ? "danger" : "success"}>{respirationImpact.longTerm.direction}</BSBadge> by {respirationImpact.longTerm.percentChange.toFixed(1)}%.</p>
                    <p>Interpretation: {respirationImpact.longTerm.interpretation}</p>
                  </>
                ) : <p>Insufficient long-term windows for structural change analysis.</p>}

                {respirationImpact.hasConflictingSignals ? (
                  <p className="alert alert-warning mt-3">Signals conflict across time horizons.</p>
                ) : null}
              </div>
            ) : (
              <p className="text-muted fst-italic">Not enough respiration data for multi-horizon analysis.</p>
            )}
          </div>

          <div className="mb-4 p-3 border rounded bg-white shadow-sm">
            <h3 className="h5 mb-3 text-secondary">Body Battery</h3>
            {bodyBatteryImpact ? (
              <div className="row g-2 mb-3">
                <p className="fw-bold text-dark mt-2 mb-1">Short-term:</p>
                {bodyBatteryImpact.shortTerm ? (
                  <>
                    <p>Body battery became <BSBadge bg={bodyBatteryImpact.shortTerm.direction === "lower" ? "danger" : "success"}>{bodyBatteryImpact.shortTerm.direction}</BSBadge> by {bodyBatteryImpact.shortTerm.percentChange.toFixed(1)}%.</p>
                    <p>Interpretation: {bodyBatteryImpact.shortTerm.interpretation}</p>
                  </>
                ) : <p>Insufficient data for 7 days before or 7 days after the event.</p>}

                <p className="fw-bold text-dark mt-2 mb-1">Medium-term:</p>
                {bodyBatteryImpact.mediumTerm ? (
                  <>
                    <p>Body battery was <BSBadge bg={bodyBatteryImpact.mediumTerm.direction === "lower" ? "danger" : "success"}>{bodyBatteryImpact.mediumTerm.direction}</BSBadge> by {bodyBatteryImpact.mediumTerm.percentChange.toFixed(1)}% compared to baseline.</p>
                    <p>Z-score: {bodyBatteryImpact.mediumTerm.zScore === null ? "n/a" : bodyBatteryImpact.mediumTerm.zScore.toFixed(2)}</p>
                    <p>Interpretation: {bodyBatteryImpact.mediumTerm.interpretation}</p>
                  </>
                ) : <p>Insufficient baseline or 0-30 day post-event data.</p>}

                <p className="fw-bold text-dark mt-2 mb-1">Long-term:</p>
                {bodyBatteryImpact.longTerm ? (
                  <>
                    <p>Body battery is <BSBadge bg={bodyBatteryImpact.longTerm.direction === "lower" ? "danger" : "success"}>{bodyBatteryImpact.longTerm.direction}</BSBadge> by {bodyBatteryImpact.longTerm.percentChange.toFixed(1)}%.</p>
                    <p>Interpretation: {bodyBatteryImpact.longTerm.interpretation}</p>
                  </>
                ) : <p>Insufficient long-term windows for structural change analysis.</p>}

                {bodyBatteryImpact.hasConflictingSignals ? (
                  <p className="alert alert-warning mt-3">Signals conflict across time horizons.</p>
                ) : null}
              </div>
            ) : (
              <p className="text-muted fst-italic">Not enough body battery data for multi-horizon analysis.</p>
            )}
          </div>
        </BSCard>

        <BSCard className="mb-4 shadow-sm border-0">
          <h2 className="h4 mb-4 border-bottom pb-2">Detailed Metrics During This Important Day</h2>

          <BSCard className="mb-4 p-3 border rounded bg-white shadow-sm">
            <h3 className="h5 mb-3 text-secondary">Stress (all properties)</h3>
            {stressRows.length === 0 ? (
              <p className="text-muted fst-italic">No stress rows found for this date range.</p>
            ) : (
              stressRows.map((row) => (
                <div key={`stress-${row.pk_date.toISOString()}`} className="mb-4 border-bottom pb-3">
                  <p className="fw-bold mb-2">{toDateLabel(row.pk_date)}</p>
                  <dl className="row g-2">
                    {Object.entries(row).map(([key, value]) => (
                      <div key={key} className="col-md-4 col-sm-6">
                        <dt>{key}</dt>
                        <dd>{toDisplayValue(value)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))
            )}
          </BSCard>

          <BSCard className="mb-4 p-3 border rounded bg-white shadow-sm">
            <h3 className="h5 mb-3 text-secondary">Respiration (all properties)</h3>
            {respirationRows.length === 0 ? (
              <p className="text-muted fst-italic">No respiration rows found for this date range.</p>
            ) : (
              respirationRows.map((row) => (
                <div key={`respiration-${row.pk_date.toISOString()}`} className="mb-4 border-bottom pb-3">
                  <p className="fw-bold mb-2">{toDateLabel(row.pk_date)}</p>
                  <dl className="row g-2">
                    {Object.entries(row).map(([key, value]) => (
                      <div key={key} className="col-md-4 col-sm-6">
                        <dt>{key}</dt>
                        <dd>{toDisplayValue(value)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))
            )}
          </BSCard>

          <BSCard className="mb-4 p-3 border rounded bg-white shadow-sm">
            <h3 className="h5 mb-3 text-secondary">Body Battery (all properties)</h3>
            {bodyBatteryRows.length === 0 ? (
              <p className="text-muted fst-italic">No body battery rows found for this date range.</p>
            ) : (
              bodyBatteryRows.map((row) => (
                <div key={`body-battery-${row.pk_date.toISOString()}`} className="mb-4 border-bottom pb-3">
                  <p className="fw-bold mb-2">{toDateLabel(row.pk_date)}</p>
                  <dl className="row g-2">
                    {Object.entries(row).map(([key, value]) => (
                      <div key={key} className="col-md-4 col-sm-6">
                        <dt>{key}</dt>
                        <dd>{toDisplayValue(value)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))
            )}
          </BSCard>
        </BSCard>

        <Link href="/private/events" className="btn btn-outline-secondary mt-4">
          Back To Events
        </Link>
      </div>
    </main>
  );
}
