import { NextRequest, NextResponse } from "next/server";
import type { EventVisibility } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json() as {
      eventId: string;
      visibility: string;
    };

    const { eventId, visibility } = body;

    if (!eventId || !visibility) {
      return NextResponse.json(
        { error: "Missing eventId or visibility" },
        { status: 400 }
      );
    }

    const validVisibilities = ["PUBLISHED", "NOT_PUBLIC", "PRIVATE"];
    if (!validVisibilities.includes(visibility)) {
      return NextResponse.json(
        { error: "Invalid visibility value" },
        { status: 400 }
      );
    }

    const event = await prisma.importantEvent.findUnique({
      where: { id: eventId },
      select: { id: true },
    });

    if (!event) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    const updated = await prisma.importantEvent.update({
      where: { id: eventId },
      data: { visibility: visibility as EventVisibility },
      select: {
        id: true,
        visibility: true,
        name: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      event: updated,
    });
  } catch (error) {
    console.error("Failed to update event visibility:", error);
    return NextResponse.json(
      { error: "Failed to update event visibility" },
      { status: 500 }
    );
  }
}
