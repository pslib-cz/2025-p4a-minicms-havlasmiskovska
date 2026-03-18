import { PrismaPg } from "@prisma/adapter-pg";
import * as PrismaModule from "@prisma/client";
import { existsSync } from "node:fs";
import { Pool } from "pg";
import type { PrismaClient as PrismaClientType } from "../../node_modules/.prisma/client/default";

type PrismaClientCtor = new (options?: {
  adapter?: unknown;
  log?: Array<"error" | "warn" | "info" | "query">;
}) => PrismaClientType;

const PrismaClient = (PrismaModule as unknown as { PrismaClient?: PrismaClientCtor }).PrismaClient;

if (!PrismaClient) {
  throw new Error("PrismaClient export was not found. Run `npm run prisma:generate`.");
}

function resolveDatabaseUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error("DATABASE_URL is not set.");
  }

  try {
    const parsed = new URL(raw);
    const isLocalHost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    const runningInDocker = existsSync("/.dockerenv");
    const rewriteDisabled = process.env.DATABASE_URL_DISABLE_LOCALHOST_REWRITE === "1";

    if (isLocalHost && runningInDocker && !rewriteDisabled) {
      parsed.hostname = "host.docker.internal";
      const rewritten = parsed.toString();

      console.warn(
        "DATABASE_URL points to localhost inside Docker; rewriting host to host.docker.internal."
      );

      return rewritten;
    }
  } catch {
    console.warn("DATABASE_URL is not a valid URL string; using value as-is.");
  }

  return raw;
}

const adapter = new PrismaPg(
  new Pool({
    connectionString: resolveDatabaseUrl(),
  })
);

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClientType;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
