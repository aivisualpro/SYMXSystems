import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

describe("Delivery Excellence site index migration", () => {
  const source = readFileSync("scripts/migrate/20-delivery-excellence-site-index.mjs", "utf8");
  it("preflights incomplete identities and duplicates before index writes", () => {
    expect(source).toContain("incomplete identities");
    expect(source).toContain("duplicate groups");
    expect(source.indexOf("if (before.incomplete || before.duplicates.length)")).toBeLessThan(source.indexOf("createIndex"));
  });
  it("verifies site uniqueness before removing the legacy index and modifies no documents", () => {
    expect(source).toContain('const canonicalKey = { siteId: 1, week: 1, transporterId: 1 }');
    expect(source).toContain('const legacyKey = { week: 1, transporterId: 1 }');
    expect(source.indexOf("if (!verified)")).toBeLessThan(source.indexOf("dropIndex"));
    expect(source).not.toMatch(/updateOne|updateMany|deleteOne|deleteMany|replaceOne|bulkWrite/);
  });
});
