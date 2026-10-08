import { z } from "zod";
import { count, eq, sql } from "drizzle-orm";
import { db, isMongoDatabase, mongoTemplateStore, portfoliosTable, templateDefinitionsTable } from "@workspace/db";
import { getTemplate as getBuiltInTemplate, portfolioTemplates, type PortfolioTemplate } from "./portfolio-catalog";
import { logger } from "./logger";

/*
 * Templates = the built-in catalog + what admins upload.
 *
 * An admin uploads a small JSON "template definition": names, category, which
 * of the 12 built-in layouts to use, and a palette and fonts. Nothing in it is
 * code or raw CSS. Colours, fonts and layouts are checked against strict
 * lists here, and the frontend applies them through the same theme system the
 * built-in templates use.
 */

export const TEMPLATE_LAYOUTS = [
  "clean", "developer", "bento", "sidebar", "editorial", "minimal",
  "split", "gallery", "timeline", "academic", "creative", "executive",
] as const;
export const TEMPLATE_FONTS = ["inter", "bricolage", "playfair", "garamond", "grotesk", "mono", "syne", "outfit"] as const;
export const TEMPLATE_GROUPS = ["technical", "non-technical"] as const;
export const TEMPLATE_CATEGORIES = [
  "Universal", "Software Engineering", "Frontend & Mobile", "Data & AI", "Cloud & Security",
  "Design & Creative", "Writing & Content", "Marketing & Sales", "Business & Consulting",
  "Education", "Healthcare", "Law & Public Service",
] as const;
export const THEME_COLOR_KEYS = [
  "bg", "surface", "surfaceAlt", "text", "muted", "border", "accent", "accentText", "onAccent", "highlight", "ink", "onInk",
] as const;

const color = z
  .string()
  .trim()
  .regex(
    /^(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\))$/,
    "Use a hex colour like #1f2937, or rgba(0, 0, 0, 0.1).",
  );

export const TemplateThemeDefinition = z
  .object({
    base: z.enum(["light", "dark"]).default("light"),
    ...Object.fromEntries(THEME_COLOR_KEYS.map((key) => [key, color.optional()])) as Record<(typeof THEME_COLOR_KEYS)[number], z.ZodOptional<typeof color>>,
    headingFont: z.enum(TEMPLATE_FONTS).optional(),
    bodyFont: z.enum(TEMPLATE_FONTS).optional(),
    monoFont: z.enum(TEMPLATE_FONTS).optional(),
    radius: z.number().int().min(0).max(40).optional(),
  })
  .strict();

export const TemplateDefinition = z
  .object({
    version: z.literal(1).optional(),
    id: z
      .string()
      .trim()
      .min(3, "The id needs at least 3 characters.")
      .max(48)
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single dashes, like sunset-pro."),
    name: z.string().trim().min(2).max(60),
    description: z.string().trim().min(10).max(220),
    groups: z
      .array(z.enum(TEMPLATE_GROUPS))
      .min(1)
      .max(2)
      .refine((groups) => new Set(groups).size === groups.length, "List each group once."),
    category: z.enum(TEMPLATE_CATEGORIES),
    premium: z.boolean().default(false),
    layout: z.enum(TEMPLATE_LAYOUTS),
    recommendedFor: z.array(z.string().trim().min(2).max(40)).max(8).default([]),
    theme: TemplateThemeDefinition.default({}),
  })
  .strict();

export type TemplateDefinitionInput = z.input<typeof TemplateDefinition>;
export type TemplateDefinitionValue = z.output<typeof TemplateDefinition>;
export type TemplateSource = "built-in" | "custom" | "modified";

export type ResolvedTemplate = PortfolioTemplate & {
  groups?: (typeof TEMPLATE_GROUPS)[number][];
  /** Present only for uploaded designs; built-in looks live in the frontend catalog. */
  theme?: z.output<typeof TemplateThemeDefinition>;
  hidden: boolean;
  source: TemplateSource;
  updatedAt?: string;
};

type StoredRecord = { id: string; definition: unknown; hidden: boolean; createdAt: Date; updatedAt: Date };
type ValidRecord = Omit<StoredRecord, "definition"> & { definition: TemplateDefinitionValue | null };

/** Turns zod issues into short messages an admin can act on. */
export function describeIssues(error: z.ZodError) {
  return error.issues.slice(0, 12).map((issue) => {
    const where = issue.path.length ? issue.path.join(".") : "file";
    return `${where}: ${issue.message}`;
  });
}

