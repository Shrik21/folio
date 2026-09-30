import { portfolioContentSchema, type PortfolioContent, newId } from "./portfolio";

export type AiStructureResult = {
  content: PortfolioContent;
  reviewFields: string[];
  provider: "gemini" | "ai" | "grounded-local";
  message: string;
};

type ResumeSection = "summary" | "skills" | "experience" | "projects" | "education";

const SECTION_NAMES: Record<string, ResumeSection> = {
  experience: "experience",
  "work experience": "experience",
  employment: "experience",
  "professional experience": "experience",
  projects: "projects",
  "selected projects": "projects",
  skills: "skills",
  "technical skills": "skills",
  education: "education",
  profile: "summary",
  summary: "summary",
  "professional summary": "summary",
};

function cleanLines(source: string) {
  return source
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function splitItems(value: string) {
  return value
    .split(/[,|•·;]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 1 && item.length < 80);
}

export function structureResumeLocally(source: string): AiStructureResult {
  const lines = cleanLines(source);
  const sectionLines: Record<ResumeSection, string[]> = {
    summary: [],
    skills: [],
    experience: [],
    projects: [],
    education: [],
  };
  let section: ResumeSection = "summary";

  for (const line of lines) {
    const matched = SECTION_NAMES[line.toLowerCase()];
    if (matched) {
      section = matched;
      continue;
    }
    sectionLines[section].push(line);
  }

  const email = source.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
  const phone =
    source
      .match(/(?:\+?\d[\d\s().-]{7,}\d)/)?.[0]
      ?.replace(/\s+/g, " ")
      .trim() ?? "";
  const urls = Array.from(source.match(/https?:\/\/[^\s)>]+/gi) ?? []);
  const linkedin = urls.find((url) => /linkedin\.com/i.test(url)) ?? "";
  const github = urls.find((url) => /github\.com/i.test(url)) ?? "";
  const website = urls.find((url) => url !== linkedin && url !== github) ?? "";
  const name =
    lines.find(
      (line) =>
        line.length <= 70 &&
        !line.includes("@") &&
        !/resume|curriculum|vitae|portfolio|https?:|linkedin|github|\d{4}/i.test(line),
    ) ?? "";

  const summary = sectionLines["summary"]
    .filter((line) => line !== name && line !== email && line !== phone && !urls.includes(line))
    .slice(0, 4)
    .join(" ")
    .slice(0, 1200);
  const skills = sectionLines["skills"].flatMap(splitItems).slice(0, 40);

  const content: PortfolioContent = {
    fullName: name,
    headline: "",
    summary,
    location: "",
    email,
    phone,
    website,
    linkedin,
    github,
    skills,
    experience: sectionLines["experience"].length
      ? [
          {
            id: newId("experience"),
            company: "",
            role: "",
            startDate: "",
            endDate: "",
            description: sectionLines["experience"].join("\n").slice(0, 4000),
            highlights: [],
            needsReview: true,
          },
        ]
      : [],
    projects: sectionLines["projects"].length
      ? [
          {
            id: newId("project"),
            name: "",
            description: sectionLines["projects"].join("\n").slice(0, 4000),
            outcome: "",
            url: "",
            technologies: [],
            needsReview: true,
          },
        ]
      : [],
    education: sectionLines["education"].length
      ? [
          {
            id: newId("education"),
            institution: "",
            qualification: sectionLines["education"].join(" · ").slice(0, 240),
            startDate: "",
            endDate: "",
            needsReview: true,
          },
        ]
      : [],
  };

  const reviewFields = [
    ...(!content.fullName ? ["fullName"] : []),
    "headline",
    ...(!content.summary ? ["summary"] : []),
    ...content.experience.map((_, index) => `experience.${index}`),
    ...content.projects.map((_, index) => `projects.${index}`),
    ...content.education.map((_, index) => `education.${index}`),
  ];

  return {
    content,
    reviewFields,
    provider: "grounded-local",
    message:
      "Folio extracted only high-confidence fields locally. Review the highlighted sections before publishing.",
  };
}

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

