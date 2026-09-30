import { createFileRoute, Link } from "@tanstack/react-router";
import { Eye, FileUp, Gauge, Globe, PenLine, ShieldCheck } from "lucide-react";

import { Breadcrumbs, PageIntro, PageShell } from "@/components/site/PageShell";
import { Button } from "@/components/ui/button";

const title = "Folio features — résumé extraction, review, templates, publishing";
const description =
  "Upload a PDF or DOCX résumé, review every extracted field, choose a template, edit content and appearance, then publish to a permanent public URL.";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/features" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/features" }],
  }),
  component: FeaturesPage,
});

const features = [
  {
    icon: FileUp,
    title: "Secure résumé upload",
    body: "PDF and DOCX files are uploaded straight to private storage tied to your account. Text extraction happens on the server; the file itself is never part of a public page.",
  },
  {
    icon: Eye,
    title: "Field-by-field review",
    body: "Every extracted role, date, qualification and highlight is shown for confirmation. Anything the extraction was unsure about is marked for review before you can publish.",
  },
  {
    icon: PenLine,
    title: "Content and appearance editing",
    body: "Rewrite any section, reorder roles and projects, add links and images, and adjust type scale, colour and layout density.",
  },
  {
    icon: Globe,
    title: "Publishing and permanent URLs",
    body: "Publishing gives you a permanent address at /p/your-slug. Unpublishing takes it offline immediately and returns a 410 response so search engines drop the page.",
  },
  {
    icon: Gauge,
    title: "Fast, indexable pages",
    body: "Published portfolios are server-rendered with per-page titles, descriptions, canonical URLs and Person and ProfilePage structured data.",
  },
  {
    icon: ShieldCheck,
    title: "AI you can audit",
    body: "The model only reorganises text you supplied. It is not permitted to add employers, dates, degrees, awards or metrics that are absent from your document.",
  },
];

function FeaturesPage() {
  return (
    <PageShell>
      <Breadcrumbs trail={[{ to: "/features", label: "Features" }]} />
      <PageIntro
        eyebrow="Features"
        title="Everything between an uploaded résumé and a live portfolio"
        lede="Folio does one job well: it converts the career history you already wrote into a portfolio site you control, without inventing anything."
      />
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="section-y grid gap-x-10 gap-y-12 sm:grid-cols-2">
          {features.map((feature) => (
            <section key={feature.title}>
              <feature.icon className="size-6 text-signal" aria-hidden="true" />
              <h2 className="mt-3 text-2xl">{feature.title}</h2>
              <p className="mt-2 text-muted-foreground">{feature.body}</p>
            </section>
          ))}
        </div>
        <div className="mb-20 flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/signup">Start with my résumé</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/pricing">See pricing</Link>
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
