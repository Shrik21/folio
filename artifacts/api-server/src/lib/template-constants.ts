/** Lists shared by template validation (JSON files and ZIP bundles). */

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

export type TemplateGroupName = (typeof TEMPLATE_GROUPS)[number];
export type TemplateCategoryName = (typeof TEMPLATE_CATEGORIES)[number];

/** Categories shown under "Technical"; "Universal" appears in both groups, the rest are non-technical. */
export const TECHNICAL_CATEGORIES: readonly TemplateCategoryName[] = ["Software Engineering", "Frontend & Mobile", "Data & AI", "Cloud & Security"];

export function groupsForCategory(category: TemplateCategoryName): TemplateGroupName[] {
  if (category === "Universal") return ["technical", "non-technical"];
  return TECHNICAL_CATEGORIES.includes(category) ? ["technical"] : ["non-technical"];
}
