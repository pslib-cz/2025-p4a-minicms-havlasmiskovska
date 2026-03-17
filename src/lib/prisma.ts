import { PrismaPg } from "@prisma/adapter-pg";
import * as PrismaModule from "@prisma/client";
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

const adapter = new PrismaPg(
  new Pool({
    connectionString: process.env.DATABASE_URL,
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
