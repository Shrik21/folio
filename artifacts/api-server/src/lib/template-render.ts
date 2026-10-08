import { normalizeBundlePath } from "./template-bundle";
import { parse, type DefaultTreeAdapterTypes } from "parse5";

/*
 * Turns an uploaded HTML template + one person's portfolio into a single,
 * self-contained HTML document for a sandboxed <iframe>.
 *
 *  1. {{placeholders}} are filled in (a small, safe Mustache subset).
 *  2. Local CSS, JavaScript, images and fonts from the ZIP are inlined, so the
 *     document needs no other requests from Folio.
 *  3. A Content-Security-Policy is added: no fetch/XHR, no forms,
 *     no frames, and scripts only from a short list of public CDNs.
 *
 * The frontend shows the result in an iframe with sandbox="allow-scripts" (never
 * allow-same-origin), so template JavaScript can't reach Folio's cookies, pages
 * or API. The CSP is a second layer for when someone opens the HTML directly.
 */

export class TemplateRenderError extends Error {}

/** HTML escaping is not JavaScript/CSS escaping. Only interpolate in text or
 * quoted, non-executable attributes; JavaScript must use window.FOLIO instead. */
export function validatePlaceholderContexts(source: string) {
  // The HTML parser treats <{{name}}> as text, but substitution could turn it
  // into a real tag. Never allow dynamic tag names, including malformed prefixes.
  if (/<\s*\/?\s*\{\{/.test(source)) throw new TemplateRenderError("Dynamic HTML tag names are not supported. Keep tag names fixed and put placeholders inside their text.");
  const safe: { start: number; end: number }[] = [];
  const pending: DefaultTreeAdapterTypes.Node[] = [parse(source, { sourceCodeLocationInfo: true })];
  const rawText = new Set(["script", "style", "xmp", "iframe", "noembed", "noframes", "plaintext"]);
  while (pending.length) {
    const node = pending.pop()!;
    const location = node.sourceCodeLocation;
    if (node.nodeName === "#comment" || (node.nodeName === "#text" && "parentNode" in node &&
      !(node.parentNode && "tagName" in node.parentNode && rawText.has(node.parentNode.tagName)))) {
      if (location) safe.push({ start: location.startOffset, end: location.endOffset });
    }
    if ("tagName" in node) {
      for (const attr of node.attrs) {
        const at = location && "attrs" in location ? location.attrs?.[attr.name] : undefined;
        if (!at) continue;
        const original = source.slice(at.startOffset, at.endOffset);
        if (!original.includes("{{")) continue;
        // Restrict dynamic attributes to an explicit safe list, not an ever-growing denylist.
        const textAttribute = /^(?:id|class|title|alt|role|aria-[\w-]+|data-[\w-]+)$/.test(attr.name);
        const linkAttribute = node.tagName === "a" && attr.name === "href" &&
          /^\{\{\s*(?:emailLink|phoneLink|links\.(?:github|linkedin|twitter|website)|liveUrl|githubUrl)\s*\}\}$/.test(attr.value);
        const imageAttribute = node.tagName === "img" && attr.name === "src" && /^\{\{\s*avatar\s*\}\}$/.test(attr.value);
        const quoted = /^[^=]+\s*=\s*(["'])([\s\S]*)\1$/.exec(original);
        if (!quoted || (!textAttribute && !linkAttribute && !imageAttribute) || attr.namespace) continue;
        const valueStart = at.startOffset + original.indexOf(quoted[1]);
        safe.push({ start: valueStart + 1, end: at.endOffset - 1 });
      }
      if (node.tagName === "template" && "content" in node) pending.push(node.content as DefaultTreeAdapterTypes.DocumentFragment);
    }
    if ("childNodes" in node) pending.push(...node.childNodes);
  }
  safe.sort((a, b) => a.start - b.start);
  let interval = 0;
  for (const match of source.matchAll(/\{\{[\s\S]*?\}\}\}?/g)) {
    while (interval < safe.length && safe[interval].end <= match.index) interval++;
    const range = safe[interval];
    if (!range || range.start > match.index || range.end < match.index + match[0].length) {
      throw new TemplateRenderError(`Unsafe placeholder ${match[0]}. Use placeholders in text or quoted text attributes, safe link fields in href, and window.FOLIO in JavaScript. Never put placeholders in scripts, styles, event handlers or unquoted attributes.`);
    }
  }
}

/* ---------- allowed hosts (also used for upload warnings) ---------------------- */

export const SCRIPT_HOSTS = ["cdnjs.cloudflare.com", "cdn.jsdelivr.net", "unpkg.com"];
export const STYLE_HOSTS = [...SCRIPT_HOSTS, "fonts.googleapis.com"];
export const FONT_HOSTS = [...SCRIPT_HOSTS, "fonts.gstatic.com"];

const CSP = [
  "default-src 'none'",
  `script-src 'unsafe-inline' ${SCRIPT_HOSTS.map((host) => `https://${host}`).join(" ")}`,
  `style-src 'unsafe-inline' ${STYLE_HOSTS.map((host) => `https://${host}`).join(" ")}`,
  `font-src data: ${FONT_HOSTS.map((host) => `https://${host}`).join(" ")}`,
  "img-src data: blob: https:",
  "media-src data: https:",
  "connect-src 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
].join("; ");

/* ---------- placeholders (Mustache subset) -------------------------------------- */

type Node = { t: "text"; v: string } | { t: "var"; n: string } | { t: "sec"; n: string; inv: boolean; kids: Node[] };

const NAME = /^(\.|[A-Za-z_]\w*(\.[A-Za-z_]\w*)*)$/;
const near = (source: string, at: number) => source.slice(at, at + 30).replace(/\s+/g, " ");

function parseMustache(source: string): Node[] {
  const root: Node[] = [];
  const open: Extract<Node, { t: "sec" }>[] = [];
  let kids = root;
  let i = 0;
  while (i < source.length) {
    const start = source.indexOf("{{", i);
    if (start === -1) {
      kids.push({ t: "text", v: source.slice(i) });
      break;
    }
    if (start > i) kids.push({ t: "text", v: source.slice(i, start) });
    const triple = source[start + 2] === "{";
    const closer = triple ? "}}}" : "}}";
    const end = source.indexOf(closer, start + (triple ? 3 : 2));
    if (end === -1) throw new TemplateRenderError(`A “{{” is never closed (near “${near(source, start)}”).`);
    const inner = source.slice(start + (triple ? 3 : 2), end).trim();
    i = end + closer.length;
    const sigil = triple ? "" : inner[0];
    const name = (sigil === "#" || sigil === "^" || sigil === "/" || sigil === "&" ? inner.slice(1) : inner).trim();

    if (sigil === "!" || sigil === ">" || sigil === "=") continue; // comments; partials and delimiter changes aren't supported
    if (!NAME.test(name)) throw new TemplateRenderError(`“{{${inner}}}” isn't a valid placeholder name.`);
    if (sigil === "#" || sigil === "^") {
      const node: Extract<Node, { t: "sec" }> = { t: "sec", n: name, inv: sigil === "^", kids: [] };
      kids.push(node);
      open.push(node);
      kids = node.kids;
      if (open.length > 12) throw new TemplateRenderError("Sections are nested too deeply (the limit is 12).");
    } else if (sigil === "/") {
      const top = open.pop();
      if (!top) throw new TemplateRenderError(`{{/${name}}} closes a section that was never opened.`);
      if (top.n !== name) throw new TemplateRenderError(`Expected {{/${top.n}}} but found {{/${name}}}.`);
      kids = open.length ? open[open.length - 1].kids : root;
    } else {
      // {{{x}}} and {{&x}} are treated like {{x}}: user content is always escaped.
      kids.push({ t: "var", n: name });
    }
  }
  if (open.length) throw new TemplateRenderError(`{{#${open[open.length - 1].n}}} is never closed. Add {{/${open[open.length - 1].n}}}.`);
  return root;
}

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;" };
const escapeHtml = (value: string) => value.replace(/[&<>"'`]/g, (char) => ESCAPES[char]);

function lookup(name: string, stack: unknown[]): unknown {
  if (name === ".") return stack[stack.length - 1];
  const [head, ...rest] = name.split(".");
  for (let i = stack.length - 1; i >= 0; i--) {
    const context = stack[i];
    if (context && typeof context === "object" && !Array.isArray(context) && Object.hasOwn(context, head)) {
      let value: unknown = (context as Record<string, unknown>)[head];
      for (const part of rest) {
        if (value && typeof value === "object" && Object.hasOwn(value, part)) value = (value as Record<string, unknown>)[part];
        else return undefined;
      }
      return value;
    }
  }
  return undefined;
}

const truthy = (value: unknown) => (Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && value !== false && value !== "" && value !== 0);

const MAX_OUTPUT = 2 * 1024 * 1024;
const MAX_ITEMS = 200;

function renderNodes(nodes: Node[], stack: unknown[], budget: { size: number }): string {
  let out = "";
  for (const node of nodes) {
    let piece = "";
    if (node.t === "text") piece = node.v;
    else if (node.t === "var") {
      const value = lookup(node.n, stack);
      if (typeof value === "string" || typeof value === "number") piece = escapeHtml(String(value));
    } else {
      const value = lookup(node.n, stack);
      if (node.inv) {
        if (!truthy(value)) piece = renderNodes(node.kids, stack, budget);
      } else if (Array.isArray(value)) {
        for (const item of value.slice(0, MAX_ITEMS)) piece += renderNodes(node.kids, [...stack, item], budget);
      } else if (truthy(value)) {
        piece = renderNodes(node.kids, value && typeof value === "object" ? [...stack, value] : stack, budget);
      }
    }
    budget.size += piece.length;
    if (budget.size > MAX_OUTPUT) throw new TemplateRenderError("The filled-in page is too large. Check for loops that repeat too much.");
    out += piece;
  }
  return out;
}

export function renderMustache(source: string, data: unknown) {
  return renderNodes(parseMustache(source), [data], { size: 0 });
}

/* ---------- the data templates receive ---------------------------------------- */

const asObject = (value: unknown): Record<string, unknown> => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {});
const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const items = (value: unknown, max: number): unknown[] => (Array.isArray(value) ? value.slice(0, max) : []);

/** http(s) links only; anything else (javascript:, data:, file:…) becomes empty. */
export function safeUrl(value: unknown) {
  const raw = text(value, 500);
  if (!raw) return "";
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : `https://${raw}`);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function safeAvatar(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(raw) && raw.length <= 700_000) return raw;
  return safeUrl(raw);
}

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

/** Normalises a saved portfolio's content into what templates can use ({{name}}, {{#experience}}…). */
export function buildRenderData(content: unknown, profession?: unknown) {
  const root = asObject(content);
  const info = asObject(root.personalInfo);
  const links = asObject(root.socialLinks);
  const name = text(info.name, 120);
  const email = text(info.email, 200);
  const phone = text(info.phone, 60);

  const experience = items(root.experience, 30)
    .map(asObject)
    .map((item) => ({ role: text(item.role, 160), company: text(item.company, 160), period: text(item.period, 80), description: text(item.description, 1500) }))
    .filter((item) => Object.values(item).some(Boolean));
  const education = items(root.education, 20)
    .map(asObject)
    .map((item) => ({ degree: text(item.degree, 160), school: text(item.school, 160), period: text(item.period, 80) }))
    .filter((item) => Object.values(item).some(Boolean));
  const projects = items(root.projects, 30)
    .map(asObject)
    .map((item) => {
      const liveUrl = safeUrl(item.liveUrl);
      const githubUrl = safeUrl(item.githubUrl);
      return {
        name: text(item.name, 160),
        description: text(item.description, 1500),
        liveUrl,
        githubUrl,
        hasLinks: Boolean(liveUrl || githubUrl),
        technologies: items(item.technologies, 20).map((tech) => text(tech, 40)).filter(Boolean),
      };
    })
    .filter((item) => item.name || item.description);
  const skills = items(root.skills, 60).map((skill) => text(skill, 60)).filter(Boolean);
  const safeLinks = { github: safeUrl(links.github), linkedin: safeUrl(links.linkedin), twitter: safeUrl(links.twitter), website: safeUrl(links.website) };

  return {
    name,
    firstName: name.split(/\s+/)[0] ?? "",
    initials: initialsOf(name),
    headline: text(info.headline, 200),
    summary: text(info.summary, 3000),
    location: text(info.location, 120),
    email,
    emailLink: /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(email) ? `mailto:${email}` : "",
    phone,
    phoneLink: phone.replace(/[^\d+]/g, "") ? `tel:${phone.replace(/[^\d+]/g, "")}` : "",
    avatar: safeAvatar(info.avatar),
    profession: text(profession, 120),
    links: safeLinks,
    hasLinks: Object.values(safeLinks).some(Boolean),
    hasExperience: experience.length > 0,
    hasEducation: education.length > 0,
    hasProjects: projects.length > 0,
    hasSkills: skills.length > 0,
    experience,
    education,
    projects,
    skills,
    year: String(new Date().getFullYear()),
  };
}
export type RenderData = ReturnType<typeof buildRenderData>;

/** A fictional person used for previews when an admin uploads a template. */
export const SAMPLE_CONTENT = {
  personalInfo: {
    name: "Alex Rivera",
    headline: "Senior Product Engineer",
    email: "alex@example.com",
    phone: "+1 555 0100",
    location: "Lisbon, Portugal",
    summary: "I build calm, reliable products people enjoy using. Nine years across payments, developer tools and design systems, most recently leading a team of six.",
  },
  experience: [
    { role: "Senior Product Engineer", company: "Northwind", period: "2021 — Now", description: "Led the checkout rewrite and cut load time by 38%.\nMentored four engineers." },
    { role: "Software Engineer", company: "Lumen Labs", period: "2017 — 2021", description: "Built the plugin SDK used by internal teams." },
  ],
  education: [{ degree: "BSc Computer Science", school: "University of Porto", period: "2012 — 2016" }],
  skills: ["TypeScript", "React", "Node.js", "PostgreSQL", "Design systems"],
  projects: [
    { name: "Ledgerline", description: "Open-source double-entry ledger for small teams.", technologies: ["TypeScript", "Postgres"], githubUrl: "https://github.com/example/ledgerline", liveUrl: "" },
    { name: "Palette", description: "A colour tool that checks contrast as you type.", technologies: ["React", "Canvas"], githubUrl: "", liveUrl: "https://example.com/palette" },
  ],
  socialLinks: { github: "https://github.com/example", linkedin: "https://linkedin.com/in/example", twitter: "", website: "https://example.com" },
};

/* ---------- inlining files from the ZIP ---------------------------------------- */

type Files = Map<string, Buffer>;

const MIME: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", avif: "image/avif",
  svg: "image/svg+xml", ico: "image/x-icon", woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf",
};

const dirnameOf = (path: string) => (path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "");
const LOCAL_ONLY = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;

function resolveRef(ref: string, baseDir: string) {
  const trimmed = ref.trim();
  if (!trimmed || LOCAL_ONLY.test(trimmed)) return null;
  let clean = trimmed.split(/[?#]/)[0];
  try {
    clean = decodeURIComponent(clean);
  } catch {
    // keep the raw path
  }
  return normalizeBundlePath(clean.startsWith("/") ? clean.slice(1) : baseDir ? `${baseDir}/${clean}` : clean);
}

function dataUri(path: string, files: Files) {
  const data = files.get(path);
  const mime = MIME[path.slice(path.lastIndexOf(".") + 1).toLowerCase()];
  return data && mime ? `data:${mime};base64,${data.toString("base64")}` : null;
}

function processCss(css: string, baseDir: string, files: Files, depth = 0): string {
  let out = css;
  if (depth < 3) {
    out = out.replace(/@import\s+(?:url\(\s*)?(["']?)([^"')\s;]+)\1\s*\)?[^;]*;/gi, (match, _quote, ref: string) => {
      const path = resolveRef(ref, baseDir);
      const file = path && /\.css$/i.test(path) ? files.get(path) : undefined;
      return path && file ? processCss(file.toString("utf8"), dirnameOf(path), files, depth + 1) : match;
    });
  }
  return out.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi, (match, _quote, ref: string) => {
    const path = resolveRef(ref, baseDir);
    const uri = path && dataUri(path, files);
    return uri ? `url("${uri}")` : match;
  });
}

// Attribute names exclude "<", so a malformed tag fails fast instead of backtracking across the document.
const ATTRIBUTE = /(\s)([^\s"'<>/=]+)(\s*=\s*)("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
const TAG = /<([a-zA-Z][\w-]*)((?:\s+[^\s"'<>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*(\/?)>/g;

function getAttribute(attrs: string, name: string) {
  const match = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i").exec(attrs);
  return match ? (match[1] ?? match[2] ?? match[3]) : undefined;
}

function rewriteAttributes(attrs: string, names: string[], rewrite: (name: string, value: string) => string) {
  return attrs.replace(ATTRIBUTE, (match, space: string, name: string, equals: string, _raw: string, dq?: string, sq?: string, bare?: string) => {
    if (!names.includes(name.toLowerCase())) return match;
    const value = dq ?? sq ?? bare ?? "";
    const next = rewrite(name.toLowerCase(), value);
    return next === value ? match : `${space}${name}${equals}"${next.replaceAll('"', "&quot;")}"`;
  });
}

function inlineAssets(html: string, files: Files, entryDir: string) {
  const fileUri = (ref: string) => {
    const path = resolveRef(ref, entryDir);
    return (path && dataUri(path, files)) || ref;
  };

  // 1. Images, media, icons: src, poster, srcset and favicon links become data URIs.
  let out = html.replace(TAG, (match, tag: string, attrs: string, slash: string) => {
    const lower = tag.toLowerCase();
    if (lower === "script" || lower === "a") return match;
    if (lower === "link") {
      if (/\brel\s*=\s*["']?[^"'>]*stylesheet/i.test(attrs)) return match;
      return `<${tag}${rewriteAttributes(attrs, ["href"], (_n, value) => fileUri(value))}${slash}>`;
    }
    const next = rewriteAttributes(attrs, ["src", "poster", "data-src", "data-poster", "srcset", "data-srcset"], (name, value) => {
      if (name.endsWith("srcset")) {
        if (value.includes("data:")) return value;
        return value
          .split(",")
          .map((part) => {
            const [url, ...descriptor] = part.trim().split(/\s+/);
            return [url ? fileUri(url) : "", ...descriptor].join(" ").trim();
          })
          .join(", ");
      }
      return fileUri(value);
    });
    return `<${tag}${next}${slash}>`;
  });

  // 2. url(...) in inline styles and <style> blocks.
  out = processCss(out, entryDir, files, 3);

  // 3. <link rel="stylesheet" href="local.css"> becomes an inline <style>.
  out = out.replace(/<link\b([^>]*)>/gi, (match, attrs: string) => {
    if (!/\brel\s*=\s*["']?[^"'>]*stylesheet/i.test(attrs)) return match;
    const href = getAttribute(attrs, "href");
    const path = href ? resolveRef(href, entryDir) : null;
    const file = path ? files.get(path) : undefined;
    if (!path || !file) return match;
    return `<style data-folio-file="${escapeHtml(path)}">\n${processCss(file.toString("utf8"), dirnameOf(path), files).replace(/<\/style/gi, "<\\/style")}\n</style>`;
  });

  // 4. <script src="local.js"> becomes an inline script. Classic scripts marked defer
  //    move to the end of <body>, which keeps their "run after the page is parsed" timing.
  const deferred: string[] = [];
  out = out.replace(/<script\b([^>]*)>\s*<\/script\s*>/gi, (match, attrs: string) => {
    const src = getAttribute(attrs, "src");
    const path = src ? resolveRef(src, entryDir) : null;
    const file = path ? files.get(path) : undefined;
    if (!path || !file) return match;
    const kept = attrs.replace(/\s+(src|defer|async|integrity|crossorigin)(\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/gi, "");
    const tag = `<script${kept}>\n${file.toString("utf8").replace(/<\/script/gi, "<\\/script")}\n</script>`;
    if (/\sdefer(\s|=|>|$)/i.test(` ${attrs} `) && !/type\s*=\s*["']?module/i.test(attrs)) {
      deferred.push(tag);
      return "";
    }
    return tag;
  });
  if (deferred.length) {
    const close = out.toLowerCase().lastIndexOf("</body>");
    out = close === -1 ? `${out}\n${deferred.join("\n")}` : `${out.slice(0, close)}${deferred.join("\n")}\n${out.slice(close)}`;
  }
  return out;
}

/* ---------- injected into every document --------------------------------------- */

// Links open in a new tab (an iframe can't navigate the page), and javascript: links do nothing.
const LINK_SCRIPT = `(function(){document.addEventListener("click",function(e){var a=e.target&&e.target.closest?e.target.closest("a[href]"):null;if(!a)return;var h=(a.getAttribute("href")||"").trim();if(/^javascript:/i.test(h)){e.preventDefault();return}if(h.charAt(0)==="#"||/^(mailto|tel):/i.test(h))return;a.setAttribute("target","_blank");a.setAttribute("rel","noopener noreferrer")},true)})();`;

const safeJson = (value: unknown) =>
  JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

function injectHead(html: string, injection: string) {
  const doctype = /^\s*<!doctype/i.test(html) ? "" : "<!doctype html>\n";
  const head = /<head\b[^>]*>/i.exec(html);
  if (head) {
    const at = head.index + head[0].length;
    return `${doctype}${html.slice(0, at)}\n${injection}${html.slice(at)}`;
  }
  const root = /<html\b[^>]*>/i.exec(html);
  if (root) {
    const at = root.index + root[0].length;
    return `${doctype}${html.slice(0, at)}<head>${injection}</head>${html.slice(at)}`;
  }
  return `${doctype}<head>${injection}</head>${html}`;
}

/** Builds the final HTML document for one person. Throws TemplateRenderError on a problem in the template. */
export function renderBundleHtml(files: Files, entry: string, data: RenderData) {
  const source = files.get(entry);
  if (!source) throw new TemplateRenderError(`The template has no ${entry}.`);
  const original = source.toString("utf8");
  validatePlaceholderContexts(original);
  const filled = renderMustache(original, data);
  const inlined = inlineAssets(filled, files, dirnameOf(entry));
  const viewport = /name\s*=\s*["']viewport["']/i.test(inlined) ? "" : '<meta name="viewport" content="width=device-width, initial-scale=1">\n';
  const html = injectHead(
    inlined,
    `<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="${CSP}">\n${viewport}<script>window.FOLIO=${safeJson(data)};${LINK_SCRIPT}</script>\n`,
  );
  if (html.length > 8 * 1024 * 1024) throw new TemplateRenderError("The finished page is too large. Optimise images and fonts.");
  return html;
}

/* ---------- warnings shown to the admin when uploading --------------------------- */

/** Things that won't work inside the sandbox, or that look like mistakes. */
export function analyzeBundle(files: Files, entry: string): string[] {
  const warnings = new Set<string>();
  const html = files.get(entry)?.toString("utf8") ?? "";
  const entryDir = dirnameOf(entry);
  const scripts = [...files].filter(([path]) => /\.m?js$/i.test(path)).map(([, data]) => data.toString("utf8"));
  const inlineScripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)].map((match) => match[1]);
  // Comments are ignored, so a note like "no localStorage here" doesn't trigger a warning.
  const code = [...scripts, ...inlineScripts]
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
  const styles = [...[...files].filter(([path]) => /\.css$/i.test(path)).map(([, data]) => data.toString("utf8")), ...[...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)].map((match) => match[1])].join("\n");

  if (!/\{\{/.test(html) && !/\bFOLIO\b/.test(code + html)) {
    warnings.add("This template doesn't use any {{placeholders}} or window.FOLIO, so every portfolio would show the same text.");
  }

  const missing = new Set<string>();
  const checkLocal = (ref: string, from: string) => {
    const path = resolveRef(ref, from);
    if (path && !files.has(path)) missing.add(ref.trim());
  };
  for (const match of html.matchAll(TAG)) {
    const tag = match[1].toLowerCase();
    const attrs = match[2];
    if (tag === "a") {
      const href = getAttribute(attrs, "href");
      if (href && !LOCAL_ONLY.test(href.trim()) && !href.includes("{{")) warnings.add(`A link to “${href}” won't work: portfolios are a single page, so links to other pages inside the ZIP aren't supported.`);
      continue;
    }
    const value = tag === "link" ? getAttribute(attrs, "href") : getAttribute(attrs, "src") ?? getAttribute(attrs, "poster") ?? getAttribute(attrs, "data-src");
    if (!value || value.includes("{{")) continue;
    if (/^http:\/\//i.test(value.trim())) warnings.add(`“${value}” uses http://. Only https:// resources load inside templates.`);
    else if (/^https:\/\//i.test(value.trim())) {
      let host: string;
      try { host = new URL(value.trim(), "https://x.invalid").hostname; }
      catch { warnings.add(`“${value}” is not a valid resource URL.`); continue; }
      if (tag === "script" && !SCRIPT_HOSTS.includes(host)) warnings.add(`The script from ${host} is blocked. Scripts can only load from: ${SCRIPT_HOSTS.join(", ")}. Put the file in the ZIP instead.`);
      if (tag === "link" && /stylesheet/i.test(attrs) && !STYLE_HOSTS.includes(host)) warnings.add(`The stylesheet from ${host} is blocked. Styles can only load from: ${STYLE_HOSTS.join(", ")}. Put the file in the ZIP instead.`);
    } else checkLocal(value, entryDir);
    if (tag === "form") warnings.add("Forms can't be submitted inside templates.");
  }
  if (/<form\b/i.test(html)) warnings.add("Forms can't be submitted inside templates.");
  if (/<(iframe|embed|object)\b/i.test(html)) warnings.add("<iframe>, <embed> and <object> are blocked inside templates.");
  for (const [path, data] of files) {
    if (!/\.css$/i.test(path)) continue;
    for (const match of data.toString("utf8").matchAll(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi)) checkLocal(match[2], dirnameOf(path));
  }
  for (const match of styles.matchAll(/url\(\s*(["']?)http:\/\/([^"')]+)\1\s*\)/gi)) warnings.add(`“http://${match[2]}” uses http://. Only https:// resources load inside templates.`);
  if (missing.size) warnings.add(`These files are referenced but not in the ZIP: ${[...missing].slice(0, 6).join(", ")}${missing.size > 6 ? "…" : ""}.`);

  if (/\b(fetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts)/.test(code)) warnings.add("Network requests (fetch, XMLHttpRequest, WebSocket…) are blocked inside templates.");
  if (/\b(eval\s*\(|new\s+Function\s*\()/.test(code)) warnings.add("eval() and new Function() are blocked inside templates.");
  if (/\b(localStorage|sessionStorage|indexedDB|document\.cookie)\b/.test(code)) warnings.add("localStorage, sessionStorage, IndexedDB and cookies aren't available inside templates; using them throws an error.");
  if (/@import\s+(?:url\(\s*)?["']?https?:/i.test(styles)) warnings.add("A CSS @import from the web may be blocked. Fonts and styles can only load from the allowed CDNs; use <link> tags for those.");

  return [...warnings].slice(0, 12);
}
