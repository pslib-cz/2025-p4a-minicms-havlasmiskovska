import { prisma } from "@/lib/prisma";
import PublishedDaysList from "./published-days-list";
import styles from "./published-days.module.css";

export const dynamic = "force-dynamic";

async function getAllPublishedEvents() {
  try {
    const events = await prisma.importantEvent.findMany({
      where: { visibility: "PUBLISHED" },
      orderBy: { startDate: "desc" },
      select: {
        id: true,
        name: true,
        tags: true,
        expectedEffect: true,
        descriptionHtml: true,
        startDate: true,
        endDate: true,
        user: {
          select: {
            name: true,
          },
        },
      },
    });

    return events;
  } catch (error) {
    console.warn("published-days: DB unavailable, returning empty list", error);
    return [];
  }
}

export default async function PublishedDaysPage() {
  const events = await getAllPublishedEvents();

  return (
    <main className={styles.page}>
      <section className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>Published Important Days</h1>
          <p className={styles.subtitle}>
            Browse important days shared by the community
          </p>
        </header>

        <PublishedDaysList initialEvents={events} />
      </section>
    </main>
  );
}
