import { z } from "zod";
import { ZipError, readZip } from "./zip-reader";
import { TEMPLATE_CATEGORIES, TEMPLATE_GROUPS, groupsForCategory, type TemplateCategoryName, type TemplateGroupName } from "./template-constants";

/*
 * HTML templates: an admin uploads a ZIP holding a manifest (folio-template.json)
 * plus HTML, CSS, JavaScript and images. This module checks the ZIP and turns it
 * into a validated bundle. Rendering (placeholders, inlining, sandboxing) lives
 * in template-render.ts.
 */

export const BUNDLE_LIMITS = {
  zipBytes: 4 * 1024 * 1024,
  entries: 80,
  fileBytes: 1024 * 1024,
  totalBytes: 3 * 1024 * 1024,
  htmlBytes: 512 * 1024,
} as const;

export const MANIFEST_NAMES = ["folio-template.json", "template.json"] as const;
const ALLOWED_EXTENSIONS = new Set([
  "html", "htm", "css", "js", "mjs", "json", "txt", "md",
  "svg", "png", "jpg", "jpeg", "gif", "webp", "avif", "ico",
  "woff", "woff2", "ttf", "otf",
]);
const IGNORED = (path: string) => /(^|\/)(__MACOSX|\.git)\//.test(path) || /(^|\/)(\.DS_Store|Thumbs\.db|desktop\.ini)$/i.test(path);

/* ---------- categories ------------------------------------------------------ */

const normalizeWords = (value: string) =>
  value.toLowerCase().replaceAll("&", " and ").replace(/[^a-z0-9]+/g, " ").trim();

const CATEGORY_ALIASES: Record<TemplateCategoryName, string[]> = {
  Universal: ["universal", "general", "all", "everyone", "any", "other", "anyone"],
  "Software Engineering": ["software engineering", "software", "developer", "developers", "engineer", "engineers", "engineering", "programmer", "programmers", "backend", "full stack", "fullstack", "coding"],
  "Frontend & Mobile": ["frontend and mobile", "frontend", "front end", "mobile", "ui engineer", "app developer", "web developer"],
  "Data & AI": ["data and ai", "data", "ai", "ml", "machine learning", "data science", "data scientist", "analytics", "artificial intelligence"],
  "Cloud & Security": ["cloud and security", "cloud", "security", "devops", "sre", "infrastructure", "cybersecurity", "cyber security"],
  "Design & Creative": ["design and creative", "design", "designer", "designers", "creative", "creatives", "artist", "artists", "photographer", "photographers", "photography", "illustrator", "illustrators"],
  "Writing & Content": ["writing and content", "writing", "writer", "writers", "content", "journalist", "journalists", "journalism", "author", "authors", "editor", "copywriter"],
  "Marketing & Sales": ["marketing and sales", "marketing", "marketer", "marketers", "sales", "growth", "seo"],
  "Business & Consulting": ["business and consulting", "business", "consulting", "consultant", "consultants", "finance", "accounting", "executive", "executives", "management", "manager", "managers", "freelance", "freelancer", "freelancers", "entrepreneur", "entrepreneurs"],
  Education: ["education", "teacher", "teachers", "teaching", "academic", "academia", "researcher", "researchers", "research", "professor", "professors", "tutor", "tutors"],
  Healthcare: ["healthcare", "health", "medical", "medicine", "nurse", "nurses", "doctor", "doctors", "clinical", "care"],
  "Law & Public Service": ["law and public service", "law", "legal", "lawyer", "lawyers", "attorney", "attorneys", "public service", "government", "policy", "nonprofit", "non profit"],
};

const aliasLookup = new Map<string, TemplateCategoryName>();
for (const category of TEMPLATE_CATEGORIES) {
  aliasLookup.set(normalizeWords(category), category);
  for (const alias of CATEGORY_ALIASES[category]) aliasLookup.set(normalizeWords(alias), category);
}

