require("dotenv/config");

const fs = require("node:fs");
const path = require("node:path");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const PrismaModule = require("@prisma/client");

const PrismaClient = PrismaModule.PrismaClient;

if (!PrismaClient) {
  throw new Error("PrismaClient export was not found. Run `npm run prisma:generate`.");
}

function resolveConnectionString() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set.");
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
  })
);

const prisma = new PrismaClient({
  adapter,
  log: ["error", "warn"],
});

const SEEDED_USER = {
  name: "le heelow",
  email: "jakub.havlas.022@pslib.cz",
};

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
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
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

function buildPrismaRows(parsedRows, fieldTypes, seededUserProfilePK) {
  const allowedFields = Object.keys(fieldTypes);

  return parsedRows.map((csvRow) => {
    const prismaRow = {};

    for (const field of allowedFields) {
      prismaRow[field] = castValue(csvRow[field] ?? "", fieldTypes[field]);
    }

    // Keep data linked to the single seeded user.
    prismaRow.userProfilePK = seededUserProfilePK;

    return prismaRow;
  });
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
  return prisma.$transaction(async (tx) => {
    const [userByEmail, userByProfilePK] = await Promise.all([
      tx.user.findUnique({ where: { email: SEEDED_USER.email } }),
      tx.user.findUnique({ where: { userProfilePK: seededUserProfilePK } }),
    ]);

    // If email and profilePK point to different users, move profilePK to the requested seed user.
    if (userByEmail && userByProfilePK && userByEmail.id !== userByProfilePK.id) {
      await tx.user.update({
        where: { id: userByProfilePK.id },
        data: { userProfilePK: null },
      });

      return tx.user.update({
        where: { id: userByEmail.id },
        data: {
          name: SEEDED_USER.name,
          userProfilePK: seededUserProfilePK,
        },
      });
    }

    if (userByProfilePK) {
      return tx.user.update({
        where: { id: userByProfilePK.id },
        data: {
          name: SEEDED_USER.name,
          email: SEEDED_USER.email,
        },
      });
    }

    if (userByEmail) {
      return tx.user.update({
        where: { id: userByEmail.id },
        data: {
          name: SEEDED_USER.name,
          userProfilePK: seededUserProfilePK,
        },
      });
    }

    return tx.user.create({
      data: {
        name: SEEDED_USER.name,
        email: SEEDED_USER.email,
        userProfilePK: seededUserProfilePK,
      },
    });
  });
}

async function main() {
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    throw new Error(`Data directory not found: ${dataDir}`);
  }

  const seededUserProfilePK = getSeedUserProfilePK(dataDir);

  const user = await ensureSeedUser(seededUserProfilePK);

  console.log(`Seed user ready: ${user.email} (userProfilePK=${seededUserProfilePK})`);

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

    const fullPath = path.join(dataDir, fileName);
    const content = fs.readFileSync(fullPath, "utf8");
    const { rows } = parseCsv(content);

    if (rows.length === 0) {
      console.log(`Skipping ${fileName}: no rows.`);
      continue;
    }

    const prismaRows = buildPrismaRows(rows, modelConfig.fieldTypes, seededUserProfilePK);
    const inserted = await insertInChunks(modelConfig.delegate, prismaRows);

    console.log(`${fileName}: processed ${rows.length} rows, inserted ${inserted} new rows.`);
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