const store = {
  async list(): Promise<StoredRecord[]> {
    if (isMongoDatabase()) return (await mongoTemplateStore.list()) as StoredRecord[];
    return db.select().from(templateDefinitionsTable);
  },
  async upsert(id: string, update: { definition?: TemplateDefinitionValue | null; hidden?: boolean }) {
    if (isMongoDatabase()) {
      await mongoTemplateStore.upsert(id, update);
      return;
    }
    await db
      .insert(templateDefinitionsTable)
      .values({ id, definition: update.definition ?? null, hidden: update.hidden ?? false })
      .onConflictDoUpdate({ target: templateDefinitionsTable.id, set: { ...update, updatedAt: new Date() } });
  },
  async remove(id: string) {
    if (isMongoDatabase()) return mongoTemplateStore.remove(id);
    const removed = await db.delete(templateDefinitionsTable).where(eq(templateDefinitionsTable.id, id)).returning();
    return removed.length > 0;
  },
  async usage(): Promise<{ templateId: string; total: number; published: number }[]> {
    if (isMongoDatabase()) return mongoTemplateStore.usage();
    const rows = await db
      .select({
        templateId: portfoliosTable.templateId,
        total: count(),
        published: sql<number>`count(*) filter (where ${portfoliosTable.status} = 'published')`,
      })
      .from(portfoliosTable)
      .groupBy(portfoliosTable.templateId);
    return rows.map((row) => ({ templateId: row.templateId, total: Number(row.total), published: Number(row.published) }));
  },
};

const CACHE_MS = 30_000;
const RETRY_MS = 10_000;
let cache: { at: number; ttl: number; records: ValidRecord[] } | undefined;

async function withTimeout<T>(promise: Promise<T>, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}

/** Uploaded records, cached briefly. If the database is unreachable the site keeps working with the built-ins. */
async function readRecords(): Promise<ValidRecord[]> {
  if (cache && Date.now() - cache.at < cache.ttl) return cache.records;
  try {
    const rows = await withTimeout(store.list(), 4000);
    const records = rows.flatMap((row): ValidRecord[] => {
      if (row.definition == null) return [{ ...row, definition: null }];
      const parsed = TemplateDefinition.safeParse(row.definition);
      if (!parsed.success) {
        logger.warn({ templateId: row.id, issues: describeIssues(parsed.error) }, "Skipping an invalid stored template");
        return [];
      }
      return [{ ...row, definition: parsed.data }];
    });
    cache = { at: Date.now(), ttl: CACHE_MS, records };
  } catch (error) {
    logger.error({ err: error }, "Could not load uploaded templates; showing built-in templates only");
    cache = { at: Date.now(), ttl: RETRY_MS, records: cache?.records ?? [] };
  }
  return cache.records;
}

export function invalidateTemplateCache() {
  cache = undefined;
}

function fromDefinition(definition: TemplateDefinitionValue, record: ValidRecord, source: TemplateSource): ResolvedTemplate {
  return {
    id: definition.id,
    name: definition.name,
    category: definition.category,
    description: definition.description,
    premium: definition.premium,
    accent: definition.theme.accent ?? (definition.theme.base === "dark" ? "#77e6c0" : "#2f6fed"),
    layout: definition.layout,
    recommendedFor: definition.recommendedFor,
    groups: definition.groups,
    theme: definition.theme,
    hidden: record.hidden,
    source,
    updatedAt: record.updatedAt.toISOString(),
  };
}

/** Every template, including hidden ones: built-ins in catalog order, then uploads oldest first. */
export async function listAllTemplates(): Promise<ResolvedTemplate[]> {
  const records = await readRecords();
  const byId = new Map(records.map((record) => [record.id, record]));
  const builtIns = portfolioTemplates.map((template): ResolvedTemplate => {
    const record = byId.get(template.id);
    if (record?.definition) return fromDefinition(record.definition, record, "modified");
    return { ...template, hidden: record?.hidden ?? false, source: "built-in", updatedAt: record?.updatedAt.toISOString() };
  });
  const custom = records
    .filter((record) => record.definition && !getBuiltInTemplate(record.id))
    .map((record) => fromDefinition(record.definition!, record, "custom"));
  return [...builtIns, ...custom];
}

/** Templates people can choose and see. */
export async function listVisibleTemplates() {
  return (await listAllTemplates()).filter((template) => !template.hidden);
}

export async function resolveTemplate(id: string) {
  return (await listAllTemplates()).find((template) => template.id === id);
}

/** Can a portfolio switch to (or be created with) this template? */
export async function isSelectableTemplate(id: string) {
  const template = await resolveTemplate(id);
  return Boolean(template && !template.hidden);
}

export async function saveTemplateDefinition(definition: TemplateDefinitionValue) {
  await store.upsert(definition.id, { definition });
  invalidateTemplateCache();
  return resolveTemplate(definition.id);
}

/** Hide or show a template. Hiding a built-in keeps its original look. */
export async function setTemplateHidden(id: string, hidden: boolean) {
  await store.upsert(id, { hidden });
  invalidateTemplateCache();
  return resolveTemplate(id);
}

/** Deletes an uploaded template, or resets a built-in one to its original look and visibility. */
export async function removeTemplateRecord(id: string) {
  const removed = await store.remove(id);
  invalidateTemplateCache();
  return removed;
}

export async function templateUsage() {
  return store.usage();
}
