import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "prisma/config";

function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== "") {
    return process.env.DATABASE_URL.trim();
  }

  const envPath = resolve(process.cwd(), ".env");
  if (existsSync(envPath)) {
    const file = readFileSync(envPath, "utf8");
    for (const rawLine of file.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (line === "" || line.startsWith("#")) {
        continue;
      }
      if (line.startsWith("DATABASE_URL=")) {
        const value = line.slice("DATABASE_URL=".length).trim();
        if (value !== "") {
          return value;
        }
      }
    }
  }

  throw new Error(
    "Missing DATABASE_URL. Checked process.env and .env at " + envPath,
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
