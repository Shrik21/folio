import { createFileRoute } from "@tanstack/react-router";

import { Breadcrumbs, PageIntro, PageShell } from "@/components/site/PageShell";

const title = "Folio terms of service";
const description =
  "The terms covering Folio accounts, published portfolios, acceptable use, subscriptions and cancellation, content ownership and service availability.";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/terms" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/terms" }],
  }),
  component: TermsPage,
});

const sections = [
  {
    heading: "Your account",
    body: "You need an account to build a portfolio, and you are responsible for keeping access to your email secure. One person per account.",
  },
  {
    heading: "Your content stays yours",
    body: "You keep all rights to the résumé, text and images you upload. You grant Folio only the permission needed to store, process and display that content in the way you configure — including serving it publicly once you press publish.",
  },
  {
    heading: "Accuracy is your responsibility",
    body: "Folio structures the text you supply and never adds employment history, qualifications or metrics. You are responsible for checking that your published portfolio is truthful before it goes live.",
  },
  {
    heading: "Acceptable use",
    body: "Do not publish content that is unlawful, impersonates another person, infringes someone else's rights or breaches an agreement you are bound by. We may take down a portfolio that does.",
  },
  {
    heading: "Subscriptions and cancellation",
    body: "Pro is billed monthly in advance through Stripe. You can cancel at any time from billing settings and keep Pro features until the end of the paid period. Failed payments are retried by Stripe and you are notified before Pro features end.",
  },
  {
    heading: "Availability",
    body: "Folio is provided as-is without an uptime guarantee on the free plan. We aim for high availability and will publish incident notes for significant outages.",
  },
  {
    heading: "Changes",
    body: "We will email account holders before any material change to these terms takes effect. Last updated 10 September 2026.",
  },
];

function TermsPage() {
  return (
    <PageShell>
      <Breadcrumbs trail={[{ to: "/terms", label: "Terms" }]} />
      <PageIntro
        eyebrow="Terms"
        title="Terms of service"
        lede="The agreement between you and Folio when you create an account or publish a portfolio."
      />
      <div className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
        <div className="space-y-8">
          {sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-2xl">{section.heading}</h2>
              <p className="mt-2 leading-7 text-muted-foreground">{section.body}</p>
            </section>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
