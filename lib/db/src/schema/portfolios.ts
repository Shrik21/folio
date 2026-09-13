import { integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const portfoliosTable = pgTable("portfolios", {
  id: serial("id").primaryKey(),
  ownerId: text("owner_id").notNull().default("demo-user"),
  slug: text("slug").notNull().unique(),
  profession: text("profession").notNull(),
  purpose: text("purpose").notNull(),
  templateId: text("template_id").notNull(),
  status: text("status").notNull().default("draft"),
  content: jsonb("content").notNull(),
  views: integer("views").notNull().default(0),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPortfolioSchema = createInsertSchema(portfoliosTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPortfolio = z.infer<typeof insertPortfolioSchema>;
export type PortfolioRow = typeof portfoliosTable.$inferSelect;