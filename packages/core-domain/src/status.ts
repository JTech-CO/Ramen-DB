// 단종 status 도출(M2) — docs/TECHNICAL §2 규칙. 순수·결정론.
// 우선순위: ① 회수·판매중지(high) → ② 제조사 폐업(medium) → ③ 스냅샷 부재(low) → ④ ON_SALE(high).
// 모든 산출에 status·source·confidence를 부착한다(INV-6).

import type {
  BusinessStatus,
  ProductDraft,
  RamenProduct,
  RecallEvent,
  SourceRef,
  StatusInfo,
} from "./types.js";
import { normalizeProductId } from "./invariants.js";

/** status 근거 데이터셋/규칙 식별자(statusSource). */
export const STATUS_SOURCE = {
  RECALL: "RECALL" as SourceRef,
  MANUFACTURER_CLOSURE: "MANUFACTURER_CLOSURE" as SourceRef,
  SNAPSHOT_ABSENCE: "SNAPSHOT_ABSENCE" as SourceRef,
  PRODUCT_REPORT: "PRODUCT_REPORT" as SourceRef,
} as const;

/** 직전 스냅샷 부재가 DISCONTINUED?(low)로 굳는 연속 부재 임계(기본). */
export const DEFAULT_ABSENCE_THRESHOLD = 2;

/** 도출 입력 신호. 제품 존재·회수·제조사상태·스냅샷 부재 이력. */
export interface StatusSignals {
  recallEvents: RecallEvent[];
  manufacturerStatus: BusinessStatus;
  /** 현재 품목제조보고 로스터에 존재하는가. false면 부재 판정 대상 */
  presentInCurrentRoster: boolean;
  /** 직전 N개 스냅샷 연속 부재 횟수(현재 포함 X) */
  consecutiveAbsence: number;
  absenceThreshold?: number;
}

/**
 * 우선순위 규칙으로 status·source·confidence를 도출한다(§2).
 * 회수가 최우선이므로 제조사 폐업·부재보다 먼저 평가한다.
 */
export function deriveStatus(signals: StatusSignals): StatusInfo {
  // ① 회수·판매중지 피드 매칭 → high
  if (signals.recallEvents.length > 0) {
    const recalled = signals.recallEvents.some((r) => r.kind === "RECALL");
    return {
      status: recalled ? "RECALLED" : "SALES_HALTED",
      statusSource: STATUS_SOURCE.RECALL,
      statusConfidence: "high",
    };
  }
  // ② 제조사 폐업 → DISCONTINUED? medium
  if (signals.manufacturerStatus === "CLOSED") {
    return {
      status: "DISCONTINUED?",
      statusSource: STATUS_SOURCE.MANUFACTURER_CLOSURE,
      statusConfidence: "medium",
    };
  }
  // ③ 스냅샷 시계열 연속 부재 → DISCONTINUED? low
  const threshold = signals.absenceThreshold ?? DEFAULT_ABSENCE_THRESHOLD;
  if (!signals.presentInCurrentRoster && signals.consecutiveAbsence >= threshold) {
    return {
      status: "DISCONTINUED?",
      statusSource: STATUS_SOURCE.SNAPSHOT_ABSENCE,
      statusConfidence: "low",
    };
  }
  // ④ 그 외 → 판매중(로스터 존재가 권위 신호) high
  return {
    status: "ON_SALE",
    statusSource: STATUS_SOURCE.PRODUCT_REPORT,
    statusConfidence: "high",
  };
}

/**
 * 현재 로스터 제품(ProductDraft)의 status 도출. 존재=true, 부재=0.
 *
 * 주의(미배선): 규칙 ③(스냅샷 연속 부재 → DISCONTINUED? low)은 현재 로스터에 존재하는
 * 제품에는 발화하지 않는다. 로스터에서 사라진 제품을 부재 이력과 함께 `deriveStatus`에
 * present=false로 투입하려면 **다주차 스냅샷 시계열(부재 카운터)** 이 필요하다. 이 배선은
 * 향후 증분(직전 스냅샷 PK 집합·부재 누적)에서 build 파이프라인에 연결한다. 그전까지
 * 로스터 이탈은 스냅샷 diff의 `removed`로만 관측된다(파이프라인이 DISCONTINUED? low 레코드를
 * 산출하지는 않음).
 */
export function deriveProductStatus(draft: ProductDraft): StatusInfo {
  return deriveStatus({
    recallEvents: draft.recallEvents,
    manufacturerStatus: draft.manufacturerStatus,
    presentInCurrentRoster: true,
    consecutiveAbsence: 0,
  });
}

/** ProductDraft + 도출 status → 완성 RamenProduct(도출 입력 신호 제거). */
export function finalizeProduct(draft: ProductDraft, status: StatusInfo): RamenProduct {
  const product: RamenProduct = {
    id: draft.id,
    name: draft.name,
    ...(draft.barcode ? { barcode: draft.barcode } : {}),
    packageType: draft.packageType,
    manufacturerId: draft.manufacturerId,
    nutrition: draft.nutrition,
    ...(draft.imageUrl ? { imageUrl: draft.imageUrl } : {}),
    ...(draft.officialRecipe ? { officialRecipe: draft.officialRecipe } : {}),
    sourceRefs: draft.sourceRefs,
    updatedAt: draft.updatedAt,
    status: status.status,
    statusSource: status.statusSource,
    statusConfidence: status.statusConfidence,
  };
  return product;
}

/** ProductDraft → RamenProduct (도출 + 완성 일괄). */
export function deriveAndFinalize(draft: ProductDraft): RamenProduct {
  return finalizeProduct(draft, deriveProductStatus(draft));
}

// ── 회수 매칭 일치율 리포트(M2 DoD #4) ──

export interface RecallMatchReport {
  totalRecalls: number;
  matched: number;
  matchedByNumber: number;
  matchedByBarcode: number;
  unmatched: number;
  matchRate: number;
  /** 어떤 제품에도 붙지 않은 회수 이벤트 ID(라면 도메인 외 등) */
  unmatchedIds: string[];
}

/**
 * 전체 회수 이벤트가 라면 제품(draft)에 얼마나 매칭됐는지 리포트.
 * 매칭 키: 품목제조보고번호(number) 또는 바코드(barcode).
 */
export function recallMatchReport(
  allRecalls: RecallEvent[],
  drafts: ProductDraft[],
): RecallMatchReport {
  // 조인 레이어와 동일하게 키를 정규화해 비교(일치율 과소 보고 방지).
  const productIds = new Set(drafts.map((d) => normalizeProductId(d.id)));
  const barcodes = new Set(
    drafts.map((d) => d.barcode?.trim()).filter((b): b is string => Boolean(b)),
  );

  let matchedByNumber = 0;
  let matchedByBarcode = 0;
  const unmatchedIds: string[] = [];

  for (const r of allRecalls) {
    const byNumber = r.productId !== undefined && productIds.has(normalizeProductId(r.productId));
    const byBarcode = r.barcode !== undefined && barcodes.has(r.barcode.trim());
    if (byNumber) matchedByNumber++;
    else if (byBarcode) matchedByBarcode++;
    else unmatchedIds.push(r.id);
  }

  const matched = matchedByNumber + matchedByBarcode;
  return {
    totalRecalls: allRecalls.length,
    matched,
    matchedByNumber,
    matchedByBarcode,
    unmatched: unmatchedIds.length,
    matchRate: allRecalls.length === 0 ? 1 : matched / allRecalls.length,
    unmatchedIds,
  };
}
