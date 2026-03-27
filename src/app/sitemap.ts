import { MetadataRoute } from 'next'
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";

  const publishedEvents = await prisma.importantEvent.findMany({
    where: { visibility: "PUBLISHED" },
    select: { id: true, updatedAt: true },
  });

  const eventEntries: MetadataRoute.Sitemap = publishedEvents.map((event) => ({
    url: `${baseUrl}/published-days/${event.id}`,
    lastModified: event.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 1,
    },
    {
      url: `${baseUrl}/published-days`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    ...eventEntries,
  ]
}
