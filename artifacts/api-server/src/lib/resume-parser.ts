import * as zod from "zod";
// @ts-ignore
import pdfParse from "pdf-parse-new";
import mammoth from "mammoth";

export interface PortfolioContent {
  personalInfo: {
    name: string;
    headline: string;
    email: string;
    phone: string;
    location: string;
    summary: string;
    avatar: string | null;
  };
  experience: Array<{
    id: string;
    role: string;
    company: string;
    period: string;
    description: string;
  }>;
  education: Array<{
    id: string;
    school: string;
    degree: string;
    period: string;
  }>;
  skills: string[];
  projects: Array<{
    id: string;
    name: string;
    description: string;
    technologies: string[];
    githubUrl: string;
    liveUrl: string;
    image: string | null;
  }>;
  socialLinks: {
    github: string;
    linkedin: string;
    twitter: string;
    website: string;
  };
}

const portfolioContentSchema = zod.object({
  personalInfo: zod.object({
    name: zod.string().default(""),
    headline: zod.string().default(""),
    email: zod.string().default(""),
    phone: zod.string().default(""),
    location: zod.string().default(""),
    summary: zod.string().default(""),
    avatar: zod.string().nullable().default(null),
  }),
  experience: zod.array(
    zod.object({
      id: zod.string(),
      role: zod.string().default(""),
      company: zod.string().default(""),
      period: zod.string().default(""),
      description: zod.string().default(""),
    })
  ).default([]),
  education: zod.array(
    zod.object({
      id: zod.string(),
      school: zod.string().default(""),
      degree: zod.string().default(""),
      period: zod.string().default(""),
    })
  ).default([]),
  skills: zod.array(zod.string()).default([]),
  projects: zod.array(
    zod.object({
      id: zod.string(),
      name: zod.string().default(""),
      description: zod.string().default(""),
      technologies: zod.array(zod.string()).default([]),
      githubUrl: zod.string().default(""),
      liveUrl: zod.string().default(""),
      image: zod.string().nullable().default(null),
    })
  ).default([]),
  socialLinks: zod.object({
    github: zod.string().default(""),
    linkedin: zod.string().default(""),
    twitter: zod.string().default(""),
    website: zod.string().default(""),
  }).default({ github: "", linkedin: "", twitter: "", website: "" }),
});

export async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === "application/pdf") {
    const data = await pdfParse(buffer);
    if (!data.text || !data.text.trim()) throw new Error("The resume appears to be empty.");
    return data.text;
  }
  
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const result = await mammoth.extractRawText({ buffer });
    if (!result.value || !result.value.trim()) throw new Error("The resume appears to be empty.");
    return result.value;
  }
  
  throw new Error("Upload a PDF or DOCX resume.");
}

const newId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

function normalizeForGrounding(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function appearsInSource(value: string, source: string) {
  const normalized = normalizeForGrounding(value);
  if (!normalized || normalized.length < 2) return true;
  return normalizeForGrounding(source).includes(normalized);
}

export async function structureWithGemini(text: string): Promise<{ content: PortfolioContent; warnings: string[] }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");

  const model = process.env.AI_MODEL || "gemini-2.5-flash";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You extract structured portfolio data from a resume. Use only facts explicitly present in RESUME_TEXT. Never invent employers, roles, dates, education, metrics, projects, links, locations, or contact details. If a field is uncertain, leave it empty. Return only JSON matching the requested shape."
          },
          {
            role: "user",
            content: `Return this exact JSON shape:\n${JSON.stringify({
              personalInfo: {
                name: "",
                headline: "",
                email: "",
                phone: "",
                location: "",
                summary: "",
                avatar: null
              },
              experience: [
                {
                  id: "",
                  role: "",
                  company: "",
                  period: "",
                  description: ""
                }
              ],
              education: [
                {
                  id: "",
                  school: "",
                  degree: "",
                  period: ""
                }
              ],
              skills: [""],
              projects: [
                {
                  id: "",
                  name: "",
                  description: "",
                  technologies: [""],
                  githubUrl: "",
                  liveUrl: "",
                  image: null
                }
              ],
              socialLinks: {
                github: "",
                linkedin: "",
                twitter: "",
                website: ""
              }
            }, null, 2)}\n\nRESUME_TEXT\n---\n${text}\n---`
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API returned ${response.status}`);
    }

    const payload = await response.json() as any;
    const raw = payload.choices?.[0]?.message?.content;
    if (!raw) throw new Error("Gemini returned empty response.");

    const parsed = JSON.parse(raw);
    const content = portfolioContentSchema.parse(parsed) as PortfolioContent;

    // Generate unique IDs if missing
    content.experience.forEach(exp => { if (!exp.id) exp.id = newId("exp"); });
    content.education.forEach(edu => { if (!edu.id) edu.id = newId("edu"); });
    content.projects.forEach(proj => { if (!proj.id) proj.id = newId("proj"); });

    // Grounding audit
    const warnings = new Set<string>();

    const directFields = ["name", "email", "phone", "location"] as const;
    for (const field of directFields) {
      const val = content.personalInfo[field];
      if (val && !appearsInSource(val, text)) warnings.add(`personalInfo.${field}`);
    }

    content.experience.forEach((entry, index) => {
      if (!appearsInSource(entry.company, text) || !appearsInSource(entry.role, text)) {
        warnings.add(`experience.${index}`);
      }
    });

    content.projects.forEach((entry, index) => {
      if (!appearsInSource(entry.name, text)) warnings.add(`projects.${index}`);
    });

    content.education.forEach((entry, index) => {
      if (!appearsInSource(entry.school, text) || !appearsInSource(entry.degree, text)) {
        warnings.add(`education.${index}`);
      }
    });

    const finalWarnings = Array.from(warnings).map(w => `Unverified field: ${w}`);

    return {
      content,
      warnings: finalWarnings.length ? finalWarnings : ["Review every extracted field before publishing. Folio never invents employers, achievements, metrics, or qualifications."],
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function structureLocally(text: string): { content: PortfolioContent; warnings: string[] } {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
  const phone = text.match(/(?:\+?\d[\d\s().-]{7,}\d)/)?.[0]?.replace(/\s+/g, " ").trim() ?? "";
  const urls = Array.from(text.match(/https?:\/\/[^\s)>]+/gi) ?? []);
  const linkedin = urls.find((url) => /linkedin\.com/i.test(url)) ?? "";
  const github = urls.find((url) => /github\.com/i.test(url)) ?? "";
  const website = urls.find((url) => url !== linkedin && url !== github) ?? "";
  
  const name = lines.find(
    (line) =>
      line.length <= 70 &&
      !line.includes("@") &&
      !/resume|curriculum|vitae|portfolio|https?:|linkedin|github|\d{4}/i.test(line)
  ) ?? "";

  const content: PortfolioContent = {
    personalInfo: {
      name,
      headline: "",
      email,
      phone,
      location: "",
      summary: "",
      avatar: null,
    },
    experience: [],
    education: [],
    skills: [],
    projects: [],
    socialLinks: {
      github,
      linkedin,
      twitter: "",
      website,
    },
  };

  return {
    content,
    warnings: [
      "AI was unavailable, so Folio used its local parser. Review all fields.",
      "Review every extracted field before publishing. Folio never invents employers, achievements, metrics, or qualifications."
    ],
  };
}
