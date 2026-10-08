import assert from "node:assert/strict";
import { test } from "node:test";
import { publicationError } from "../src/lib/portfolio-access";
import { TemplateDefinition, describeIssues } from "../src/lib/template-registry";
import { verifyDelegatedAdmin } from "../src/lib/delegated-admin";
import { mongoTemplateStore } from "@workspace/db";
import { invalidateTemplateCache, listAllTemplates, saveTemplateDefinition, setTemplateHidden, removeTemplateRecord, resolveTemplate, isSelectableTemplate } from "../src/lib/template-registry";

test("delegated admin verification accepts only recognized signed sessions and fails closed", async () => {
  const session = { role: "admin", expiresAt: Date.now() + 60_000 };
  let calls = 0;
  const accepted: typeof fetch = async (url, options) => {
    calls++;
    assert.equal(url, "https://login.example/api/admin/session");
    assert.equal(options?.redirect, "error");
    assert.equal(new Headers(options?.headers).get("cookie"), "signed-test-cookie");
    return Response.json({ authenticated: true });
  };
  assert.equal(await verifyDelegatedAdmin(session, "signed-test-cookie", "https://login.example", accepted), true);
  for (const value of [false, null, {}, { ...session, role: "user" }, { ...session, expiresAt: 0 }, { ...session, expiresAt: Infinity }])
    assert.equal(await verifyDelegatedAdmin(value, "signed-test-cookie", "https://login.example", accepted), false);
  assert.equal(calls, 1);
  assert.equal(await verifyDelegatedAdmin(session, "signed-test-cookie", "http://login.example", accepted), false);
  assert.equal(await verifyDelegatedAdmin(session, "signed-test-cookie", "https://login.example", async () => Response.json({ authenticated: false })), false);
  assert.equal(await verifyDelegatedAdmin(session, "signed-test-cookie", "https://login.example", async () => { throw new Error("Unavailable"); }), false);
});

const valid = {
  id: "sunset-pro",
  name: "Sunset Pro",
  description: "A warm split layout for marketers.",
  groups: ["non-technical"],
  category: "Marketing & Sales",
  premium: false,
  layout: "split",
  recommendedFor: ["Marketing Professional"],
  theme: { base: "light", bg: "#fff7ed", accent: "#ea580c", border: "rgba(0, 0, 0, 0.1)", headingFont: "playfair", radius: 12 },
};

test("a well-formed template file passes and gets defaults", () => {
  const parsed = TemplateDefinition.parse({ ...valid, premium: undefined, recommendedFor: undefined });
  assert.equal(parsed.premium, false);
  assert.deepEqual(parsed.recommendedFor, []);
  assert.equal(parsed.theme.headingFont, "playfair");
});

test("template files reject unknown layouts, fonts, colours, keys and bad ids", () => {
  const bad = [
    { ...valid, layout: "my-own-layout" },
    { ...valid, theme: { ...valid.theme, headingFont: "Comic Sans" } },
    { ...valid, theme: { ...valid.theme, accent: "red; background: url(https://evil.example)" } },
    { ...valid, theme: { ...valid.theme, bg: "url(x)" } },
    { ...valid, css: "body { display: none }" },
    { ...valid, id: "Sunset Pro" },
    { ...valid, groups: [] },
    { ...valid, category: "Astronauts" },
  ];
  for (const input of bad) assert.equal(TemplateDefinition.safeParse(input).success, false, JSON.stringify(input).slice(0, 80));
});

test("validation messages say which field is wrong", () => {
  const result = TemplateDefinition.safeParse({ ...valid, layout: "nope" });
  assert.equal(result.success, false);
  if (!result.success) assert.match(describeIssues(result.error)[0], /^layout: /);
});

test("hidden and Studio templates can't be published; uploaded free ones can", () => {
  assert.equal(publicationError("sunset-pro", { premium: false }), null);
  assert.equal(publicationError("sunset-pro", { premium: true })?.status, 402);
  assert.equal(publicationError("clean-professional", { premium: false, hidden: true })?.status, 400);
  assert.equal(publicationError("sunset-pro", undefined)?.status, 400);
});

test("template registry saves, restyles, hides, restores and deletes without touching portfolios", async () => {
  const oldProvider = process.env.DATABASE_PROVIDER;
  const original = { ...mongoTemplateStore };
  const records = new Map<string, { id: string; definition: unknown; hidden: boolean; createdAt: Date; updatedAt: Date }>();
  process.env.DATABASE_PROVIDER = "mongo";
  mongoTemplateStore.list = async () => [...records.values()];
  mongoTemplateStore.upsert = async (id, update) => {
    const next = { id, definition: null, hidden: false, createdAt: new Date(), ...records.get(id), ...update, updatedAt: new Date() };
    records.set(id, next);
    return next;
  };
  mongoTemplateStore.remove = async id => records.delete(id);
  invalidateTemplateCache();
  try {
    assert.equal((await listAllTemplates()).length, 24);
    const uploaded = TemplateDefinition.parse(valid);
    assert.equal((await saveTemplateDefinition(uploaded))?.source, "custom");
    assert.equal(await isSelectableTemplate(uploaded.id), true);
    assert.equal((await resolveTemplate(uploaded.id))?.theme?.bg, "#fff7ed");
    await setTemplateHidden(uploaded.id, true);
    assert.equal(await isSelectableTemplate(uploaded.id), false);
    assert.equal((await resolveTemplate(uploaded.id))?.theme?.bg, "#fff7ed");
    await setTemplateHidden(uploaded.id, false);
    assert.equal(await isSelectableTemplate(uploaded.id), true);
    const restyled = TemplateDefinition.parse({ ...valid, id: "clean-professional" });
    assert.equal((await saveTemplateDefinition(restyled))?.source, "modified");
    await removeTemplateRecord("clean-professional");
    assert.equal((await resolveTemplate("clean-professional"))?.source, "built-in");
    await removeTemplateRecord(uploaded.id);
    assert.equal(await isSelectableTemplate(uploaded.id), false);
    assert.equal(await resolveTemplate(uploaded.id), undefined);
  } finally {
    Object.assign(mongoTemplateStore, original);
    if (oldProvider === undefined) delete process.env.DATABASE_PROVIDER;
    else process.env.DATABASE_PROVIDER = oldProvider;
    invalidateTemplateCache();
  }
});
