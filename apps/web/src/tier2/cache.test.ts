import { describe, expect, it } from "vitest";
import { TtlCache } from "./cache.js";

describe("TtlCache — 비영속 TTL (INV-4)", () => {
  it("TTL 내 히트, 경과 시 만료·즉시 폐기", () => {
    let now = 1000;
    const c = new TtlCache<string>(500, () => now);
    c.set("k", "v"); // expires at 1500
    expect(c.get("k")).toBe("v");
    now = 1499;
    expect(c.get("k")).toBe("v");
    now = 1500;
    expect(c.get("k")).toBeUndefined(); // 만료
    expect(c.size).toBe(0); // get이 만료분 폐기
  });

  it("prune로 만료 항목 일괄 정리", () => {
    let now = 0;
    const c = new TtlCache<number>(100, () => now);
    c.set("a", 1); // expires 100
    now = 50;
    c.set("b", 2); // expires 150
    now = 120;
    c.prune();
    expect(c.size).toBe(1);
    expect(c.get("b")).toBe(2);
  });

  it("clear", () => {
    const c = new TtlCache<number>(100, () => 0);
    c.set("x", 1);
    c.clear();
    expect(c.size).toBe(0);
  });
});
