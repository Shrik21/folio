import { describe, expect, it } from "vitest";

import { auditAiContent, structureResumeLocally } from "./ai-resume";
import { emptyPortfolioContent } from "./portfolio";

const resume = `
Jane Doe
jane@example.com
https://github.com/janedoe

Summary
Product designer focused on accessible systems.

Skills
Figma, Research, Prototyping
`;

describe("grounded résumé structuring", () => {
  it("extracts contact details without an AI key", () => {
    const result = structureResumeLocally(resume);
    expect(result.content.fullName).toBe("Jane Doe");
    expect(result.content.email).toBe("jane@example.com");
    expect(result.content.skills).toContain("Figma");
  });

  it("flags direct facts that do not occur in the source", () => {
    const result = auditAiContent(
      { ...emptyPortfolioContent, fullName: "Invented Person" },
      resume,
    );
    expect(result.reviewFields).toContain("fullName");
  });
});
