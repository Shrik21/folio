import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  CreatePortfolioBody,
  CreatePortfolioResponse,
  GetCurrentPortfolioResponse,
  GetPortfolioParams,
  GetPortfolioResponse,
  GetPublicPortfolioParams,
  GetPublicPortfolioResponse,
  ListTemplatesResponse,
  ParseResumeBody,
  ParseResumeResponse,
  PublishPortfolioParams,
  PublishPortfolioResponse,
  UnpublishPortfolioParams,
  UnpublishPortfolioResponse,
  UpdatePortfolioBody,
  UpdatePortfolioParams,
  UpdatePortfolioResponse,
} from "@workspace/api-zod";
import { db, portfoliosTable } from "@workspace/db";
import { portfolioTemplates } from "../lib/portfolio-catalog";

const router: IRouter = Router();
const DEMO_OWNER_ID = "demo-user";

const emptyContent = () => ({
  personalInfo: {
    name: "",
    headline: "",
    email: "",
    phone: "",
    location: "",
    summary: "",
    avatar: null,
  },
  experience: [],
  education: [],
  skills: [],
  projects: [],
  socialLinks: {
    github: "",
    linkedin: "",
    twitter: "",
    website: "",
  },
});

const starterContent = () => ({
  personalInfo: {
    name: "Jordan Lee",
    headline: "Product-minded software engineer",
    email: "jordan.lee@example.com",
    phone: "",
    location: "Bengaluru, India",
    summary:
      "I build thoughtful digital products at the intersection of technology, craft, and useful outcomes.",
    avatar: null,
  },
  experience: [
    {
      id: "exp-1",
      role: "Senior Software Engineer",
      company: "Northstar Labs",
      period: "2022 — Present",
      description:
        "Leading product engineering across a small, multidisciplinary team. I care about clear systems, useful defaults, and shipping work people can feel.",
    },
  ],
  education: [
    {
      id: "edu-1",
      school: "National Institute of Technology",
      degree: "B.Tech, Computer Science",
      period: "2017 — 2021",
    },
  ],
  skills: ["TypeScript", "React", "Node.js", "Product thinking", "Systems design"],
  projects: [
    {
      id: "project-1",
      name: "Atlas Workspace",
      description:
        "A shared workspace that helps teams turn scattered research into decisions they can act on.",
      technologies: ["React", "TypeScript", "PostgreSQL"],
      githubUrl: "",
      liveUrl: "",
      image: null,
    },
    {
      id: "project-2",
      name: "Signal Notes",
      description:
        "A focused note-taking tool designed around retrieval, context, and less noise.",
      technologies: ["Next.js", "Prisma", "Design systems"],
      githubUrl: "",
      liveUrl: "",
      image: null,
    },
  ],
  socialLinks: {
    github: "github.com/jordanlee",
    linkedin: "linkedin.com/in/jordanlee",
    twitter: "",
    website: "",
  },
});

const toResponse = (row: typeof portfoliosTable.$inferSelect) => ({
  id: String(row.id),
  slug: row.slug,
  profession: row.profession,
  purpose: row.purpose,
  templateId: row.templateId,
  status: row.status === "published" ? "published" as const : "draft" as const,
  content: row.content,
  views: row.views,
  updatedAt: row.updatedAt.toISOString(),
  publishedAt: row.publishedAt?.toISOString() ?? null,
});

const makeSlug = async (name: string, currentId?: number) => {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "your-portfolio";
  let slug = base;
  let suffix = 2;
  while (true) {
    const matches = await db
      .select({ id: portfoliosTable.id })
      .from(portfoliosTable)
      .where(eq(portfoliosTable.slug, slug))
      .limit(1);
    if (matches.length === 0 || matches[0].id === currentId) return slug;
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
};

const findCurrent = async () => {
  const rows = await db
    .select()
    .from(portfoliosTable)
    .where(eq(portfoliosTable.ownerId, DEMO_OWNER_ID))
    .orderBy(desc(portfoliosTable.updatedAt))
    .limit(1);
  return rows[0];
};

const ensureCurrent = async () => {
  const existing = await findCurrent();
  if (existing) return existing;
  const [created] = await db
    .insert(portfoliosTable)
    .values({
      ownerId: DEMO_OWNER_ID,
      slug: "jordan-lee",
      profession: "Software Developer",
      purpose: "Personal Branding",
      templateId: "clean-professional",
      status: "draft",
      content: starterContent(),
    })
    .returning();
  return created;
};

router.get("/templates", (_req, res) => {
  res.json(ListTemplatesResponse.parse(portfolioTemplates));
});

router.get("/portfolios", async (_req, res): Promise<void> => {
  const portfolio = await ensureCurrent();
  res.json(GetCurrentPortfolioResponse.parse(toResponse(portfolio)));
});

router.post("/portfolios", async (req, res): Promise<void> => {
  const parsed = CreatePortfolioBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Please review the required portfolio fields." });
    return;
  }
  const slug = await makeSlug(parsed.data.content.personalInfo.name);
  const [created] = await db
    .insert(portfoliosTable)
    .values({
      ownerId: DEMO_OWNER_ID,
      slug,
      profession: parsed.data.profession,
      purpose: parsed.data.purpose,
      templateId: parsed.data.templateId,
      status: "draft",
      content: parsed.data.content,
    })
    .returning();
  res.status(201).json(CreatePortfolioResponse.parse(toResponse(created)));
});

