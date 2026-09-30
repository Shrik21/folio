/** Serialize JSON-LD so user text cannot break out of a script element. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function httpUrl(value?: string | null): string | undefined {
  if (!value?.trim()) return undefined;
  try {
    const input = value.trim();
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(input) ? input : `https://${input}`);
    return ["http:", "https:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

type PortfolioLike = {
  slug?: string;
  profession?: string;
  content?: {
    personalInfo?: {
      name?: string;
      headline?: string;
      email?: string;
      summary?: string;
    };
    socialLinks?: Record<string, string>;
  };
};

export function personJsonLd(portfolio: PortfolioLike, pageUrl: string) {
  const info = portfolio.content?.personalInfo || {};
  const sameAs = Object.values(portfolio.content?.socialLinks || {})
    .map((value) => httpUrl(value))
    .filter((value): value is string => Boolean(value));
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: info.name || "Portfolio",
    jobTitle: info.headline || portfolio.profession,
    description: info.summary || undefined,
    email: info.email || undefined,
    url: pageUrl,
    sameAs: sameAs.length ? sameAs : undefined,
  };
}

export function websiteJsonLd(origin: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Folio",
    url: origin,
    description: "Turn a resume into a shareable portfolio with a free professional template.",
  };
}
