import { MongoClient, type Collection, type Db } from "mongodb";
import { randomUUID } from "node:crypto";

export type MongoPortfolio = {
  id: number;
  ownerId: string;
  slug: string;
  profession: string;
  purpose: string;
  templateId: string;
  status: string;
  content: unknown;
  views: number;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type MongoUser = {
  id: string;
  provider: string;
  providerUserId: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  createdAt: Date;
};

export type MongoTemplateDefinition = {
  id: string;
  /** Validated by the API before it is stored; null when a built-in template is only hidden. */
  definition: unknown;
  hidden: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type MongoTemplateBundle = {
  id: string;
  version: number;
  /** The uploaded ZIP, base64-encoded. */
  data: string;
  bytes: number;
  updatedAt: Date;
};

type OAuthState = {
  stateHash: string;
  browserHash: string;
  provider: string;
  verifier: string;
  nonce: string;
  returnTo: string;
  expiresAt: Date;
};

type Session = { tokenHash: string; userId: string; expiresAt: Date };

const uri = () => process.env.MONGODB_URI || "";
const dbName = () => process.env.MONGODB_DATABASE || "folio";
let clientPromise: Promise<MongoClient> | undefined;

async function database(): Promise<Db> {
  if (!uri()) throw new Error("MONGODB_URI must be set when DATABASE_PROVIDER=mongo.");
  // Fail fast (8s) when the database is unreachable, and forget a failed connection so the next request retries (e.g. after the Atlas IP allowlist is fixed).
  clientPromise ??= new MongoClient(uri(), { serverSelectionTimeoutMS: 8000 }).connect().catch((error: unknown) => {
    clientPromise = undefined;
    throw error;
  });
  return (await clientPromise).db(dbName());
}

async function collections() {
  const db = await database();
  const users = db.collection<MongoUser>("users");
  const sessions = db.collection<Session>("auth_sessions");
  const states = db.collection<OAuthState>("oauth_states");
  const portfolios = db.collection<MongoPortfolio>("portfolios");
  const templates = db.collection<MongoTemplateDefinition>("template_definitions");
  const bundles = db.collection<MongoTemplateBundle>("template_bundles");
  await Promise.all([
    templates.createIndex({ id: 1 }, { unique: true }),
    bundles.createIndex({ id: 1 }, { unique: true }),
    users.createIndex({ provider: 1, providerUserId: 1 }, { unique: true }),
    sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    states.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    portfolios.createIndex({ slug: 1 }, { unique: true }),
    portfolios.createIndex({ ownerId: 1, updatedAt: -1 }),
    portfolios.createIndex({ status: 1, slug: 1 }),
  ]);
  return { users, sessions, states, portfolios, templates, bundles };
}

export const isMongoDatabase = () => process.env.DATABASE_PROVIDER?.toLowerCase() === "mongo";

export const mongoStore = {
  async saveState(state: OAuthState) {
    const { states } = await collections();
    await states.insertOne(state);
  },
  async consumeState(stateHash: string, browserHash: string, provider: string, now: Date) {
    const { states } = await collections();
    return states.findOneAndDelete({ stateHash, browserHash, provider, expiresAt: { $gt: now } });
  },
  async upsertUser(identity: Omit<MongoUser, "id" | "createdAt">) {
    const { users } = await collections();
    const user = await users.findOneAndUpdate(
      { provider: identity.provider, providerUserId: identity.providerUserId },
      { $set: identity, $setOnInsert: { id: randomUUID(), createdAt: new Date() } },
      { upsert: true, returnDocument: "after" },
    );
    if (!user) throw new Error("Unable to create user.");
    return user;
  },
  async saveSession(session: Session) {
    const { sessions } = await collections();
    await sessions.updateOne({ tokenHash: session.tokenHash }, { $set: session }, { upsert: true });
  },
  async getSession(tokenHash: string, now: Date) {
    const { sessions, users } = await collections();
    const session = await sessions.findOne({ tokenHash, expiresAt: { $gt: now } });
    if (!session) return undefined;
    return users.findOne({ id: session.userId });
  },
  async deleteSession(tokenHash: string) {
    const { sessions } = await collections();
    await sessions.deleteOne({ tokenHash });
  },
  async cleanup(now: Date) {
    const { sessions, states } = await collections();
    await Promise.all([sessions.deleteMany({ expiresAt: { $lte: now } }), states.deleteMany({ expiresAt: { $lte: now } })]);
  },
  async nextPortfolioId() {
    const db = await database();
    const result = await db.collection<{ _id: string; value: number }>("counters").findOneAndUpdate(
      { _id: "portfolios" },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: "after" },
    );
    return result?.value ?? 1;
  },
  async slugExists(slug: string) {
    const { portfolios } = await collections();
    return Boolean(await portfolios.findOne({ slug }, { projection: { id: 1 } }));
  },
  async createPortfolio(input: Omit<MongoPortfolio, "id" | "createdAt" | "updatedAt" | "views" | "publishedAt">) {
    const { portfolios } = await collections();
    const now = new Date();
    const row: MongoPortfolio = { ...input, id: await this.nextPortfolioId(), views: 0, publishedAt: null, createdAt: now, updatedAt: now };
    await portfolios.insertOne(row);
    return row;
  },
  async findById(ownerId: string, id: number) {
    const { portfolios } = await collections();
    return portfolios.findOne({ ownerId, id });
  },
  async findCurrent(ownerId: string) {
    const { portfolios } = await collections();
    return portfolios.findOne({ ownerId }, { sort: { updatedAt: -1 } });
  },
  async updatePortfolio(ownerId: string, id: number, update: Partial<MongoPortfolio>) {
    const { portfolios } = await collections();
    const result = await portfolios.findOneAndUpdate({ ownerId, id }, { $set: { ...update, updatedAt: new Date() } }, { returnDocument: "after" });
    return result;
  },
  async findPublishedBySlug(slug: string) {
    const { portfolios } = await collections();
    return portfolios.findOne({ slug, status: "published" });
  },
  async listPublished() {
    const { portfolios } = await collections();
    return portfolios.find({ status: "published" }, { projection: { slug: 1, updatedAt: 1, publishedAt: 1 } }).toArray();
  },
  async incrementViews(slug: string) {
    const { portfolios } = await collections();
    return portfolios.findOneAndUpdate({ slug, status: "published" }, { $inc: { views: 1 }, $set: { updatedAt: new Date() } }, { returnDocument: "after" });
  },
  async adminStats() {
    const { users, portfolios } = await collections();
    const [userTotal, portfolioTotal, published, drafts, views, recentUsers, recentPortfolios] = await Promise.all([
      users.countDocuments(), portfolios.countDocuments(), portfolios.countDocuments({ status: "published" }), portfolios.countDocuments({ status: "draft" }),
      portfolios.aggregate<{ total: number }>([{ $group: { _id: null, total: { $sum: "$views" } } }]).next(),
      users.find({}, { projection: { id: 1, name: 1, email: 1, provider: 1, createdAt: 1 }, sort: { createdAt: -1 }, limit: 10 }).toArray(),
      portfolios.find({}, { projection: { id: 1, slug: 1, ownerId: 1, status: 1, views: 1, updatedAt: 1 }, sort: { updatedAt: -1 }, limit: 10 }).toArray(),
    ]);
    return { users: { total: userTotal, recent: recentUsers }, portfolios: { total: portfolioTotal, published, drafts, totalViews: views?.total ?? 0, recent: recentPortfolios } };
  },
};

export const mongoTemplateStore = {
  async list() {
    const { templates } = await collections();
    return templates.find({}, { projection: { _id: 0 }, sort: { createdAt: 1 } }).toArray();
  },
  async upsert(id: string, update: { definition?: unknown; hidden?: boolean }) {
    const { templates } = await collections();
    const now = new Date();
    return templates.findOneAndUpdate(
      { id },
      { $set: { ...update, updatedAt: now }, $setOnInsert: { id, createdAt: now, ...("definition" in update ? {} : { definition: null }), ...("hidden" in update ? {} : { hidden: false }) } },
      { upsert: true, returnDocument: "after", projection: { _id: 0 } },
    );
  },
  async remove(id: string) {
    const { templates } = await collections();
    return (await templates.deleteOne({ id })).deletedCount > 0;
  },
  async getBundle(id: string) {
    const { bundles } = await collections();
    return bundles.findOne({ id }, { projection: { _id: 0 } });
  },
  async putBundle(id: string, version: number, data: string, bytes: number) {
    const { bundles } = await collections();
    await bundles.updateOne({ id }, { $set: { id, version, data, bytes, updatedAt: new Date() } }, { upsert: true });
  },
  async removeBundle(id: string) {
    const { bundles } = await collections();
    await bundles.deleteOne({ id });
  },
  async usage() {
    const { portfolios } = await collections();
    const rows = await portfolios.aggregate<{ _id: string; total: number; published: number }>([
      { $group: { _id: "$templateId", total: { $sum: 1 }, published: { $sum: { $cond: [{ $eq: ["$status", "published"] }, 1, 0] } } } },
    ]).toArray();
    return rows.map((row) => ({ templateId: row._id, total: row.total, published: row.published }));
  },
};

export type { OAuthState, Session };
