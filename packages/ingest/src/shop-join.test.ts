import { describe, expect, it } from "vitest";
import { contentHash } from "@ramen/shared";
import { joinShops, type ShopJoinInputs } from "./shop-join.js";
import { normalizeModelRestaurant, normalizeRestaurant } from "./shop-normalize.js";
import type { CorrectionList } from "./correction-list.js";
import { RAW_MODEL_RESTAURANTS, RAW_RESTAURANTS } from "./__fixtures__/shops.js";

const CORRECTIONS: CorrectionList = {
  version: "test",
  include: ["MGT-0007"],
  exclude: ["MGT-0006"],
};

function buildInputs(): ShopJoinInputs {
  return {
    shops: RAW_RESTAURANTS.map((r) => normalizeRestaurant(r)),
    modelRestaurantIds: RAW_MODEL_RESTAURANTS.map(normalizeModelRestaurant),
    corrections: CORRECTIONS,
  };
}

const result = joinShops(buildInputs());
const get = (id: string) => result.shops.find((s) => s.id === id)!;

describe("joinShops — 음식점 필터 + 모범 플래그 조인", () => {
  it("라멘 음식점만, PK 정렬", () => {
    expect(result.shops.map((s) => s.id)).toEqual([
      "MGT-0001",
      "MGT-0002",
      "MGT-0005",
      "MGT-0007",
    ]);
  });

  it("결정론: 동일 입력 2회 → 동일 산출(해시 일치)", () => {
    const again = joinShops(buildInputs());
    expect(again.shops).toEqual(result.shops);
    expect(contentHash(again.shops)).toBe(contentHash(result.shops));
  });

  it("INV-9: 모든 레코드 source=RESTAURANT", () => {
    for (const s of result.shops) expect(s.source).toBe("RESTAURANT");
  });

  it("모범음식점 플래그(MGT-0001만 true)", () => {
    expect(get("MGT-0001").isModelRestaurant).toBe(true);
    expect(get("MGT-0002").isModelRestaurant).toBe(false);
    expect(result.report.modelRestaurants).toBe(1);
  });

  it("좌표 유무 정확(폐업 멘야하나는 좌표 없음)", () => {
    expect(get("MGT-0001").lat).toBeDefined();
    expect(get("MGT-0005").lat).toBeUndefined();
    expect(result.report.withCoords).toBe(3);
    expect(result.report.coordsMissing).toBe(1);
  });

  it("영업상태 집계", () => {
    expect(get("MGT-0005").businessStatus).toBe("CLOSED");
    expect(get("MGT-0001").businessStatus).toBe("ACTIVE");
    expect(result.report.active).toBe(3);
    expect(result.report.closed).toBe(1);
  });
});

describe("인허가관리번호 PK 안정성 (M4 DoD #2)", () => {
  it("사업장명만 바뀌어도 동일 PK·레코드 연속성", () => {
    const renamed = RAW_RESTAURANTS.map((r) =>
      r.MGTNO === "MGT-0001" ? { ...r, BPLCNM: "스미스라멘 본점(리뉴얼)" } : r,
    );
    const r2 = joinShops({
      ...buildInputs(),
      shops: renamed.map((r) => normalizeRestaurant(r)),
    });
    const orig = get("MGT-0001");
    const ren = r2.shops.find((s) => s.id === "MGT-0001")!;
    expect(ren.id).toBe(orig.id);
    expect(ren.name).toBe("스미스라멘 본점(리뉴얼)");
    expect(ren.isModelRestaurant).toBe(orig.isModelRestaurant);
    expect(ren.source).toBe(orig.source);
  });
});

describe("빈 PK 드롭", () => {
  it("빈/공백 인허가관리번호 음식점은 제외", () => {
    const shops = [
      normalizeRestaurant({ MGTNO: "", BPLCNM: "유령라멘", UPTAENM: "일식" }),
      normalizeRestaurant({ MGTNO: "MGT-0002", BPLCNM: "오라면집", UPTAENM: "분식" }),
    ];
    const r = joinShops({ shops, modelRestaurantIds: [], corrections: CORRECTIONS });
    expect(r.shops.map((s) => s.id)).toEqual(["MGT-0002"]);
  });
});
