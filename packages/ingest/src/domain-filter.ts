// 라면 도메인 필터(ADR-0004) — ① 식품유형 면류 축소 → ② 제품명 키워드 → ③ 보정.
// 키워드는 불완전하므로 "다 잡혔다"고 단정하지 않고 보정 리스트로 관리한다(주의 §M1).

import { normalizeProductId } from "@ramen/core-domain";
import type { NormalizedProduct } from "./normalize.js";
import type { CorrectionList } from "./correction-list.js";

/** ① 면류 식품유형(유탕면·건면 중심). 라면은 식품유형이 아니라 제품명 개념이므로 면류로 범위만 좁힌다. */
export const NOODLE_FOOD_TYPES = new Set(["유탕면", "유탕면류", "건면", "면류", "생면", "숙면"]);

/** ② 라면 식별 키워드. "면" 단독은 과탐(우동·파스타) → 제외. */
export const RAMEN_KEYWORDS = ["라면", "라멘", "사발면", "컵라면"];

/** 음성 키워드 — 면류·키워드에 걸려도 라면이 아닌 것(과자·타 면류). */
export const NEGATIVE_KEYWORDS = ["냉면", "라면땅", "우동", "파스타", "스파게티", "당면", "쫄면", "스낵", "과자"];

export type FilterReason =
  | "보정-제외"
  | "보정-포함"
  | "코드+키워드"
  | "음성키워드"
  | "식품유형불일치"
  | "키워드불일치";

export interface FilterDecision {
  included: boolean;
  reason: FilterReason;
}

function compact(name: string): string {
  return name.replace(/\s/g, "");
}

/**
 * 단일 제품 분류. 우선순위: 보정 → 음성키워드 → 식품유형 → 키워드.
 * 보정 키는 제품 id와 동일하게 정규화(normalizeProductId)해 비교한다(공백/표기 변형 침묵실패 방지).
 */
export function classifyProduct(p: NormalizedProduct, c: CorrectionList): FilterDecision {
  if (c.exclude.some((e) => normalizeProductId(e) === p.id)) {
    return { included: false, reason: "보정-제외" };
  }
  if (c.include.some((i) => normalizeProductId(i) === p.id)) {
    return { included: true, reason: "보정-포함" };
  }

  const name = compact(p.name);
  if (NEGATIVE_KEYWORDS.some((k) => name.includes(k))) {
    return { included: false, reason: "음성키워드" };
  }
  if (!NOODLE_FOOD_TYPES.has(p.foodType)) {
    return { included: false, reason: "식품유형불일치" };
  }
  if (!RAMEN_KEYWORDS.some((k) => name.includes(k))) {
    return { included: false, reason: "키워드불일치" };
  }
  return { included: true, reason: "코드+키워드" };
}

/** 라면으로 분류된 제품만 반환(순서 보존). */
export function filterRamenProducts(
  products: NormalizedProduct[],
  c: CorrectionList,
): NormalizedProduct[] {
  return products.filter((p) => classifyProduct(p, c).included);
}

// ── 정밀도 리포트(M1 DoD #5) ──

export interface LabeledProduct {
  product: NormalizedProduct;
  /** 정답 라벨: 실제 라면인가 */
  expectedRamen: boolean;
}

export interface FilterReport {
  total: number;
  included: number;
  excluded: number;
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
  trueNegative: number;
  /** TP/(TP+FP). 분모 0이면 1로 본다(오탐 없음). */
  precision: number;
  /** TP/(TP+FN). 분모 0이면 1로 본다(누락 없음). */
  recall: number;
  /** 오탐 제품 ID(보정 exclude 후보) */
  falsePositiveIds: string[];
  /** 누락 제품 ID(보정 include 후보) */
  falseNegativeIds: string[];
}

/**
 * 분류 결과(id·got·정답)로부터 정밀도/재현율·오탐·누락을 산출하는 제네릭 헬퍼.
 * 제품·음식점 필터가 공유한다.
 */
export function precisionFrom(
  entries: Array<{ id: string; got: boolean; expectedRamen: boolean }>,
): FilterReport {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let tn = 0;
  const falsePositiveIds: string[] = [];
  const falseNegativeIds: string[] = [];

  for (const { id, got, expectedRamen } of entries) {
    if (got && expectedRamen) tp++;
    else if (got && !expectedRamen) {
      fp++;
      falsePositiveIds.push(id);
    } else if (!got && expectedRamen) {
      fn++;
      falseNegativeIds.push(id);
    } else tn++;
  }

  const precision = tp + fp === 0 ? 1 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 1 : tp / (tp + fn);
  return {
    total: entries.length,
    included: tp + fp,
    excluded: fn + tn,
    truePositive: tp,
    falsePositive: fp,
    falseNegative: fn,
    trueNegative: tn,
    precision,
    recall,
    falsePositiveIds,
    falseNegativeIds,
  };
}

/** 라벨셋에 대해 필터 정밀도/재현율과 오탐·누락 목록을 산출한다. */
export function filterPrecisionReport(items: LabeledProduct[], c: CorrectionList): FilterReport {
  return precisionFrom(
    items.map(({ product, expectedRamen }) => ({
      id: product.id,
      got: classifyProduct(product, c).included,
      expectedRamen,
    })),
  );
}
