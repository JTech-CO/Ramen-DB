// 제휴 대가성 문구(INV-10) — 쿠팡 파트너스 등 제휴 링크가 노출되는 모든 화면에
// 공정위 기준 대가성 문구를 명확·확정형으로 표기한다(ADR-0003). 조건부 표현 금지.

/** 공정위 「추천·보증 등에 관한 표시·광고 심사지침」 기준 확정형 문구. */
export const COUPANG_PARTNERS_DISCLOSURE =
  "이 게시물은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.";

/**
 * 승인된 확정형 대가성 문구 allow-list. 여기 등록된 문구만 노출 허용.
 * (deny-list는 조건부 표현 변형을 놓치므로 화이트리스트로 강제 — INV-10.)
 */
export const APPROVED_DISCLOSURES: readonly string[] = [COUPANG_PARTNERS_DISCLOSURE];

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * 승인된 확정형 문구와 일치하는가(allow-list, 공백 정규화 후 정확 일치).
 * 조건부·불확정 변형('받을 수도 있음','간혹','지도 모릅니다' 등)은 통과하지 못한다(INV-10).
 */
export function isConfirmedDisclosure(text: string): boolean {
  const n = normalize(text);
  return APPROVED_DISCLOSURES.some((d) => normalize(d) === n);
}
