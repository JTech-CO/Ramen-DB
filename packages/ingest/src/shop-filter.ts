// 라멘/라면 음식점 도메인 필터(ADR-0004) — ① 업태(일식·분식 등) → ② 상호 키워드 → ③ 보정.
// 라멘집=일식, 한국식 라면/분식=분식. 전용 업태 없음 → 키워드+보정으로 선별.

import { normalizeProductId } from "@ramen/core-domain";
import type { CorrectionList } from "./correction-list.js";
import { precisionFrom, type FilterReport } from "./domain-filter.js";
import type { NormalizedShop } from "./shop-normalize.js";

/** ① 후보 업태(일식·분식 중심 + 기타·한식·김밥 일부). 키워드가 추가로 선별. */
export const RAMEN_SHOP_CATEGORIES = new Set([
  "일식",
  "분식",
  "기타",
  "한식",
  "김밥(도시락)",
  "외국음식전문점(인도,태국등)",
]);

/** ② 상호 키워드. */
export const RAMEN_SHOP_KEYWORDS = ["라멘", "라면", "멘야", "麺"];

/**
 * ②' 상호에 라멘/라면이 없지만 라멘(류)인 유명 체인·노들 — 벌크 실데이터로 존재·과탐 검증한
 * 보수적 화이트리스트(ADR-0004 ③). 과탐 후보(토리·천하일품·우마이 등)는 제외. 데이터로 재검증 후 추가.
 */
export const RAMEN_SHOP_CHAINS = ["잇푸도", "무테키야", "탄탄면", "돈코츠"];

/** 음성 키워드 — 컵라면 제공처 등 라멘집 아닌 곳. */
export const SHOP_NEGATIVE_KEYWORDS = ["편의점", "휴게소", "마트", "주유소"];

export type ShopFilterReason =
  | "보정-제외"
  | "보정-포함"
  | "업태+키워드"
  | "음성키워드"
  | "업태불일치"
  | "키워드불일치";

export interface ShopFilterDecision {
  included: boolean;
  reason: ShopFilterReason;
}

function compact(name: string): string {
  return name.replace(/\s/g, "");
}

/** 단일 음식점 분류. 우선순위: 보정 → 음성키워드 → 업태 → 키워드. 보정 키는 정규화 비교. */
export function classifyShop(s: NormalizedShop, c: CorrectionList): ShopFilterDecision {
  if (c.exclude.some((e) => normalizeProductId(e) === s.id)) {
    return { included: false, reason: "보정-제외" };
  }
  if (c.include.some((i) => normalizeProductId(i) === s.id)) {
    return { included: true, reason: "보정-포함" };
  }
  const name = compact(s.name);
  if (SHOP_NEGATIVE_KEYWORDS.some((k) => name.includes(k))) {
    return { included: false, reason: "음성키워드" };
  }
  if (!RAMEN_SHOP_CATEGORIES.has(s.category)) {
    return { included: false, reason: "업태불일치" };
  }
  const hasKeyword =
    RAMEN_SHOP_KEYWORDS.some((k) => name.includes(k)) ||
    RAMEN_SHOP_CHAINS.some((k) => name.includes(k));
  if (!hasKeyword) {
    return { included: false, reason: "키워드불일치" };
  }
  return { included: true, reason: "업태+키워드" };
}

export function filterRamenShops(shops: NormalizedShop[], c: CorrectionList): NormalizedShop[] {
  return shops.filter((s) => classifyShop(s, c).included);
}

export interface LabeledShop {
  shop: NormalizedShop;
  expectedRamen: boolean;
}

/** 음식점 필터 정밀도/재현율·오탐·누락 리포트(M4 DoD #6). */
export function shopFilterPrecisionReport(items: LabeledShop[], c: CorrectionList): FilterReport {
  return precisionFrom(
    items.map(({ shop, expectedRamen }) => ({
      id: shop.id,
      got: classifyShop(shop, c).included,
      expectedRamen,
    })),
  );
}