/** Maps what an admin wrote ("developers", "Design", "healthcare"…) to one of Folio's categories. */
export function resolveCategory(input: string): TemplateCategoryName | undefined {
  return aliasLookup.get(normalizeWords(input));
}

export const categoryHelp = () =>
  `Use one of: ${TEMPLATE_CATEGORIES.join(", ")}. Friendly names also work, e.g. developers, designers, writers, marketers, teachers, nurses, lawyers.`;

/* ---------- manifest -------------------------------------------------------- */

const colour = z
  .string()
  .trim()
  .regex(/^(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8})$/, "Use a hex colour like #7c3aed.");

export const BundleManifest = z
  .object({
    id: z
      .string()
      .trim()
      .min(3, "The id needs at least 3 characters.")
      .max(48)
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single dashes, like aurora-dev."),
    name: z.string().trim().min(2).max(60),
    description: z.string().trim().min(10).max(220),
    category: z.string().trim().min(2).max(60),
    groups: z
      .array(z.enum(TEMPLATE_GROUPS))
      .min(1)
      .max(2)
      .refine((groups) => new Set(groups).size === groups.length, "List each group once.")
      .optional(),
    premium: z.boolean().default(false),
    recommendedFor: z.array(z.string().trim().min(2).max(40)).max(8).default([]),
    accent: colour.optional(),
    entry: z.string().trim().min(1).max(120).default("index.html"),
    author: z.string().trim().max(80).optional(),
    version: z.union([z.string().trim().max(20), z.number()]).optional(),
  })
  .strict();

/** What the registry stores for an HTML template (set by the server, never taken from an upload). */
export const StoredBundleDefinition = z.object({
  kind: z.literal("bundle"),
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.enum(TEMPLATE_CATEGORIES),
  groups: z.array(z.enum(TEMPLATE_GROUPS)).min(1),
  premium: z.boolean(),
  recommendedFor: z.array(z.string()).default([]),
  accent: z.string().optional(),
  entry: z.string(),
  bundleVersion: z.number().int().positive(),
  files: z.number().int().nonnegative(),
  bytes: z.number().int().nonnegative(),
});
export type StoredBundleDefinitionValue = z.output<typeof StoredBundleDefinition>;

export type ParsedBundle = {
  /** The definition without a version; the registry assigns bundleVersion when saving. */
  definition: Omit<StoredBundleDefinitionValue, "bundleVersion">;
  files: Map<string, Buffer>;
  manifest: z.output<typeof BundleManifest>;
};

export class BundleError extends Error {
  constructor(message: string, readonly issues: string[] = []) {
    super(message);
  }
}

/** Resolves "./a/../b.css" style paths against the bundle root; null if it would escape it. */
export function normalizeBundlePath(path: string) {
  const parts: string[] = [];
  for (const part of path.replaceAll("\\", "/").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (!parts.length) return null;
      parts.pop();
    } else parts.push(part);
  }
  return parts.length ? parts.join("/") : null;
}

const extensionOf = (path: string) => path.slice(path.lastIndexOf(".") + 1).toLowerCase();

