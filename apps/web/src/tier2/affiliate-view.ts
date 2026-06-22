// 제휴 뷰 빌더 — INV-10 강제. 제휴(쿠팡) 링크가 노출되는 뷰에는 공정위 기준 확정형
// 대가성 문구를 최상단에 둔다. 조건부·불확정 표현은 거부(throw).
// 비영속 마커(__tier2RuntimeOnly)를 동반해 영속 직렬화를 신호 차단(INV-4).

import { COUPANG_PARTNERS_DISCLOSURE, isConfirmedDisclosure } from "./disclosure.js";
import type { PriceQuote } from "./price-quote.js";

export interface AffiliateView {
  /** 영속 저장 금지 마커(INV-4) */
  readonly __tier2RuntimeOnly: true;
  /** 제휴 링크 노출 시 최상단 확정형 대가성 문구(INV-10). 제휴 링크 없으면 null. */
  disclosure: string | null;
  quotes: PriceQuote[];
}

/** 우리 쿠팡 파트너스 provider의 출처 라벨(providers/coupang-partners.ts의 source와 일치). */
const COUPANG_SOURCE = "쿠팡";

/**
 * 우리가 수수료를 받는 제휴 견적이 포함됐는가.
 * 권위 신호는 `affiliate === true`(각 provider가 설정). 더해 우리 쿠팡 provider의 source
 * 라벨도 fail-safe로 본다(플래그 누락 방어).
 *
 * **URL 도메인(link.coupang.com)으로는 판정하지 않는다.** 네이버쇼핑 등 가격비교 제공자가
 * 제3자 쿠팡 링크를 affiliate:false로 노출하는데(라이브에서 확인), 이를 우리 제휴로 오인해
 * 허위 대가성 문구를 붙이면 그 자체가 INV-10/표시광고 위반(없는 대가관계를 표시)이 된다.
 */
export function hasAffiliate(quotes: PriceQuote[]): boolean {
  return quotes.some((q) => q.affiliate === true || q.source === COUPANG_SOURCE);
}

/**
 * 제휴 뷰 구성. 제휴 링크가 하나라도 있으면 확정형 대가성 문구를 강제한다(INV-10).
 * 문구가 승인 allow-list에 없으면(조건부·불확정 포함) 위반으로 throw.
 */
export function buildAffiliateView(
  quotes: PriceQuote[],
  disclosureText: string = COUPANG_PARTNERS_DISCLOSURE,
): AffiliateView {
  if (!hasAffiliate(quotes)) {
    return { __tier2RuntimeOnly: true, disclosure: null, quotes };
  }
  if (!isConfirmedDisclosure(disclosureText)) {
    throw new Error(
      "INV-10 위반: 제휴 링크 노출 화면에는 승인된 확정형 대가성 문구가 필요합니다(조건부·불확정 표현 금지).",
    );
  }
  return { __tier2RuntimeOnly: true, disclosure: disclosureText, quotes };
}
