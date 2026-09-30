export type Template = {
  slug: string;
  name: string;
  tagline: string;
  tier: "free" | "pro";
  bestFor: string;
  accent: string;
};

export const templates: Template[] = [
  {
    slug: "ledger",
    name: "Ledger",
    tagline: "Editorial single column with a clear career timeline.",
    tier: "free",
    bestFor: "Anyone publishing a first portfolio",
    accent: "bg-signal",
  },
  {
    slug: "atlas",
    name: "Atlas",
    tagline: "Two column layout with a persistent profile sidebar.",
    tier: "pro",
    bestFor: "Developers and engineers with many projects",
    accent: "bg-published",
  },
  {
    slug: "gallery",
    name: "Gallery",
    tagline: "Image-forward case study grid with generous whitespace.",
    tier: "pro",
    bestFor: "Designers and visual practitioners",
    accent: "bg-chart-4",
  },
  {
    slug: "brief",
    name: "Brief",
    tagline: "Service-led page that leads with offers and availability.",
    tier: "pro",
    bestFor: "Freelancers and consultants",
    accent: "bg-chart-5",
  },
];

export type Guide = {
  slug: string;
  title: string;
  description: string;
  author: string;
  published: string;
  updated: string;
  readingMinutes: number;
  body: { heading: string; paragraphs: string[] }[];
};

export const guides: Guide[] = [
  {
    slug: "resume-vs-portfolio",
    title: "Résumé vs portfolio: what each one is actually for",
    description:
      "A résumé proves you qualify for a role. A portfolio shows how you work. Here is how to use both without duplicating effort.",
    author: "The Folio team",
    published: "2026-04-08",
    updated: "2026-09-02",
    readingMinutes: 6,
    body: [
      {
        heading: "The short answer",
        paragraphs: [
          "A résumé is a screening document: dense, chronological, and written for recruiters and applicant tracking systems. A portfolio is an evidence document: it shows the work, the decisions behind it, and the outcome.",
          "Most professionals need both. The résumé gets you past a filter; the portfolio is what a hiring manager reads before a conversation.",
        ],
      },
      {
        heading: "What belongs only in the portfolio",
        paragraphs: [
          "Context and constraints, the approach you chose and why, artefacts such as screenshots or repositories, and the measurable result. These are the details a one-page résumé has no room for.",
          "Keep claims verifiable. If a number is not something you can defend in an interview, leave it out.",
        ],
      },
      {
        heading: "How Folio uses your résumé",
        paragraphs: [
          "Folio extracts the text of the file you upload and structures it into roles, education, skills, and projects. It does not add employers, dates, degrees, or metrics that are absent from your document.",
          "Anything ambiguous is flagged for review so you can confirm or correct it before publishing.",
        ],
      },
    ],
  },
  {
    slug: "portfolio-without-client-work",
    title: "How to build a portfolio when your work is confidential",
    description:
      "Practical ways to show your capability without breaching an NDA: sanitised case studies, process artefacts, and scoped side projects.",
    author: "The Folio team",
    published: "2026-05-19",
    updated: "2026-08-21",
    readingMinutes: 7,
    body: [
      {
        heading: "Start with the problem, not the client",
        paragraphs: [
          "You can almost always describe the class of problem, your role, the constraints, and the shape of the outcome without naming the client or exposing protected data.",
          'Replace "we increased revenue for Acme by 18%" with "a subscription business; conversion improved after we rebuilt the checkout" if the specific figure is not yours to publish.',
        ],
      },
      {
        heading: "Show process artefacts you own",
        paragraphs: [
          "Diagrams you drew, a written decision record, a redacted architecture sketch, or a rebuilt component in a personal repository all demonstrate judgement without revealing confidential material.",
        ],
      },
      {
        heading: "Check before you publish",
        paragraphs: [
          "Read your published page as if you were your employer's legal team. Folio keeps portfolios private until you press publish, and you can unpublish at any time — the public URL then returns a 410 response.",
        ],
      },
    ],
  },
  {
    slug: "ai-accuracy-and-your-career-history",
    title: "Why Folio never invents your career history",
    description:
      "How Folio constrains AI to reorganising the text you supply, what gets flagged for review, and what the model is never allowed to add.",
    author: "The Folio team",
    published: "2026-06-30",
    updated: "2026-09-10",
    readingMinutes: 5,
    body: [
      {
        heading: "Extraction, not authorship",
        paragraphs: [
          "Folio reads the text of your uploaded file and maps it into structured fields. The model is instructed to use only that text: employers, titles, dates, institutions, qualifications, and metrics must appear in your document or they are left empty.",
        ],
      },
      {
        heading: "Everything uncertain is flagged",
        paragraphs: [
          "Where a date is partial, a title ambiguous, or a bullet point unclear, the field is marked as needing review and surfaced in the editor before you can publish.",
        ],
      },
      {
        heading: "Your file stays private",
        paragraphs: [
          "Uploaded résumés are stored in private object storage tied to your account and are never part of a public portfolio page. You can delete the original file and keep the structured content.",
        ],
      },
    ],
  },
];

export const faqs = [
  {
    q: "Does Folio write my career history for me?",
    a: "No. Folio structures the text in the file you upload. It never adds employers, job titles, dates, degrees, awards, or metrics that are not in your document, and anything ambiguous is flagged for your review.",
  },
  {
    q: "What file types can I upload?",
    a: "PDF and DOCX résumés. Text is extracted on the server; the original file is stored privately and is never shown on your public page.",
  },
  {
    q: "What URL do I get?",
    a: "Every published portfolio gets a permanent Folio address in the form folio.example/p/your-slug. Pro plans can also point a custom domain at the same page.",
  },
  {
    q: "Can I unpublish later?",
    a: "Yes. Unpublishing takes the page offline immediately and the public URL returns a 410 Gone response so search engines drop it.",
  },
  {
    q: "What is included for free?",
    a: "One published portfolio, the Ledger template, a Folio URL, basic editing, and a small Folio credit in the footer.",
  },
  {
    q: "Is my résumé used to train AI models?",
    a: "No. Your file is used only to produce your own portfolio content.",
  },
];

export const plans = {
  free: {
    name: "Free",
    price: "$0",
    cadence: "forever",
    summary: "Publish one portfolio and keep it online.",
    features: [
      "One published portfolio",
      "Ledger template",
      "Folio URL (folio.example/p/you)",
      "Résumé extraction and review",
      "Basic content and colour editing",
      "Folio credit in the footer",
    ],
  },
  pro: {
    name: "Pro",
    price: "$12",
    cadence: "per month, billed monthly",
    summary: "For people whose portfolio is doing real work.",
    features: [
      "Premium templates (Atlas, Gallery, Brief)",
      "Remove Folio branding",
      "Custom domain",
      "Advanced appearance controls",
      "Visitor analytics with sources",
      "AI writing assistance on your own text",
      "Priority support",
    ],
  },
} as const;
