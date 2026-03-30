import "dotenv/config";

import fs from "node:fs";
import path from "node:path";
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
        throw new Error(
            "DATABASE_URL is not set and could not be derived from POSTGRES_* variables.",
        );
    }

    // In WSL, host.docker.internal may not resolve; localhost works for published ports.
    if (process.platform === "linux" && url.includes("host.docker.internal")) {
        return url.replace(/host\.docker\.internal/g, "127.0.0.1");
    }

    return url;
}

const connectionString = resolveConnectionString();

const adapter = new PrismaPg(
    new Pool({
        connectionString,
    }),
);

const prisma = new PrismaClient({
    adapter,
    log: ["error", "warn"],
});

const SEEDED_USER = {
    name: "le heelow",
    email: "jakub.havlas.022@pslib.cz",
};

const JAKUB_IMPORTANT_DAYS = [
    {
        title: "GF",
        slug: "gf-2025-12-11",
        startDate: "2025-12-11",
        endDate: "2025-12-11",
        tags: ["relationship"],
        expectedEffect: "POSITIVE",
        visibility: "PUBLISHED",
    },
    {
        title: "Konec s Dukliu",
        slug: "konec-s-dukliu-2025-03-31",
        startDate: "2025-03-31",
        endDate: "2025-03-31",
        tags: ["free time"],
        expectedEffect: "NEGATIVE",
        visibility: "NOT_PUBLIC",
    },
    {
        title: "First day on hugh schoo",

        slug: "first-day-on-hugh-schoo-2022-09-04",
        startDate: "2022-09-04",
        endDate: "2022-09-04",
        tags: ["school", "career"],
        expectedEffect: "NEGATIVE",
        visibility: "PUBLISHED",
    },
];

const SYNTHETIC_YEARS = 4;

const FILE_MODEL_MAP = {
    "body_battery.csv": {
        delegate: "bodyBattery",
        fieldTypes: {
            pk_date: "date",
            userProfilePK: "int",
            chargedValue: "int",
            drainedValue: "int",
            highest_statTimestamp: "datetime",
            highest_statsValue: "int",
            lowest_statTimestamp: "datetime",
            lowest_statsValue: "int",
            sleepend_statTimestamp: "datetime",
            sleepend_statsValue: "int",
            sleepstart_statTimestamp: "datetime",
            sleepstart_statsValue: "int",
        },
    },
    "respiration.csv": {
        delegate: "respiration",
        fieldTypes: {
            pk_date: "date",
            userProfilePK: "int",
            avgWakingRespirationValue: "float",
            highestRespirationValue: "float",
            lowestRespirationValue: "float",
        },
    },
    "stress.csv": {
        delegate: "stress",
        fieldTypes: {
            pk_date: "date",
            userProfilePK: "int",
            awake_averageStressLevel: "float",
            awake_averageStressLevelIntensity: "float",
            awake_highDuration: "int",
            awake_lowDuration: "int",
            awake_maxStressLevel: "int",
            awake_mediumDuration: "int",
            awake_restDuration: "int",
            awake_stressDuration: "int",
            awake_stressIntensityCount: "int",
            awake_totalDuration: "int",
            awake_totalStressCount: "int",
            awake_totalStressIntensity: "int",
        },
    },
};

function parseCsv(content) {
    const lines = content
        .split(/\r?\n/)
        .filter((line) => line.trim().length > 0);
    if (lines.length === 0) {
        return { headers: [], rows: [] };
    }

    const headers = lines[0].replace(/^\uFEFF/, "").split(",");
    const rows = lines.slice(1).map((line) => {
        const values = line.split(",");
        const row = {};

        headers.forEach((header, idx) => {
            row[header] = values[idx] ?? "";
        });

        return row;
    });

    return { headers, rows };
}

function parseDateValue(raw, asDateOnly) {
    if (raw === null || raw === undefined || raw === "") {
        return null;
    }

    if (asDateOnly && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        return new Date(`${raw}T00:00:00.000Z`);
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
        throw new Error(`Invalid date value: ${raw}`);
    }

    return parsed;
}

