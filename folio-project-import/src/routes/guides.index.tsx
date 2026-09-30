import { createFileRoute, Link } from "@tanstack/react-router";

import { Breadcrumbs, PageIntro, PageShell } from "@/components/site/PageShell";
import { guides } from "@/content/folio";

const title = "Guides to portfolios, résumés and career evidence | Folio";
const description =
  "Original guides on the difference between a résumé and a portfolio, publishing work under an NDA, and how Folio constrains AI to the text you supply.";

export const Route = createFileRoute("/guides/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/guides" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/guides" }],
  }),
  component: GuidesIndex,
});

function GuidesIndex() {
  return (
    <PageShell>
      <Breadcrumbs trail={[{ to: "/guides", label: "Guides" }]} />
      <PageIntro
        eyebrow="Guides"
        title="Guides on turning career history into evidence"
        lede="Written by the Folio team. Every guide carries a publication and an updated date so you can judge how current it is."
      />
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <ul className="section-y divide-y divide-border border-y border-border">
          {guides.map((guide) => (
            <li key={guide.slug} className="py-6">
              <article>
                <h2 className="text-2xl">
                  <Link
                    to="/guides/$slug"
                    params={{ slug: guide.slug }}
                    className="underline-offset-4 hover:underline"
                  >
                    {guide.title}
                  </Link>
                </h2>
                <p className="mt-2 max-w-2xl text-muted-foreground">{guide.description}</p>
                <p className="mt-3 text-sm text-muted-foreground">
                  {guide.author} · Updated{" "}
                  <time dateTime={guide.updated}>
                    {new Date(guide.updated).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </time>{" "}
                  · {guide.readingMinutes} min read
                </p>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </PageShell>
  );
}
