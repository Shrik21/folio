import { createFileRoute, Link } from "@tanstack/react-router";

import { Breadcrumbs, PageIntro, PageShell } from "@/components/site/PageShell";
import { Button } from "@/components/ui/button";

const title = "Example portfolios by profession | Folio";
const description =
  "Rendered examples of Folio portfolios for a frontend engineer, a product designer and a freelance copywriter, showing how résumé content becomes a page.";

export const Route = createFileRoute("/examples")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/examples" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/examples" }],
  }),
  component: ExamplesPage,
});

const examples = [
  {
    name: "Jordan Ellis",
    role: "Senior Frontend Engineer",
    template: "Atlas",
    sections: ["Timeline of 3 roles", "4 engineering projects", "Performance results", "Contact"],
  },
  {
    name: "Priya Raman",
    role: "Product Designer",
    template: "Gallery",
    sections: ["3 case studies", "Process artefacts", "Selected visuals", "About"],
  },
  {
    name: "Sam Okafor",
    role: "Freelance Copywriter",
    template: "Brief",
    sections: ["Services and rates", "Client sectors", "Writing samples", "Availability"],
  },
];

function ExamplesPage() {
  return (
    <PageShell>
      <Breadcrumbs trail={[{ to: "/examples", label: "Examples" }]} />
      <PageIntro
        eyebrow="Examples"
        title="What a Folio portfolio looks like"
        lede="These are illustrative examples rendered with real Folio templates and sample content — not customer portfolios."
      />
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="section-y grid gap-6 md:grid-cols-3">
          {examples.map((example) => (
            <article
              key={example.name}
              className="rounded-xl border border-border bg-paper p-6 shadow-page"
            >
              <p className="eyebrow">{example.template} template</p>
              <h2 className="mt-2 text-2xl">{example.name}</h2>
              <p className="text-muted-foreground">{example.role}</p>
              <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
                {example.sections.map((section) => (
                  <li key={section}>{section}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <div className="mb-20 flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/signup">Build mine</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/templates">See the templates</Link>
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
