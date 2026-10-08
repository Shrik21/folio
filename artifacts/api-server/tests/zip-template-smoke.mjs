// Real Express routes, isolated in-memory persistence: never touches Atlas or portfolios.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
process.env.NODE_ENV = 'development';
process.env.DATABASE_PROVIDER = 'mongo';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/unused';
process.env.APP_URL = 'http://localhost:3052';
process.env.SESSION_SECRET = 'fictional-local-test-secret-not-for-production';
delete process.env.ADMIN_AUTH_URL;
delete process.env.ADMIN_PASSWORD;
delete process.env.ADMIN_USERNAME;
const { mongoTemplateStore, mongoStore } = await import('@workspace/db');
const records = new Map();
const bundles = new Map();
Object.assign(mongoTemplateStore, {
  list: async () => [...records.values()],
  upsert: async (id, update) => {
    const value = { id, definition: null, hidden: false, createdAt: new Date(), ...records.get(id), ...update, updatedAt: new Date() };
    records.set(id, value); return value;
  },
  remove: async id => records.delete(id),
  getBundle: async id => bundles.get(id) ?? null,
  putBundle: async (id, version, data, bytes) => { bundles.set(id, { id, version, data, bytes, updatedAt: new Date() }); },
  removeBundle: async id => { bundles.delete(id); },
  usage: async () => [],
});
const { SAMPLE_CONTENT } = await import('../src/lib/template-render.ts');
for (const section of ['experience', 'education', 'projects']) SAMPLE_CONTENT[section].forEach((item, index) => { item.id = `fictional-${section}-${index}`; });
const samplePortfolio = { id: 101, ownerId: 'fictional-test-user', slug: 'zip-smoke', profession: 'Product Engineer', purpose: 'Find a role', templateId: 'aurora-dev', content: SAMPLE_CONTENT, status: 'published', views: 0, createdAt: new Date(), updatedAt: new Date(), publishedAt: new Date() };
Object.assign(mongoStore, {
  findPublishedBySlug: async slug => slug === 'zip-smoke' ? samplePortfolio : null,
  incrementViews: async slug => slug === 'zip-smoke' ? samplePortfolio : null,
  listPublished: async () => [samplePortfolio],
});
const { default: app } = await import('../src/app.ts');
const server = app.listen(3051, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const origin = process.env.APP_URL;
const base = 'http://127.0.0.1:3051/api';
const zip = readFileSync(new URL('./fixtures/folio-template-sample.zip', import.meta.url));
const multipart = () => { const form = new FormData(); form.append('file', new Blob([zip], { type: 'application/zip' }), 'sample.zip'); return form; };
try {
  assert.equal((await fetch(base + '/admin/templates/validate', { method: 'POST', headers: { Origin: origin }, body: multipart() })).status, 401);
  const login = await fetch(base + '/admin/login', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin@folio.com', password: 'Admin@123' }) });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const headers = { Origin: origin, Cookie: cookie };
  assert.equal((await fetch(base + '/admin/templates/validate', { method: 'POST', headers: { ...headers, Origin: 'https://wrong.invalid' }, body: multipart() })).status, 403);
  const checked = await fetch(base + '/admin/templates/validate', { method: 'POST', headers, body: multipart() });
  assert.equal(checked.status, 200);
  const check = await checked.json();
  assert.equal(check.definition.category, 'Software Engineering');
  assert.deepEqual(check.warnings, []);
  assert.ok(check.previewHtml.includes('Northwind'));
  assert.equal(records.size, 0, 'validation must not save');
  assert.equal((await fetch(base + '/admin/templates/wrong-id', { method: 'PUT', headers, body: multipart() })).status, 400);
  const save = await fetch(base + '/admin/templates/aurora-dev', { method: 'PUT', headers, body: multipart() });
  assert.equal(save.status, 200);
  const saved = await save.json();
  assert.equal(saved.template.kind, 'bundle');
  const download = await fetch(base + '/admin/templates/aurora-dev/bundle', { headers });
  assert.equal(download.status, 200);
  assert.equal(createHash('sha256').update(Buffer.from(await download.arrayBuffer())).digest('hex'), createHash('sha256').update(zip).digest('hex'));
  const rendered = await fetch(base + '/templates/aurora-dev/render', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: SAMPLE_CONTENT }) });
  assert.equal(rendered.status, 200);
  assert.equal(rendered.headers.get('cache-control'), 'no-store');
  assert.ok((await rendered.json()).html.includes('Ledgerline'));
  assert.equal((await fetch(base + '/public/portfolios/zip-smoke')).status, 200);
  for (const hidden of [true, false]) {
    assert.equal((await fetch(base + '/admin/templates/aurora-dev/visibility', { method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ hidden }) })).status, 200);
    const gallery = await (await fetch(base + '/templates')).json();
    assert.equal(gallery.find(item => item.id === 'aurora-dev')?.hidden, hidden);
  }
  if (!process.argv.includes('--serve')) {
    assert.equal((await fetch(base + '/admin/templates/aurora-dev', { method: 'DELETE', headers })).status, 200);
    assert.equal(bundles.size, 0);
    assert.equal((await fetch(base + '/templates/aurora-dev/render', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 404);
  }
  console.log('ZIP SMOKE PASS: authentication, CSRF, validate-without-save, category, save, exact download, rendering, public portfolio, hide/show and delete. In-memory only.');
} catch (error) { server.close(); throw error; }
if (process.argv.includes('--serve')) console.log('Local fixture API listening on 127.0.0.1:3051');
else await new Promise(resolve => server.close(resolve));
