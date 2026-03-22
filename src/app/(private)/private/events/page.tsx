import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import styles from "./events.module.css";

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

  const stressInsightByEventId = new Map<string, MetricInsight>();
  const respirationInsightByEventId = new Map<string, MetricInsight>();
  const bodyBatteryInsightByEventId = new Map<string, MetricInsight>();

  for (const event of events) {
    const stressInsight = computeMetricInsight(event, stressPoints, true);
    const respirationInsight = computeMetricInsight(event, respirationPoints, true);
    const bodyBatteryInsight = computeMetricInsight(event, bodyBatteryPoints, false);

    if (stressInsight) {
      stressInsightByEventId.set(event.id, stressInsight);
    }

    if (respirationInsight) {
      respirationInsightByEventId.set(event.id, respirationInsight);
    }

    if (bodyBatteryInsight) {
      bodyBatteryInsightByEventId.set(event.id, bodyBatteryInsight);
    }
  }

  const resolvedSearchParams = (await searchParams) ?? {};

  return (
    <main className={styles.page}>
      <section className={styles.container}>
        <header className={styles.header}>
          <p className={styles.kicker}>Important Days</p>
          <h1 className={styles.title}>Events</h1>
          <p className={styles.subtitle}>
            Create events that may affect your stress, respiration, or body battery trends.
          </p>
        </header>

        {resolvedSearchParams.success === "1" ? (
          <p className={styles.successBox}>Event saved successfully.</p>
        ) : null}

        <Link href="/private/events/new" className={styles.createButton}>
          Create Important Day
        </Link>

        <section className={styles.list}>
          {events.length === 0 ? (
            <p className={styles.emptyState}>No important days yet.</p>
          ) : (
            events.map((event) => (
              <article key={event.id} className={styles.card}>
                <div className={styles.cardTop}>
                  <h2 className={styles.cardTitle}>{event.name}</h2>
                  <span className={event.expectedEffect === "POSITIVE" ? styles.positive : styles.negative}>
                    {event.expectedEffect === "POSITIVE" ? "Positive" : "Negative"}
                  </span>
                </div>

                <p className={styles.dateText}>
                  {toDateLabel(event.startDate)}
                  {toDateLabel(event.startDate) !== toDateLabel(event.endDate)
                    ? ` - ${toDateLabel(event.endDate)}`
                    : ""}
                </p>

                {stressInsightByEventId.has(event.id) ? (
                  <p className={styles.stressInsight}>
                    Your stress has got {stressInsightByEventId.get(event.id)?.trend} by {" "}
                    {stressInsightByEventId.get(event.id)?.percent.toFixed(1)}% from this day.
                  </p>
                ) : (
                  <p className={styles.stressInsightMuted}>
                    Not enough nearby stress data to calculate change from this day.
                  </p>
                )}

                {bodyBatteryInsightByEventId.has(event.id) ? (
                  <p className={styles.stressInsight}>
                    Your body battery has got {bodyBatteryInsightByEventId.get(event.id)?.trend} by {" "}
                    {bodyBatteryInsightByEventId.get(event.id)?.percent.toFixed(1)}% from this day.
                  </p>
                ) : (
                  <p className={styles.stressInsightMuted}>
                    Not enough nearby body battery data to calculate change from this day.
                  </p>
                )}

                {respirationInsightByEventId.has(event.id) ? (
                  <p className={styles.stressInsight}>
                    Your respiration has got {respirationInsightByEventId.get(event.id)?.trend} by {" "}
                    {respirationInsightByEventId.get(event.id)?.percent.toFixed(1)}% from this day.
                  </p>
                ) : (
                  <p className={styles.stressInsightMuted}>
                    Not enough nearby respiration data to calculate change from this day.
                  </p>
                )}

                <div className={styles.tagsRow}>
                  {(event.tags as string[]).map((tag) => (
                    <span key={tag} className={styles.tag}>{tag}</span>
                  ))}
                </div>

                <Link href={`/private/events/${event.id}`} className={styles.detailLink}>
                  View Details
                </Link>
              </article>
            ))
          )}
        </section>
      </section>
    </main>
  );
}
