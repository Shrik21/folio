export type TemplateKind = "clean" | "developer" | "bento";

export function templateKind(templateId?: string): TemplateKind {
  if (templateId === "developer-command-center") return "developer";
  if (templateId === "bento-professional") return "bento";
  return "clean";
}

export type PortfolioContent = {
  personalInfo?: {
    name?: string;
    headline?: string;
    email?: string;
    phone?: string;
    location?: string;
    summary?: string;
    avatar?: string | null;
  };
  projects?: Array<{
    id?: string;
    name?: string;
    description?: string;
    technologies?: string[];
    liveUrl?: string;
    githubUrl?: string;
    image?: string | null;
  }>;
  experience?: Array<{
    id?: string;
    role?: string;
    company?: string;
    period?: string;
    description?: string;
  }>;
  education?: Array<{
    id?: string;
    degree?: string;
    school?: string;
    period?: string;
  }>;
  skills?: string[];
  socialLinks?: Record<string, string>;
};

export function mapPortfolioForRenderer(portfolio: {
  templateId?: string;
  profession?: string;
  slug?: string;
  content?: PortfolioContent;
}) {
  const content = portfolio.content || {};
  const personal = content.personalInfo || {};
  return {
    kind: templateKind(portfolio.templateId),
    profession: portfolio.profession || "",
    slug: portfolio.slug || "",
    name: personal.name?.trim() || "",
    headline: personal.headline?.trim() || "",
    summary: personal.summary?.trim() || "",
    location: personal.location?.trim() || "",
    email: personal.email?.trim() || "",
    phone: personal.phone?.trim() || "",
    avatar: personal.avatar || "",
    projects: (content.projects || []).filter((item) => item.name?.trim()),
    experience: (content.experience || []).filter((item) => item.role?.trim() || item.company?.trim()),
    education: (content.education || []).filter((item) => item.degree?.trim() || item.school?.trim()),
    skills: (content.skills || []).filter((skill) => skill.trim()),
    socialLinks: content.socialLinks || {},
  };
}
