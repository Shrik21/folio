import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
export { isMongoDatabase, mongoStore } from "./mongo";
export type { MongoPortfolio, MongoUser } from "./mongo";

const { Pool } = pg;
const usingMongo = process.env.DATABASE_PROVIDER?.toLowerCase() === "mongo";

if (!usingMongo && !process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Keep the Drizzle export available for PostgreSQL routes and tests. In Mongo mode
// no SQL query is executed; the fallback URI prevents module initialization from
// requiring a PostgreSQL URL before the Mongo store is selected.
export const pool = new Pool({ connectionString: process.env.DATABASE_URL || "postgresql://127.0.0.1:5432/unused" });
export const db = drizzle(pool, { schema });

export * from "./schema";