/** Reads and validates a template ZIP. Throws BundleError with plain-language messages. */
export function parseBundleZip(zip: Buffer): ParsedBundle {
  if (zip.length > BUNDLE_LIMITS.zipBytes) throw new BundleError(`This ZIP is larger than ${BUNDLE_LIMITS.zipBytes / 1024 / 1024} MB. Optimise images and fonts and try again.`);
  let entries;
  try {
    entries = readZip(zip, { maxEntries: BUNDLE_LIMITS.entries, maxFileBytes: BUNDLE_LIMITS.fileBytes, maxTotalBytes: BUNDLE_LIMITS.totalBytes });
  } catch (error) {
    if (error instanceof ZipError) throw new BundleError(error.message);
    throw error;
  }

  for (const entry of entries) {
    if (/^(?:\/|[A-Za-z]:)/.test(entry.path) || !normalizeBundlePath(entry.path)) {
      throw new BundleError(`“${entry.path}” has an unsafe path. File paths must stay inside the ZIP.`);
    }
  }
  const kept = entries.map((entry) => ({ ...entry, path: normalizeBundlePath(entry.path)! })).filter((entry) => !IGNORED(entry.path));
  if (!kept.length) throw new BundleError("This ZIP is empty.");

  // A ZIP made by "compress this folder" wraps everything in one folder; look inside it.
  const firstSegments = new Set(kept.map((entry) => entry.path.split("/")[0]));
  const strip = kept.every((entry) => entry.path.includes("/")) && firstSegments.size === 1 ? `${[...firstSegments][0]}/` : "";

  const files = new Map<string, Buffer>();
  const rejected: string[] = [];
  for (const entry of kept) {
    const relative = normalizeBundlePath(strip ? entry.path.slice(strip.length) : entry.path);
    if (!relative) throw new BundleError(`“${entry.path}” has an unsafe path. File paths must stay inside the ZIP.`);
    if (relative.split("/").some((segment) => segment.startsWith("."))) continue; // hidden files
    if (!ALLOWED_EXTENSIONS.has(extensionOf(relative))) rejected.push(relative);
    if (files.has(relative)) throw new BundleError(`“${relative}” appears more than once in this ZIP.`);
    files.set(relative, entry.data);
  }
  if (rejected.length) {
    const shown = rejected.slice(0, 5).join(", ");
    throw new BundleError(`This ZIP contains file types that aren't allowed: ${shown}${rejected.length > 5 ? ` and ${rejected.length - 5} more` : ""}.`, [
      `Allowed: ${[...ALLOWED_EXTENSIONS].join(", ")}.`,
    ]);
  }

  const manifestName = MANIFEST_NAMES.find((name) => files.has(name));
  if (!manifestName) {
    throw new BundleError(`The ZIP needs a ${MANIFEST_NAMES[0]} file at its top level. It says the template's name and category.`, [
      'Example: { "id": "aurora-dev", "name": "Aurora Dev", "description": "…", "category": "developers" }',
    ]);
  }
  let rawManifest: unknown;
  try {
    rawManifest = JSON.parse(files.get(manifestName)!.toString("utf8").replace(/^﻿/, ""));
  } catch {
    throw new BundleError(`${manifestName} isn't valid JSON. Check for a missing comma or quote.`);
  }
  const parsed = BundleManifest.safeParse(rawManifest);
  if (!parsed.success) {
    throw new BundleError(
      `${manifestName} has problems.`,
      parsed.error.issues.slice(0, 12).map((issue) => `${issue.path.length ? issue.path.join(".") : "file"}: ${issue.message}`),
    );
  }
  const manifest = parsed.data;

  const category = resolveCategory(manifest.category);
  if (!category) throw new BundleError(`${manifestName} has problems.`, [`category: “${manifest.category}” isn't a category Folio knows. ${categoryHelp()}`]);
  const groups: TemplateGroupName[] = manifest.groups ?? groupsForCategory(category);

  const entry = normalizeBundlePath(manifest.entry);
  if (!entry || !/\.html?$/i.test(entry)) throw new BundleError(`${manifestName} has problems.`, ["entry: This must be an .html file inside the ZIP, such as index.html."]);
  const entryFile = files.get(entry);
  if (!entryFile) throw new BundleError(`The ZIP has no ${entry}. Add it at the top level, or set "entry" in ${manifestName}.`);
  if (entryFile.length > BUNDLE_LIMITS.htmlBytes) throw new BundleError(`${entry} is larger than ${BUNDLE_LIMITS.htmlBytes / 1024} KB. Move big scripts and styles into separate .js and .css files.`);

  const bytes = [...files.values()].reduce((sum, data) => sum + data.length, 0);
  return {
    manifest,
    files,
    definition: {
      kind: "bundle",
      id: manifest.id,
      name: manifest.name,
      description: manifest.description,
      category,
      groups,
      premium: manifest.premium,
      recommendedFor: manifest.recommendedFor,
      accent: manifest.accent,
      entry,
      files: files.size,
      bytes,
    },
  };
}
