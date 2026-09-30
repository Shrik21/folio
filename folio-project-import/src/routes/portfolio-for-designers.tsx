import { createFileRoute } from "@tanstack/react-router";

import { ProfessionPage, type ProfessionContent } from "@/components/site/ProfessionPage";

const title = "Designer portfolio from your résumé | Folio";
const description =
  "Turn a design CV into an image-forward portfolio: case studies with context and constraints, process artefacts and selected visuals on a fast public page.";

const content: ProfessionContent = {
  slug: "/portfolio-for-designers",
  profession: "For designers",
  title: "A design portfolio without rebuilding your website",
  lede: "Design hiring runs on case studies, not job titles. Folio starts from your CV and gives each project a place for context, decisions and visuals.",
  answer:
    "Upload your CV, confirm the extracted roles and projects, then expand two or three into case studies with images. Folio publishes them in an image-forward layout at a permanent URL.",
  sections: [
    {
      heading: "What a strong case study contains",
      body: "Reviewers want to see judgement, not only final screens.",
      bullets: [
        "The problem and the constraints you worked inside",
        "Options you considered and why you chose one",
        "What changed for users or the business afterwards",
      ],
    },
    {
      heading: "Working around confidentiality",
      body: "Sanitised artefacts, redacted flows and written decision records let you show capability without breaching an NDA.",
    },
    {
      heading: "Images that stay fast",
      body: "Uploads are resized and served in modern formats with explicit dimensions, so a visual portfolio still loads quickly on a phone.",
    },
  ],
  template: "Gallery",
};

export const Route = createFileRoute("/portfolio-for-designers")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "/portfolio-for-designers" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/portfolio-for-designers" }],
  }),
  component: () => <ProfessionPage content={content} />,
});
