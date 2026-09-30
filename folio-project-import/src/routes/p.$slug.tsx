import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { PortfolioRenderer } from "@/components/portfolio/PortfolioRenderer";
import type { PortfolioRow } from "@/integrations/supabase/types";
import { normalizePortfolioContent, serializeJsonLd } from "@/lib/portfolio";

const getPublishedPortfolio = createServerFn({ method: "GET" })
  .validator(
    z.object({
      slug: z
        .string()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
        .max(60),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const result = await supabaseAdmin
      .from("portfolios")
      .select("*")
      .eq("slug", data.slug)
      .eq("status", "published")
      .maybeSingle();
    if (result.error) throw result.error;
    if (result.data) {
      void supabaseAdmin.rpc("increment_portfolio_view", { target_slug: data.slug });
    }
    return result.data;
  });

export const Route = createFileRoute("/p/$slug")({
  loader: async ({ params }) => {
    const portfolio = await getPublishedPortfolio({ data: { slug: params.slug } });
    if (!portfolio) throw notFound();
    return { portfolio: portfolio as PortfolioRow };
  },
  head: ({ loaderData, params }) => {
    const portfolio = loaderData?.portfolio;
    const content = normalizePortfolioContent(portfolio?.content);
    const title = content.fullName
      ? `${content.fullName} — ${content.headline || "Portfolio"}`
      : "Portfolio";
    const description =
      content.summary || `View ${content.fullName || "this professional"}'s portfolio.`;
    const canonical = `/p/${params.slug}`;
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "ProfilePage",
      url: canonical,
      mainEntity: {
        "@type": "Person",
        name: content.fullName,
        jobTitle: content.headline,
        description,
        email: content.email || undefined,
        sameAs: [content.website, content.linkedin, content.github].filter(Boolean),
      },
    };
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "profile" },
        { property: "og:url", content: canonical },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: canonical }],
      scripts: [{ type: "application/ld+json", children: serializeJsonLd(jsonLd) }],
    };
  },
  component: PublicPortfolioPage,
});

function PublicPortfolioPage() {
  const { portfolio } = Route.useLoaderData();
  return <PortfolioRenderer portfolio={portfolio} />;
}
