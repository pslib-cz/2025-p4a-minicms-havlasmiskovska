import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import MetricChart, { type MetricPoint } from "./metric-chart";
import CombinedChart from "./combined-chart";
import { BSCard } from "@/components/BootstrapUI";

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

type AdditionalChart = {
    key: string;
    title: string;
    description: string;
    points: MetricPoint[];
    smoothingWindow: number;
    colorStart: string;
    colorEnd: string;
};

type ImportantEventMarker = {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    tags: string[];
    effect: "positive" | "negative";
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
    eventId: string;
    eventName: string;
    shortTerm: HorizonResult | null;
    mediumTerm: MediumHorizonResult | null;
    longTerm: HorizonResult | null;
    hasConflictingSignals: boolean;
};

type ImportantEventRow = {
    id: string;
    name: string;
    tags: string[];
    expectedEffect: "POSITIVE" | "NEGATIVE";
    startDate: Date;
    endDate: Date;
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
    return (
        slug === "dashboard" ||
        slug === "stress" ||
        slug === "body-battery" ||
        slug === "respiration"
    );
}

async function resolveTargetUserProfilePK(
    email: string | null | undefined,
): Promise<number | null> {
    let targetUserProfilePK: number | null = null;

    if (email) {
        const user = await prisma.user.findUnique({
            where: { email },
            select: { userProfilePK: true },
        });

        targetUserProfilePK = user?.userProfilePK ?? null;
    }

    if (targetUserProfilePK === null) {
        const [stressFallback, respirationFallback, bodyBatteryFallback] =
            await Promise.all([
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

async function getMetricSeries(
    email: string | null | undefined,
): Promise<MetricSeries> {
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

async function getImportantEvents(
    userProfilePK: number | null,
): Promise<ImportantEventMarker[]> {
    if (userProfilePK === null) {
        return [];
    }

    try {
        const user = await prisma.user.findUnique({
            where: { userProfilePK },
            select: {
                importantEvents: {
                    orderBy: { startDate: "asc" },
                    select: {
                        id: true,
                        name: true,
                        tags: true,
                        expectedEffect: true,
                        startDate: true,
                        endDate: true,
                    },
                },
            },
        });

        const rows: ImportantEventRow[] = user?.importantEvents ?? [];

        return rows.map((row) => ({
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

async function getAdditionalCharts(
    metric: MetricDescriptor,
    userProfilePK: number | null,
): Promise<AdditionalChart[]> {
    if (userProfilePK === null) {
        return [];
    }

    if (metric.key === "stress") {
        const rows = await prisma.stress.findMany({
            where: { userProfilePK },
            orderBy: { pk_date: "asc" },
            select: {
                pk_date: true,
                awake_maxStressLevel: true,
                awake_averageStressLevelIntensity: true,
                awake_stressDuration: true,
            },
        });

        return [
            {
                key: "stress-max-level",
                title: "Stress Max Level by Day",
                description:
                    "Daily maximum stress level highlights acute peaks that can be hidden by averages.",
                points: rows.map((row) => ({
                    date: row.pk_date.toISOString().slice(0, 10),
                    value: row.awake_maxStressLevel,
                })),
                smoothingWindow: 5,
                colorStart: "#ef4444",
                colorEnd: "#b91c1c",
            },
            {
                key: "stress-intensity",
                title: "Stress Intensity Trend",
                description:
                    "Average stress intensity shows whether stressful periods are mild or strongly elevated.",
                points: rows.map((row) => ({
                    date: row.pk_date.toISOString().slice(0, 10),
                    value: row.awake_averageStressLevelIntensity,
                })),
                smoothingWindow: 7,
                colorStart: "#fb7185",
                colorEnd: "#be123c",
            },
            {
                key: "stress-duration",
                title: "Stress Duration by Day",
                description:
                    "Stress duration tracks how long stress lasted each day, not only how high it was.",
                points: rows.map((row) => ({
                    date: row.pk_date.toISOString().slice(0, 10),
                    value: row.awake_stressDuration,
                })),
                smoothingWindow: 7,
                colorStart: "#f97316",
                colorEnd: "#c2410c",
            },
        ];
    }

    if (metric.key === "bodyBattery") {
        const rows = await prisma.bodyBattery.findMany({
            where: { userProfilePK },
            orderBy: { pk_date: "asc" },
            select: {
                pk_date: true,
                chargedValue: true,
                drainedValue: true,
                highest_statsValue: true,
                lowest_statsValue: true,
            },
        });

        return [
            {
                key: "body-battery-charged",
                title: "Body Battery Charged by Day",
                description:
                    "Daily charged amount reveals recovery quality and how well you refill energy reserves.",
                points: rows.map((row) => ({
                    date: row.pk_date.toISOString().slice(0, 10),
                    value: row.chargedValue,
                })),
                smoothingWindow: 7,
                colorStart: "#14b8a6",
                colorEnd: "#0f766e",
            },
            {
                key: "body-battery-drained",
                title: "Body Battery Drained by Day",
                description:
                    "Daily drained amount shows how demanding your days were and when depletion spikes.",
                points: rows.map((row) => ({
                    date: row.pk_date.toISOString().slice(0, 10),
                    value: row.drainedValue,
                })),
                smoothingWindow: 7,
                colorStart: "#0ea5e9",
                colorEnd: "#0369a1",
            },
            {
                key: "body-battery-span",
                title: "Body Battery Daily Range",
                description:
                    "The difference between highest and lowest body battery values indicates day-to-day volatility.",
                points: rows.map((row) => ({
                    date: row.pk_date.toISOString().slice(0, 10),
                    value:
                        row.highest_statsValue !== null &&
                        row.lowest_statsValue !== null
                            ? row.highest_statsValue - row.lowest_statsValue
                            : null,
                })),
                smoothingWindow: 7,
                colorStart: "#22d3ee",
                colorEnd: "#0891b2",
            },
        ];
    }

    const rows = await prisma.respiration.findMany({
        where: { userProfilePK },
        orderBy: { pk_date: "asc" },
        select: {
            pk_date: true,
            highestRespirationValue: true,
            lowestRespirationValue: true,
            avgWakingRespirationValue: true,
        },
    });

    return [
        {
            key: "respiration-highest",
            title: "Highest Respiration by Day",
            description:
                "Daily highest respiration values help identify days with unusually strong physiological load.",
            points: rows.map((row) => ({
                date: row.pk_date.toISOString().slice(0, 10),
                value: row.highestRespirationValue,
            })),
            smoothingWindow: 7,
            colorStart: "#16a34a",
            colorEnd: "#15803d",
        },
        {
            key: "respiration-lowest",
            title: "Lowest Respiration by Day",
            description:
                "Daily lowest respiration values show your calmer baseline and long-term recovery shifts.",
            points: rows.map((row) => ({
                date: row.pk_date.toISOString().slice(0, 10),
                value: row.lowestRespirationValue,
            })),
            smoothingWindow: 7,
            colorStart: "#22c55e",
            colorEnd: "#166534",
        },
        {
            key: "respiration-range",
            title: "Respiration Daily Range",
            description:
                "The gap between highest and lowest respiration values reflects day-level physiological variability.",
            points: rows.map((row) => ({
                date: row.pk_date.toISOString().slice(0, 10),
                value:
                    row.highestRespirationValue !== null &&
                    row.lowestRespirationValue !== null
                        ? row.highestRespirationValue -
                          row.lowestRespirationValue
                        : null,
            })),
            smoothingWindow: 7,
            colorStart: "#65a30d",
            colorEnd: "#3f6212",
        },
    ];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function averageInRange(points: MetricPoint[], start: Date, end: Date) {
    const values = points
        .filter((point) => {
            const date = new Date(point.date);
            return (
                !Number.isNaN(date.getTime()) && date >= start && date <= end
            );
        })
        .map((point) => point.value)
        .filter((value): value is number => value !== null);

    if (values.length === 0) {
        return null;
    }

    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function toValidSeries(points: MetricPoint[]) {
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
        .filter(
            (entry): entry is { time: number; value: number } => entry !== null,
        )
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
    const magnitudeText =
        Math.abs(percent) < 5
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
        return "Stress remains elevated in the long run, indicating a lasting increase.";
    }

    return "Stress remains lower in the long run, indicating a lasting decrease.";
}

function resolveDirection(
    percent: number,
    lowerIsBetter: boolean,
): "higher" | "lower" | "no meaningful change" {
    if (Math.abs(percent) < 5) {
        return "no meaningful change";
    }

    const improved = lowerIsBetter ? percent < 0 : percent > 0;
    return improved ? "lower" : "higher";
}

function analyzeEventImpact(
    points: MetricPoint[],
    events: ImportantEventMarker[],
    lowerIsBetter: boolean,
): EventImpactAnalysis[] {
    const dayMs = 24 * 60 * 60 * 1000;
    const series = toValidSeries(points);

    if (series.length < 20) {
        return [];
    }

    const allValues = series.map((entry) => entry.value);
    const fullMean =
        allValues.reduce((sum, value) => sum + value, 0) / allValues.length;
    const fullVariance =
        allValues.reduce((sum, value) => sum + (value - fullMean) ** 2, 0) /
        allValues.length;
    const fullStd = Math.sqrt(fullVariance);

    const analyses: EventImpactAnalysis[] = [];

    for (const event of events) {
        const startTime = new Date(
            `${event.startDate}T00:00:00.000Z`,
        ).getTime();
        const endTimeRaw = new Date(`${event.endDate}T00:00:00.000Z`).getTime();
        if (Number.isNaN(startTime)) {
            continue;
        }

        const anchorEndTime = Number.isNaN(endTimeRaw) ? startTime : endTimeRaw;

        const shortBeforeAvg = averageByTimeRange(
            series,
            startTime - 7 * dayMs,
            startTime - dayMs,
        );
        const shortAfterAvg = averageByTimeRange(
            series,
            anchorEndTime + dayMs,
            anchorEndTime + 7 * dayMs,
        );

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
                : baselineValues.reduce((sum, value) => sum + value, 0) /
                  baselineValues.length;

        const mediumPostAvg = averageByTimeRange(
            series,
            anchorEndTime,
            anchorEndTime + 30 * dayMs,
        );

        let mediumTerm: MediumHorizonResult | null = null;
        if (baselineAvg !== null && mediumPostAvg !== null) {
            const pct = percentageChange(baselineAvg, mediumPostAvg);
            if (pct !== null) {
                const zScore =
                    fullStd > 0 ? (mediumPostAvg - fullMean) / fullStd : null;
                mediumTerm = {
                    percentChange: Math.abs(pct),
                    direction: resolveDirection(pct, lowerIsBetter),
                    zScore,
                    interpretation: describeMediumTermChange(pct, zScore),
                };
            }
        }

        const longBeforeAvg = averageByTimeRange(
            series,
            startTime - 90 * dayMs,
            startTime - dayMs,
        );

        const longAfterValues = series
            .filter((entry) => entry.time >= anchorEndTime + 30 * dayMs)
            .map((entry) => entry.value);
        const longAfterAvg =
            longAfterValues.length === 0
                ? null
                : longAfterValues.reduce((sum, value) => sum + value, 0) /
                  longAfterValues.length;

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
            continue;
        }

        const meaningfulDirections = [shortTerm, mediumTerm, longTerm]
            .filter((result): result is HorizonResult => result !== null)
            .filter((result) => result.direction !== "no meaningful change")
            .map((result) => result.direction);

        const _hasConflictingSignals =
            meaningfulDirections.includes("higher") &&
            meaningfulDirections.includes("lower");

        analyses.push({
            eventId: event.id,
            eventName: event.name,
            shortTerm,
            mediumTerm,
            longTerm,
            hasConflictingSignals:
                meaningfulDirections.includes("higher") &&
                meaningfulDirections.includes("lower"),
        });
    }

    return analyses;
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

function calculateTrend(
    points: MetricPoint[],
    metric: MetricDescriptor,
): TrendSummary {
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

    const previousAvg =
        previous.reduce((sum, value) => sum + value, 0) / previous.length;
    const recentAvg =
        recent.reduce((sum, value) => sum + value, 0) / recent.length;
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

function MetricPanel({
    title,
    average,
    trend,
    hint,
    children,
}: MetricPanelProps) {
    const trendToneClass = {
        up: "bg-danger",
        down: "bg-success",
        flat: "bg-secondary",
    };

    return (
        <BSCard className="shadow-sm border-0 mb-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h2 className="h5 mb-0">{title}</h2>
                <p className="fs-5 fw-bold text-primary mb-0">
                    Average: {average}
                </p>
            </div>
            <div className="d-flex align-items-center gap-2 mb-3">
                <p className={`badge p-2 ${trendToneClass[trend.tone]}`}>
                    {trend.label}
                </p>
                <p className="fw-bold ms-2 mb-0">{trend.deltaText}</p>
            </div>
            <p className="text-muted small mb-4">{hint}</p>
            {children}
        </BSCard>
    );
}

type PrivateSlugPageProps = {
    params: Promise<{
        slug: string;
    }>;
};

export default async function PrivateSlugPage({
    params,
}: PrivateSlugPageProps) {
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
            <main className="min-vh-100 bg-light py-5">
                <div className="container">
                    <header className="mb-5">
                        <p className="text-uppercase text-primary fw-bold mb-1">
                            Private
                        </p>
                        <h1 className="display-5 fw-bold mb-3">Dashboard</h1>
                        <p className="lead text-muted">
                            Combined view of stress, body battery, and
                            respiration. Values are normalized so their lines
                            can be connected and compared on the same timeline.
                        </p>
                    </header>

                    <section className="row row-cols-1 row-cols-md-3 g-4 mb-5">
                        {METRICS.map((metric) => {
                            const oneYearPoints = getOneYearSubset(
                                series[metric.key],
                            );
                            const oneYearTrend = calculateTrend(
                                oneYearPoints,
                                metric,
                            );
                            const oneYearAverage = averageMetric(oneYearPoints);

                            return (
                                <BSCard
                                    key={metric.key}
                                    className="h-100 shadow-sm border-0 p-4 text-center"
                                >
                                    <p className="text-muted text-uppercase fw-bold small mb-2">
                                        {metric.label}
                                    </p>
                                    <p className="display-6 fw-bold mb-3">
                                        {oneYearAverage}
                                    </p>
                                    <p className="badge bg-light text-dark p-2">
                                        {oneYearTrend.label}
                                    </p>
                                </BSCard>
                            );
                        })}
                    </section>

                    <section className="d-flex flex-column gap-4">
                        <BSCard className="shadow-sm border-0 mb-4">
                            <h2 className="h5 mb-0">Combined Trend - 1 Year</h2>
                            <p className="text-muted small mb-4">
                                7-point smoothing with normalized values to
                                compare all three metrics together.
                            </p>
                            <CombinedChart
                                series={oneYearSeries}
                                chartLabel="Combined one-year trend"
                                smoothingWindow={7}
                                events={importantEvents}
                            />
                        </BSCard>

                        <BSCard className="shadow-sm border-0 mb-4">
                            <h2 className="h5 mb-0">
                                Combined Trend - All Time
                            </h2>
                            <p className="text-muted small mb-4">
                                21-point smoothing across full history with
                                connected lines for each metric.
                            </p>
                            <CombinedChart
                                series={allTimeSeries}
                                chartLabel="Combined all-time trend"
                                smoothingWindow={21}
                                events={importantEvents}
                            />
                        </BSCard>
                    </section>
                </div>
            </main>
        );
    }

    const metric = METRICS.find((item) => item.slug === slug);
    if (!metric) {
        notFound();
    }

    const allPoints = series[metric.key];
    const oneYearPoints = getOneYearSubset(allPoints);
    const additionalCharts = await getAdditionalCharts(metric, userProfilePK);

    const oneYearAverage = averageMetric(oneYearPoints);
    const allAverage = averageMetric(allPoints);

    const oneYearTrend = calculateTrend(oneYearPoints, metric);
    const allTrend = calculateTrend(allPoints, metric);
    const lowerIsBetter =
        metric.key === "stress" || metric.key === "respiration";
    const eventImpactAnalyses = analyzeEventImpact(
        allPoints,
        importantEvents,
        lowerIsBetter,
    );

    return (
        <main className="min-vh-100 bg-light py-5">
            <div className="container">
                <header className="mb-5">
                    <p className="text-uppercase text-primary fw-bold mb-1">
                        Private
                    </p>
                    <h1 className="display-5 fw-bold mb-3">{metric.label}</h1>
                    <p className="lead text-muted">
                        Dedicated {metric.label.toLowerCase()} page with two
                        large graphs for yearly and all-time analysis.
                    </p>
                </header>

                <section className="d-flex flex-column gap-4">
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

                    <BSCard className="shadow-sm border-0 mb-4">
                        <h2 className="h5 mb-0">Detailed Metric Graphs</h2>
                        <p className="text-muted small mb-4">
                            These extra charts break the metric into separate
                            dimensions so you can see daily dynamics, not only
                            the smoothed average trend.
                        </p>
                    </BSCard>

                    {additionalCharts.map((chart) => (
                        <BSCard
                            key={chart.key}
                            className="card shadow-sm border-0 mb-4"
                        >
                            <h2 className="h5 mb-0">{chart.title}</h2>
                            <p className="text-muted small mb-4">
                                {chart.description}
                            </p>
                            <MetricChart
                                points={chart.points}
                                metricLabel={`${metric.label} - ${chart.title}`}
                                smoothingWindow={chart.smoothingWindow}
                                colorStart={chart.colorStart}
                                colorEnd={chart.colorEnd}
                                events={importantEvents}
                            />
                        </BSCard>
                    ))}

                    <BSCard className="shadow-sm border-0 mb-4">
                        <h2 className="h5 mb-0">Event Impact</h2>
                        <p className="text-muted small mb-4">
                            Three-horizon analysis of{" "}
                            {metric.label.toLowerCase()} around each important
                            day. Small shifts under 5% are treated as potential
                            noise.
                        </p>

                        {eventImpactAnalyses.length === 0 ? (
                            <p className="text-muted fst-italic p-4 text-center border rounded">
                                Not enough {metric.label.toLowerCase()} data to
                                run short-, medium-, and long-term impact
                                analysis.
                            </p>
                        ) : (
                            <div className="d-flex flex-column gap-3">
                                {eventImpactAnalyses.map((analysis) => (
                                    <article
                                        key={analysis.eventId}
                                        className="p-3 border rounded bg-light"
                                    >
                                        <h3 className="h6 fw-bold mb-3">
                                            Event: {analysis.eventName}
                                        </h3>

                                        <p className="fw-bold small text-secondary mt-2 mb-1">
                                            Short-term:
                                        </p>
                                        {analysis.shortTerm ? (
                                            <>
                                                <p>
                                                    {metric.label} became{" "}
                                                    {
                                                        analysis.shortTerm
                                                            .direction
                                                    }{" "}
                                                    by{" "}
                                                    {analysis.shortTerm.percentChange.toFixed(
                                                        1,
                                                    )}
                                                    %.
                                                </p>
                                                <p>
                                                    Interpretation:{" "}
                                                    {
                                                        analysis.shortTerm
                                                            .interpretation
                                                    }
                                                </p>
                                            </>
                                        ) : (
                                            <p>
                                                Insufficient data for 7 days
                                                before or 7 days after the
                                                event.
                                            </p>
                                        )}

                                        <p className="fw-bold small text-secondary mt-2 mb-1">
                                            Medium-term:
                                        </p>
                                        {analysis.mediumTerm ? (
                                            <>
                                                <p>
                                                    {metric.label} was{" "}
                                                    {
                                                        analysis.mediumTerm
                                                            .direction
                                                    }{" "}
                                                    by{" "}
                                                    {analysis.mediumTerm.percentChange.toFixed(
                                                        1,
                                                    )}
                                                    % compared to baseline.
                                                </p>
                                                <p>
                                                    Z-score:{" "}
                                                    {analysis.mediumTerm
                                                        .zScore === null
                                                        ? "n/a"
                                                        : analysis.mediumTerm.zScore.toFixed(
                                                              2,
                                                          )}
                                                </p>
                                                <p>
                                                    Interpretation:{" "}
                                                    {
                                                        analysis.mediumTerm
                                                            .interpretation
                                                    }
                                                </p>
                                            </>
                                        ) : (
                                            <p>
                                                Insufficient baseline or 0-30
                                                day post-event data.
                                            </p>
                                        )}

                                        <p className="fw-bold small text-secondary mt-2 mb-1">
                                            Long-term:
                                        </p>
                                        {analysis.longTerm ? (
                                            <>
                                                <p>
                                                    {metric.label} is{" "}
                                                    {
                                                        analysis.longTerm
                                                            .direction
                                                    }{" "}
                                                    by{" "}
                                                    {analysis.longTerm.percentChange.toFixed(
                                                        1,
                                                    )}
                                                    %.
                                                </p>
                                                <p>
                                                    Interpretation:{" "}
                                                    {
                                                        analysis.longTerm
                                                            .interpretation
                                                    }
                                                </p>
                                            </>
                                        ) : (
                                            <p>
                                                Insufficient long-term windows
                                                for structural change analysis.
                                            </p>
                                        )}

                                        {analysis.hasConflictingSignals ? (
                                            <p className="alert alert-warning small mt-3 mb-0">
                                                Note: Signals conflict across
                                                time horizons, so the event may
                                                have mixed short-, medium-, and
                                                long-term effects.
                                            </p>
                                        ) : null}
                                    </article>
                                ))}
                            </div>
                        )}
                    </BSCard>
                </section>
            </div>
        </main>
    );
}