export function auditAiContent(
  value: unknown,
  source: string,
  provider: AiStructureResult["provider"] = "ai",
): AiStructureResult {
  const content = portfolioContentSchema.parse(value);
  const reviewFields = new Set<string>();

  const directFields: Array<
    keyof Pick<
      PortfolioContent,
      "fullName" | "email" | "phone" | "location" | "website" | "linkedin" | "github"
    >
  > = ["fullName", "email", "phone", "location", "website", "linkedin", "github"];

  for (const field of directFields) {
    if (content[field] && !appearsInSource(content[field], source)) reviewFields.add(field);
  }

  content.experience = content.experience.map((entry, index) => {
    const grounded = appearsInSource(entry.company, source) && appearsInSource(entry.role, source);
    if (!grounded) reviewFields.add(`experience.${index}`);
    return { ...entry, needsReview: entry.needsReview || !grounded };
  });

  content.projects = content.projects.map((entry, index) => {
    const grounded = appearsInSource(entry.name, source);
    if (!grounded) reviewFields.add(`projects.${index}`);
    return { ...entry, needsReview: entry.needsReview || !grounded };
  });

  content.education = content.education.map((entry, index) => {
    const grounded =
      appearsInSource(entry.institution, source) && appearsInSource(entry.qualification, source);
    if (!grounded) reviewFields.add(`education.${index}`);
    return { ...entry, needsReview: entry.needsReview || !grounded };
  });

  return {
    content,
    reviewFields: [...reviewFields],
    provider,
    message: reviewFields.size
      ? `AI structured the résumé and flagged ${reviewFields.size} field${reviewFields.size === 1 ? "" : "s"} for review.`
      : "AI structured the résumé. Review the result before publishing.",
  };
}

export async function structureResumeWithAi(source: string): Promise<AiStructureResult> {
  const geminiApiKey = process.env["GEMINI_API_KEY"];
  const apiKey = geminiApiKey || process.env["AI_API_KEY"];
  if (!apiKey) return structureResumeLocally(source);

  const baseUrl = (
    process.env["AI_BASE_URL"] ??
    (geminiApiKey
      ? "https://generativelanguage.googleapis.com/v1beta/openai"
      : "https://api.openai.com/v1")
  ).replace(/\/$/, "");
  const model = process.env["AI_MODEL"] ?? (geminiApiKey ? "gemini-3.8-flash" : "gpt-4.1-mini");
  const provider: AiStructureResult["provider"] = geminiApiKey ? "gemini" : "ai";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
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
            content:
              "You extract structured portfolio data from a resume. Use only facts explicitly present in RESUME_TEXT. Never invent employers, roles, dates, education, metrics, projects, links, locations, or contact details. Preserve measurable outcomes verbatim. If a field is uncertain, leave it empty and set needsReview=true. Return only JSON matching the requested shape.",
          },
          {
            role: "user",
            content: `Return this exact JSON shape:\n${JSON.stringify({
              fullName: "",
              headline: "",
              summary: "",
              location: "",
              email: "",
              phone: "",
              website: "",
              linkedin: "",
              github: "",
              skills: [""],
              experience: [
                {
                  id: "experience-unique",
                  company: "",
                  role: "",
                  startDate: "",
                  endDate: "",
                  description: "",
                  highlights: [""],
                  needsReview: false,
                },
              ],
              projects: [
                {
                  id: "project-unique",
                  name: "",
                  description: "",
                  outcome: "",
                  url: "",
                  technologies: [""],
                  needsReview: false,
                },
              ],
              education: [
                {
                  id: "education-unique",
                  institution: "",
                  qualification: "",
                  startDate: "",
                  endDate: "",
                  needsReview: false,
                },
              ],
            })}\n\nRESUME_TEXT\n---\n${source}\n---`,
          },
        ],
      }),
    });

    if (!response.ok) throw new Error(`AI provider returned ${response.status}`);
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = payload.choices?.[0]?.message?.content;
    if (!raw) throw new Error("AI provider returned no structured content");
    return auditAiContent(JSON.parse(raw), source, provider);
  } catch (error) {
    console.error("AI structuring failed; using grounded local parser", error);
    const fallback = structureResumeLocally(source);
    return {
      ...fallback,
      message: "AI was unavailable, so Folio used its private local parser. Review all fields.",
    };
  } finally {
    clearTimeout(timeout);
  }
}
