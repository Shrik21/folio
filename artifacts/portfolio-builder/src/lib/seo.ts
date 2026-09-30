export const publicIndexablePaths = ["/", "/templates", "/pricing", "/privacy", "/terms"] as const;

export const privatePrefixPaths = [
  "/dashboard",
  "/login",
  "/signup",
  "/admin",
  "/onboarding",
] as const;

export const appRoutes = [
  "/",
  "/templates",
  "/pricing",
  "/privacy",
  "/terms",
  "/login",
  "/signup",
  "/admin",
  "/onboarding",
  "/onboarding/upload",
  "/onboarding/details",
  "/onboarding/profession",
  "/onboarding/templates",
  "/onboarding/preview",
  "/dashboard",
  "/dashboard/portfolio",
  "/dashboard/content",
  "/dashboard/templates",
  "/dashboard/appearance",
  "/dashboard/domain",
  "/dashboard/analytics",
  "/dashboard/billing",
  "/dashboard/settings",
] as const;

export type RouteMeta = {
  title: string;
  description: string;
  robots: string;
  indexable: boolean;
};

export function originFrom(base: string) {
  return base.replace(/\/$/, "");
}

export function canonicalUrl(origin: string, pathname: string) {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (path === "/") return `${originFrom(origin)}/`;
  return `${originFrom(origin)}${path}`;
}

export function isPrivatePath(pathname: string) {
  return privatePrefixPaths.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function routeMeta(pathname: string): RouteMeta {
  if (pathname.startsWith("/p/")) {
    return {
      title: "Portfolio · Folio",
      description: "A public portfolio published with Folio.",
      robots: "index,follow",
      indexable: true,
    };
  }
  if (isPrivatePath(pathname)) {
    return {
      title: pathname.startsWith("/admin")
        ? "Administrator sign in · Folio"
        : pathname.startsWith("/onboarding")
          ? "Create your portfolio · Folio"
          : pathname.startsWith("/dashboard")
            ? "Workspace · Folio"
            : "Sign in · Folio",
      description: "Private Folio workspace. This page is not indexed.",
      robots: "noindex,nofollow",
      indexable: false,
    };
  }
  if (pathname === "/templates") {
    return {
      title: "Portfolio templates · Folio",
      description: "Preview the Clean Professional, Developer Command Center, and Bento Professional designs. Publish the free template with your own content.",
      robots: "index,follow",
      indexable: true,
    };
  }
  if (pathname === "/pricing") {
    return {
      title: "Pricing · Folio",
      description: "Start free with one published portfolio and the Clean Professional design. Studio features such as premium templates and custom domains are not available yet.",
      robots: "index,follow",
      indexable: true,
    };
  }
  if (pathname === "/privacy") {
    return {
      title: "Privacy · Folio",
      description: "How Folio handles account, resume, and portfolio information in this version of the product.",
      robots: "index,follow",
      indexable: true,
    };
  }
  if (pathname === "/terms") {
    return {
      title: "Terms · Folio",
      description: "Current limits of the Folio portfolio builder, including publishing rules and planned features.",
      robots: "index,follow",
      indexable: true,
    };
  }
  if (pathname === "/") {
    return {
      title: "Folio — Turn your resume into a portfolio",
      description: "Create a shareable portfolio from the experience you already have. Start free with a professional template. No invented stats, and no checkout in this version.",
      robots: "index,follow",
      indexable: true,
    };
  }
  return {
    title: "Page not found · Folio",
    description: "This Folio page does not exist.",
    robots: "noindex,nofollow",
    indexable: false,
  };
}

export function sitemapUrls(origin: string, extraPublicPaths: string[] = []) {
  const base = originFrom(origin);
  const paths = [...publicIndexablePaths, ...extraPublicPaths.filter((path) => path.startsWith("/p/"))];
  return [...new Set(paths)].map((path) => canonicalUrl(base, path));
}

export function robotsTxt(origin: string) {
  const sitemap = `${originFrom(origin)}/sitemap.xml`;
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /dashboard",
    "Disallow: /login",
    "Disallow: /signup",
    "Disallow: /admin",
    "Disallow: /onboarding",
    `Sitemap: ${sitemap}`,
    "",
  ].join("\n");
}