router.get("/portfolios/:id", async (req, res): Promise<void> => {
  const params = GetPortfolioParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "That portfolio could not be found." });
    return;
  }
  const [portfolio] = await db
    .select()
    .from(portfoliosTable)
    .where(and(eq(portfoliosTable.id, Number(params.data.id)), eq(portfoliosTable.ownerId, DEMO_OWNER_ID)))
    .limit(1);
  if (!portfolio) {
    res.status(404).json({ error: "That portfolio could not be found." });
    return;
  }
  res.json(GetPortfolioResponse.parse(toResponse(portfolio)));
});

router.patch("/portfolios/:id", async (req, res): Promise<void> => {
  const params = UpdatePortfolioParams.safeParse(req.params);
  const parsed = UpdatePortfolioBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "Please review your portfolio changes." });
    return;
  }
  const existing = await findCurrent();
  if (!existing || existing.id !== Number(params.data.id)) {
    res.status(404).json({ error: "That portfolio could not be found." });
    return;
  }
  const nextName = parsed.data.content?.personalInfo.name ?? (existing.content as { personalInfo: { name: string } }).personalInfo.name;
  const [updated] = await db
    .update(portfoliosTable)
    .set({
      profession: parsed.data.profession ?? existing.profession,
      purpose: parsed.data.purpose ?? existing.purpose,
      templateId: parsed.data.templateId ?? existing.templateId,
      content: parsed.data.content ?? existing.content,
      slug: parsed.data.content ? await makeSlug(nextName, existing.id) : existing.slug,
    })
    .where(eq(portfoliosTable.id, existing.id))
    .returning();
  res.json(UpdatePortfolioResponse.parse(toResponse(updated)));
});

router.post("/portfolios/:id/publish", async (req, res): Promise<void> => {
  const params = PublishPortfolioParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "That portfolio could not be published." });
    return;
  }
  const existing = await findCurrent();
  if (!existing || existing.id !== Number(params.data.id)) {
    res.status(404).json({ error: "That portfolio could not be found." });
    return;
  }
  const [updated] = await db
    .update(portfoliosTable)
    .set({ status: "published", publishedAt: new Date() })
    .where(eq(portfoliosTable.id, existing.id))
    .returning();
  res.json(PublishPortfolioResponse.parse(toResponse(updated)));
});

router.post("/portfolios/:id/unpublish", async (req, res): Promise<void> => {
  const params = UnpublishPortfolioParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "That portfolio could not be unpublished." });
    return;
  }
  const existing = await findCurrent();
  if (!existing || existing.id !== Number(params.data.id)) {
    res.status(404).json({ error: "That portfolio could not be found." });
    return;
  }
  const [updated] = await db
    .update(portfoliosTable)
    .set({ status: "draft", publishedAt: null })
    .where(eq(portfoliosTable.id, existing.id))
    .returning();
  res.json(UnpublishPortfolioResponse.parse(toResponse(updated)));
});

router.get("/public/portfolios/:slug", async (req, res): Promise<void> => {
  const params = GetPublicPortfolioParams.safeParse(req.params);
  if (!params.success) {
    res.status(404).json({ error: "Portfolio not found." });
    return;
  }
  const [portfolio] = await db
    .select()
    .from(portfoliosTable)
    .where(and(eq(portfoliosTable.slug, params.data.slug), eq(portfoliosTable.status, "published")))
    .limit(1);
  if (!portfolio) {
    res.status(404).json({ error: "Portfolio not found." });
    return;
  }
  const [updated] = await db
    .update(portfoliosTable)
    .set({ views: portfolio.views + 1 })
    .where(eq(portfoliosTable.id, portfolio.id))
    .returning();
  res.json(GetPublicPortfolioResponse.parse(toResponse(updated)));
});

router.post("/resume/parse", async (req, res): Promise<void> => {
  const parsed = ParseResumeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Upload a PDF or DOCX resume under 10 MB." });
    return;
  }
  if (!["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(parsed.data.mimeType)) {
    res.status(400).json({ error: "Upload a PDF or DOCX resume." });
    return;
  }
  const extraction = {
    fileName: parsed.data.fileName,
    extracted: emptyContent(),
    warnings: [
      "Review every extracted field before publishing. Folio never invents employers, achievements, metrics, or qualifications.",
      "You can add missing projects, links, and details in the next step.",
    ],
  };
  res.json(ParseResumeResponse.parse(extraction));
});

export default router;