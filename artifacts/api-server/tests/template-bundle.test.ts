import assert from "node:assert/strict";
import { test } from "node:test";
import { deflateRawSync } from "node:zlib";
import { crc32, readZip, ZipError } from "../src/lib/zip-reader";
import { BundleError, parseBundleZip, resolveCategory } from "../src/lib/template-bundle";
import { analyzeBundle, buildRenderData, renderBundleHtml, renderMustache, SAMPLE_CONTENT, TemplateRenderError, validatePlaceholderContexts } from "../src/lib/template-render";
import { readFileSync } from "node:fs";

/* ---------- a tiny ZIP writer, for tests only ---------- */

type Spec = { data: Buffer | string; method?: 0 | 8; flags?: number; attributes?: number; size?: number; crc?: number };
function makeZip(files: Record<string, Buffer | string | Spec>) {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, value] of Object.entries(files)) {
    const spec: Spec = Buffer.isBuffer(value) || typeof value === "string" ? { data: value } : value;
    const raw = Buffer.isBuffer(spec.data) ? spec.data : Buffer.from(spec.data);
    const method = spec.method ?? (name.endsWith("/") ? 0 : 8);
    const body = method === 8 ? deflateRawSync(raw) : raw;
    const nameBuffer = Buffer.from(name);
    const size = spec.size ?? raw.length;
    const crc = spec.crc ?? crc32(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(spec.flags ?? 0, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(size, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    locals.push(local, nameBuffer, body);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(spec.flags ?? 0, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(size, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt32LE(spec.attributes ?? 0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuffer);
    offset += 30 + nameBuffer.length + body.length;
  }
  const centralBuffer = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuffer, end]);
}

const limits = { maxEntries: 20, maxFileBytes: 1000, maxTotalBytes: 3000 };
const manifest = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({ id: "aurora-dev", name: "Aurora Dev", description: "A dark developer portfolio for tests.", category: "developers", ...extra });
const goodFiles = (): Record<string, string> => ({
  "folio-template.json": manifest(),
  "index.html": "<!doctype html><html><head><title>{{name}}</title></head><body><h1>{{name}}</h1></body></html>",
});

test("HTML placeholders cannot become executable JavaScript, CSS or attributes", () => {
  for (const html of [
    '<script>window.name={{name}}</script>', '<style>{{summary}}</style>',
    '<div data-name={{name}}>Hello</div>', '<button onclick="{{summary}}">Hi</button>',
    '<div style="{{summary}}">Hi</div>', '<iframe srcdoc="{{summary}}"></iframe>',
    '<script src="{{links.website}}"></script>', '<a href="{{name}}">Hi</a>',
    '<img src="{{summary}}">', '<meta http-equiv="refresh" content="{{summary}}">',
    '<{{name}}>Hi</{{name}}>', '<template><script>{{summary}}</script></template>',
  ]) assert.throws(() => validatePlaceholderContexts(html), TemplateRenderError, html);
  assert.doesNotThrow(() => validatePlaceholderContexts('<h1>{{name}}</h1><p title="{{summary}}">{{summary}}</p><a href="{{links.website}}">Site</a><img src="{{avatar}}"><script>document.title=window.FOLIO.name</script>'));
});

test("ZIP paths stay relative, duplicate normalized names are refused, and empty files work", () => {
  for (const path of ['/index.html', '../index.html', 'C:/index.html']) {
    assert.throws(() => parseBundleZip(makeZip({ ...goodFiles(), [path]: '{{name}}' })), BundleError);
  }
  assert.throws(() => parseBundleZip(makeZip({ ...goodFiles(), './index.html': '{{name}}' })), /more than once/);
  assert.equal(parseBundleZip(makeZip({ ...goodFiles(), 'empty.txt': '' })).files.get('empty.txt')?.length, 0);
});

test("the downloadable Aurora sample parses and renders all resume sections without warnings", () => {
  const zip = readFileSync(new URL('./fixtures/folio-template-sample.zip', import.meta.url));
  const sample = parseBundleZip(zip);
  assert.equal(sample.definition.category, 'Software Engineering');
  const html = renderBundleHtml(sample.files, sample.definition.entry, buildRenderData(SAMPLE_CONTENT, 'Product Engineer'));
  for (const text of ['Alex Rivera', 'Senior Product Engineer', 'Northwind', 'Ledgerline', 'TypeScript', 'University of Porto']) assert.ok(html.includes(text), text);
  assert.deepEqual(analyzeBundle(sample.files, sample.definition.entry), []);
});

/* ---------- ZIP reader ---------- */

test("zip reader reads stored and deflated files and skips folders", () => {
  const zip = makeZip({ "a/": "", "a/one.txt": { data: "hello", method: 0 }, "two.txt": "world ".repeat(20) });
  const entries = readZip(zip, limits);
  assert.deepEqual(entries.map((entry) => entry.path), ["a/one.txt", "two.txt"]);
  assert.equal(entries[0].data.toString(), "hello");
  assert.equal(entries[1].data.toString(), "world ".repeat(20));
});

test("zip reader refuses damaged, encrypted, oversized and lying archives", () => {
  assert.throws(() => readZip(Buffer.from("not a zip at all, definitely not"), limits), ZipError);
  assert.throws(() => readZip(makeZip({ "a.txt": { data: "x", flags: 1 } }), limits), /Password/);
  assert.throws(() => readZip(makeZip({ "a.txt": "x".repeat(1500) }), limits), /at most/);
  assert.throws(() => readZip(makeZip({ a: "x".repeat(900), b: "y".repeat(900), c: "z".repeat(900), d: "w".repeat(900) }), limits), /add up to more than/);
  assert.throws(() => readZip(makeZip(Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`f${i}.txt`, "x"]))), limits), /too many/);
  assert.throws(() => readZip(makeZip({ "a.txt": { data: "hello", crc: 1 } }), limits), /checksum/);
  assert.throws(() => readZip(makeZip({ "link.txt": { data: "target", attributes: 0xa1ff0000 } }), limits), /shortcut/);
  // A "zip bomb": the header claims 10 bytes but the data expands to a megabyte.
  assert.throws(() => readZip(makeZip({ "bomb.txt": { data: Buffer.alloc(1_000_000), size: 10 } }), limits), ZipError);
});

