// 도메인 불변식 단언 — 순수 함수. INV-5(PK)·INV-6(status) 보장.

import type { Confidence, ProductStatus, RamenProduct, StatusInfo } from "./types.js";

/** 품목제조보고번호 형태 검증(INV-5: 빈 값/공백 불가). 표기 차이 흡수를 위해 trim. */
export function normalizeProductId(raw: string): string {
  return raw.trim();
}

export function isValidProductId(raw: string | undefined | null): raw is string {
  return typeof raw === "string" && raw.trim().length > 0;
}

/** 모든 status는 source·confidence를 동반해야 한다(INV-6). 위반 시 throw. */
export function assertStatusInfo(info: Partial<StatusInfo>): asserts info is StatusInfo {
  if (!info.status) {
    throw new Error("INV-6 위반: status 누락");
  }
  if (!info.statusSource || info.statusSource.trim().length === 0) {
    throw new Error(`INV-6 위반: status='${info.status}'에 statusSource 누락`);
  }
  if (!info.statusConfidence) {
    throw new Error(`INV-6 위반: status='${info.status}'에 confidence 누락`);
  }
}

/** confidence<high 인가 — UI 단정형 표기 차단 판단(INV-6). */
export function isEstimated(confidence: Confidence): boolean {
  return confidence !== "high";
}

const STATUS_LABEL_CONFIRMED: Record<ProductStatus, string> = {
  ON_SALE: "판매중",
  SALES_HALTED: "판매중지",
  RECALLED: "회수",
  "DISCONTINUED?": "단종",
};

/**
 * status 표시 라벨. confidence<high면 '추정'을 붙여 단정형 표기를 차단한다(INV-6).
 * 예: status=DISCONTINUED?, confidence=low → "단종 추정".
 */
export function statusDisplayLabel(status: ProductStatus, confidence: Confidence): string {
  const base = STATUS_LABEL_CONFIRMED[status];
  return isEstimated(confidence) ? `${base} 추정` : base;
}

/** 레코드가 INV-6를 충족하는지(필수필드 존재) 점검. 스냅샷 게이트용. */
export function hasValidStatus(p: Pick<RamenProduct, "status" | "statusSource" | "statusConfidence">): boolean {
  return Boolean(p.status) && Boolean(p.statusSource) && Boolean(p.statusConfidence);
}
