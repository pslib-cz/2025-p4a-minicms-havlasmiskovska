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

function toDateLabel(value: Date) {
  return value.toISOString().slice(0, 10);
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
    select: { userProfilePK: true },
  });

  if (!user?.userProfilePK) {
    redirect("/register");
  }

  const events = await (prisma as any).importantEvent.findMany({
    where: { userProfilePK: user.userProfilePK },
    orderBy: { startDate: "desc" },
    select: {
      id: true,
      name: true,
      tags: true,
      expectedEffect: true,
      startDate: true,
      endDate: true,
    },
  });

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
            events.map((event: any) => (
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

                <div className={styles.tagsRow}>
                  {(event.tags as string[]).map((tag) => (
                    <span key={tag} className={styles.tag}>{tag}</span>
                  ))}
                </div>
              </article>
            ))
          )}
        </section>
      </section>
    </main>
  );
}
