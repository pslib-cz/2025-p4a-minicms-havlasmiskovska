import type {
  EventImpact,
  EventVisibility,
  Prisma,
} from "@prisma/client";

const VALID_VISIBILITIES: EventVisibility[] = ["PUBLISHED", "NOT_PUBLIC", "PRIVATE"];
const VALID_IMPACTS: EventImpact[] = ["POSITIVE", "NEGATIVE"];

export type EventPayload = {
  name?: string;
  title?: string;
  slug?: string;
  publishDate?: Date;
  tags?: string[];
  expectedEffect?: EventImpact;
  visibility?: EventVisibility;
  descriptionHtml?: string;
  startDate?: Date;
  endDate?: Date;
};

export type ValidationResult =
  | { ok: true; value: EventPayload }
  | { ok: false; message: string };

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function htmlToText(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function parseDateField(raw: unknown, fieldName: string): Date | { error: string } {
  if (typeof raw !== "string") {
    return { error: `${fieldName} must be a string date value.` };
  }

  const value = raw.trim();
  if (!value) {
    return { error: `${fieldName} cannot be empty.` };
  }

  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00.000Z`)
    : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return { error: `${fieldName} is not a valid date.` };
  }

  return parsed;
}

function parseTags(raw: unknown): string[] | { error: string } {
  if (raw === undefined) {
    return [];
  }

  if (Array.isArray(raw)) {
    const normalized = raw
      .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
      .filter((tag) => tag.length > 0);

    return [...new Set(normalized)];
  }

  if (typeof raw === "string") {
    const normalized = raw
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    return [...new Set(normalized)];
  }

  return { error: "tags must be an array of strings or comma-separated string." };
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function createUniqueEventSlug(
  prisma: {
    importantEvent: {
      findUnique(args: { where: { slug: string }; select: { id: true } }): Promise<{ id: string } | null>;
    };
  },
  title: string,
  excludedId?: string,
) {
  const base = slugify(title) || "event";

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const suffix = attempt === 0 ? "" : `-${Math.random().toString(36).slice(2, 7)}`;
    const candidate = `${base}${suffix}`;

    const existing = await prisma.importantEvent.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!existing || existing.id === excludedId) {
      return candidate;
    }
  }

  return `${base}-${Date.now()}`;
}

export function buildCategoryConnectOrCreate(tags: string[]): Prisma.CategoryCreateOrConnectWithoutEventsInput[] {
  return tags.map((tag) => {
    const normalized = slugify(tag) || "category";
    return {
      where: { slug: normalized },
      create: {
        name: tag,
        slug: normalized,
      },
    };
  });
}

export function validateEventPayload(raw: unknown, options?: { partial?: boolean }): ValidationResult {
  const partial = options?.partial ?? false;

  if (!isObject(raw)) {
    return { ok: false, message: "Body must be a JSON object." };
  }

  const out: EventPayload = {};

  if ("name" in raw) {
    if (typeof raw.name !== "string" || !raw.name.trim()) {
      return { ok: false, message: "name must be a non-empty string." };
    }
    out.name = raw.name.trim();
    out.title = raw.name.trim();
  }

  if ("title" in raw && !out.name) {
    if (typeof raw.title !== "string" || !raw.title.trim()) {
      return { ok: false, message: "title must be a non-empty string." };
    }
    out.title = raw.title.trim();
    out.name = raw.title.trim();
  }

  if (!partial && !out.name) {
    return { ok: false, message: "name is required." };
  }

  if ("descriptionHtml" in raw) {
    if (typeof raw.descriptionHtml !== "string") {
      return { ok: false, message: "descriptionHtml must be a string." };
    }

    const cleaned = raw.descriptionHtml.trim();
    if (htmlToText(cleaned).length < 5) {
      return { ok: false, message: "descriptionHtml must contain at least 5 characters of text." };
    }

    out.descriptionHtml = cleaned;
  }

  if (!partial && !out.descriptionHtml) {
    return { ok: false, message: "descriptionHtml is required." };
  }

  if ("startDate" in raw) {
    const parsed = parseDateField(raw.startDate, "startDate");
    if ("error" in parsed) {
      return { ok: false, message: parsed.error };
    }
    out.startDate = parsed;
  }

  if ("endDate" in raw) {
    const parsed = parseDateField(raw.endDate, "endDate");
    if ("error" in parsed) {
      return { ok: false, message: parsed.error };
    }
    out.endDate = parsed;
  }

  if (!partial && !out.startDate) {
    return { ok: false, message: "startDate is required." };
  }

  if (!partial && !out.endDate && out.startDate) {
    out.endDate = out.startDate;
  }

  if (out.startDate && out.endDate && out.endDate.getTime() < out.startDate.getTime()) {
    return { ok: false, message: "endDate cannot be before startDate." };
  }

  if ("publishDate" in raw) {
    const parsed = parseDateField(raw.publishDate, "publishDate");
    if ("error" in parsed) {
      return { ok: false, message: parsed.error };
    }
    out.publishDate = parsed;
  }

  if ("tags" in raw) {
    const parsedTags = parseTags(raw.tags);
    if (!Array.isArray(parsedTags)) {
      return { ok: false, message: parsedTags.error };
    }
    out.tags = parsedTags;
  }

  if (!partial && !out.tags) {
    out.tags = [];
  }

  if ("expectedEffect" in raw) {
    if (typeof raw.expectedEffect !== "string" || !VALID_IMPACTS.includes(raw.expectedEffect as EventImpact)) {
      return { ok: false, message: "expectedEffect must be POSITIVE or NEGATIVE." };
    }
    out.expectedEffect = raw.expectedEffect as EventImpact;
  }

  if (!partial && !out.expectedEffect) {
    out.expectedEffect = "NEGATIVE";
  }

  if ("visibility" in raw) {
    if (typeof raw.visibility !== "string" || !VALID_VISIBILITIES.includes(raw.visibility as EventVisibility)) {
      return { ok: false, message: "visibility must be one of PUBLISHED, NOT_PUBLIC, PRIVATE." };
    }
    out.visibility = raw.visibility as EventVisibility;
  }

  if (!partial && !out.visibility) {
    out.visibility = "NOT_PUBLIC";
  }

  if ("slug" in raw) {
    if (typeof raw.slug !== "string") {
      return { ok: false, message: "slug must be a string when provided." };
    }

    const normalized = slugify(raw.slug);
    if (!normalized) {
      return { ok: false, message: "slug must contain at least one alphanumeric character." };
    }

    out.slug = normalized;
  }

  if (partial && Object.keys(out).length === 0) {
    return { ok: false, message: "No valid fields were provided for update." };
  }

  return { ok: true, value: out };
}
