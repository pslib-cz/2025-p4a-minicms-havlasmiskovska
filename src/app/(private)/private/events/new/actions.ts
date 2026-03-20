"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ImportantEventCreateData = {
  userProfilePK: number;
  name: string;
  tags: string[];
  expectedEffect: "POSITIVE" | "NEGATIVE";
  descriptionHtml: string;
  startDate: Date;
  endDate: Date;
};

type PrismaWithImportantEventCreate = {
  importantEvent: {
    create: (args: { data: ImportantEventCreateData }) => Promise<unknown>;
  };
};

function parseTags(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

function parseDate(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return null;
  }

  const parsed = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function htmlToText(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export async function createImportantEvent(formData: FormData) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;

  if (!email) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { userProfilePK: true },
  });

  if (!user?.userProfilePK) {
    redirect("/register");
  }

  const name = String(formData.get("name") ?? "").trim();
  const tags = parseTags(formData.get("tags"));
  const expectedEffect = String(formData.get("expectedEffect") ?? "NEGATIVE") === "POSITIVE"
    ? "POSITIVE"
    : "NEGATIVE";

  const startDate = parseDate(formData.get("startDate"));
  const endDate = parseDate(formData.get("endDate")) ?? startDate;
  const descriptionHtml = String(formData.get("descriptionHtml") ?? "").trim();

  if (!name || !startDate || !endDate) {
    redirect("/private/events/new?error=InvalidInput");
  }

  if (endDate.getTime() < startDate.getTime()) {
    redirect("/private/events/new?error=InvalidRange");
  }

  if (htmlToText(descriptionHtml).length < 5) {
    redirect("/private/events/new?error=EmptyDescription");
  }

  const prismaWithImportantEvents = prisma as unknown as PrismaWithImportantEventCreate;
  await prismaWithImportantEvents.importantEvent.create({
    data: {
      userProfilePK: user.userProfilePK,
      name,
      tags,
      expectedEffect,
      descriptionHtml,
      startDate,
      endDate,
    },
  });

  revalidatePath("/private/dashboard");
  revalidatePath("/private/stress");
  revalidatePath("/private/body-battery");
  revalidatePath("/private/respiration");
  revalidatePath("/private/events");
  redirect("/private/events?success=1");
}
