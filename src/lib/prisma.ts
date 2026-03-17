import { PrismaPg } from "@prisma/adapter-pg";
import * as PrismaModule from "@prisma/client";
import { Pool } from "pg";

const PrismaClient = (PrismaModule as { PrismaClient?: any }).PrismaClient;

if (!PrismaClient) {
  throw new Error("PrismaClient export was not found. Run `npm run prisma:generate`.");
}

const adapter = new PrismaPg(
  new Pool({
    connectionString: process.env.DATABASE_URL,
  })
);

const globalForPrisma = globalThis as unknown as {
  prisma?: InstanceType<typeof PrismaClient>;
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
