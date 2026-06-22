import { describe, expect, it } from "vitest";
import type { RamenProduct, RamenShop } from "@ramen/core-domain";
import { diffSnapshots } from "./diff.js";
import type { Snapshot } from "./build.js";

function prod(id: string, over: Partial<RamenProduct> = {}): RamenProduct {
  return {
    id,
    name: `제품${id}`,
    packageType: "BAG",
    manufacturerId: "MFR",
    nutrition: null,
    sourceRefs: ["PRODUCT_REPORT"],
    updatedAt: "2026-06-11",
    status: "ON_SALE",
    statusSource: "PRODUCT_REPORT",
    statusConfidence: "high",
    ...over,
  };
}

function shop(id: string, over: Partial<RamenShop> = {}): RamenShop {
  return {
    id,
    name: `가게${id}`,
    address: "주소",
    businessStatus: "ACTIVE",
    category: "일식",
    isModelRestaurant: false,
    source: "RESTAURANT",
    ...over,
  };
}

const prev: Snapshot = {
  version: "snapshot-2026-W24",
  products: [
    prod("U"),
    prod("C", { name: "옛이름" }),
    prod("H"),
    prod("D"),
    prod("R"),
  ],
  shops: [
    shop("SU"),
    shop("SC", { name: "옛가게" }),
    shop("SX"), // ACTIVE → CLOSED 예정
    shop("SR"), // 이탈 예정
    shop("SO", { businessStatus: "CLOSED" }), // 재개 예정
  ],
};

const curr: Snapshot = {
  version: "snapshot-2026-W25",
  products: [
    prod("U", { updatedAt: "2026-06-18" }),
    prod("C", { name: "새이름", updatedAt: "2026-06-18" }),
    prod("H", { status: "SALES_HALTED", statusSource: "RECALL", updatedAt: "2026-06-18" }),
    prod("D", {
      status: "DISCONTINUED?",
      statusSource: "MANUFACTURER_CLOSURE",
      statusConfidence: "medium",
      updatedAt: "2026-06-18",
    }),
    prod("A", { updatedAt: "2026-06-18" }),
  ],
  shops: [
    shop("SU"),
    shop("SC", { name: "새가게" }),
    shop("SX", { businessStatus: "CLOSED" }),
    shop("SO"), // CLOSED → ACTIVE
    shop("SA"),
  ],
};

const d = diffSnapshots(prev, curr);

describe("diffSnapshots — 제품 변경 분류 (M3 DoD #3)", () => {
  it("신규/이탈/판매중지/단종추정/변경 정확 분류", () => {
    expect(d.products.added).toEqual(["A"]);
    expect(d.products.removed).toEqual(["R"]);
    expect(d.products.nowHalted).toEqual(["H"]);
    expect(d.products.nowDiscontinued).toEqual(["D"]);
    expect(d.products.changed).toEqual(["C"]);
  });
  it("updatedAt만 다른 제품(U)은 변경 제외", () => {
    expect(d.products.changed).not.toContain("U");
  });
});

describe("diffSnapshots — 음식점 변경 분류 (M4 통합)", () => {
  it("신규/이탈/폐업전환/재개/변경 정확 분류", () => {
    expect(d.shops.added).toEqual(["SA"]);
    expect(d.shops.removed).toEqual(["SR"]);
    expect(d.shops.nowClosed).toEqual(["SX"]);
    expect(d.shops.reopened).toEqual(["SO"]);
    expect(d.shops.changed).toEqual(["SC"]);
  });
  it("변동 없는 음식점(SU)은 어디에도 없음", () => {
    expect(d.shops.changed).not.toContain("SU");
    expect(d.shops.added).not.toContain("SU");
  });
  it("counts 정합", () => {
    expect(d.shops.counts).toEqual({ added: 1, removed: 1, nowClosed: 1, reopened: 1, changed: 1 });
    expect(d.products.counts).toEqual({
      added: 1,
      removed: 1,
      nowHalted: 1,
      nowDiscontinued: 1,
      changed: 1,
    });
  });
});

describe("diffSnapshots — 메타·결정론", () => {
  it("버전·결정론(2회 동일)", () => {
    expect(d.prevVersion).toBe("snapshot-2026-W24");
    expect(d.currVersion).toBe("snapshot-2026-W25");
    expect(diffSnapshots(prev, curr)).toEqual(d);
  });
});
