import { createFileRoute, notFound } from "@tanstack/react-router";

import { Breadcrumbs, PageShell } from "@/components/site/PageShell";
import { guides } from "@/content/folio";

export const Route = createFileRoute("/guides/$slug")({
  loader: ({ params }) => {
    const guide = guides.find((entry) => entry.slug === params.slug);
    if (!guide) throw notFound();
    return { guide };
  },
  head: ({ params, loaderData }) => {
    const guide = loaderData?.guide;
    const title = guide ? `${guide.title} | Folio guides` : "Guide | Folio";
    const description = guide?.description ?? "Folio guide";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: `/guides/${params.slug}` },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: `/guides/${params.slug}` }],
      scripts: guide
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Article",
                headline: guide.title,
                description: guide.description,
                datePublished: guide.published,
                dateModified: guide.updated,
                author: { "@type": "Organization", name: guide.author },
                publisher: { "@type": "Organization", name: "Folio" },
              }),
            },
            {
              type: "application/ld+json",
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "Home", item: "/" },
                  { "@type": "ListItem", position: 2, name: "Guides", item: "/guides" },
                  {
                    "@type": "ListItem",
                    position: 3,
                    name: guide.title,
                    item: `/guides/${guide.slug}`,
                  },
                ],
              }),
            },
          ]
        : [],
    };
  },
  component: GuidePage,
});

function GuidePage() {
  const { guide } = Route.useLoaderData();

  return (
    <PageShell>
      <Breadcrumbs
        trail={[
          { to: "/guides", label: "Guides" },
          { to: `/guides/${guide.slug}`, label: guide.title },
        ]}
      />
      <article className="mx-auto max-w-3xl px-4 pb-20 pt-8 sm:px-6">
        <h1 className="display-lg">{guide.title}</h1>
        <p className="mt-4 text-lg text-muted-foreground">{guide.description}</p>
        <p className="mt-4 border-y border-border py-3 text-sm text-muted-foreground">
          {guide.author} · Published{" "}
          <time dateTime={guide.published}>
            {new Date(guide.published).toLocaleDateString("en-GB", { dateStyle: "long" })}
          </time>{" "}
          · Updated{" "}
          <time dateTime={guide.updated}>
            {new Date(guide.updated).toLocaleDateString("en-GB", { dateStyle: "long" })}
          </time>{" "}
          · {guide.readingMinutes} min read
        </p>
        <div className="mt-10 space-y-8">
          {guide.body.map((section) => (
            <section key={section.heading}>
              <h2 className="text-2xl">{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="mt-3 text-base leading-7">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>
      </article>
    </PageShell>
  );
}
