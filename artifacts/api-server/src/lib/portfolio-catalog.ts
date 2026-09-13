export type PortfolioTemplate = {
  id: string;
  name: string;
  category: string;
  description: string;
  premium: boolean;
  accent: string;
  layout: string;
  recommendedFor?: string[];
};

export const portfolioTemplates: PortfolioTemplate[] = [
  {
    id: "clean-professional",
    name: "Clean Professional",
    category: "Universal",
    description: "A composed, editorial portfolio for every kind of professional.",
    premium: false,
    accent: "#2f6fed",
    layout: "timeline",
    recommendedFor: ["Developer", "Product Manager", "Consultant", "Teacher"],
  },
  {
    id: "developer-command-center",
    name: "Developer Command Center",
    category: "Technology",
    description: "A focused dark canvas for technical work, systems thinking, and shipped projects.",
    premium: true,
    accent: "#77e6c0",
    layout: "terminal",
    recommendedFor: ["Software Developer", "AI Engineer", "Data Scientist"],
  },
  {
    id: "bento-professional",
    name: "Bento Professional",
    category: "Creative & Business",
    description: "An expressive modular layout for people with a range of work to show.",
    premium: true,
    accent: "#d87852",
    layout: "bento",
    recommendedFor: ["Designer", "Product Manager", "Consultant", "Marketing Professional"],
  },
];

export const getTemplate = (id: string) =>
  portfolioTemplates.find((template) => template.id === id);