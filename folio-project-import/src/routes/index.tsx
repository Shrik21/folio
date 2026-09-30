import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, FileUp, Globe, SlidersHorizontal } from "lucide-react";

import { PageShell } from "@/components/site/PageShell";
import { ResumeTransform } from "@/components/site/ResumeTransform";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { faqs, plans, templates } from "@/content/folio";

const title = "Folio — turn your résumé into a published portfolio site";
const description =
  "Upload a PDF or DOCX résumé, review every field Folio extracts, choose a template and publish a portfolio website with a permanent public URL. Free to publish.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Folio",
          description,
          publisher: { "@type": "Organization", name: "Folio" },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((faq) => ({
            "@type": "Question",
            name: faq.q,
            acceptedAnswer: { "@type": "Answer", text: faq.a },
          })),
        }),
      },
    ],
  }),
  component: Home,
});

const steps = [
  {
    icon: FileUp,
    title: "Upload your résumé",
    body: "PDF or DOCX. Text is extracted on the server; the file stays in private storage.",
  },
  {
    icon: SlidersHorizontal,
    title: "Review and shape it",
    body: "Confirm every role, date and highlight, choose your purpose, then pick a template and edit appearance.",
  },
  {
    icon: Globe,
    title: "Publish and share",
    body: "Get a permanent URL. Edit, analyse or unpublish whenever you like.",
  },
];

const professions = [
  {
    to: "/portfolio-for-developers",
    label: "Developers",
    note: "Timeline, projects, measurable results",
  },
  {
    to: "/portfolio-for-designers",
    label: "Designers",
    note: "Case studies with context and visuals",
  },
  {
    to: "/portfolio-for-freelancers",
    label: "Freelancers",
    note: "Services, sectors and availability",
  },
] as const;

function Home() {
  return (
    <PageShell>
      {/* Hero */}
      <section className="border-b border-border">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.05fr_minmax(0,1fr)] lg:py-20">
          <div className="min-w-0">
            <p className="eyebrow">Résumé in. Portfolio out.</p>
            <h1 className="display-xl mt-4">
              Your career history,
              <br />
              published as a portfolio
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              Folio reads the résumé you already have, structures it into portfolio content you
              approve line by line, and publishes it at a permanent URL. It never invents a job, a
              date or a number.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="min-h-11">
                <Link to="/signup">
                  Upload my résumé
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="min-h-11">
                <Link to="/examples">See example portfolios</Link>
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Free plan publishes one portfolio. No card required.
            </p>
          </div>
          <ResumeTransform />
        </div>
      </section>

      {/* Three steps */}
      <section className="border-b border-border bg-secondary/40">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="display-lg">Three steps, about ten minutes</h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title} className="rounded-xl border border-border bg-paper p-6">
                <div className="flex items-center gap-3">
                  <span className="grid size-8 place-items-center rounded-full bg-signal font-sans text-sm font-bold text-signal-foreground">
                    {index + 1}
                  </span>
                  <step.icon className="size-5 text-muted-foreground" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-xl">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Professions */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="display-lg">Built for how your field is judged</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {professions.map((profession) => (
              <Link
                key={profession.to}
                to={profession.to}
                className="group rounded-xl border border-border bg-paper p-6 transition-colors hover:border-signal"
              >
                <h3 className="text-2xl">{profession.label}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{profession.note}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium">
                  See the approach
                  <ArrowRight
                    className="size-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Templates */}
      <section className="border-b border-border bg-secondary/40">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="display-lg">Templates that fit real careers</h2>
            <Button asChild variant="outline">
              <Link to="/templates">Compare all four</Link>
            </Button>
          </div>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {templates.map((template) => (
              <li key={template.slug} className="rounded-xl border border-border bg-paper p-5">
                <div className={`h-1.5 w-12 rounded-full ${template.accent}`} aria-hidden="true" />
                <h3 className="mt-4 flex items-center gap-2 text-xl">
                  {template.name}
                  <Badge variant={template.tier === "pro" ? "default" : "secondary"}>
                    {template.tier === "pro" ? "Pro" : "Free"}
                  </Badge>
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">{template.tagline}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Privacy and accuracy */}
      <section className="border-b border-border">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-2">
          <div>
            <h2 className="display-lg">Accuracy is the product</h2>
            <p className="mt-4 text-muted-foreground">
              Folio's model is limited to reorganising the text you upload. Employers, titles,
              dates, institutions, qualifications and metrics must appear in your document, or the
              field is left empty and flagged for you.
            </p>
            <ul className="mt-5 space-y-2 text-sm">
              {[
                "No invented employment history or education",
                "No invented achievements, awards or metrics",
                "Uncertain fields marked “Needs your review”",
                "You must approve content before publishing",
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-published" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-border bg-paper p-6">
            <h3 className="text-2xl">Where your file goes</h3>
            <p className="mt-3 text-sm text-muted-foreground">
              Uploads land in private storage scoped to your account. Extraction runs server-side
              and the file is never part of a public page. Delete the file and keep the content
              whenever you want — details in our{" "}
              <Link to="/privacy" className="underline underline-offset-4">
                privacy notice
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="border-b border-border bg-secondary/40">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="display-lg">Transparent pricing</h2>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            {[plans.free, plans.pro].map((plan) => (
              <div key={plan.name} className="rounded-xl border border-border bg-paper p-6">
                <h3 className="text-2xl">{plan.name}</h3>
                <p className="mt-1 flex items-baseline gap-2">
                  <span className="font-display text-4xl">{plan.price}</span>
                  <span className="text-sm text-muted-foreground">{plan.cadence}</span>
                </p>
                <ul className="mt-4 space-y-2 text-sm">
                  {plan.features.slice(0, 4).map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-published" aria-hidden="true" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <Button asChild variant="outline" className="mt-6">
            <Link to="/pricing">Full pricing details</Link>
          </Button>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <h2 className="display-lg">Questions people actually ask</h2>
          <Accordion type="single" collapsible className="mt-6">
            {faqs.map((faq) => (
              <AccordionItem key={faq.q} value={faq.q}>
                <AccordionTrigger className="text-left text-base">{faq.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{faq.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Final CTA */}
      <section>
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="rounded-xl border border-signal bg-paper p-8 shadow-lift sm:p-12">
            <h2 className="display-lg max-w-2xl">
              You already wrote the hard part. Publish it properly.
            </h2>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg" className="min-h-11">
                <Link to="/signup">Create my portfolio</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="min-h-11">
                <Link to="/resume-to-portfolio">How it works</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
