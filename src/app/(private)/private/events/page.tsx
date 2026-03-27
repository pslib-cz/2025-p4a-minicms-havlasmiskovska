import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import ClientEventsView from "./ClientEventsView";

type EventsPageProps = {
  searchParams?: Promise<{
    success?: string;
  }>;
};

type ImportantEventRow = {
  id: string;
  name: string;
  tags: string[];
  expectedEffect: "POSITIVE" | "NEGATIVE";
  startDate: Date;
  endDate: Date;
  descriptionHtml: string;
};

type StressRow = {
  pk_date: Date;
  awake_averageStressLevel: number | null;
};

type MetricPoint = {
  date: Date;
  value: number | null;
};

type MetricInsight = {
  trend: "better" | "worsen";
  percent: number;
};

function toDateLabel(value: Date) {
  return value.toISOString().slice(0, 10);
}

function averageInRange(points: MetricPoint[], start: Date, end: Date) {
  const values = points
    .filter((point) => {
      const date = point.date;
      return date >= start && date <= end;
    })
    .map((point) => point.value)
    .filter((value): value is number => value !== null);

  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function computeMetricInsight(
  event: ImportantEventRow,
  points: MetricPoint[],
  lowerIsBetter: boolean,
): MetricInsight | null {
  const beforeEnd = new Date(event.startDate);
  beforeEnd.setUTCDate(beforeEnd.getUTCDate() - 1);

  const beforeStart = new Date(beforeEnd);
  beforeStart.setUTCDate(beforeStart.getUTCDate() - 6);

  const afterStart = new Date(event.endDate);
  afterStart.setUTCDate(afterStart.getUTCDate() + 1);

  const afterEnd = new Date(afterStart);
  afterEnd.setUTCDate(afterEnd.getUTCDate() + 6);

  const beforeAvg = averageInRange(points, beforeStart, beforeEnd);
  const afterAvg = averageInRange(points, afterStart, afterEnd);

  if (beforeAvg === null || afterAvg === null || beforeAvg === 0) {
    return null;
  }

  const deltaPercent = ((afterAvg - beforeAvg) / Math.abs(beforeAvg)) * 100;
  const improved = lowerIsBetter ? deltaPercent <= 0 : deltaPercent >= 0;

  return {
    trend: improved ? "better" : "worsen",
    percent: Math.abs(deltaPercent),
  };
}

export default async function EventsPage({ searchParams }: EventsPageProps) {
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
        orderBy: { startDate: "desc" },
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

  const events: ImportantEventRow[] = user.importantEvents;

  const stressRows: StressRow[] = await prisma.stress.findMany({
    where: { userProfilePK: user.userProfilePK },
    orderBy: { pk_date: "asc" },
    select: {
      pk_date: true,
      awake_averageStressLevel: true,
    },
  });

  const [respirationRows, bodyBatteryRows] = await Promise.all([
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

  const stressPoints: MetricPoint[] = stressRows.map((row) => ({
    date: row.pk_date,
    value: row.awake_averageStressLevel,
  }));

  const respirationPoints: MetricPoint[] = respirationRows.map((row) => ({
    date: row.pk_date,
    value: row.avgWakingRespirationValue,
  }));

  const bodyBatteryPoints: MetricPoint[] = bodyBatteryRows.map((row) => ({
    date: row.pk_date,
    value:
      row.highest_statsValue ??
      row.sleepend_statsValue ??
      row.sleepstart_statsValue ??
      row.chargedValue,
  }));

  const stressInsightMap: Record<string, MetricInsight> = {};
  const respirationInsightMap: Record<string, MetricInsight> = {};
  const bodyBatteryInsightMap: Record<string, MetricInsight> = {};

  for (const event of events) {
    const stressInsight = computeMetricInsight(event, stressPoints, true);
    const respirationInsight = computeMetricInsight(event, respirationPoints, true);
    const bodyBatteryInsight = computeMetricInsight(event, bodyBatteryPoints, false);

    if (stressInsight) stressInsightMap[event.id] = stressInsight;
    if (respirationInsight) respirationInsightMap[event.id] = respirationInsight;
    if (bodyBatteryInsight) bodyBatteryInsightMap[event.id] = bodyBatteryInsight;
  }

  const resolvedSearchParams = (await searchParams) ?? {};

  return (
    <main className="min-vh-100 bg-light py-5">
      {resolvedSearchParams.success === "1" && (
        <div className="container mb-3">
          <div className="alert alert-success fw-bold">Event saved successfully.</div>
        </div>
      )}
      <ClientEventsView 
        events={events}
        stressInsights={stressInsightMap}
        respirationInsights={respirationInsightMap}
        bodyBatteryInsights={bodyBatteryInsightMap}
      />
    </main>
  );
}
