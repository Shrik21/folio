import { z } from "zod";

const text = z.string().trim().max(5000);
const shortText = z.string().trim().max(240);

export const experienceSchema = z.object({
  id: z.string(),
  company: shortText,
  role: shortText,
  startDate: z.string().max(40),
  endDate: z.string().max(40),
  description: text,
  highlights: z.array(shortText).max(12),
  needsReview: z.boolean().default(false),
});

export const projectSchema = z.object({
  id: z.string(),
  name: shortText,
  description: text,
  outcome: text,
  url: z.string().max(500),
  technologies: z.array(shortText).max(30),
  needsReview: z.boolean().default(false),
});

export const educationSchema = z.object({
  id: z.string(),
  institution: shortText,
  qualification: shortText,
  startDate: z.string().max(40),
  endDate: z.string().max(40),
  needsReview: z.boolean().default(false),
});

export const portfolioContentSchema = z.object({
  fullName: shortText,
  headline: shortText,
  summary: text,
  location: shortText,
  email: z.string().max(320),
  phone: z.string().max(80),
  website: z.string().max(500),
  linkedin: z.string().max(500),
  github: z.string().max(500),
  skills: z.array(shortText).max(80),
  experience: z.array(experienceSchema).max(30),
  projects: z.array(projectSchema).max(30),
  education: z.array(educationSchema).max(20),
});

export type PortfolioContent = z.infer<typeof portfolioContentSchema>;
export type Experience = z.infer<typeof experienceSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Education = z.infer<typeof educationSchema>;

export const emptyPortfolioContent: PortfolioContent = {
  fullName: "",
  headline: "",
  summary: "",
  location: "",
  email: "",
  phone: "",
  website: "",
  linkedin: "",
  github: "",
  skills: [],
  experience: [],
  projects: [],
  education: [],
};

export function normalizePortfolioContent(value: unknown): PortfolioContent {
  const parsed = portfolioContentSchema.safeParse(value);
  if (parsed.success) return parsed.data;

  if (!value || typeof value !== "object" || Array.isArray(value)) return emptyPortfolioContent;
  const partial = value as Partial<PortfolioContent>;
  return portfolioContentSchema.parse({
    ...emptyPortfolioContent,
    ...partial,
    skills: Array.isArray(partial.skills) ? partial.skills : [],
    experience: Array.isArray(partial.experience) ? partial.experience : [],
    projects: Array.isArray(partial.projects) ? partial.projects : [],
    education: Array.isArray(partial.education) ? partial.education : [],
  });
}

export function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function safeExternalUrl(value: string) {
  if (!value) return null;
  try {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    const url = new URL(withProtocol);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function newId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
