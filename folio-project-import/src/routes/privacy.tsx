import { createFileRoute } from "@tanstack/react-router";

import { Breadcrumbs, PageIntro, PageShell } from "@/components/site/PageShell";

const title = "Privacy at Folio — how your résumé and portfolio data are handled";
const description =
  "What Folio stores, where uploaded résumés live, how AI processing works, how long data is kept and how to delete your account and files.";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/privacy" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/privacy" }],
  }),
  component: PrivacyPage,
});

const sections = [
  {
    heading: "What we store",
    body: "Your account email, the résumé files you upload, the structured content produced from them, your portfolio settings, and aggregate visit counts for published portfolios.",
  },
  {
    heading: "Where uploaded files live",
    body: "Résumés are stored in private object storage scoped to your user account. They are never served on a public portfolio page and are not accessible to other users. You can delete a file and keep the structured content produced from it.",
  },
  {
    heading: "How AI processing works",
    body: "Extracted text is sent to a server-side AI provider to be structured into fields. Prompts and keys stay on the server. Your content is not used to train models.",
  },
  {
    heading: "What is public",
    body: "Only what you publish. A published portfolio is a public web page and can be indexed by search engines. Drafts and previews are private and marked noindex. Unpublishing returns a 410 response at the public URL.",
  },
  {
    heading: "Analytics",
    body: "Folio records page views and referrer categories for your published portfolio so you can see traffic. We do not sell data or run third-party advertising trackers.",
  },
  {
    heading: "Deletion",
    body: "Deleting your account removes your portfolios, uploaded files and structured content. Billing records are retained where tax law requires it.",
  },
  {
    heading: "Contact",
    body: "Privacy questions can be sent to privacy@folio.example and we aim to reply within five working days.",
  },
];

function PrivacyPage() {
  return (
    <PageShell>
      <Breadcrumbs trail={[{ to: "/privacy", label: "Privacy" }]} />
      <PageIntro
        eyebrow="Privacy"
        title="Privacy at Folio"
        lede="Plain-language summary of what Folio collects and what stays private. Last updated 10 September 2026."
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
