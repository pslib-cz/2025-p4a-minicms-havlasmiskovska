import { NextRequest, NextResponse } from "next/server";
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

async function getEvent(id: string) {
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

  return { ok: true as const, event };
}

export async function GET(_: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const result = await getEvent(id);
    if (!result.ok) {
      return result.response;
    }

    return NextResponse.json({ data: result.event });
  } catch (error) {
    console.error("Failed to fetch event detail:", error);
    return NextResponse.json({ error: "Failed to fetch event detail." }, { status: 500 });
  }
}

async function updateEvent(request: NextRequest, context: RouteContext, partial: boolean) {
  const { id } = await context.params;
  const result = await getEvent(id);
  if (!result.ok) {
    return result.response;
  }

  const body = (await request.json()) as unknown;
  const validation = validateEventPayload(body, { partial });

  if (!validation.ok) {
    return NextResponse.json({ error: validation.message }, { status: 400 });
  }

  const payload = validation.value;

  const nextName = payload.name ?? payload.title ?? result.event.name;
  const nextStartDate = payload.startDate ?? result.event.startDate;
  const nextEndDate = payload.endDate ?? result.event.endDate;

  if (nextEndDate.getTime() < nextStartDate.getTime()) {
    return NextResponse.json({ error: "endDate cannot be before startDate." }, { status: 400 });
  }

  let nextSlug = result.event.slug;
  if (payload.slug) {
    nextSlug = payload.slug;
  } else if (payload.name || payload.title) {
    nextSlug = await createUniqueEventSlug(prisma, nextName, result.event.id);
  }

  const nextTags = payload.tags ?? result.event.tags;
  const categoryOps =
    payload.tags !== undefined
      ? {
          set: [],
          connectOrCreate: buildCategoryConnectOrCreate(nextTags),
        }
      : undefined;

  const updated = await prisma.importantEvent.update({
    where: { id: result.event.id },
    data: {
      title: nextName,
      name: nextName,
      slug: nextSlug,
      publishDate: payload.publishDate ?? result.event.publishDate,
      tags: nextTags,
      expectedEffect: payload.expectedEffect ?? result.event.expectedEffect,
      visibility: payload.visibility ?? result.event.visibility,
      descriptionHtml: payload.descriptionHtml ?? result.event.descriptionHtml,
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
    const { id } = await context.params;
    const result = await getEvent(id);
    if (!result.ok) {
      return result.response;
    }

    await prisma.importantEvent.delete({
      where: { id: result.event.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete event:", error);
    return NextResponse.json({ error: "Failed to delete event." }, { status: 500 });
  }
}
