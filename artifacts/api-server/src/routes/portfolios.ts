import { Router, type IRouter } from "express";
import multer from "multer";
import { extractText, structureWithGemini, structureLocally } from "../lib/resume-parser";
import { and, desc, eq, sql } from "drizzle-orm";
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
import { db, isMongoDatabase, mongoStore, portfoliosTable } from "@workspace/db";
import type { MongoPortfolio } from "@workspace/db";
import { getTemplate, portfolioTemplates } from "../lib/portfolio-catalog";
import { requireAuthentication, sameOrigin } from "../lib/auth";
import { isAdmin } from "./admin";
import { ownerScope, publicationError } from "../lib/portfolio-access";

const router: IRouter = Router();
// Existing demo portfolios remain accessible only through explicit administrator login.
router.use(["/portfolios", "/resume"], (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) return sameOrigin(req, res, next);
  return next();
}, (req, res, next) => {
  if (isAdmin(req)) { res.locals.ownerId = "demo-user"; next(); return; }
  return requireAuthentication(req, res, (error) => {
    if (error) return next(error);
    res.locals.ownerId = res.locals.user.id;
    next();
  });
});

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

const toResponse = (row: typeof portfoliosTable.$inferSelect | MongoPortfolio) => ({
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
    if (isMongoDatabase()) {
      if (!(await mongoStore.slugExists(slug))) return slug;
      slug = `${base}-${suffix}`;
      suffix += 1;
      continue;
    }
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

const findCurrent = async (ownerId: string) => {
  if (isMongoDatabase()) return mongoStore.findCurrent(ownerId);
  const rows = await db
    .select()
    .from(portfoliosTable)
    .where(ownerScope(ownerId))
    .orderBy(desc(portfoliosTable.updatedAt))
    .limit(1);
  return rows[0];
};

router.get("/templates", (_req, res) => {
  res.json(ListTemplatesResponse.parse(portfolioTemplates));
});

router.get("/portfolios", async (_req, res): Promise<void> => {
  const portfolio = await findCurrent(res.locals.ownerId);
  if (!portfolio) { res.status(404).json({ message: "Create your first portfolio to get started." }); return; }
  res.json(GetCurrentPortfolioResponse.parse(toResponse(portfolio)));
});

router.post("/portfolios", async (req, res): Promise<void> => {
  const parsed = CreatePortfolioBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Please review the required portfolio fields." });
    return;
  }
  const slug = await makeSlug(parsed.data.content.personalInfo.name);
  if (!getTemplate(parsed.data.templateId)) { res.status(400).json({ message: "Choose an available portfolio design." }); return; }
  if (isMongoDatabase()) {
    const created = await mongoStore.createPortfolio({
      ownerId: res.locals.ownerId, slug, profession: parsed.data.profession, purpose: parsed.data.purpose,
      templateId: parsed.data.templateId, status: "draft", content: parsed.data.content,
    });
    res.status(201).json(CreatePortfolioResponse.parse(toResponse(created)));
    return;
  }
  const [created] = await db
    .insert(portfoliosTable)
    .values({
      ownerId: res.locals.ownerId,
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
  if (!params.success || !/^[1-9][0-9]*$/.test(String(req.params.id))) {
    res.status(400).json({ error: "That portfolio could not be found." });
    return;
  }
  if (isMongoDatabase()) {
    const portfolio = await mongoStore.findById(res.locals.ownerId, Number(params.data.id));
    if (!portfolio) { res.status(404).json({ error: "That portfolio could not be found." }); return; }
    res.json(GetPortfolioResponse.parse(toResponse(portfolio)));
    return;
  }
  const [portfolio] = await db
    .select()
    .from(portfoliosTable)
    .where(ownerScope(res.locals.ownerId, Number(params.data.id)))
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
  if (!params.success || !parsed.success || !/^[1-9][0-9]*$/.test(String(req.params.id))) {
    res.status(400).json({ error: "Please review your portfolio changes." });
    return;
  }
  if (isMongoDatabase()) {
    const existing = await mongoStore.findById(res.locals.ownerId, Number(params.data.id));
    if (!existing) { res.status(404).json({ error: "That portfolio could not be found." }); return; }
    const nextTemplateId = parsed.data.templateId ?? existing.templateId;
    if (!getTemplate(nextTemplateId)) { res.status(400).json({ message: "Choose an available portfolio design." }); return; }
    if (existing.status === "published") {
      const blocked = publicationError(nextTemplateId);
      if (blocked) { res.status(blocked.status).json({ message: blocked.message }); return; }
    }
    const updated = await mongoStore.updatePortfolio(res.locals.ownerId, existing.id, {
      profession: parsed.data.profession ?? existing.profession,
      purpose: parsed.data.purpose ?? existing.purpose,
      templateId: nextTemplateId,
      content: parsed.data.content ?? existing.content,
      slug: existing.slug,
    });
    res.json(UpdatePortfolioResponse.parse(toResponse(updated!)));
    return;
  }
  const [existing] = await db.select().from(portfoliosTable).where(ownerScope(res.locals.ownerId, Number(params.data.id))).limit(1);
  if (!existing || existing.id !== Number(params.data.id)) {
    res.status(404).json({ error: "That portfolio could not be found." });
    return;
  }
  const nextTemplateId = parsed.data.templateId ?? existing.templateId;
  if (!getTemplate(nextTemplateId)) { res.status(400).json({ message: "Choose an available portfolio design." }); return; }
  if (existing.status === "published") {
    const blocked = publicationError(nextTemplateId);
    if (blocked) { res.status(blocked.status).json({ message: blocked.message }); return; }
  }
  const [updated] = await db
    .update(portfoliosTable)
    .set({
      profession: parsed.data.profession ?? existing.profession,
      purpose: parsed.data.purpose ?? existing.purpose,
      templateId: parsed.data.templateId ?? existing.templateId,
      content: parsed.data.content ?? existing.content,
      slug: existing.slug, // Keep already-shared links stable when names/content change.
    })
    .where(ownerScope(res.locals.ownerId, existing.id))
    .returning();
  res.json(UpdatePortfolioResponse.parse(toResponse(updated)));
});

router.post("/portfolios/:id/publish", async (req, res): Promise<void> => {
  const params = PublishPortfolioParams.safeParse(req.params);
  if (!params.success || ("id" in req.params && !/^[1-9][0-9]*$/.test(String(req.params.id)))) {
    res.status(400).json({ error: "That portfolio could not be published." });
    return;
  }
  if (isMongoDatabase()) {
    const existing = await mongoStore.findById(res.locals.ownerId, Number(params.data.id));
    if (!existing) { res.status(404).json({ error: "That portfolio could not be found." }); return; }
    const blocked = publicationError(existing.templateId);
    if (blocked) { res.status(blocked.status).json({ message: blocked.message }); return; }
    const updated = await mongoStore.updatePortfolio(res.locals.ownerId, existing.id, { status: "published", publishedAt: new Date() });
    res.json(PublishPortfolioResponse.parse(toResponse(updated!)));
    return;
  }
  const [existing] = await db.select().from(portfoliosTable).where(ownerScope(res.locals.ownerId, Number(params.data.id))).limit(1);
  if (!existing || existing.id !== Number(params.data.id)) {
    res.status(404).json({ error: "That portfolio could not be found." });
    return;
  }
  const blocked = publicationError(existing.templateId);
  if (blocked) { res.status(blocked.status).json({ message: blocked.message }); return; }
  const [updated] = await db
    .update(portfoliosTable)
    .set({ status: "published", publishedAt: new Date() })
    .where(ownerScope(res.locals.ownerId, existing.id))
    .returning();
  res.json(PublishPortfolioResponse.parse(toResponse(updated)));
});

router.post("/portfolios/:id/unpublish", async (req, res): Promise<void> => {
  const params = UnpublishPortfolioParams.safeParse(req.params);
  if (!params.success || ("id" in req.params && !/^[1-9][0-9]*$/.test(String(req.params.id)))) {
    res.status(400).json({ error: "That portfolio could not be unpublished." });
    return;
  }
  if (isMongoDatabase()) {
    const existing = await mongoStore.findById(res.locals.ownerId, Number(params.data.id));
    if (!existing) { res.status(404).json({ error: "That portfolio could not be found." }); return; }
    const updated = await mongoStore.updatePortfolio(res.locals.ownerId, existing.id, { status: "draft", publishedAt: null });
    res.json(UnpublishPortfolioResponse.parse(toResponse(updated!)));
    return;
  }
  const [existing] = await db.select().from(portfoliosTable).where(ownerScope(res.locals.ownerId, Number(params.data.id))).limit(1);
  if (!existing || existing.id !== Number(params.data.id)) {
    res.status(404).json({ error: "That portfolio could not be found." });
    return;
  }
  const [updated] = await db
    .update(portfoliosTable)
    .set({ status: "draft", publishedAt: null })
    .where(ownerScope(res.locals.ownerId, existing.id))
    .returning();
  res.json(UnpublishPortfolioResponse.parse(toResponse(updated)));
});

router.get("/public/portfolios", async (_req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  if (isMongoDatabase()) {
    const rows = await mongoStore.listPublished();
    res.json(rows.map((row) => ({ slug: row.slug, updatedAt: row.updatedAt.toISOString(), publishedAt: row.publishedAt?.toISOString() ?? null })));
    return;
  }
  const rows = await db
    .select({
      slug: portfoliosTable.slug,
      updatedAt: portfoliosTable.updatedAt,
      publishedAt: portfoliosTable.publishedAt,
    })
    .from(portfoliosTable)
    .where(eq(portfoliosTable.status, "published"));
  res.json(rows.map((row) => ({
    slug: row.slug,
    updatedAt: row.updatedAt.toISOString(),
    publishedAt: row.publishedAt?.toISOString() ?? null,
  })));
});

router.get("/public/portfolios/:slug", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  const params = GetPublicPortfolioParams.safeParse(req.params);
  if (!params.success) {
    res.status(404).json({ error: "Portfolio not found." });
    return;
  }
  if (isMongoDatabase()) {
    const portfolio = await mongoStore.findPublishedBySlug(params.data.slug);
    if (!portfolio) { res.status(404).json({ error: "Portfolio not found." }); return; }
    res.json(GetPublicPortfolioResponse.parse(toResponse(portfolio)));
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
  res.json(GetPublicPortfolioResponse.parse(toResponse(portfolio)));
});

router.post("/public/portfolios/:slug/views", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  const params = GetPublicPortfolioParams.safeParse(req.params);
  if (!params.success) {
    res.status(404).json({ error: "Portfolio not found." });
    return;
  }
  if (isMongoDatabase()) {
    const updated = await mongoStore.incrementViews(params.data.slug);
    if (!updated) { res.status(404).json({ error: "Portfolio not found." }); return; }
    res.status(204).end();
    return;
  }
  const [updated] = await db
    .update(portfoliosTable)
    .set({ views: sql`${portfoliosTable.views} + 1` })
    .where(and(eq(portfoliosTable.slug, params.data.slug), eq(portfoliosTable.status, "published")))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Portfolio not found." });
    return;
  }
  res.status(204).end();
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post("/resume/parse", upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "Upload a PDF or DOCX resume." });
    return;
  }

  if (!["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(req.file.mimetype)) {
    res.status(400).json({ error: "Upload a PDF or DOCX resume." });
    return;
  }

  try {
    const text = await extractText(req.file.buffer, req.file.mimetype);

    let result;
    if (process.env.GEMINI_API_KEY) {
      try {
        result = await structureWithGemini(text);
      } catch (err) {
        console.error("Gemini structuring failed", err);
        result = structureLocally(text);
      }
    } else {
      result = structureLocally(text);
    }

    const extraction = {
      fileName: req.file.originalname,
      extracted: result.content,
      warnings: result.warnings,
    };
    res.json(ParseResumeResponse.parse(extraction));
  } catch (error: any) {
    if (error.message === "The resume appears to be empty." || error.message === "Upload a PDF or DOCX resume.") {
      res.status(400).json({ error: error.message });
      return;
    }
    console.error("Resume parsing error:", error);
    res.status(500).json({ error: "Failed to parse resume." });
  }
});

export default router;
