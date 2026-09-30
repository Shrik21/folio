import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { AdminLoginBody } from "@workspace/api-zod";

describe("Admin API", () => {
  test("Validates dev credentials", () => {
    // A simplified test for dev credentials since we aren't spinning up the full Express server here
    const parsed = AdminLoginBody.safeParse({ username: "admin@folio.com", password: "Admin@123" });
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.username, "admin@folio.com");
      assert.equal(parsed.data.password, "Admin@123");
    }
  });

  test("Requires username and password", () => {
    const parsed = AdminLoginBody.safeParse({ username: "admin" });
    assert.equal(parsed.success, false);
  });
});
