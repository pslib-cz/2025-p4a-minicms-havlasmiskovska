"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { EventVisibility } from "@prisma/client";

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

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function createUniqueEventSlug(title: string) {
  const base = slugify(title) || "event";

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const suffix = attempt === 0 ? "" : `-${Math.random().toString(36).slice(2, 7)}`;
    const candidate = `${base}${suffix}`;

    const existing = await prisma.importantEvent.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }
  }

  return `${base}-${Date.now()}`;
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
  const visibility = String(formData.get("visibility") ?? "NOT_PUBLIC");
  const validVisibilities = ["PUBLISHED", "NOT_PUBLIC", "PRIVATE"];
  const finalVisibility = validVisibilities.includes(visibility) ? visibility : "NOT_PUBLIC";

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

  const slug = await createUniqueEventSlug(name);
  const categoryConnectOrCreate = tags.map((tag) => {
    const normalized = slugify(tag) || "category";
    return {
      where: { slug: normalized },
      create: {
        name: tag,
        slug: normalized,
      },
    };
  });

  await prisma.user.update({
    where: { userProfilePK: user.userProfilePK },
    data: {
      importantEvents: {
        create: {
          title: name,
          name,
          slug,
          publishDate: startDate,
          tags,
          expectedEffect,
          visibility: finalVisibility as EventVisibility,
          descriptionHtml,
          startDate,
          endDate,
          categories: {
            connectOrCreate: categoryConnectOrCreate,
          },
        },
      },
    },
  });

  revalidatePath("/private/dashboard");
  revalidatePath("/private/stress");
  revalidatePath("/private/body-battery");
  revalidatePath("/private/respiration");
  revalidatePath("/private/events");
  redirect("/private/events?success=1");
}
