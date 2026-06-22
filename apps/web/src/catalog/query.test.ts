import { describe, expect, it } from "vitest";
import type { RamenProduct } from "@ramen/core-domain";
import {
  buildSearchIndex,
  filterProducts,
  manufacturerFacets,
  paginate,
  sortProducts,
  statusFacets,
} from "./query.js";

function p(over: Partial<RamenProduct>): RamenProduct {
  return {
    id: "x",
    name: "제품",
    packageType: "BAG",
    manufacturerId: "M",
    nutrition: null,
    sourceRefs: ["PRODUCT_REPORT"],
    updatedAt: "t",
    status: "ON_SALE",
    statusSource: "PRODUCT_REPORT",
    statusConfidence: "high",
    ...over,
  };
}

describe("paginate", () => {
  const items = Array.from({ length: 10 }, (_, i) => i);
  it("페이지 슬라이스·메타", () => {
    const pg = paginate(items, 1, 3);
    expect(pg.items).toEqual([0, 1, 2]);
    expect(pg.totalPages).toBe(4);
    expect(pg.total).toBe(10);
  });
  it("범위 밖 page는 클램프", () => {
    expect(paginate(items, 99, 3).items).toEqual([9]); // 마지막 페이지
    expect(paginate(items, 0, 3).page).toBe(1);
  });
  it("빈 목록 → totalPages 1, items []", () => {
    const pg = paginate([], 1, 3);
    expect(pg.items).toEqual([]);
    expect(pg.totalPages).toBe(1);
  });
});

describe("filterProducts", () => {
  const list = [
    p({ id: "1", name: "신라면", packageType: "BAG", status: "ON_SALE", manufacturerId: "NS" }),
    p({ id: "2", name: "신라면 컵", packageType: "CUP", status: "SALES_HALTED", manufacturerId: "NS" }),
    p({ id: "3", name: "진라면", packageType: "BAG", status: "ON_SALE", manufacturerId: "OT" }),
  ];
  it("텍스트(부분·대소문자 무시)", () => {
    expect(filterProducts(list, { text: "신라" }).map((x) => x.id)).toEqual(["1", "2"]);
  });
  it("포장·상태·제조사 필터", () => {
    expect(filterProducts(list, { packageType: "CUP" }).map((x) => x.id)).toEqual(["2"]);
    expect(filterProducts(list, { status: "ON_SALE" }).map((x) => x.id)).toEqual(["1", "3"]);
    expect(filterProducts(list, { manufacturerId: "OT" }).map((x) => x.id)).toEqual(["3"]);
  });
  it("복합 필터(AND)", () => {
    expect(filterProducts(list, { text: "라면", status: "ON_SALE", packageType: "BAG" }).map((x) => x.id)).toEqual([
      "1",
      "3",
    ]);
  });
});

describe("sortProducts", () => {
  const list = [
    p({ id: "b", name: "나가사끼", nutrition: { servingBasis: "100g", energyKcal: 400, carbG: 1, proteinG: 1, fatG: 1 } }),
    p({ id: "a", name: "가락국수", nutrition: { servingBasis: "100g", energyKcal: 500, carbG: 1, proteinG: 1, fatG: 1 } }),
    p({ id: "c", name: "다라면", nutrition: null }),
  ];
  it("이름순(코드유닛)", () => {
    expect(sortProducts(list, "name").map((x) => x.name)).toEqual(["가락국수", "나가사끼", "다라면"]);
  });
  it("칼로리 오름차순, 영양 없는 항목은 뒤로", () => {
    expect(sortProducts(list, "kcal", "asc").map((x) => x.id)).toEqual(["b", "a", "c"]);
  });
});

describe("패싯·검색 인덱스", () => {
  const list = [
    p({ id: "1", manufacturerId: "NS", status: "ON_SALE", name: "B", nutrition: { servingBasis: "x", energyKcal: 500, carbG: 1, proteinG: 1, fatG: 1 } }),
    p({ id: "2", manufacturerId: "NS", status: "SALES_HALTED", name: "A" }),
    p({ id: "3", manufacturerId: "OT", status: "ON_SALE", name: "C" }),
  ];
  it("manufacturerFacets 개수·정렬(빈도 desc)", () => {
    expect(manufacturerFacets(list)).toEqual([
      { value: "NS", count: 2 },
      { value: "OT", count: 1 },
    ]);
  });
  it("statusFacets 집계", () => {
    expect(statusFacets(list)).toEqual({ ON_SALE: 2, SALES_HALTED: 1, RECALLED: 0, "DISCONTINUED?": 0 });
  });
  it("buildSearchIndex: 이름순·경량 필드·kcal null", () => {
    const idx = buildSearchIndex(list);
    expect(idx.map((e) => e.name)).toEqual(["A", "B", "C"]); // 이름순
    expect(idx.find((e) => e.id === "1")).toEqual({ id: "1", name: "B", mid: "NS", pkg: "BAG", status: "ON_SALE", kcal: 500 });
    expect(idx.find((e) => e.id === "2")!.kcal).toBeNull();
  });
});
