import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import PublishedDaysList from "./published-days-list";

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
  return {
    title: "Published Important Days | MiniCMS",
    description: "Browse important days shared by the community",
    openGraph: {
      title: "Published Important Days",
      description: "Browse important days shared by the community",
      type: "website",
    },
    alternates: {
      canonical: `${baseUrl}/published-days`,
    },
  };
}

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
    <main className="min-vh-100 py-4 py-md-5 bg-light">
      <div className="container-xl">
        <header className="text-center mb-4 mb-md-5">
          <h1 className="display-5 fw-bold text-dark mb-2">Published Important Days</h1>
          <p className="lead text-secondary mb-0">
            Browse important days shared by the community
          </p>
        </header>

        <PublishedDaysList initialEvents={events} />
      </div>
    </main>
  );
}
