import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import {
  buildCategoryConnectOrCreate,
  createUniqueEventSlug,
  validateEventPayload,
} from "@/lib/important-event-api";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

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

async function getOwnedEvent(id: string, userProfilePK: number) {
  const event = await prisma.importantEvent.findUnique({
    where: { id },
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

  if (!event) {
    return { ok: false as const, response: NextResponse.json({ error: "Event not found." }, { status: 404 }) };
  }

  if (event.userProfilePK !== userProfilePK) {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { ok: true as const, event };
}

export async function GET(_: NextRequest, context: RouteContext) {
  try {
    const auth = await getAuthenticatedUserProfilePK();
    if (!auth.ok) {
      return auth.response;
    }

    const { id } = await context.params;
    const owned = await getOwnedEvent(id, auth.userProfilePK);
    if (!owned.ok) {
      return owned.response;
    }

    return NextResponse.json({ data: owned.event });
  } catch (error) {
    console.error("Failed to fetch event detail:", error);
    return NextResponse.json({ error: "Failed to fetch event detail." }, { status: 500 });
  }
}

async function updateEvent(request: NextRequest, context: RouteContext, partial: boolean) {
  const auth = await getAuthenticatedUserProfilePK();
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  const owned = await getOwnedEvent(id, auth.userProfilePK);
  if (!owned.ok) {
    return owned.response;
  }

  const body = (await request.json()) as unknown;
  const validation = validateEventPayload(body, { partial });

  if (!validation.ok) {
    return NextResponse.json({ error: validation.message }, { status: 400 });
  }

  const payload = validation.value;

  const nextName = payload.name ?? payload.title ?? owned.event.name;
  const nextStartDate = payload.startDate ?? owned.event.startDate;
  const nextEndDate = payload.endDate ?? owned.event.endDate;

  if (nextEndDate.getTime() < nextStartDate.getTime()) {
    return NextResponse.json({ error: "endDate cannot be before startDate." }, { status: 400 });
  }

  let nextSlug = owned.event.slug;
  if (payload.slug) {
    nextSlug = payload.slug;
  } else if (payload.name || payload.title) {
    nextSlug = await createUniqueEventSlug(prisma, nextName, owned.event.id);
  }

  const nextTags = payload.tags ?? owned.event.tags;
  const categoryOps =
    payload.tags !== undefined
      ? {
          set: [],
          connectOrCreate: buildCategoryConnectOrCreate(nextTags),
        }
      : undefined;

  const updated = await prisma.importantEvent.update({
    where: { id: owned.event.id },
    data: {
      title: nextName,
      name: nextName,
      slug: nextSlug,
      publishDate: payload.publishDate ?? owned.event.publishDate,
      tags: nextTags,
      expectedEffect: payload.expectedEffect ?? owned.event.expectedEffect,
      visibility: payload.visibility ?? owned.event.visibility,
      descriptionHtml: payload.descriptionHtml ?? owned.event.descriptionHtml,
      startDate: nextStartDate,
      endDate: nextEndDate,
      ...(categoryOps ? { categories: categoryOps } : {}),
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

  return NextResponse.json({ data: updated });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    return await updateEvent(request, context, false);
  } catch (error) {
    console.error("Failed to update event:", error);
    return NextResponse.json({ error: "Failed to update event." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    return await updateEvent(request, context, true);
  } catch (error) {
    console.error("Failed to patch event:", error);
    return NextResponse.json({ error: "Failed to patch event." }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, context: RouteContext) {
  try {
    const auth = await getAuthenticatedUserProfilePK();
    if (!auth.ok) {
      return auth.response;
    }

    const { id } = await context.params;
    const owned = await getOwnedEvent(id, auth.userProfilePK);
    if (!owned.ok) {
      return owned.response;
    }

    await prisma.importantEvent.delete({
      where: { id: owned.event.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete event:", error);
    return NextResponse.json({ error: "Failed to delete event." }, { status: 500 });
  }
}
