import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import styles from "./published-day-detail.module.css";

type PublishedDayDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function toDateLabel(value: Date) {
  const d = value instanceof Date ? value : new Date(value);
  return d.toISOString().slice(0, 10);
}

export default async function PublishedDayDetailPage({ params }: PublishedDayDetailPageProps) {
  const { id } = await params;

  const event = await prisma.importantEvent.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      tags: true,
      expectedEffect: true,
      descriptionHtml: true,
      startDate: true,
      endDate: true,
      createdAt: true,
      visibility: true,
      user: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!event || event.visibility !== "PUBLISHED") {
    notFound();
  }

  return (
    <main className={styles.page}>
      <section className={styles.container}>
        <Link href="/published-days" className={styles.backLink}>
          ← Back to Published Days
        </Link>

        <header className={styles.header}>
          <h1 className={styles.title}>{event.name}</h1>
          <p className={styles.date}>
            {toDateLabel(event.startDate)}
            {toDateLabel(event.startDate) !== toDateLabel(event.endDate)
              ? ` - ${toDateLabel(event.endDate)}`
              : ""}
          </p>
        </header>

        <section className={styles.metaCard}>
          <p className={styles.metaRow}>
            <span className={styles.metaLabel}>Expected impact:</span>{" "}
            <span className={event.expectedEffect === "POSITIVE" ? styles.positive : styles.negative}>
              {event.expectedEffect === "POSITIVE" ? "Positive" : "Negative"}
            </span>
          </p>

          {event.user.name && (
            <p className={styles.metaRow}>
              <span className={styles.metaLabel}>Shared by:</span> {event.user.name}
            </p>
          )}

          {event.tags.length > 0 && (
            <div className={styles.tagsRow}>
              {event.tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/published-days?tags=${encodeURIComponent(tag)}`}
                  className={styles.tag}
                >
                  {tag}
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className={styles.contentCard}>
          <h2 className={styles.sectionTitle}>What Happened</h2>
          <div className={styles.richText} dangerouslySetInnerHTML={{ __html: event.descriptionHtml }} />
        </section>
      </section>
    </main>
  );
}
