import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";
import { resolveTemplate, loadBundle } from "../lib/template-registry";
import { TemplateRenderError, buildRenderData, renderBundleHtml } from "../lib/template-render";

const router: IRouter = Router();

/**
 * Fills an uploaded HTML template with someone's portfolio and returns the
 * finished document. Public: it only turns the data you send into HTML (all of
 * it escaped), and the page shows it in a sandboxed iframe.
 *
 *   POST /api/templates/:id/render   { content, profession? }  ->  { html }
 */
router.post("/templates/:id/render", async (req, res) => {
  const id = String(req.params.id);
  const template = await resolveTemplate(id);
  if (!template) return res.status(404).json({ message: "That template doesn't exist." });
  if (template.kind !== "bundle" || !template.bundleVersion) return res.status(400).json({ message: "That template doesn't use uploaded HTML." });
  try {
    const bundle = await loadBundle(id, template.bundleVersion);
    const body = req.body && typeof req.body === "object" ? (req.body as { content?: unknown; profession?: unknown }) : {};
    res.setHeader("Cache-Control", "no-store");
    return res.json({ html: renderBundleHtml(bundle.files, bundle.definition.entry, buildRenderData(body.content, body.profession)) });
  } catch (error) {
    if (error instanceof TemplateRenderError) return res.status(422).json({ message: error.message });
    logger.error({ err: error, templateId: id }, "Rendering an HTML template failed");
    return res.status(503).json({ message: "The template couldn't be loaded right now. Please try again." });
  }
});

export default router;
