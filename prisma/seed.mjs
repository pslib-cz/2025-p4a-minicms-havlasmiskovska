import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { PrismaClient } from "@prisma/client";

const { Pool } = pg;

function resolveConnectionString() {
  const explicitUrl = process.env.DATABASE_URL;
  let url = explicitUrl;
  if (!url) {
    const user = process.env.POSTGRES_USER;
    const password = process.env.POSTGRES_PASSWORD;
    const db = process.env.POSTGRES_DB;
    const host = process.env.POSTGRES_HOST ?? "127.0.0.1";
    const port = process.env.POSTGRES_PORT_HOST ?? "5434";
    if (user && password && db) {
      url = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${db}?schema=public`;
    }
  }
  if (!url) {
    throw new Error("DATABASE_URL is not set and could not be derived from POSTGRES_* variables.");
  }
  if (process.platform === "linux" && url.includes("host.docker.internal")) {
    return url.replace(/host\.docker\.internal/g, "127.0.0.1");
  }
  return url;
}

const connectionString = resolveConnectionString();
const adapter = new PrismaPg(new Pool({ connectionString }));
const prisma = new PrismaClient({ adapter, log: ["error", "warn"] });

// ── Demo user ──────────────────────────────────────────────────────────────
const DEMO_USER = {
  name: "John Doe",
  userProfilePK: 100000001,
};

const DEMO_EVENTS = [
  {
    title: "Started Morning Runs",
    slug: "started-morning-runs-2024-03-01",
    startDate: "2024-03-01",
    endDate: "2024-03-01",
    tags: ["fitness", "routine"],
    expectedEffect: "POSITIVE",
    visibility: "PUBLISHED",
    descriptionHtml: "<p>Started a consistent morning running routine. 5K every day before work.</p>",
  },
  {
    title: "Work Project Deadline",
    slug: "work-project-deadline-2024-06-15",
    startDate: "2024-06-15",
    endDate: "2024-06-22",
    tags: ["work", "stress"],
    expectedEffect: "NEGATIVE",
    visibility: "PUBLISHED",
    descriptionHtml: "<p>Major project deadline with intense overtime and pressure from management.</p>",
  },
  {
    title: "Vacation in Greece",
    slug: "vacation-greece-2024-08-10",
    startDate: "2024-08-10",
    endDate: "2024-08-24",
    tags: ["travel", "rest"],
    expectedEffect: "POSITIVE",
    visibility: "PUBLISHED",
    descriptionHtml: "<p>Two weeks of relaxation on the Greek islands. Great food and sunshine.</p>",
  },
  {
    title: "Meditation Habit",
    slug: "meditation-habit-2025-01-05",
    startDate: "2025-01-05",
    endDate: "2025-01-05",
    tags: ["mindfulness", "routine"],
    expectedEffect: "POSITIVE",
    visibility: "PUBLISHED",
    descriptionHtml: "<p>Started daily 15-minute guided meditation sessions every evening.</p>",
  },
  {
    title: "Office Relocation Stress",
    slug: "office-relocation-2025-04-01",
    startDate: "2025-04-01",
    endDate: "2025-04-14",
    tags: ["work", "change"],
    expectedEffect: "NEGATIVE",
    visibility: "PUBLISHED",
    descriptionHtml: "<p>Company relocated offices. Longer commute and adjusting to new environment.</p>",
  },
];

// ── Smooth synthetic data generation ───────────────────────────────────────

function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function toDateOnly(date) {
  return new Date(date.toISOString().slice(0, 10) + "T00:00:00.000Z");
}

/**
 * Generates a smooth value using layered sine waves (no noise).
 * Creates visually appealing patterns for investor demos.
 */
function smoothValue(dayIndex, { base, amplitude, period1, period2, period3 }) {
  const wave1 = Math.sin((2 * Math.PI * dayIndex) / period1) * amplitude * 0.6;
  const wave2 = Math.sin((2 * Math.PI * dayIndex) / period2) * amplitude * 0.25;
  const wave3 = Math.sin((2 * Math.PI * dayIndex) / period3) * amplitude * 0.15;
  return base + wave1 + wave2 + wave3;
}

function generateStressData(startDate, days, userProfilePK) {
  const rows = [];
  for (let i = 0; i < days; i++) {
    const date = toDateOnly(addDays(startDate, i));
    const avgStress = smoothValue(i, { base: 35, amplitude: 12, period1: 90, period2: 30, period3: 7 });
    const intensity = smoothValue(i, { base: 28, amplitude: 8, period1: 80, period2: 25, period3: 9 });
    const maxStress = smoothValue(i, { base: 55, amplitude: 15, period1: 100, period2: 35, period3: 11 });
    const totalDuration = 57600; // 16 hours in seconds
    const stressDuration = Math.round(smoothValue(i, { base: 14400, amplitude: 5000, period1: 85, period2: 28, period3: 8 }));
    const highDuration = Math.round(stressDuration * 0.25);
    const mediumDuration = Math.round(stressDuration * 0.4);
    const lowDuration = Math.round(stressDuration * 0.2);
    const restDuration = totalDuration - stressDuration;

    rows.push({
      pk_date: date,
      userProfilePK,
      awake_averageStressLevel: Math.round(Math.max(15, Math.min(70, avgStress)) * 10) / 10,
      awake_averageStressLevelIntensity: Math.round(Math.max(10, Math.min(60, intensity)) * 10) / 10,
      awake_highDuration: Math.max(0, highDuration),
      awake_lowDuration: Math.max(0, lowDuration),
      awake_maxStressLevel: Math.round(Math.max(30, Math.min(85, maxStress))),
      awake_mediumDuration: Math.max(0, mediumDuration),
      awake_restDuration: Math.max(0, restDuration),
      awake_stressDuration: Math.max(0, stressDuration),
      awake_stressIntensityCount: Math.round(smoothValue(i, { base: 120, amplitude: 40, period1: 70, period2: 20, period3: 6 })),
      awake_totalDuration: totalDuration,
      awake_totalStressCount: Math.round(smoothValue(i, { base: 200, amplitude: 60, period1: 75, period2: 22, period3: 8 })),
      awake_totalStressIntensity: Math.round(smoothValue(i, { base: 5500, amplitude: 2000, period1: 95, period2: 32, period3: 10 })),
    });
  }
  return rows;
}

function generateBodyBatteryData(startDate, days, userProfilePK) {
  const rows = [];
  for (let i = 0; i < days; i++) {
    const date = toDateOnly(addDays(startDate, i));
    const highest = Math.round(smoothValue(i, { base: 75, amplitude: 15, period1: 60, period2: 20, period3: 7 }));
    const lowest = Math.round(smoothValue(i, { base: 25, amplitude: 10, period1: 70, period2: 25, period3: 9 }));
    const charged = Math.round(smoothValue(i, { base: 55, amplitude: 12, period1: 65, period2: 22, period3: 8 }));
    const drained = Math.round(smoothValue(i, { base: 50, amplitude: 10, period1: 55, period2: 18, period3: 6 }));
    const sleepEnd = Math.round(smoothValue(i, { base: 65, amplitude: 10, period1: 50, period2: 15, period3: 7 }));
    const sleepStart = Math.round(smoothValue(i, { base: 30, amplitude: 8, period1: 45, period2: 18, period3: 9 }));

    // Create timestamps for highest/lowest within the day
    const highHour = 7; // Morning after sleep
    const lowHour = 22; // Evening before sleep

    rows.push({
      pk_date: date,
      userProfilePK,
      chargedValue: Math.max(10, Math.min(100, charged)),
      drainedValue: Math.max(10, Math.min(100, drained)),
      highest_statTimestamp: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), highHour, 0, 0)),
      highest_statsValue: Math.max(20, Math.min(100, highest)),
      lowest_statTimestamp: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), lowHour, 0, 0)),
      lowest_statsValue: Math.max(5, Math.min(80, lowest)),
      sleepend_statTimestamp: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 7, 30, 0)),
      sleepend_statsValue: Math.max(20, Math.min(100, sleepEnd)),
      sleepstart_statTimestamp: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 0, 0)),
      sleepstart_statsValue: Math.max(5, Math.min(80, sleepStart)),
    });
  }
  return rows;
}

function generateRespirationData(startDate, days, userProfilePK) {
  const rows = [];
  for (let i = 0; i < days; i++) {
    const date = toDateOnly(addDays(startDate, i));
    const avg = smoothValue(i, { base: 15.5, amplitude: 1.5, period1: 120, period2: 40, period3: 10 });
    const highest = avg + smoothValue(i, { base: 3, amplitude: 1, period1: 80, period2: 20, period3: 7 });
    const lowest = avg - smoothValue(i, { base: 3, amplitude: 0.8, period1: 90, period2: 25, period3: 8 });

    rows.push({
      pk_date: date,
      userProfilePK,
      avgWakingRespirationValue: Math.round(Math.max(10, Math.min(22, avg)) * 10) / 10,
      highestRespirationValue: Math.round(Math.max(12, Math.min(28, highest)) * 10) / 10,
      lowestRespirationValue: Math.round(Math.max(8, Math.min(18, lowest)) * 10) / 10,
    });
  }
  return rows;
}

// ── Main seed function ─────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Seeding database with John Doe demo data...");

  // Clean existing data
  await prisma.importantEvent.deleteMany();
  await prisma.stress.deleteMany();
  await prisma.bodyBattery.deleteMany();
  await prisma.respiration.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  // Create demo user
  const user = await prisma.user.create({
    data: {
      name: DEMO_USER.name,
      userProfilePK: DEMO_USER.userProfilePK,
    },
  });
  console.log(`✅ Created user: ${user.name} (PK: ${user.userProfilePK})`);

  // Generate 2 years of smooth data (2024-01-01 to 2025-12-31)
  const startDate = new Date("2024-01-01T00:00:00.000Z");
  const days = 730; // ~2 years

  console.log("📊 Generating smooth stress data...");
  const stressData = generateStressData(startDate, days, DEMO_USER.userProfilePK);
  for (let i = 0; i < stressData.length; i += 100) {
    const batch = stressData.slice(i, i + 100);
    await prisma.stress.createMany({ data: batch });
  }
  console.log(`   → ${stressData.length} stress records`);

  console.log("🔋 Generating smooth body battery data...");
  const bodyBatteryData = generateBodyBatteryData(startDate, days, DEMO_USER.userProfilePK);
  for (let i = 0; i < bodyBatteryData.length; i += 100) {
    const batch = bodyBatteryData.slice(i, i + 100);
    await prisma.bodyBattery.createMany({ data: batch });
  }
  console.log(`   → ${bodyBatteryData.length} body battery records`);

  console.log("🫁 Generating smooth respiration data...");
  const respirationData = generateRespirationData(startDate, days, DEMO_USER.userProfilePK);
  for (let i = 0; i < respirationData.length; i += 100) {
    const batch = respirationData.slice(i, i + 100);
    await prisma.respiration.createMany({ data: batch });
  }
  console.log(`   → ${respirationData.length} respiration records`);

  // Seed important events
  console.log("📅 Creating demo events...");
  for (const event of DEMO_EVENTS) {
    const categoryOps = event.tags.map((tag) => ({
      where: { slug: tag.toLowerCase().replace(/\s+/g, "-") },
      create: { name: tag, slug: tag.toLowerCase().replace(/\s+/g, "-") },
    }));

    await prisma.importantEvent.create({
      data: {
        userProfilePK: DEMO_USER.userProfilePK,
        title: event.title,
        name: event.title,
        slug: event.slug,
        publishDate: new Date(event.startDate + "T00:00:00.000Z"),
        tags: event.tags,
        expectedEffect: event.expectedEffect,
        visibility: event.visibility,
        descriptionHtml: event.descriptionHtml,
        startDate: new Date(event.startDate + "T00:00:00.000Z"),
        endDate: new Date(event.endDate + "T00:00:00.000Z"),
        categories: { connectOrCreate: categoryOps },
      },
    });
    console.log(`   → ${event.title}`);
  }

  console.log("\n🎉 Seed complete! Demo ready for John Doe.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
