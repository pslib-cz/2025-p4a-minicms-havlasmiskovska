import { existsSync, readFileSync } from "node:fs";
import { defineConfig } from "prisma/config";

function readDotEnvValue(key: string) {
  if (!existsSync(".env")) {
    return undefined;
  }

  const text = readFileSync(".env", "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex < 1) {
      continue;
    }

    const envKey = line.slice(0, separatorIndex).trim();
    if (envKey !== key) {
      continue;
    }

    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    return value;
  }

  return undefined;
}

function readEnvValue(key: string) {
  return process.env[key] ?? readDotEnvValue(key);
}

function resolveDatasourceUrl() {
  const explicitDatabaseUrl = readEnvValue("DATABASE_URL");
  if (explicitDatabaseUrl) {
    return explicitDatabaseUrl;
  }

  const user = readEnvValue("POSTGRES_USER");
  const password = readEnvValue("POSTGRES_PASSWORD");
  const db = readEnvValue("POSTGRES_DB");
  const host = readEnvValue("POSTGRES_HOST") ?? "127.0.0.1";
  const port = readEnvValue("POSTGRES_PORT_HOST") ?? "5434";

  if (!user || !password || !db) {
    return undefined;
  }

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${db}?schema=public`;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: resolveDatasourceUrl(),
  },
});
