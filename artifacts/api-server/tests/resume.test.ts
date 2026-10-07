import { test } from "node:test";
import assert from "node:assert/strict";
import { structureLocally, structureWithGemini } from "../src/lib/resume-parser.ts";

const resume = `Alex Example
Software Engineer
alex@example.com
Summary
Builds accessible applications.
Work Experience
Software Engineer at Example Labs | Jan 2022 - Present
• Built an accessible editor.
• Maintained deployment pipelines.
Education
Example University | 2018 - 2022
BSc Computer Science
Technical Skills
Languages: TypeScript, JavaScript
Tools: React, Docker
Projects
Portfolio editor | 2023
• Implemented keyboard navigation.
Certifications
Cloud Fundamentals`;

test("fallback preserves recognizable resume sections, not just contacts", () => {
  const { content, warnings } = structureLocally(resume);
  assert.equal(content.personalInfo.name, "Alex Example");
  assert.equal(content.personalInfo.headline, "Software Engineer");
  assert.equal(content.personalInfo.summary, "Builds accessible applications.");
  assert.match(content.experience[0].description, /deployment pipelines/);
  assert.equal(content.experience[0].period, "Jan 2022 - Present");
  assert.match(content.education[0].school, /BSc Computer Science/);
  assert.deepEqual(content.skills, ["TypeScript", "JavaScript", "React", "Docker"]);
  assert.match(content.projects[0].description, /keyboard navigation/);
  assert.ok(!content.projects[0].description.includes("Cloud Fundamentals"));
  assert.match(warnings[0], /incomplete/);
});

test("fallback does not invent absent sections", () => {
  const { content } = structureLocally("Alex Example\nalex@example.com");
  assert.deepEqual(content.experience, []);
  assert.deepEqual(content.education, []);
  assert.deepEqual(content.skills, []);
  assert.deepEqual(content.projects, []);
});

test("Gemini import accepts omitted generated IDs and fenced JSON", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GEMINI_API_KEY;
  const originalModel = process.env.AI_MODEL;
  process.env.GEMINI_API_KEY = "test-only-not-a-real-key";
  delete process.env.AI_MODEL;
  try {
    let attempts = 0;
    globalThis.fetch = async (_url, init) => {
      const request = JSON.parse(init?.body as string);
      assert.equal(request.model, "gemini-3.1-flash-lite");
      // The first transient provider error should not trigger a basic import.
      if (++attempts === 1) return new Response("unavailable", { status: 503 });
      return new Response(JSON.stringify({ choices: [{ message: { content: "```json\n" + JSON.stringify({
        personalInfo: { name: "Alex Example" },
        experience: [{ role: "Software Engineer", company: "Example Labs" }],
        education: [{ school: "Example University", degree: "BSc Computer Science" }],
        projects: [{ name: "Portfolio editor" }],
        skills: ["React"],
      }) + "\n```" } }] }), { status: 200 });
    };
    const { content } = await structureWithGemini(resume);
    assert.equal(attempts, 2);
    assert.match(content.experience[0].id, /^exp-/);
    assert.match(content.education[0].id, /^edu-/);
    assert.match(content.projects[0].id, /^proj-/);
    assert.deepEqual(content.skills, ["React"]);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.AI_MODEL;
    else process.env.AI_MODEL = originalModel;
  }
});
