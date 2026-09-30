import { QueryClient } from "@tanstack/react-query";
export const queryClient = new QueryClient();
export const sampleContent: any = {
  personalInfo: {
    name: "Maya Chen",
    headline: "Product designer shaping quieter, better tools.",
    email: "maya.chen@email.com",
    phone: "+1 415 555 0148",
    location: "Brooklyn, New York",
    summary:
      "I design digital products where clarity is a feature. Over the last decade, I have helped teams turn complex systems into experiences people trust.",
    avatar: null,
  },
  experience: [
    {
      id: "1",
      role: "Senior Product Designer",
      company: "Northstar",
      period: "2021 — Present",
      description:
        "Leading product design across the core platform and a new generation of collaborative workflows.",
    },
    {
      id: "2",
      role: "Product Designer",
      company: "Fieldwork",
      period: "2017 — 2021",
      description:
        "Built the design language and launched tools used by 40,000 independent teams.",
    },
  ],
  education: [
    {
      id: "1",
      school: "Rhode Island School of Design",
      degree: "BFA, Industrial Design",
      period: "2013 — 2017",
    },
  ],
  skills: [
    "Product strategy",
    "Interaction design",
    "Design systems",
    "Prototyping",
    "Research",
  ],
  projects: [
    {
      id: "1",
      name: "Northstar OS",
      description: "A new operating system for collaborative teams.",
      technologies: ["Product", "Systems"],
      githubUrl: "",
      liveUrl: "",
      image: null,
    },
    {
      id: "2",
      name: "Field Notes",
      description: "A field guide to making room for better work.",
      technologies: ["Editorial", "Writing"],
      githubUrl: "",
      liveUrl: "",
      image: null,
    },
  ],
  socialLinks: {
    github: "",
    linkedin: "linkedin.com/in/mayachen",
    twitter: "",
    website: "",
  },
};

export const blankContent: any = {
  personalInfo: {
    name: "",
    headline: "",
    email: "",
    phone: "",
    location: "",
    summary: "",
    avatar: null,
  },
  experience: [],
  education: [],
  skills: [],
  projects: [],
  socialLinks: { github: "", linkedin: "", twitter: "", website: "" },
};

export function readOnboardingDraft(): any {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(sessionStorage.getItem("folio-onboarding") || "{}");
  } catch {
    return {};
  }
}

export function saveOnboardingDraft(next: any) {
  if (typeof window !== "undefined")
    sessionStorage.setItem(
      "folio-onboarding",
      JSON.stringify({ ...readOnboardingDraft(), ...next }),
    );
}
