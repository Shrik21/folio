import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { z } from "zod";
import { sameOrigin } from "../lib/auth";
import { logger } from "../lib/logger";
import { getTemplate as getBuiltInTemplate } from "../lib/portfolio-catalog";
import { BUNDLE_LIMITS, BundleError, MANIFEST_NAMES, categoryHelp, parseBundleZip, type ParsedBundle } from "../lib/template-bundle";
import { TemplateRenderError, analyzeBundle, buildRenderData, renderBundleHtml, SAMPLE_CONTENT } from "../lib/template-render";
import {
  TEMPLATE_CATEGORIES,
  TEMPLATE_FONTS,
  TEMPLATE_GROUPS,
  TEMPLATE_LAYOUTS,
  TemplateDefinition,
  describeIssues,
  getBundleZip,
  listAllTemplates,
  removeTemplateRecord,
  resolveTemplate,
  saveBundleTemplate,
  saveTemplateDefinition,
  setTemplateHidden,
  templateUsage,
} from "../lib/template-registry";
import { requireAdmin } from "./admin";

const router: IRouter = Router();

// One ZIP at a time, held in memory while it's checked.
const zipUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: BUNDLE_LIMITS.zipBytes, files: 1, fields: 4 } });
function acceptZip(req: Request, res: Response, next: NextFunction) {
  zipUpload.single("file")(req, res, (error: unknown) => {
    if (!error) return next();
    const tooBig = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE";
    return res.status(tooBig ? 413 : 400).json({
      message: tooBig ? `This ZIP is larger than ${BUNDLE_LIMITS.zipBytes / 1024 / 1024} MB. Optimise images and fonts and try again.` : "The upload could not be read.",
    });
  });
}

/** Reads the uploaded ZIP and renders it once with sample data, so mistakes are caught before saving. */
function checkZip(req: Request): { parsed: ParsedBundle; warnings: string[]; previewHtml: string } {
  const file = req.file;
  if (!file) throw new BundleError("Choose a .zip file.");
  const parsed = parseBundleZip(file.buffer);
  let previewHtml: string;
  try {
    previewHtml = renderBundleHtml(parsed.files, parsed.definition.entry, buildRenderData(SAMPLE_CONTENT, "Product Engineer"));
  } catch (error) {
    if (error instanceof TemplateRenderError) throw new BundleError(`${parsed.definition.entry} has a problem.`, [error.message]);
    throw error;
  }
  return { parsed, warnings: analyzeBundle(parsed.files, parsed.definition.entry), previewHtml };
}

const problem = (res: Response, error: unknown) => {
  if (error instanceof BundleError) return res.status(422).json({ message: error.message, issues: error.issues });
  throw error;
};

const storageError = "Templates couldn't be saved because the database isn't reachable. Check the database connection and try again.";

/** Everything the admin Templates screen needs, including what each portfolio uses. */
router.get("/admin/templates", requireAdmin, async (_req, res) => {
  const templates = await listAllTemplates();
  let usage: Awaited<ReturnType<typeof templateUsage>> = [];
  let usageAvailable = true;
  try {
    usage = await templateUsage();
  } catch (error) {
    usageAvailable = false;
    logger.error({ err: error }, "Could not count template usage");
  }
  const byId = new Map(usage.map((row) => [row.templateId, row]));
  res.json({
    templates: templates.map((template) => ({ ...template, usage: byId.get(template.id) ?? { total: 0, published: 0 } })),
    usageAvailable,
    options: {
      layouts: TEMPLATE_LAYOUTS,
      fonts: TEMPLATE_FONTS,
      groups: TEMPLATE_GROUPS,
      categories: TEMPLATE_CATEGORIES,
      zip: { manifest: MANIFEST_NAMES[0], maxBytes: BUNDLE_LIMITS.zipBytes, maxFiles: BUNDLE_LIMITS.entries, categoryHelp: categoryHelp() },
    },
  });
});

