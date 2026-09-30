import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { parseEnv, isDeepStrictEqual } from "node:util";

// Run from any directory. Dry-run by default; --apply inserts missing records.
// PostgreSQL remains read-only. Existing MongoDB records are never overwritten.
const env = { ...parseEnv(readFileSync(new URL("../.env", import.meta.url), "utf8")), ...process.env };
const require = createRequire(new URL("../lib/db/package.json", import.meta.url));
const { Client } = require("pg");
const { MongoClient } = require("mongodb");
const apply = process.argv.includes("--apply");
if (!env.DATABASE_URL || !env.MONGODB_URI) {
  throw new Error("Both DATABASE_URL and MONGODB_URI must be configured in the root .env.");
}

const sql = new Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 15000, statement_timeout: 30000 });
const mongo = new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
const camelCase = (row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()), value]));
const normalize = (row) => JSON.parse(JSON.stringify(row));

try {
  await sql.connect();
  await sql.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const users = (await sql.query("SELECT id, provider, provider_user_id, name, email, avatar_url, created_at FROM users ORDER BY id")).rows.map(camelCase);
  const portfolios = (await sql.query("SELECT id, owner_id, slug, profession, purpose, template_id, status, content, views, published_at, created_at, updated_at FROM portfolios ORDER BY id")).rows.map(camelCase);
  await sql.query("COMMIT");
  const ownerIds = new Set(users.map((user) => user.id));
  if (portfolios.some((portfolio) => !ownerIds.has(portfolio.ownerId))) {
    throw new Error("Source contains portfolios without matching users. Resolve ownership before migrating.");
  }

  await mongo.connect();
  const db = mongo.db(env.MONGODB_DATABASE || "folio");
  const plans = [];
  for (const [name, rows] of [["users", users], ["portfolios", portfolios]]) {
    const collection = db.collection(name);
    const existing = await collection.find({}, { projection: { _id: 0 } }).toArray();
    const byId = new Map(existing.map((row) => [row.id, row]));
    if (byId.size !== existing.length) throw new Error(`Duplicate IDs in target ${name}.`);
    const missing = [];
    for (const row of rows) {
      const saved = byId.get(row.id);
      if (!saved) missing.push(row);
      else if (!isDeepStrictEqual(normalize(saved), normalize(row))) {
        throw new Error(`Conflicting target record in ${name}; migration stopped without overwriting it.`);
      }
    }
    // Detect secondary unique-key conflicts before making any writes.
    if (name === "users" && missing.some((row) => existing.some((saved) => saved.provider === row.provider && saved.providerUserId === row.providerUserId))) {
      throw new Error("Target provider identity already exists under another user ID.");
    }
    if (name === "portfolios" && missing.some((row) => existing.some((saved) => saved.slug === row.slug))) {
      throw new Error("Target portfolio slug already exists under another portfolio ID.");
    }
    plans.push({ name, rows, missing });
    console.log(JSON.stringify({ collection: name, sourceCount: rows.length, existingCount: existing.length, toInsert: missing.length, mode: apply ? "apply" : "dry-run" }));
  }

  if (apply) {
    await db.collection("users").createIndex({ id: 1 }, { unique: true });
    await db.collection("users").createIndex({ provider: 1, providerUserId: 1 }, { unique: true });
    await db.collection("portfolios").createIndex({ id: 1 }, { unique: true });
    await db.collection("portfolios").createIndex({ slug: 1 }, { unique: true });
    for (const plan of plans) {
      if (plan.missing.length) await db.collection(plan.name).insertMany(plan.missing, { ordered: true });
      const saved = await db.collection(plan.name).find({ id: { $in: plan.rows.map((row) => row.id) } }, { projection: { _id: 0 } }).toArray();
      const byId = new Map(saved.map((row) => [row.id, row]));
      // insertMany adds _id to input objects; remove only that MongoDB field.
      for (const row of plan.rows) {
        const { _id, ...source } = row;
        if (!isDeepStrictEqual(normalize(byId.get(row.id)), normalize(source))) {
          throw new Error(`Verification failed for ${plan.name}. Source data is unchanged.`);
        }
      }
      console.log(JSON.stringify({ collection: plan.name, verifiedRecords: saved.length, contentsMatch: true }));
    }
    const highest = await db.collection("portfolios").findOne({}, { sort: { id: -1 }, projection: { id: 1 } });
    await db.collection("counters").updateOne({ _id: "portfolios" }, { $max: { value: highest?.id || 0 } }, { upsert: true });
    console.log("Migration verified. PostgreSQL data is unchanged. Users sign in again to create production sessions.");
  }
} catch (error) {
  // Driver errors can contain connection strings or personal data. Print only codes.
  const safeMessage = error.message?.startsWith("Source ") || error.message?.startsWith("Target ") || error.message?.startsWith("Conflicting ") || error.message?.startsWith("Duplicate ") || error.message?.startsWith("Verification ");
  console.error(safeMessage ? error.message : `Migration failed (${error.name}; code ${error.code || "unknown"}). Credentials and records were not printed.`);
  process.exitCode = 1;
} finally {
  await Promise.allSettled([sql.end(), mongo.close()]);
}
