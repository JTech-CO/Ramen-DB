import { describe, expect, it } from "vitest";
import { classifyProduct, filterPrecisionReport, type LabeledProduct } from "./domain-filter.js";
import { normalizeProductReport } from "./normalize.js";
import type { CorrectionList } from "./correction-list.js";
import { RAMEN_CORRECTIONS_V1 } from "./correction-list.js";
import { EXPECTED_RAMEN, RAW_PRODUCTS } from "./__fixtures__/sample.js";

const NORMALIZED = RAW_PRODUCTS.map(normalizeProductReport);
const byId = (id: string) => NORMALIZED.find((p) => p.id === id)!;

describe("classifyProduct (ADR-0004 ①②③)", () => {
  it("면류+키워드 → 포함", () => {
    expect(classifyProduct(byId("20210001"), RAMEN_CORRECTIONS_V1)).toEqual({
      included: true,
      reason: "코드+키워드",
    });
  });
  it("음성키워드(우동/라면땅/스파게티) → 제외", () => {
    expect(classifyProduct(byId("20210004"), RAMEN_CORRECTIONS_V1).reason).toBe("음성키워드");
    expect(classifyProduct(byId("20210005"), RAMEN_CORRECTIONS_V1).reason).toBe("음성키워드");
    expect(classifyProduct(byId("20210007"), RAMEN_CORRECTIONS_V1).reason).toBe("음성키워드");
  });
  it("키워드 없으면 제외(안성탕면=FN 후보)", () => {
    expect(classifyProduct(byId("20210008"), RAMEN_CORRECTIONS_V1).reason).toBe("키워드불일치");
  });
  it("라면스프=FP(키워드 걸리나 라면 아님) → 기본필터로는 포함됨", () => {
    expect(classifyProduct(byId("20210009"), RAMEN_CORRECTIONS_V1).included).toBe(true);
  });
  it("보정 include/exclude가 최우선", () => {
    const c: CorrectionList = { version: "t", include: ["20210008"], exclude: ["20210009"] };
    expect(classifyProduct(byId("20210008"), c)).toEqual({ included: true, reason: "보정-포함" });
    expect(classifyProduct(byId("20210009"), c)).toEqual({ included: false, reason: "보정-제외" });
  });

  it("보정 키 공백/표기 변형도 정규화되어 매칭(침묵 실패 방지)", () => {
    const c: CorrectionList = { version: "t", include: [" 20210008 "], exclude: ["  20210009"] };
    expect(classifyProduct(byId("20210008"), c).reason).toBe("보정-포함");
    expect(classifyProduct(byId("20210009"), c).reason).toBe("보정-제외");
  });
});

describe("filterPrecisionReport (M1 DoD #5 오탐·누락 리포트)", () => {
  const labeled: LabeledProduct[] = NORMALIZED.map((product) => ({
    product,
    expectedRamen: EXPECTED_RAMEN[product.id]!,
  }));

  it("보정 없음: 오탐 1(라면스프)·누락 1(안성탕면), precision/recall 0.8", () => {
    const r = filterPrecisionReport(labeled, RAMEN_CORRECTIONS_V1);
    expect(r.truePositive).toBe(4);
    expect(r.falsePositive).toBe(1);
    expect(r.falseNegative).toBe(1);
    expect(r.trueNegative).toBe(3);
    expect(r.precision).toBeCloseTo(0.8, 5);
    expect(r.recall).toBeCloseTo(0.8, 5);
    expect(r.falsePositiveIds).toEqual(["20210009"]);
    expect(r.falseNegativeIds).toEqual(["20210008"]);
  });

  it("보정 적용: 오탐·누락 0, precision/recall 1.0", () => {
    const c: CorrectionList = {
      version: "t",
      include: ["20210008"],
      exclude: ["20210009"],
    };
    const r = filterPrecisionReport(labeled, c);
    expect(r.falsePositive).toBe(0);
    expect(r.falseNegative).toBe(0);
    expect(r.truePositive).toBe(5);
    expect(r.precision).toBe(1);
    expect(r.recall).toBe(1);
  });
});
