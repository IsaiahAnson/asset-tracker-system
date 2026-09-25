import { Pool } from "pg";

type GlobalWithPool = typeof globalThis & {
  assetTrackerPool?: Pool;
};

const globalForPool = globalThis as GlobalWithPool;

export function getPool() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required for database access.");
  }

  if (!globalForPool.assetTrackerPool) {
    globalForPool.assetTrackerPool = new Pool({
      connectionString,
      ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: true } : undefined
    });
  }

  return globalForPool.assetTrackerPool;
}