/* ---------- bundles and categories ---------- */

test("friendly category names map to Folio categories and groups", () => {
  assert.equal(resolveCategory("developers"), "Software Engineering");
  assert.equal(resolveCategory(" Designers "), "Design & Creative");
  assert.equal(resolveCategory("Design and Creative"), "Design & Creative");
  assert.equal(resolveCategory("nurses"), "Healthcare");
  assert.equal(resolveCategory("Cloud & Security"), "Cloud & Security");
  assert.equal(resolveCategory("astronauts"), undefined);

  const dev = parseBundleZip(makeZip(goodFiles()));
  assert.equal(dev.definition.category, "Software Engineering");
  assert.deepEqual(dev.definition.groups, ["technical"]);
  const design = parseBundleZip(makeZip({ ...goodFiles(), "folio-template.json": manifest({ category: "designers" }) }));
  assert.deepEqual([design.definition.category, design.definition.groups], ["Design & Creative", ["non-technical"]]);
  const universal = parseBundleZip(makeZip({ ...goodFiles(), "folio-template.json": manifest({ category: "universal" }) }));
  assert.deepEqual(universal.definition.groups, ["technical", "non-technical"]);
  const custom = parseBundleZip(makeZip({ ...goodFiles(), "folio-template.json": manifest({ groups: ["technical", "non-technical"] }) }));
  assert.deepEqual(custom.definition.groups, ["technical", "non-technical"]);
});

