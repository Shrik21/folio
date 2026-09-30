import { describe, expect, it } from "vitest";

import { normalizePortfolioContent, safeExternalUrl, serializeJsonLd, slugify } from "./portfolio";

describe("portfolio utilities", () => {
  it("creates safe public slugs", () => {
    expect(slugify("  Jane Doe — Product Designer  ")).toBe("jane-doe-product-designer");
  });

  it("rejects non-http URLs", () => {
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(safeExternalUrl("example.com")).toBe("https://example.com/");
  });

  it("normalizes an empty database payload", () => {
    expect(normalizePortfolioContent({}).skills).toEqual([]);
  });

  it("cannot terminate a JSON-LD script", () => {
    expect(serializeJsonLd({ name: "</script><script>alert(1)</script>" })).not.toContain(
      "</script>",
    );
  });
});
