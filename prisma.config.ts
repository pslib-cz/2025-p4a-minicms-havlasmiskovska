import "dotenv/config";
import { defineConfig } from "prisma/config";

function resolveDatasourceUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const user = process.env.POSTGRES_USER;
  const password = process.env.POSTGRES_PASSWORD;
  const db = process.env.POSTGRES_DB;
  const host = process.env.POSTGRES_HOST ?? "127.0.0.1";
  const port = process.env.POSTGRES_PORT_HOST ?? "5434";

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
