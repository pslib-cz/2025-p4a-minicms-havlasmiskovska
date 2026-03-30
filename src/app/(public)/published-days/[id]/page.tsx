import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export async function generateMetadata(
  { params }: PublishedDayDetailPageProps
): Promise<Metadata> {
  const { id } = await params;
  const event = await prisma.importantEvent.findUnique({
    where: { id },
    select: { name: true, descriptionHtml: true, startDate: true, tags: true, visibility: true }
  });

  if (!event || event.visibility !== "PUBLISHED") {
    return { title: "Not Found" };
  }

  const plainTextDescription = event.descriptionHtml.replace(/<[^>]*>?/gm, '').substring(0, 150) + "...";

  return {
    title: event.name,
    description: plainTextDescription,
    openGraph: {
      title: event.name,
      description: plainTextDescription,
      type: "article",
      publishedTime: event.startDate.toISOString(),
      tags: event.tags,
    },
    alternates: {
      canonical: `/published-days/${id}`,
    },
  };
}

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
    <main className="min-vh-100 py-4 py-md-5 bg-light">
      <div className="container">
        <div className="row justify-content-center">
        <div className="col-12 col-lg-8">

        <Link href="/published-days" className="btn btn-outline-secondary btn-sm mb-4">
          ← Back to Published Days
        </Link>

        <header className="mb-4">
          <h1 className="display-6 fw-bold text-dark mb-1">{event.name}</h1>
          <p className="text-muted mb-0">
            {toDateLabel(event.startDate)}
            {toDateLabel(event.startDate) !== toDateLabel(event.endDate)
              ? ` – ${toDateLabel(event.endDate)}`
              : ""}
          </p>
        </header>

        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body">
            <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
              <span className="fw-semibold text-dark">Expected impact:</span>
              <span className={`badge bg-${event.expectedEffect === "POSITIVE" ? "success" : "danger"}`}>
                {event.expectedEffect === "POSITIVE" ? "Positive" : "Negative"}
              </span>
            </div>

            {event.user.name && (
              <p className="mb-3">
                <span className="fw-semibold text-dark">Shared by:</span>{" "}
                <span className="text-muted">{event.user.name}</span>
              </p>
            )}

            {event.tags.length > 0 && (
              <div className="d-flex flex-wrap gap-2">
                {event.tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/published-days?tags=${encodeURIComponent(tag)}`}
                    className="badge bg-info text-dark fw-normal text-decoration-none px-2 py-1"
                  >
                    {tag}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card border-0 shadow-sm">
          <div className="card-body p-3 p-md-4">
            <h2 className="h5 fw-semibold border-bottom pb-2 mb-3">What Happened</h2>
            <div
              className="text-secondary lh-lg"
              dangerouslySetInnerHTML={{ __html: event.descriptionHtml }}
            />
          </div>
        </div>

        </div>
        </div>
      </div>
    </main>
  );
}
