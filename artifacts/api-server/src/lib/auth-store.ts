import { randomUUID } from "node:crypto";
import { and, eq, gt, lte } from "drizzle-orm";
import { db, oauthStatesTable, sessionsTable, usersTable } from "@workspace/db";
import { isMongoDatabase, mongoStore } from "@workspace/db";
import type { AuthStore, AuthUser } from "./auth-core";

const publicUser = (user: typeof usersTable.$inferSelect): AuthUser => ({ id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, provider: user.provider });

export const authStore: AuthStore = {
  async saveState(state) { if (isMongoDatabase()) return mongoStore.saveState(state); await db.insert(oauthStatesTable).values(state); },
  async consumeState(stateHash, browserHash, provider, now) {
    if (isMongoDatabase()) return (await mongoStore.consumeState(stateHash, browserHash, provider, now)) ?? undefined;
    // Deletion returns the row atomically, so even concurrent callbacks can only use it once.
    const [state] = await db.delete(oauthStatesTable).where(and(eq(oauthStatesTable.stateHash, stateHash), eq(oauthStatesTable.browserHash, browserHash), eq(oauthStatesTable.provider, provider), gt(oauthStatesTable.expiresAt, now))).returning();
    return state;
  },
  async upsertUser(identity) {
    if (isMongoDatabase()) {
      const user = await mongoStore.upsertUser(identity);
      return { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, provider: user.provider };
    }
    // A provider's stable subject is the identity. Matching emails never link accounts.
    const [user] = await db.insert(usersTable).values({ id: randomUUID(), ...identity }).onConflictDoUpdate({
      target: [usersTable.provider, usersTable.providerUserId],
      set: { name: identity.name, email: identity.email, avatarUrl: identity.avatarUrl },
    }).returning();
    return publicUser(user);
  },
  async saveSession(tokenHash, userId, expiresAt) { if (isMongoDatabase()) return mongoStore.saveSession({ tokenHash, userId, expiresAt }); await db.insert(sessionsTable).values({ tokenHash, userId, expiresAt }); },
  async getSession(tokenHash, now) {
    if (isMongoDatabase()) {
      const user = await mongoStore.getSession(tokenHash, now);
      return user ? { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, provider: user.provider } : undefined;
    }
    const [row] = await db.select({ user: usersTable }).from(sessionsTable).innerJoin(usersTable, eq(sessionsTable.userId, usersTable.id)).where(and(eq(sessionsTable.tokenHash, tokenHash), gt(sessionsTable.expiresAt, now))).limit(1);
    return row ? publicUser(row.user) : undefined;
  },
  async deleteSession(tokenHash) { if (isMongoDatabase()) return mongoStore.deleteSession(tokenHash); await db.delete(sessionsTable).where(eq(sessionsTable.tokenHash, tokenHash)); },
  async cleanup(now) {
    if (isMongoDatabase()) return mongoStore.cleanup(now);
    await db.delete(oauthStatesTable).where(lte(oauthStatesTable.expiresAt, now));
    await db.delete(sessionsTable).where(lte(sessionsTable.expiresAt, now));
  },
};
