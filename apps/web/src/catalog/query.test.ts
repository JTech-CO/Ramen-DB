import { describe, expect, it } from "vitest";
import type { RamenProduct, RamenShop } from "@ramen/core-domain";
import {
  buildSearchIndex,
  buildShopIndex,
  dedupeProducts,
  filterProducts,
  manufacturerFacets,
  paginate,
  shopRegion,
  shopRegion2,
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
    expect(idx.find((e) => e.id === "1")).toEqual({ id: "1", name: "B", mid: "NS", mfr: "", pkg: "BAG", status: "ON_SALE", kcal: 500 });
    expect(idx.find((e) => e.id === "2")!.kcal).toBeNull();
  });
});

describe("dedupeProducts — 동일 (제품명+제조사명) 대표 1건", () => {
  it("같은 브랜드(제조사명 동일)·다른 LCNS는 1건으로 합친다", () => {
    // 신라면 사례: (주)농심이 공장별 LCNS 3개로 3건 → 1건.
    const list = [
      p({ id: "200105495411", name: "신라면", manufacturerId: "20010549541", manufacturerName: "(주)농심" }),
      p({ id: "197201540011", name: "신라면", manufacturerId: "19720154001", manufacturerName: "(주)농심" }),
      p({ id: "1986036000721", name: "신라면", manufacturerId: "19860360007", manufacturerName: "(주)농심" }),
    ];
    const out = dedupeProducts(list);
    expect(out).toHaveLength(1);
    expect(out[0]!.id).toBe("197201540011"); // PK 코드유닛 최소(결정론 tiebreak)
  });

  it("제조사명이 다른 동명 제품은 보존한다", () => {
    // 생라멘 사례: 서로 다른 업체 → 서로 다른 제품.
    const list = [
      p({ id: "a", name: "생라멘", manufacturerName: "한일식품(주)" }),
      p({ id: "b", name: "생라멘", manufacturerName: "(주)오에프지" }),
      p({ id: "c", name: "생라멘", manufacturerName: "성신푸드" }),
    ];
    expect(dedupeProducts(list)).toHaveLength(3);
  });

  it("공백·대소문자 무시, 입력 순서와 무관(결정론)", () => {
    const a = p({ id: "1", name: "신 라면", manufacturerName: "농심" });
    const b = p({ id: "2", name: "신라면", manufacturerName: "농 심" });
    expect(dedupeProducts([a, b])).toHaveLength(1);
    expect(dedupeProducts([b, a])[0]!.id).toBe(dedupeProducts([a, b])[0]!.id);
  });

  it("대표는 안전상태(회수/판매중지)·정보풍부도 우선", () => {
    const onSale = p({ id: "1", name: "X", manufacturerName: "M", status: "ON_SALE" });
    const recalled = p({ id: "2", name: "X", manufacturerName: "M", status: "RECALLED" });
    expect(dedupeProducts([onSale, recalled])[0]!.id).toBe("2"); // 회수가 대표
  });
});

describe("shopRegion + buildShopIndex (음식점 지역)", () => {
  it("주소 → 시/도(대분류)", () => {
    expect(shopRegion("서울특별시 종로구 ...")).toBe("서울");
    expect(shopRegion("경기도 성남시 ...")).toBe("경기");
    expect(shopRegion("충청남도 당진시 ...")).toBe("충남");
    expect(shopRegion("제주특별자치도 서귀포시 ...")).toBe("제주");
    expect(shopRegion("강원특별자치도 춘천시 ...")).toBe("강원");
    expect(shopRegion("우주 ...")).toBe("기타");
  });
  it("주소 → 시/군/구(중분류)", () => {
    expect(shopRegion2("서울특별시 강남구 테헤란로 1")).toBe("강남구");
    expect(shopRegion2("경기도 수원시 영통구 매영로 1")).toBe("수원시 영통구"); // 시+구
    expect(shopRegion2("경기도 가평군 ...")).toBe("가평군");
    expect(shopRegion2("강원특별자치도 춘천시 중앙로")).toBe("춘천시");
    expect(shopRegion2("세종특별자치시 한솔동")).toBe(""); // 시군구 없음
  });
  it("buildShopIndex: 경량 필드 + 지역(대/중) + 좌표 보존", () => {
    const shops: RamenShop[] = [
      { id: "b", name: "나라멘", address: "부산광역시 해운대구 ...", businessStatus: "ACTIVE", category: "일식", lat: 35.1, lng: 129.1, source: "RESTAURANT" },
      { id: "a", name: "가라멘", address: "서울특별시 강남구 ...", businessStatus: "CLOSED", category: "분식", source: "RESTAURANT" },
    ];
    const idx = buildShopIndex(shops);
    expect(idx.map((e) => e.name)).toEqual(["가라멘", "나라멘"]); // 이름순
    expect(idx.find((e) => e.id === "b")).toEqual({
      id: "b", name: "나라멘", cat: "일식", region: "부산", region2: "해운대구", addr: "부산광역시 해운대구 ...", status: "ACTIVE", lat: 35.1, lng: 129.1,
    });
    expect(idx.find((e) => e.id === "a")!.lat).toBeUndefined(); // 좌표 없으면 생략
  });
});
