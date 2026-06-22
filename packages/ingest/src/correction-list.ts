// 라면 도메인 보정 리스트(ADR-0004 ③) — 버전 관리. 코드+키워드 필터의 불완전성을
// 흡수한다. 오탐(false positive) 제외 / 누락(false negative) 추가를 품목제조보고번호로
// 명시한다. 신규 케이스는 픽스처로 축적(M1 DoD 오탐·누락 리포트와 연동).

export interface CorrectionList {
  version: string;
  /** 강제 포함 — 코드/키워드로 누락되나 실제 라면인 제품(품목제조보고번호) */
  include: string[];
  /** 강제 제외 — 코드/키워드로 잡히나 라면이 아닌 제품(품목제조보고번호) */
  exclude: string[];
}

/**
 * 시드 v1. 실데이터 보정 케이스가 쌓이면 버전을 올린다.
 * 예시 사유:
 * - include: "팔도 비빔면"류(라면이나 제품명에 '라면' 키워드 없음)
 * - exclude: "라면땅" 과자(유탕면으로 잘못 분류된 스낵)
 */
export const RAMEN_CORRECTIONS_V1: CorrectionList = {
  version: "ramen-corrections-2026-06-18",
  include: [],
  exclude: [],
};
