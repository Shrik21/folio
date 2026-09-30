import { createFileRoute } from "@tanstack/react-router";

import { ProfessionPage, type ProfessionContent } from "@/components/site/ProfessionPage";

const title = "Freelance portfolio and services page | Folio";
const description =
  "Turn your CV into a freelance portfolio that leads with services, sectors and availability, with a contact route and a permanent URL you can put on invoices.";

const content: ProfessionContent = {
  slug: "/portfolio-for-freelancers",
  profession: "For freelancers",
  title: "A freelance portfolio that sells the work",
  lede: "Clients are not screening you against a job description — they are deciding whether to send an enquiry. Your page needs services, proof and a way to get in touch.",
  answer:
    "Upload your CV, confirm the extracted history, then lead the page with what you offer, who you work with and how to reach you. Publish to a permanent URL you can reuse on proposals and invoices.",
  sections: [
    {
      heading: "Put the offer first",
      body: "A services block above your history answers the visitor's question immediately.",
      bullets: [
        "Two to four clearly named services",
        "The sectors or company sizes you work with",
        "Current availability and how to enquire",
      ],
    },
    {
      heading: "Proof without breaking confidence",
      body: "Describe the class of client and the outcome you can substantiate. Named logos are optional and only ever yours to add.",
    },
    {
      heading: "Own the address",
      body: "Pro lets you point your own domain at the same page, so the URL on your invoices stays yours if you ever move.",
    },
  ],
  template: "Brief",
};

export const Route = createFileRoute("/portfolio-for-freelancers")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "/portfolio-for-freelancers" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/portfolio-for-freelancers" }],
  }),
  component: () => <ProfessionPage content={content} />,
});
