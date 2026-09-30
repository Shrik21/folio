import { useEffect } from "react";
import { useLocation } from "wouter";
import { canonicalUrl, isPrivatePath, routeMeta } from "@/lib/seo";

function upsertMeta(selector: string, attribute: string, name: string, content: string) {
  let element = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, name);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

function upsertLink(rel: string, href: string) {
  let element = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!element) {
    element = document.createElement("link");
    element.rel = rel;
    document.head.appendChild(element);
  }
  element.href = href;
}

export function DocumentHead({ titleOverride, descriptionOverride, indexable }: { titleOverride?: string; descriptionOverride?: string; indexable?: boolean }) {
  const [location] = useLocation();
  useEffect(() => {
    const origin = window.location.origin;
    const meta = routeMeta(location);
    const title = titleOverride || meta.title;
    const description = descriptionOverride || meta.description;
    const robots = indexable === false || (indexable === undefined && !meta.indexable) || isPrivatePath(location)
      ? "noindex, nofollow"
      : "index, follow";
    const canonical = canonicalUrl(origin, location);
    document.title = title;
    upsertMeta('meta[name="description"]', "name", "description", description);
    upsertMeta('meta[name="robots"]', "name", "robots", robots);
    upsertMeta('meta[property="og:title"]', "property", "og:title", title);
    upsertMeta('meta[property="og:description"]', "property", "og:description", description);
    upsertMeta('meta[property="og:url"]', "property", "og:url", canonical);
    upsertMeta('meta[property="og:type"]', "property", "og:type", "website");
    upsertMeta('meta[name="twitter:card"]', "name", "twitter:card", "summary_large_image");
    upsertMeta('meta[name="twitter:title"]', "name", "twitter:title", title);
    upsertMeta('meta[name="twitter:description"]', "name", "twitter:description", description);
    upsertLink("canonical", canonical);
  }, [location, titleOverride, descriptionOverride, indexable]);
  return null;
}