test("a ZIP made from a folder works, and macOS and hidden files are ignored", () => {
  const wrapped = parseBundleZip(
    makeZip({
      "my-template/folio-template.json": manifest(),
      "my-template/index.html": "<h1>{{name}}</h1>",
      "my-template/assets/a.png": "png",
      "__MACOSX/my-template/._index.html": "junk",
      "my-template/.DS_Store": "junk",
    }),
  );
  assert.deepEqual([...wrapped.files.keys()].sort(), ["assets/a.png", "folio-template.json", "index.html"]);
  assert.equal(wrapped.definition.files, 3);
});

test("bundle problems are explained in plain language", () => {
  const fail = (files: Record<string, string>, pattern: RegExp, detail?: RegExp) => {
    try {
      parseBundleZip(makeZip(files));
      assert.fail("expected a BundleError");
    } catch (error) {
      assert.ok(error instanceof BundleError, String(error));
      assert.match(error.message + " " + error.issues.join(" "), pattern);
      if (detail) assert.match(error.issues.join(" "), detail);
    }
  };
  fail({ "index.html": "<h1/>" }, /folio-template\.json/);
  fail({ ...goodFiles(), "folio-template.json": "{ nope" }, /isn't valid JSON/);
  fail({ ...goodFiles(), "folio-template.json": manifest({ id: "Bad Id" }) }, /problems/, /id:/);
  fail({ ...goodFiles(), "folio-template.json": manifest({ css: "x" }) }, /problems/, /Unrecognized/);
  fail({ ...goodFiles(), "folio-template.json": manifest({ category: "astronauts" }) }, /problems/, /Software Engineering/);
  fail({ ...goodFiles(), "server.php": "<?php" }, /aren't allowed: server\.php/);
  fail({ ...goodFiles(), "run.exe": "x" }, /aren't allowed: run\.exe/);
  fail({ "folio-template.json": manifest() }, /no index\.html/);
  fail({ ...goodFiles(), "folio-template.json": manifest({ entry: "main.js" }), "main.js": "x" }, /problems/, /\.html/);
  fail({ ...goodFiles(), "../evil.html": "x" }, /unsafe path/);
});

/* ---------- placeholders ---------- */

test("placeholders escape, loop, branch and look up safely", () => {
  const data = { name: "Ann <b>&\"'", list: ["a", "b"], people: [{ n: "x" }, { n: "y" }], on: true, off: "", nested: { deep: "ok" } };
  assert.equal(renderMustache("{{name}}", data), "Ann &lt;b&gt;&amp;&quot;&#39;");
  assert.equal(renderMustache("{{{name}}} {{&name}}", data), "Ann &lt;b&gt;&amp;&quot;&#39; Ann &lt;b&gt;&amp;&quot;&#39;");
  assert.equal(renderMustache("{{#list}}[{{.}}]{{/list}}", data), "[a][b]");
  assert.equal(renderMustache("{{#people}}{{n}}{{name}}|{{/people}}", data), "xAnn &lt;b&gt;&amp;&quot;&#39;|yAnn &lt;b&gt;&amp;&quot;&#39;|");
  assert.equal(renderMustache("{{#on}}yes{{/on}}{{^on}}no{{/on}}{{#off}}A{{/off}}{{^off}}B{{/off}}", data), "yesB");
  assert.equal(renderMustache("{{nested.deep}} {{nested.missing}}|{{missing}}|{{! a comment }}", data), "ok ||");
  assert.equal(renderMustache("{{#nested}}{{deep}}{{/nested}}", data), "ok");
  // Inherited properties are never exposed.
  assert.equal(renderMustache("{{constructor}}{{__proto__}}{{toString}}{{nested.constructor}}", data), "");
});

test("placeholder mistakes are reported clearly", () => {
  assert.throws(() => renderMustache("{{name", {}), /never closed/);
  assert.throws(() => renderMustache("{{#a}}x", {}), /never closed/);
  assert.throws(() => renderMustache("{{#a}}x{{/b}}", {}), /Expected \{\{\/a\}\}/);
  assert.throws(() => renderMustache("x{{/a}}", {}), /never opened/);
  assert.throws(() => renderMustache("{{a b}}", {}), /isn't a valid placeholder/);
  assert.throws(() => renderMustache("{{#a}}".repeat(20) + "{{/a}}".repeat(20), {}), /nested too deeply/);
  const big = { rows: Array.from({ length: 200 }, () => "x".repeat(20_000)) };
  assert.throws(() => renderMustache("{{#rows}}{{.}}{{/rows}}", big), TemplateRenderError);
});

test("render data is cleaned: safe links only, capped lists, no surprises", () => {
  const data = buildRenderData({
    personalInfo: { name: "  Ann Lee  ", headline: "Dev", email: "ann@x.io", phone: "+1 (555) 010-0200", avatar: "javascript:alert(1)", summary: "S" },
    socialLinks: { github: "javascript:alert(1)", linkedin: "linkedin.com/in/ann", twitter: "data:text/html,x", website: "" },
    experience: [{ role: "Eng", company: "", period: "", description: "" }, {}, "junk", null],
    projects: [{ name: "P", liveUrl: "ftp://x", githubUrl: "https://github.com/a/b", technologies: ["A", 5, "B"] }, { description: "", name: "" }],
    skills: Array.from({ length: 100 }, (_, i) => `s${i}`),
    education: "not a list",
  }, "Engineer");
  assert.equal(data.name, "Ann Lee");
  assert.equal(data.initials, "AL");
  assert.equal(data.firstName, "Ann");
  assert.equal(data.avatar, "");
  assert.equal(data.links.github, "");
  assert.equal(data.links.twitter, "");
  assert.equal(data.links.linkedin, "https://linkedin.com/in/ann");
  assert.equal(data.hasLinks, true);
  assert.equal(data.emailLink, "mailto:ann@x.io");
  assert.equal(data.phoneLink, "tel:+15550100200");
  assert.equal(data.experience.length, 1);
  assert.equal(data.projects.length, 1);
  assert.deepEqual([data.projects[0].liveUrl, data.projects[0].githubUrl, data.projects[0].hasLinks], ["", "https://github.com/a/b", true]);
  assert.deepEqual(data.projects[0].technologies, ["A", "B"]);
  assert.equal(data.skills.length, 60);
  assert.deepEqual([data.hasEducation, data.hasExperience, data.hasProjects, data.hasSkills], [false, true, true, true]);
  assert.equal(data.profession, "Engineer");
  assert.equal(buildRenderData("garbage").name, "");
  assert.equal(buildRenderData({ personalInfo: { avatar: "data:image/png;base64,iVBORw0KGgo=" } }).avatar, "data:image/png;base64,iVBORw0KGgo=");
});

/* ---------- the finished page ---------- */

const files = (extra: Record<string, string | Buffer> = {}) =>
  new Map<string, Buffer>(
    Object.entries({
      "index.html": `<html><head><title>{{name}}</title><link rel="stylesheet" href="css/site.css"><script src="js/app.js" defer></script></head>
<body style="background:url(img/bg.png)"><img src="img/logo.png" alt="" srcset="img/logo.png 1x, img/logo2.png 2x"><h1>{{name}}</h1><a href="{{links.github}}">gh</a>
<script src="js/early.js"></script></body></html>`,
      "css/site.css": `@font-face { font-family: F; src: url("../fonts/f.woff2") } body { background: url(../img/bg.png) } .x { background: url(missing.png) }`,
      "js/app.js": `window.__app = "</script><b>"`,
      "js/early.js": `window.__early = 1`,
      "img/logo.png": "LOGO",
      "img/logo2.png": "LOGO2",
      "img/bg.png": "BG",
      "fonts/f.woff2": "FONT",
      ...extra,
    }).map(([path, data]) => [path, Buffer.isBuffer(data) ? data : Buffer.from(data)]),
  );

test("the finished page inlines files, locks the sandbox down, and escapes people's text", () => {
  const data = buildRenderData({ personalInfo: { name: "Ann </script><script>alert(1)</script>" }, socialLinks: { github: "github.com/ann" } });
  const html = renderBundleHtml(files(), "index.html", data);
  // Files from the ZIP are inlined, relative to where they were referenced from.
  assert.match(html, /<style data-folio-file="css\/site\.css">/);
  assert.match(html, /url\("data:font\/woff2;base64,Rk9OVA=="\)/);
  assert.match(html, /url\("data:image\/png;base64,Qkc="\)/);
  assert.match(html, /src="data:image\/png;base64,TE9HTw=="/);
  assert.match(html, /srcset="data:image\/png;base64,TE9HTw== 1x, data:image\/png;base64,TE9HTzI= 2x"/);
  assert.match(html, /url\(missing\.png\)/); // not in the ZIP: left alone
  assert.doesNotMatch(html, /src="js\/|href="css\//);
  // Scripts: normal ones stay in place, "defer" ones run last, and </script> inside code can't end the tag early.
  assert.ok(html.indexOf("__early") < html.indexOf("__app"));
  assert.ok(html.indexOf("__app") > html.indexOf("<h1>"));
  assert.match(html, /window\.__app = "<\\\/script><b>"/);
  // The sandbox: CSP first in <head>, data object, link handler.
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /<head>\s*<meta charset="utf-8">\s*<meta http-equiv="Content-Security-Policy" content="default-src 'none';/);
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /form-action 'none'/);
  assert.match(html, /window\.FOLIO=\{/);
  assert.match(html, /name="viewport"/);
  assert.match(html, /target.*_blank/);
  // The person's text is escaped everywhere, including inside the FOLIO data.
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /<h1>Ann &lt;\/script&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;<\/h1>/);
  assert.match(html, /\\u003c\/script\\u003e\\u003cscript\\u003ealert\(1\)/);
  assert.match(html, /<a href="https:\/\/github\.com\/ann">/);
});

test("uploads are checked for things that won't work in the sandbox", () => {
  const warnings = analyzeBundle(
    files({
      "index.html": `<html><body>
<a href="about.html">About</a><img src="http://example.com/x.png"><img src="missing.png">
<script src="https://evil.example/x.js"></script><link rel="stylesheet" href="https://cdn.example/x.css">
<form action="/x"></form><iframe src="https://a.b"></iframe></body></html>`,
      "js/app.js": `fetch("/x"); localStorage.setItem("a","b"); eval("1")`,
    }),
    "index.html",
  ).join("\n");
  assert.match(warnings, /doesn't use any \{\{placeholders\}\}/);
  assert.match(warnings, /link to “about\.html”/);
  assert.match(warnings, /http:\/\/example\.com\/x\.png/);
  assert.match(warnings, /not in the ZIP: missing\.png/);
  assert.match(warnings, /script from evil\.example is blocked/);
  assert.match(warnings, /stylesheet from cdn\.example is blocked/);
  assert.match(warnings, /Forms can't be submitted/);
  assert.match(warnings, /<iframe>/);
  assert.match(warnings, /Network requests/);
  assert.match(warnings, /localStorage/);
  assert.match(warnings, /eval\(\)/);
  // A clean template has no warnings.
  const clean = files({ "css/site.css": `@font-face { font-family: F; src: url("../fonts/f.woff2") } body { background: url(../img/bg.png) }` });
  assert.deepEqual(analyzeBundle(clean, "index.html"), []);
  // Mentions in comments aren't problems.
  const commented = files({
    "css/site.css": "body{}",
    "js/early.js": ["// no localStorage or fetch( here", "/* eval( */ window.__early = 1; var url = 'https://example.com'"].join("\n"),
  });
  assert.deepEqual(analyzeBundle(commented, "index.html"), []);
  assert.doesNotThrow(() => renderBundleHtml(clean, "index.html", buildRenderData(SAMPLE_CONTENT)));
});