/** Downloads an HTML template's ZIP, to edit and upload again. */
router.get("/admin/templates/:id/bundle", requireAdmin, async (req, res) => {
  const id = String(req.params.id);
  const template = await resolveTemplate(id);
  if (!template || template.kind !== "bundle") return res.status(404).json({ message: "That template has no ZIP to download." });
  try {
    const zip = await getBundleZip(id);
    if (!zip) return res.status(404).json({ message: "The files for this template are missing. Upload the ZIP again." });
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${id}.zip"`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.send(zip);
  } catch (error) {
    logger.error({ err: error }, "Downloading template files failed");
    return res.status(503).json({ message: "The template files couldn't be loaded because the database isn't reachable." });
  }
});

/** Checks a template file without saving it, so the admin can preview first. */
router.post("/admin/templates/validate", requireAdmin, sameOrigin, acceptZip, (req, res) => {
  if (req.file || req.is("multipart/form-data")) {
    try {
      const { parsed, warnings, previewHtml } = checkZip(req);
      const { definition } = parsed;
      return res.json({
        kind: "bundle",
        definition: { ...definition, manifest: undefined },
        builtIn: Boolean(getBuiltInTemplate(definition.id)),
        warnings,
        previewHtml,
        files: [...parsed.files].slice(0, 200).map(([path, data]) => ({ path, size: data.length })),
      });
    } catch (error) {
      return problem(res, error);
    }
  }
  const parsed = TemplateDefinition.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: "This template file has problems.", issues: describeIssues(parsed.error) });
  return res.json({ kind: "layout", definition: parsed.data, builtIn: Boolean(getBuiltInTemplate(parsed.data.id)) });
});

/** Adds a template, replaces an uploaded one, or restyles a built-in one (same id). */
router.put("/admin/templates/:id", requireAdmin, sameOrigin, acceptZip, async (req, res) => {
  if (req.file || req.is("multipart/form-data")) {
    let checked: ReturnType<typeof checkZip>;
    try {
      checked = checkZip(req);
    } catch (error) {
      return problem(res, error);
    }
    if (checked.parsed.definition.id !== req.params.id) return res.status(400).json({ message: "The id in the ZIP's manifest doesn't match the template being saved." });
    try {
      return res.json({ template: await saveBundleTemplate(checked.parsed, req.file!.buffer), warnings: checked.warnings });
    } catch (error) {
      logger.error({ err: error }, "Saving an HTML template failed");
      return res.status(503).json({ message: storageError });
    }
  }
  const parsed = TemplateDefinition.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: "This template file has problems.", issues: describeIssues(parsed.error) });
  if (parsed.data.id !== req.params.id) return res.status(400).json({ message: "The id in the file doesn't match the template being saved." });
  try {
    return res.json({ template: await saveTemplateDefinition(parsed.data) });
  } catch (error) {
    logger.error({ err: error }, "Saving a template failed");
    return res.status(503).json({ message: storageError });
  }
});

const VisibilityBody = z.object({ hidden: z.boolean() }).strict();

/** Hides a template from people choosing one, or shows it again. Existing portfolios keep rendering. */
router.patch("/admin/templates/:id/visibility", requireAdmin, sameOrigin, async (req, res) => {
  const parsed = VisibilityBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Send { \"hidden\": true } or { \"hidden\": false }." });
  const id = String(req.params.id);
  if (!(await resolveTemplate(id))) return res.status(404).json({ message: "That template doesn't exist." });
  try {
    return res.json({ template: await setTemplateHidden(id, parsed.data.hidden) });
  } catch (error) {
    logger.error({ err: error }, "Changing template visibility failed");
    return res.status(503).json({ message: storageError });
  }
});

/** Deletes an uploaded template, or resets a built-in one to its original look and visibility. */
router.delete("/admin/templates/:id", requireAdmin, sameOrigin, async (req, res) => {
  const id = String(req.params.id);
  try {
    const removed = await removeTemplateRecord(id);
    if (!removed) return res.status(404).json({ message: getBuiltInTemplate(id) ? "This built-in template is already in its original state." : "That template doesn't exist." });
    return res.json({ removed: true, template: (await resolveTemplate(id)) ?? null });
  } catch (error) {
    logger.error({ err: error }, "Removing a template failed");
    return res.status(503).json({ message: storageError });
  }
});

export default router;
