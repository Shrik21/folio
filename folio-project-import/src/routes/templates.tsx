import { createFileRoute, Link } from "@tanstack/react-router";

import { Breadcrumbs, PageIntro, PageShell } from "@/components/site/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { templates } from "@/content/folio";

const title = "Portfolio templates for résumé-based sites | Folio";
const description =
  "Four portfolio templates: Ledger for a first portfolio, Atlas for developers, Gallery for designers and Brief for freelancers. Switch at any time.";

export const Route = createFileRoute("/templates")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/templates" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/templates" }],
  }),
  component: TemplatesPage,
});

function TemplatesPage() {
  return (
    <PageShell>
      <Breadcrumbs trail={[{ to: "/templates", label: "Templates" }]} />
      <PageIntro
        eyebrow="Templates"
        title="Four layouts, one set of content"
        lede="Your approved content is stored separately from the design, so switching template never rewrites a word."
      />
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="section-y space-y-6">
          {templates.map((template) => (
            <article
              key={template.slug}
              className="grid gap-6 rounded-xl border border-border bg-paper p-6 shadow-page md:grid-cols-[1fr_1.1fr] md:p-8"
            >
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-3xl">{template.name}</h2>
                  <Badge variant={template.tier === "pro" ? "default" : "secondary"}>
                    {template.tier === "pro" ? "Pro" : "Free"}
                  </Badge>
                </div>
                <p className="mt-2 text-muted-foreground">{template.tagline}</p>
                <p className="mt-4 text-sm">
                  <span className="font-semibold">Best for:</span> {template.bestFor}
                </p>
              </div>
              <div aria-hidden="true" className="rounded-lg border border-border bg-background p-4">
                <div className={`h-1.5 w-16 rounded-full ${template.accent}`} />
                <div className="mt-4 h-6 w-2/3 rounded bg-secondary" />
                <div className="mt-2 h-3 w-1/2 rounded bg-secondary" />
                <div className="mt-5 grid grid-cols-3 gap-2">
                  <div className="h-16 rounded bg-secondary" />
                  <div className="h-16 rounded bg-secondary" />
                  <div className="h-16 rounded bg-secondary" />
                </div>
                <div className="mt-3 space-y-2">
                  <div className="h-3 w-full rounded bg-secondary" />
                  <div className="h-3 w-5/6 rounded bg-secondary" />
                </div>
              </div>
            </article>
          ))}
        </div>
        <div className="mb-20 flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/signup">Try Ledger free</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/pricing">What Pro unlocks</Link>
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
