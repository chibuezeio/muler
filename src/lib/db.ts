import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";
import path from "path";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function resolveDbUrl() {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  if (!url.startsWith("file:")) return url;
  const relative = url.slice("file:".length);
  if (path.isAbsolute(relative)) return url;
  return `file:${path.join(/*turbopackIgnore: true*/ process.cwd(), relative)}`;
}

function createClient() {
  const adapter = new PrismaBetterSqlite3({ url: resolveDbUrl() });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
