import { describe, expect, it } from "vitest";
import type { CorrectionList } from "./correction-list.js";
import { RAMEN_CORRECTIONS_V1 } from "./correction-list.js";
import { classifyShop, shopFilterPrecisionReport, type LabeledShop } from "./shop-filter.js";
import { normalizeRestaurant } from "./shop-normalize.js";
import { EXPECTED_RAMEN_SHOP, RAW_RESTAURANTS } from "./__fixtures__/shops.js";

const NORMALIZED = RAW_RESTAURANTS.map((r) => normalizeRestaurant(r));
const byId = (id: string) => NORMALIZED.find((s) => s.id === id)!;

describe("classifyShop (ADR-0004 업태+키워드+보정)", () => {
  it("업태(일식/분식)+키워드(라멘/라면/멘야) → 포함", () => {
    expect(classifyShop(byId("MGT-0001"), RAMEN_CORRECTIONS_V1).reason).toBe("업태+키워드");
    expect(classifyShop(byId("MGT-0005"), RAMEN_CORRECTIONS_V1).reason).toBe("업태+키워드"); // 멘야
  });
  it("음성키워드(편의점) → 제외", () => {
    expect(classifyShop(byId("MGT-0008"), RAMEN_CORRECTIONS_V1).reason).toBe("음성키워드");
  });
  it("키워드 없으면 제외(스시조·하카타분코=FN 후보)", () => {
    expect(classifyShop(byId("MGT-0004"), RAMEN_CORRECTIONS_V1).reason).toBe("키워드불일치");
    expect(classifyShop(byId("MGT-0007"), RAMEN_CORRECTIONS_V1).reason).toBe("키워드불일치");
  });
  it("라면땅=FP(키워드 걸리나 라멘집 아님) → 기본필터로는 포함", () => {
    expect(classifyShop(byId("MGT-0006"), RAMEN_CORRECTIONS_V1).included).toBe(true);
  });
  it("보정 공백키도 정규화 매칭", () => {
    const c: CorrectionList = { version: "t", include: [" MGT-0007 "], exclude: ["MGT-0006"] };
    expect(classifyShop(byId("MGT-0007"), c).reason).toBe("보정-포함");
    expect(classifyShop(byId("MGT-0006"), c).reason).toBe("보정-제외");
  });
});

describe("shopFilterPrecisionReport (M4 DoD #6)", () => {
  const labeled: LabeledShop[] = NORMALIZED.map((shop) => ({
    shop,
    expectedRamen: EXPECTED_RAMEN_SHOP[shop.id]!,
  }));

  it("보정 없음: 오탐 1(라면땅)·누락 1(하카타분코), precision/recall 0.75", () => {
    const r = shopFilterPrecisionReport(labeled, RAMEN_CORRECTIONS_V1);
    expect(r.truePositive).toBe(3);
    expect(r.falsePositive).toBe(1);
    expect(r.falseNegative).toBe(1);
    expect(r.trueNegative).toBe(3);
    expect(r.precision).toBeCloseTo(0.75, 5);
    expect(r.recall).toBeCloseTo(0.75, 5);
    expect(r.falsePositiveIds).toEqual(["MGT-0006"]);
    expect(r.falseNegativeIds).toEqual(["MGT-0007"]);
  });

  it("보정 적용: 오탐·누락 0, precision/recall 1.0", () => {
    const c: CorrectionList = { version: "t", include: ["MGT-0007"], exclude: ["MGT-0006"] };
    const r = shopFilterPrecisionReport(labeled, c);
    expect(r.falsePositive).toBe(0);
    expect(r.falseNegative).toBe(0);
    expect(r.truePositive).toBe(4);
    expect(r.precision).toBe(1);
    expect(r.recall).toBe(1);
  });
});
