import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "prisma/config";

function readEnvFile(envPath: string): Record<string, string> {
  if (!existsSync(envPath)) {
    return {};
  }

  const file = readFileSync(envPath, "utf8");
  const values: Record<string, string> = {};

  for (const rawLine of file.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (key !== "" && value !== "") {
      values[key] = value;
    }
  }

  return values;
}

function getDatabaseUrl(): string {
  const envPath = resolve(process.cwd(), ".env");
  const envValues = readEnvFile(envPath);
  const nodeEnv = process.env.NODE_ENV?.trim() || envValues.NODE_ENV;
  const isProduction = nodeEnv === "production";
  const primaryKey = isProduction ? "DATABASE_URL_DOCKER" : "DATABASE_URL";
  const secondaryKey = isProduction ? "DATABASE_URL" : "DATABASE_URL_DOCKER";

  const primaryValue = process.env[primaryKey]?.trim() || envValues[primaryKey];
  if (primaryValue) {
    return primaryValue;
  }

  const secondaryValue = process.env[secondaryKey]?.trim() || envValues[secondaryKey];
  if (secondaryValue) {
    return secondaryValue;
  }

  throw new Error(
    `Missing ${primaryKey} and ${secondaryKey}. Checked process.env and .env at ${envPath}`,
  );
}

const databaseUrl = getDatabaseUrl();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
