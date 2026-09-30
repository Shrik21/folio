import { createFileRoute, Link } from "@tanstack/react-router";

import { Breadcrumbs, PageIntro, PageShell } from "@/components/site/PageShell";
import { ResumeTransform } from "@/components/site/ResumeTransform";
import { Button } from "@/components/ui/button";

const title = "Turn a résumé into a portfolio website | Folio";
const description =
  "Upload a PDF or DOCX résumé, review the structured content Folio extracts, pick a template and publish a portfolio site with a permanent URL.";

export const Route = createFileRoute("/resume-to-portfolio")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "/resume-to-portfolio" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/resume-to-portfolio" }],
  }),
  component: ResumeToPortfolioPage,
});

const steps = [
  {
    heading: "1. Upload the file you already have",
    body: "PDF or DOCX, up to 10 MB. The file goes to private storage tied to your account; text is extracted server-side.",
  },
  {
    heading: "2. Review the structured result",
    body: "Roles, dates, education, skills and highlights are mapped into editable fields. Anything uncertain is flagged before you can publish.",
  },
  {
    heading: "3. Choose purpose and template",
    body: "Tell Folio whether you are job hunting, freelancing or documenting your work, then pick the layout that fits your profession.",
  },
  {
    heading: "4. Publish and share",
    body: "Publishing creates a permanent, server-rendered page at /p/your-slug. Edit, unpublish or move it to a custom domain later.",
  },
];

function ResumeToPortfolioPage() {
  return (
    <PageShell>
      <Breadcrumbs trail={[{ to: "/resume-to-portfolio", label: "Résumé to portfolio" }]} />
      <PageIntro
        eyebrow="How it works"
        title="How to turn a résumé into a portfolio website"
        lede="A résumé is a one-page screening document. A portfolio shows the work behind it. Folio reuses the writing you have already done instead of asking you to start again."
      />
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <ResumeTransform />
        <div className="section-y grid gap-8 sm:grid-cols-2">
          {steps.map((step) => (
            <section key={step.heading}>
              <h2 className="text-2xl">{step.heading}</h2>
              <p className="mt-2 text-muted-foreground">{step.body}</p>
            </section>
          ))}
        </div>
        <div className="mb-20 flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/signup">Upload my résumé</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/guides">Read the guides</Link>
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
