import { boolean, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Templates managed from the admin panel. A row either adds a new template
 * (`definition` set, id not built in), restyles a built-in one (`definition`
 * set, built-in id), or only hides a built-in one (`definition` null).
 * The definition is validated by the API before it is stored.
 */
export const templateDefinitionsTable = pgTable("template_definitions", {
  id: text("id").primaryKey(),
  definition: jsonb("definition"),
  hidden: boolean("hidden").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type TemplateDefinitionRow = typeof templateDefinitionsTable.$inferSelect;

/**
 * The uploaded ZIP for an HTML template, stored as base64 text. Kept apart from
 * `template_definitions` so the template list stays small and fast.
 */
export const templateBundlesTable = pgTable("template_bundles", {
  id: text("id").primaryKey(),
  version: integer("version").notNull(),
  data: text("data").notNull(),
  bytes: integer("bytes").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
