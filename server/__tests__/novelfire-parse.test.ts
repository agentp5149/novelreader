import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseSearch } from "../source/novelfire";

const fx = (name: string) =>
  readFileSync(join(__dirname, "fixtures", name), "utf8");

describe("parseSearch", () => {
  it("extracts novels from search HTML", () => {
    const results = parseSearch(fx("search.html"));
    expect(results.length).toBeGreaterThan(0);
    const first = results[0];
    expect(first.slug).toBe("shadow-slave");
    expect(first.title).toBe("Shadow Slave");
    expect(first.coverUrl).toBe("https://novelfire.net/server-1/shadow-slave.jpg");
  });
});
