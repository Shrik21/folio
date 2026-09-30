import { createFileRoute } from "@tanstack/react-router";

import { guides } from "@/content/folio";

const staticPaths = [
  "/",
  "/features",
  "/templates",
  "/examples",
  "/pricing",
  "/resume-to-portfolio",
  "/portfolio-for-developers",
  "/portfolio-for-designers",
  "/portfolio-for-freelancers",
  "/guides",
  "/privacy",
  "/terms",
];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin;
        let published: Array<{ slug: string; updated_at: string }> = [];
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const result = await supabaseAdmin
            .from("portfolios")
            .select("slug, updated_at")
            .eq("status", "published")
            .limit(5000);
          if (!result.error) published = result.data;
        } catch (error) {
          console.warn("Published portfolios were omitted from the sitemap", error);
        }
        const entries = [
          ...staticPaths.map((path) => ({
            loc: `${origin}${path}`,
            lastmod: undefined as string | undefined,
          })),
          ...guides.map((guide) => ({
            loc: `${origin}/guides/${guide.slug}`,
            lastmod: guide.updated,
          })),
          ...published.map((portfolio) => ({
            loc: `${origin}/p/${portfolio.slug}`,
            lastmod: portfolio.updated_at.slice(0, 10),
          })),
        ];

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (entry) =>
      `  <url><loc>${entry.loc}</loc>${entry.lastmod ? `<lastmod>${entry.lastmod}</lastmod>` : ""}</url>`,
  )
  .join("\n")}
</urlset>`;

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
