import { Router, type IRouter } from "express";
import { z } from "zod";
import { sameOrigin } from "../lib/auth";
import { logger } from "../lib/logger";
import { getTemplate as getBuiltInTemplate } from "../lib/portfolio-catalog";
import {
  TEMPLATE_CATEGORIES,
  TEMPLATE_FONTS,
  TEMPLATE_GROUPS,
  TEMPLATE_LAYOUTS,
  TemplateDefinition,
  describeIssues,
  listAllTemplates,
  removeTemplateRecord,
  resolveTemplate,
  saveTemplateDefinition,
  setTemplateHidden,
  templateUsage,
} from "../lib/template-registry";
import { requireAdmin } from "./admin";

const router: IRouter = Router();
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
    options: { layouts: TEMPLATE_LAYOUTS, fonts: TEMPLATE_FONTS, groups: TEMPLATE_GROUPS, categories: TEMPLATE_CATEGORIES },
  });
});

/** Checks a template file without saving it, so the admin can preview first. */
router.post("/admin/templates/validate", requireAdmin, sameOrigin, (req, res) => {
  const parsed = TemplateDefinition.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ message: "This template file has problems.", issues: describeIssues(parsed.error) });
  return res.json({ definition: parsed.data, builtIn: Boolean(getBuiltInTemplate(parsed.data.id)) });
});

/** Adds a template, replaces an uploaded one, or restyles a built-in one (same id). */
router.put("/admin/templates/:id", requireAdmin, sameOrigin, async (req, res) => {
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
