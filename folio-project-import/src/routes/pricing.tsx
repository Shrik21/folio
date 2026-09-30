import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";

import { Breadcrumbs, PageIntro, PageShell } from "@/components/site/PageShell";
import { Button } from "@/components/ui/button";
import { plans } from "@/content/folio";

const title = "Folio pricing — free portfolio, Pro at $12/month";
const description =
  "Publish one portfolio free with the Ledger template and a Folio URL. Pro is $12 per month for premium templates, custom domains, analytics and no Folio branding.";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/pricing" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/pricing" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Folio",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          description,
          offers: [
            {
              "@type": "Offer",
              name: "Free",
              price: "0",
              priceCurrency: "USD",
            },
            {
              "@type": "Offer",
              name: "Pro",
              price: "12",
              priceCurrency: "USD",
            },
          ],
        }),
      },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  return (
    <PageShell>
      <Breadcrumbs trail={[{ to: "/pricing", label: "Pricing" }]} />
      <PageIntro
        eyebrow="Pricing"
        title="Free to publish. Pro when it matters."
        lede="No trial countdown and no credit card to publish your first portfolio. Pro is billed monthly and can be cancelled from your billing settings at any time."
      />
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="section-y grid gap-6 lg:grid-cols-2">
          {[plans.free, plans.pro].map((plan, index) => (
            <section
              key={plan.name}
              className={`rounded-xl border bg-paper p-6 shadow-page sm:p-8 ${
                index === 1 ? "border-signal" : "border-border"
              }`}
            >
              <h2 className="text-2xl">{plan.name}</h2>
              <p className="mt-1 text-muted-foreground">{plan.summary}</p>
              <p className="mt-5 flex items-baseline gap-2">
                <span className="display-lg">{plan.price}</span>
                <span className="text-sm text-muted-foreground">{plan.cadence}</span>
              </p>
              <ul className="mt-6 space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-published" aria-hidden="true" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button asChild className="mt-7 w-full" variant={index === 1 ? "default" : "outline"}>
                <Link to="/signup">
                  {index === 1 ? "Start free, upgrade later" : "Create a free account"}
                </Link>
              </Button>
            </section>
          ))}
        </div>
        <div className="mb-20 max-w-3xl space-y-3 text-sm text-muted-foreground">
          <h2 className="text-2xl text-foreground">Billing details</h2>
          <p>
            Pro is charged in US dollars through Stripe. Prices exclude any sales tax or VAT
            collected in your country. You keep Pro features until the end of the period you paid
            for; after cancelling, portfolios using premium templates stay online and revert to the
            free template only if the subscription is not renewed.
          </p>
          <p>
            If a payment fails, Stripe retries and Folio emails you. Pro features remain active
            during the retry window so nothing disappears without warning.
          </p>
        </div>
      </div>
    </PageShell>
  );
}
