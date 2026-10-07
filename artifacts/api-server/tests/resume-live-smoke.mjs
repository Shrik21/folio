// Read-only smoke test: sends a fictional PDF to the parser, never saves a portfolio.
// Usage: node artifacts/api-server/tests/resume-live-smoke.mjs https://api.example.com
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const base = process.argv[2];
if (!base || (base !== "--fixture" && !/^https?:\/\//.test(base))) throw new Error("Supply an API origin or --fixture.");
const lines = [
  "Alex Example", "Software Engineer", "alex@example.com",
  "Professional Summary", "Builds accessible applications.",
  "Work Experience", "Software Engineer at Example Labs | Jan 2022 - Present",
  "Built a keyboard-accessible editor and maintained deployment pipelines.",
  "Education", "BSc Computer Science, Example University, 2018 - 2022",
  "Technical Skills", "TypeScript, React, Docker",
  "Projects", "Portfolio Editor", "Created a content editor with React.",
];
const escape = value => value.replace(/[\\()]/g, "\\$&");
const stream = `BT /F1 11 Tf 40 790 Td 18 TL\n${lines.map(line => `(${escape(line)}) Tj T*`).join("\n")}\nET`;
const objects = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
];
let pdf = "%PDF-1.4\n";
const offsets = [0];
objects.forEach((object, index) => {
  offsets.push(Buffer.byteLength(pdf));
  pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
});
const xref = Buffer.byteLength(pdf);
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
pdf += offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
if (base === "--fixture") {
  const directory = await mkdtemp(join(tmpdir(), "folio-resume-test-"));
  const path = join(directory, "fictional-resume.pdf");
  await writeFile(path, pdf);
  console.log(path);
  process.exit(0);
}
const body = new FormData();
body.append("file", new Blob([Buffer.from(pdf)], { type: "application/pdf" }), "fictional-resume.pdf");
const response = await fetch(`${base.replace(/\/$/, "")}/api/resume/parse`, {
  method: "POST", body, headers: {
    Origin: "https://folio-seven-delta.vercel.app",
    ...(process.env.FOLIO_TEST_COOKIE ? { Cookie: process.env.FOLIO_TEST_COOKIE } : {}),
  }, signal: AbortSignal.timeout(120_000),
});
assert.equal(response.status, 200, `Parser returned ${response.status}`);
const result = await response.json();
assert.equal(result.extracted.personalInfo.name, "Alex Example");
assert.ok(result.extracted.experience.length >= 1, "Missing experience");
assert.ok(result.extracted.education.length >= 1, "Missing education");
assert.ok(result.extracted.projects.length >= 1, "Missing projects");
assert.ok(result.extracted.skills.includes("TypeScript"), "Missing skills");
assert.ok(!result.warnings.some(warning => /unavailable|basic import|local parser/i.test(warning)), "AI fell back to basic import");
console.log(JSON.stringify({ status: "passed", file: result.fileName,
  experience: result.extracted.experience.length, education: result.extracted.education.length,
  projects: result.extracted.projects.length, skills: result.extracted.skills.length,
  aiFallback: false }));