function castValue(rawValue, type) {
    if (rawValue === "") {
        return null;
    }

    if (type === "int") {
        const parsed = Number.parseInt(rawValue, 10);
        if (Number.isNaN(parsed)) {
            throw new Error(`Invalid integer value: ${rawValue}`);
        }
        return parsed;
    }

    if (type === "float") {
        const parsed = Number.parseFloat(rawValue);
        if (Number.isNaN(parsed)) {
            throw new Error(`Invalid float value: ${rawValue}`);
        }
        return parsed;
    }

    if (type === "date") {
        return parseDateValue(rawValue, true);
    }

    if (type === "datetime") {
        return parseDateValue(rawValue, false);
    }

    return rawValue;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function buildPrismaRows(parsedRows, fieldTypes, seededUserProfilePK) {
    const allowedFields = Object.keys(fieldTypes);

    return parsedRows.map((csvRow) => {
        const prismaRow = {};

        for (const field of allowedFields) {
            prismaRow[field] = castValue(
                csvRow[field] ?? "",
                fieldTypes[field],
            );
        }

        // Keep data linked to the single seeded user.
        prismaRow.userProfilePK = seededUserProfilePK;

        return prismaRow;
    });
}

function gaussianRandom() {
    // Box-Muller transform.
    let u = 0;
    let v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function toUtcMidnight(date) {
    const value = new Date(date);
    value.setUTCHours(0, 0, 0, 0);
    return value;
}

function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function dateDiffDays(a, b) {
    const aMs = toUtcMidnight(a).getTime();
    const bMs = toUtcMidnight(b).getTime();
    return Math.round((aMs - bMs) / (24 * 60 * 60 * 1000));
}

function addDays(date, days) {
    const value = new Date(date);
    value.setUTCDate(value.getUTCDate() + days);
    return value;
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function getNumericStats(rows, fields) {
    const stats = {};

    for (const field of fields) {
        const values = rows
            .map((row) => row[field])
            .filter(
                (value) => typeof value === "number" && Number.isFinite(value),
            );

        if (values.length === 0) {
            stats[field] = {
                min: 0,
                max: 1,
                span: 1,
            };
            continue;
        }

        const min = Math.min(...values);
        const max = Math.max(...values);
        stats[field] = {
            min,
            max,
            span: Math.max(1, max - min),
        };
    }

    return stats;
}

function perturbNumber(baseValue, type, fieldStat) {
    if (baseValue === null || baseValue === undefined) {
        return null;
    }

    const localScale = Math.max(
        Math.abs(baseValue) * 0.08,
        fieldStat.span * 0.06,
        0.5,
    );
    const perturbed = baseValue + gaussianRandom() * localScale;

    const padding = fieldStat.span * 0.08;
    const minBound = fieldStat.min - padding;
    const maxBound = fieldStat.max + padding;
    const clamped = clamp(perturbed, minBound, maxBound);

    if (type === "int") {
        return Math.round(clamped);
    }

    return Number(clamped.toFixed(3));
}

function getTimeMinutes(dateValue) {
    return dateValue.getUTCHours() * 60 + dateValue.getUTCMinutes();
}

function minutesToDate(targetDate, minutes) {
    const clampedMinutes = clamp(minutes, 0, 23 * 60 + 59);
    const result = toUtcMidnight(targetDate);
    result.setUTCMinutes(clampedMinutes);
    return result;
}

function perturbDateTime(templateDateTime, targetDate) {
    if (!(templateDateTime instanceof Date)) {
        return null;
    }

    const baseMinutes = getTimeMinutes(templateDateTime);
    const minuteNoise = Math.round(gaussianRandom() * 45);
    return minutesToDate(targetDate, baseMinutes + minuteNoise);
}

function normalizeRespirationRow(row) {
    const values = [
        row.lowestRespirationValue,
        row.avgWakingRespirationValue,
        row.highestRespirationValue,
    ].filter((value) => typeof value === "number" && Number.isFinite(value));

    if (values.length === 0) {
        return row;
    }

    const low = Math.min(...values);
    const high = Math.max(...values);
    const avg = row.avgWakingRespirationValue ?? (low + high) / 2;

    row.lowestRespirationValue = Number(low.toFixed(3));
    row.highestRespirationValue = Number(high.toFixed(3));
    row.avgWakingRespirationValue = Number(clamp(avg, low, high).toFixed(3));

    return row;
}

function normalizeStressRow(row) {
    const high = Math.max(0, Math.round(row.awake_highDuration ?? 0));
    const medium = Math.max(0, Math.round(row.awake_mediumDuration ?? 0));
    const low = Math.max(0, Math.round(row.awake_lowDuration ?? 0));
    const rest = Math.max(0, Math.round(row.awake_restDuration ?? 0));

    row.awake_highDuration = high;
    row.awake_mediumDuration = medium;
    row.awake_lowDuration = low;
    row.awake_restDuration = rest;
    row.awake_stressDuration = high + medium + low;
    row.awake_totalDuration = row.awake_stressDuration + rest;

    if (typeof row.awake_averageStressLevel === "number") {
        row.awake_averageStressLevel = Number(
            clamp(row.awake_averageStressLevel, 0, 100).toFixed(3),
        );
    }

    if (typeof row.awake_averageStressLevelIntensity === "number") {
        row.awake_averageStressLevelIntensity = Number(
            clamp(row.awake_averageStressLevelIntensity, 0, 100).toFixed(3),
        );
    }

    if (typeof row.awake_maxStressLevel === "number") {
        row.awake_maxStressLevel = Math.round(
            clamp(row.awake_maxStressLevel, 0, 100),
        );
    }

    if (typeof row.awake_totalStressCount === "number") {
        row.awake_totalStressCount = Math.max(
            0,
            Math.round(row.awake_totalStressCount),
        );
    }

    if (typeof row.awake_stressIntensityCount === "number") {
        row.awake_stressIntensityCount = Math.max(
            0,
            Math.round(row.awake_stressIntensityCount),
        );
    }

    if (typeof row.awake_totalStressIntensity === "number") {
        row.awake_totalStressIntensity = Math.max(
            0,
            Math.round(row.awake_totalStressIntensity),
        );
    }

    return row;
}

function normalizeBodyBatteryRow(row) {
    if (
        typeof row.highest_statsValue === "number" &&
        typeof row.lowest_statsValue === "number"
    ) {
        if (row.lowest_statsValue > row.highest_statsValue) {
            const temp = row.lowest_statsValue;
            row.lowest_statsValue = row.highest_statsValue;
            row.highest_statsValue = temp;
        }
    }

    if (
        typeof row.sleepstart_statsValue === "number" &&
        typeof row.sleepend_statsValue === "number"
    ) {
        row.sleepstart_statsValue = Math.round(
            clamp(row.sleepstart_statsValue, 0, 100),
        );
        row.sleepend_statsValue = Math.round(
            clamp(row.sleepend_statsValue, 0, 100),
        );
    }

    return row;
}

function buildSyntheticRowsForModel(
    modelConfig,
    sourceRows,
    userProfilePK,
    years = SYNTHETIC_YEARS,
) {
    const fieldTypes = modelConfig.fieldTypes;
    const numericFields = Object.entries(fieldTypes)
        .filter(([_field, type]) => type === "int" || type === "float")
        .map(([field]) => field);
    const stats = getNumericStats(sourceRows, numericFields);

    const endDate = toUtcMidnight(new Date());
    const startDate = new Date(endDate);
    startDate.setUTCFullYear(startDate.getUTCFullYear() - years);

    const totalDays = dateDiffDays(endDate, startDate) + 1;
    const rows = [];

    for (let dayIndex = 0; dayIndex < totalDays; dayIndex += 1) {
        const targetDate = addDays(startDate, dayIndex);
        const template = pickRandom(sourceRows);
        const row = {
            pk_date: targetDate,
            userProfilePK,
        };

        for (const [field, type] of Object.entries(fieldTypes)) {
            if (field === "pk_date" || field === "userProfilePK") {
                continue;
            }

            const sourceValue = template[field];

            if (type === "int" || type === "float") {
                row[field] = perturbNumber(sourceValue, type, stats[field]);
                continue;
            }

            if (type === "datetime") {
                row[field] = perturbDateTime(sourceValue, targetDate);
                continue;
            }

            if (type === "date") {
                row[field] = targetDate;
                continue;
            }

            row[field] = sourceValue;
        }

        if (modelConfig.delegate === "respiration") {
            normalizeRespirationRow(row);
        }

        if (modelConfig.delegate === "stress") {
            normalizeStressRow(row);
        }

        if (modelConfig.delegate === "bodyBattery") {
            normalizeBodyBatteryRow(row);
        }

        rows.push(row);
    }

    return rows;
}

async function insertInChunks(delegateName, rows, chunkSize = 500) {
    let inserted = 0;

    for (let index = 0; index < rows.length; index += chunkSize) {
        const chunk = rows.slice(index, index + chunkSize);
        const result = await prisma[delegateName].createMany({
            data: chunk,
            skipDuplicates: true,
        });
        inserted += result.count;
    }

    return inserted;
}

function getSeedUserProfilePK(dataDir) {
    const csvFiles = fs
        .readdirSync(dataDir)
        .filter((fileName) => fileName.toLowerCase().endsWith(".csv"));

    for (const fileName of csvFiles) {
        const fullPath = path.join(dataDir, fileName);
        const content = fs.readFileSync(fullPath, "utf8");
        const { rows } = parseCsv(content);

        for (const row of rows) {
            const raw = row.userProfilePK;
            if (raw !== undefined && raw !== "") {
                const parsed = Number.parseInt(raw, 10);
                if (!Number.isNaN(parsed)) {
                    return parsed;
                }
            }
        }
    }

    return 104768835;
}

async function ensureSeedUser(seededUserProfilePK) {
    return ensureUser(SEEDED_USER, seededUserProfilePK);
}

async function ensureUser(userConfig, userProfilePK) {
    return prisma.$transaction(async (tx) => {
        const [userByEmail, userByProfilePK] = await Promise.all([
            tx.user.findUnique({ where: { email: userConfig.email } }),
            tx.user.findUnique({ where: { userProfilePK } }),
        ]);

        // If email and profilePK point to different users, move profilePK to the requested seed user.
        if (
            userByEmail &&
            userByProfilePK &&
            userByEmail.id !== userByProfilePK.id
        ) {
            await tx.user.update({
                where: { id: userByProfilePK.id },
                data: { userProfilePK: null },
            });

            return tx.user.update({
                where: { id: userByEmail.id },
                data: {
                    name: userConfig.name,
                    userProfilePK,
                },
            });
        }

        if (userByProfilePK) {
            return tx.user.update({
                where: { id: userByProfilePK.id },
                data: {
                    name: userConfig.name,
                    email: userConfig.email,
                },
            });
        }

        if (userByEmail) {
            return tx.user.update({
                where: { id: userByEmail.id },
                data: {
                    name: userConfig.name,
                    userProfilePK,
                },
            });
        }

        return tx.user.create({
            data: {
                name: userConfig.name,
                email: userConfig.email,
                userProfilePK,
            },
        });
    });
}

async function getSyntheticUserProfilePK(baseProfilePK, usedProfilePKs) {
    const existingUser = await prisma.user.findUnique({
        where: { email: SYNTHETIC_USER.email },
        select: { userProfilePK: true },
    });

    if (existingUser?.userProfilePK) {
        return existingUser.userProfilePK;
    }

    const usedInDb = await prisma.user.findMany({
        where: { userProfilePK: { not: null } },
        select: { userProfilePK: true },
    });

    const used = new Set(usedProfilePKs);
    for (const row of usedInDb) {
        if (typeof row.userProfilePK === "number") {
            used.add(row.userProfilePK);
        }
    }

    let candidate = baseProfilePK + 1;
    while (used.has(candidate)) {
        candidate += 1;
    }

    return candidate;
}

function collectUsedProfilePKsFromRows(rowsByFile) {
    const used = new Set();

    for (const rows of Object.values(rowsByFile)) {
        for (const row of rows) {
            const raw = row.userProfilePK;
            if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
                used.add(raw);
            }
        }
    }

    return used;
}

function loadCsvRowsByFile(dataDir) {
    const result = {};

    const csvFiles = fs
        .readdirSync(dataDir)
        .filter((fileName) => fileName.toLowerCase().endsWith(".csv"));

    for (const fileName of csvFiles) {
        const fullPath = path.join(dataDir, fileName);
        const content = fs.readFileSync(fullPath, "utf8");
        const { rows } = parseCsv(content);

        const modelConfig = FILE_MODEL_MAP[fileName];
        if (!modelConfig || rows.length === 0) {
            result[fileName] = [];
            continue;
        }

        const allowedFields = Object.keys(modelConfig.fieldTypes);
        result[fileName] = rows.map((csvRow) => {
            const parsed = {};

            for (const field of allowedFields) {
                parsed[field] = castValue(
                    csvRow[field] ?? "",
                    modelConfig.fieldTypes[field],
                );
            }

            return parsed;
        });
    }

    return result;
}

async function upsertImportantDaysForUser(userProfilePK) {
    for (const item of JAKUB_IMPORTANT_DAYS) {
        const startDate = new Date(`${item.startDate}T00:00:00.000Z`);
        const endDate = new Date(`${item.endDate}T00:00:00.000Z`);

        await prisma.importantEvent.upsert({
            where: { slug: item.slug },
            create: {
                userProfilePK,
                title: item.title,
                name: item.title,
                slug: item.slug,
                publishDate: startDate,
                tags: item.tags,
                expectedEffect: item.expectedEffect,
                visibility: item.visibility,
                descriptionHtml: `<p>${item.title}</p>`,
                startDate,
                endDate,
                categories: {
                    connectOrCreate: item.tags.map((tag) => ({
                        where: {
                            slug: tag.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
                        },
                        create: {
                            name: tag,
                            slug: tag.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
                        },
                    })),
                },
            },
            update: {
                userProfilePK,
                title: item.title,
                name: item.title,
                publishDate: startDate,
                tags: item.tags,
                expectedEffect: item.expectedEffect,
                visibility: item.visibility,
                startDate,
                endDate,
                categories: {
                    connectOrCreate: item.tags.map((tag) => ({
                        where: {
                            slug: tag.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
                        },
                        create: {
                            name: tag,
                            slug: tag.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
                        },
                    })),
                },
            },
        });
    }
}

async function main() {
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
        throw new Error(`Data directory not found: ${dataDir}`);
    }

    const seededUserProfilePK = getSeedUserProfilePK(dataDir);
    const csvRowsByFile = loadCsvRowsByFile(dataDir);

    const user = await ensureSeedUser(seededUserProfilePK);

    console.log(
        `Seed user ready: ${user.email} (userProfilePK=${seededUserProfilePK})`,
    );

    await upsertImportantDaysForUser(seededUserProfilePK);
    console.log(
        `Important days ready for ${SEEDED_USER.email}: ${JAKUB_IMPORTANT_DAYS.length} upserted.`,
    );

    await prisma.importantEvent.updateMany({
        where: {
            userProfilePK: seededUserProfilePK,
            NOT: { slug: "konec-s-dukliu-2025-03-31" },
        },
        data: { visibility: "PUBLISHED" },
    });

    await prisma.importantEvent.updateMany({
        where: {
            userProfilePK: seededUserProfilePK,
            slug: "konec-s-dukliu-2025-03-31",
        },
        data: { visibility: "NOT_PUBLIC" },
    });

    const csvFiles = fs
        .readdirSync(dataDir)
        .filter((fileName) => fileName.toLowerCase().endsWith(".csv"));

    if (csvFiles.length === 0) {
        console.log("No CSV files found in data/. Nothing to import.");
        return;
    }

    for (const fileName of csvFiles) {
        const modelConfig = FILE_MODEL_MAP[fileName];
        if (!modelConfig) {
            console.warn(`Skipping ${fileName}: no model mapping configured.`);
            continue;
        }

        const rows = csvRowsByFile[fileName] ?? [];

        if (rows.length === 0) {
            console.log(`Skipping ${fileName}: no rows.`);
            continue;
        }

        const originalRows = rows.map((row) => ({
            ...row,
            userProfilePK: seededUserProfilePK,
        }));
        const insertedOriginal = await insertInChunks(
            modelConfig.delegate,
            originalRows,
        );

        console.log(
            `${fileName}: ${rows.length} rows, inserted ${insertedOriginal}.`,
        );
    }
}

main()
    .catch((error) => {
        console.error("Seed failed:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
