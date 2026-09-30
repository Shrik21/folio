import { createFileRoute } from "@tanstack/react-router";

import { ProfessionPage, type ProfessionContent } from "@/components/site/ProfessionPage";

const title = "Developer portfolio from your résumé | Folio";
const description =
  "Build a developer portfolio from your existing CV: role timeline, project write-ups, repositories and measurable engineering outcomes on a fast, indexable page.";

const content: ProfessionContent = {
  slug: "/portfolio-for-developers",
  profession: "For developers",
  title: "A developer portfolio built from your CV",
  lede: "Engineers usually have the evidence already — commits, incidents, migrations, performance numbers. Folio turns the CV that lists them into a page that explains them.",
  answer:
    "Upload your CV, confirm the extracted roles and projects, then add repository links and short write-ups. Folio publishes a server-rendered page with your timeline, stack and results at a permanent URL.",
  sections: [
    {
      heading: "What hiring managers look for",
      body: "Reviewers scan for scope, ownership and outcome before they read anything else.",
      bullets: [
        "The system you owned, not just the language you used",
        "One or two numbers you can defend in an interview",
        "Links to code, docs or a live deployment",
      ],
    },
    {
      heading: "How Folio structures it",
      body: "Roles become a timeline, bullet points become highlights, and stack keywords become a skills block. Nothing is added that was not in your file.",
      bullets: [
        "Timeline with dates you confirm",
        "Project entries with links",
        "Skills grouped by area",
      ],
    },
    {
      heading: "Performance matters here",
      body: "A slow portfolio undermines a performance claim. Published pages are server-rendered, ship minimal JavaScript and pass Core Web Vitals on mobile connections.",
    },
  ],
  template: "Atlas",
};

export const Route = createFileRoute("/portfolio-for-developers")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "/portfolio-for-developers" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/portfolio-for-developers" }],
  }),
  component: () => <ProfessionPage content={content} />,
});
