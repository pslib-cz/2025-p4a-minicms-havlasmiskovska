import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import type { EventVisibility, Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import {
  buildCategoryConnectOrCreate,
  createUniqueEventSlug,
  validateEventPayload,
} from "@/lib/important-event-api";
import { prisma } from "@/lib/prisma";

async function getAuthenticatedUserProfilePK() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;

  if (!email) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { userProfilePK: true },
  });

  if (!user?.userProfilePK) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "User profile is not initialized." }, { status: 403 }),
    };
  }

  return { ok: true as const, userProfilePK: user.userProfilePK };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUserProfilePK();
    if (!auth.ok) {
      return auth.response;
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(Number.parseInt(searchParams.get("page") ?? "1", 10) || 1, 1);
    const pageSize = Math.min(
      Math.max(Number.parseInt(searchParams.get("pageSize") ?? "20", 10) || 20, 1),
      100,
    );
    const search = (searchParams.get("search") ?? "").trim();
    const visibilityRaw = (searchParams.get("visibility") ?? "").trim();
    const visibility: EventVisibility | null =
      visibilityRaw === "PUBLISHED" || visibilityRaw === "NOT_PUBLIC" || visibilityRaw === "PRIVATE"
        ? visibilityRaw
        : null;

    const where: Prisma.ImportantEventWhereInput = {
      userProfilePK: auth.userProfilePK,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { title: { contains: search, mode: "insensitive" as const } },
              { tags: { has: search } },
            ],
          }
        : {}),
      ...(visibility ? { visibility } : {}),
    };

    const [total, events] = await Promise.all([
      prisma.importantEvent.count({ where }),
      prisma.importantEvent.findMany({
        where,
        orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          categories: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      }),
    ]);

    return NextResponse.json({
      data: events,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Failed to list events:", error);
    return NextResponse.json({ error: "Failed to list events." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUserProfilePK();
    if (!auth.ok) {
      return auth.response;
    }

    const body = (await request.json()) as unknown;
    const validation = validateEventPayload(body, { partial: false });

    if (!validation.ok) {
      return NextResponse.json({ error: validation.message }, { status: 400 });
    }

    const payload = validation.value;
    const eventName = payload.name ?? payload.title;
    const startDate = payload.startDate;
    const endDate = payload.endDate ?? startDate;

    if (!eventName || !startDate || !endDate || !payload.descriptionHtml) {
      return NextResponse.json({ error: "Missing required event fields." }, { status: 400 });
    }

    const slug = payload.slug ?? (await createUniqueEventSlug(prisma, eventName));

    const created = await prisma.importantEvent.create({
      data: {
        userProfilePK: auth.userProfilePK,
        title: eventName,
        name: eventName,
        slug,
        publishDate: payload.publishDate ?? startDate,
        tags: payload.tags ?? [],
        expectedEffect: payload.expectedEffect ?? "NEGATIVE",
        visibility: payload.visibility ?? "NOT_PUBLIC",
        descriptionHtml: payload.descriptionHtml,
        startDate,
        endDate,
        categories: {
          connectOrCreate: buildCategoryConnectOrCreate(payload.tags ?? []),
        },
      },
      include: {
        categories: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    console.error("Failed to create event:", error);
    return NextResponse.json({ error: "Failed to create event." }, { status: 500 });
  }
}
