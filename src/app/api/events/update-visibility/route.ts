import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import type { EventVisibility } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { userProfilePK: true },
    });

    if (!user?.userProfilePK) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

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

    // Verify the event belongs to the user
    const event = await prisma.importantEvent.findUnique({
      where: { id: eventId },
      select: { userProfilePK: true },
    });

    if (!event || event.userProfilePK !== user.userProfilePK) {
      return NextResponse.json(
        { error: "Event not found or does not belong to user" },
        { status: 403 }
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
