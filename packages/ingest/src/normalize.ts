// 정규화 — 원시 공공데이터 → 도메인 중간형. 키 trim·단위·날짜·packageType 추론.
// 부수효과 없는 순수 함수. 결정론(동일 입력 → 동일 출력).

import type { BusinessStatus, Nutrition, PackageType, RecallEvent } from "@ramen/core-domain";
import { isValidProductId, normalizeProductId } from "@ramen/core-domain";
import type {
  RawClosure,
  RawNutrition,
  RawProductReport,
  RawRecall,
} from "./raw-types.js";

/** 정규화된 제품(도메인 필터·조인 입력). status 도출 전. */
export interface NormalizedProduct {
  id: string;
  name: string;
  manufacturerId: string;
  manufacturerName: string;
  /** 식품유형(품목유형) — 도메인 필터 1차 기준 */
  foodType: string;
  barcode?: string;
  packageType: PackageType;
  rawMaterials?: string;
  reportedAt?: string;
}

export interface NormalizedNutritionRow {
  /** 품목제조보고번호 키(있을 때). 식약처 영양 통합DB(I2790)는 미제공 → matchKey 사용. */
  productId?: string;
  /** 식품명+제조사 정규화 매칭 키(ADR-0007). productId 부재 시 조인에 사용. */
  matchKey?: string;
  /** 필수 4종(에너지·탄수·단백·지방) 중 하나라도 결측이면 null(미커버). 0 날조 금지(백서 §5). */
  nutrition: Nutrition | null;
}

/** 식품명+제조사 정규화 매칭 키(공백·대소문자 무시). 영양 조인 폴백(ADR-0007). */
export function nutritionMatchKey(name: string, maker: string): string {
  const norm = (s: string): string => s.replace(/\s+/g, "").toLowerCase();
  return `${norm(name)}|${norm(maker)}`;
}

/**
 * 수치 파싱. 콤마 제거 후 선행 숫자 토큰만 추출(단위 접미사 "12g"·"1,790mg" 허용,
 * 16진수/지수표기 오수용 방지). 비수치·빈값은 undefined.
 */
export function parseNum(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const cleaned = raw.replace(/,/g, "").trim();
  if (cleaned === "") return undefined;
  const m = cleaned.match(/^-?\d+(?:\.\d+)?/);
  if (!m) return undefined;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : undefined;
}

/** 바코드 정규화 — 숫자만 추출(공백·하이픈·구분자 제거). 빈 값은 undefined. */
export function normalizeBarcode(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const digits = raw.replace(/\D/g, "");
  return digits.length > 0 ? digits : undefined;
}

function isoIfValid(y: string, mo: string, d: string): string | undefined {
  const m = Number(mo);
  const day = Number(d);
  if (m < 1 || m > 12 || day < 1 || day > 31) return undefined;
  return `${y}-${mo}-${d}`;
}

/** YYYYMMDD | YYYY-MM-DD → YYYY-MM-DD. 월/일 범위 검증, 무효·미파싱은 undefined. */
export function normalizeDate(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const s = raw.trim();
  const compact = s.match(/^(\d{4})(\d{2})(\d{2})/);
  if (compact) return isoIfValid(compact[1]!, compact[2]!, compact[3]!);
  const dashed = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dashed) return isoIfValid(dashed[1]!, dashed[2]!, dashed[3]!);
  return undefined;
}

const CUP_HINTS = ["컵", "용기", "사발", "뚜껑", "큰사발", "왕뚜껑"];

/** 제품명에서 포장형태 추론. 컵/용기 힌트 → CUP, 그 외 → BAG. */
export function inferPackageType(name: string): PackageType {
  const n = name.replace(/\s/g, "");
  if (CUP_HINTS.some((h) => n.includes(h))) return "CUP";
  return "BAG";
}

export function normalizeProductReport(raw: RawProductReport): NormalizedProduct {
  const id = normalizeProductId(raw.PRDLST_REPORT_NO);
  const name = raw.PRDLST_NM.trim();
  // 제조사 식별: 인허가번호 우선, 없으면 업소명 기반 안정 키.
  const manufacturerId = (raw.LCNS_NO?.trim() || `BSSH:${raw.BSSH_NM.trim()}`).trim();
  return {
    id,
    name,
    manufacturerId,
    manufacturerName: raw.BSSH_NM.trim(),
    foodType: (raw.PRDLST_DCNM ?? "").trim(),
    barcode: normalizeBarcode(raw.BAR_CD),
    packageType: inferPackageType(name),
    rawMaterials: raw.RAWMTRL_NM?.trim() || undefined,
    reportedAt: normalizeDate(raw.PRMS_DT),
  };
}

export function normalizeNutrition(raw: RawNutrition): NormalizedNutritionRow {
  const productId = normalizeProductId(raw.PRDLST_REPORT_NO);
  const energyKcal = parseNum(raw.ENERC);
  const carbG = parseNum(raw.CHOCDF);
  const proteinG = parseNum(raw.PROT);
  const fatG = parseNum(raw.FATCE);
  // 필수 4종 중 하나라도 결측/비수치면 미커버(null)로 둔다 — 0 날조 금지(백서 §5, 빈칸 미채움).
  if (
    energyKcal === undefined ||
    carbG === undefined ||
    proteinG === undefined ||
    fatG === undefined
  ) {
    return { productId, nutrition: null };
  }
  const nutrition: Nutrition = {
    servingBasis: (raw.NUT_CONT_SRTR_QUA ?? "100g").trim(),
    energyKcal,
    carbG,
    proteinG,
    fatG,
    ...optional("sugarG", parseNum(raw.SUGAR)),
    ...optional("satFatG", parseNum(raw.FASAT)),
    ...optional("transFatG", parseNum(raw.FATRN)),
    ...optional("sodiumMg", parseNum(raw.NAT)),
    ...optional("cholesterolMg", parseNum(raw.CHOLE)),
  };
  return { productId, nutrition };
}

/** 값이 있을 때만 키를 포함(undefined 필드 제외 → 결정론 직렬화 INV-7과 정합). */
function optional<K extends string>(key: K, val: number | undefined): Record<K, number> | object {
  return val === undefined ? {} : { [key]: val };
}

export function normalizeRecall(raw: RawRecall, index: number): RecallEvent {
  const kind = (raw.RTRVL_SE ?? "").includes("판매중지") ? "SALES_HALT" : "RECALL";
  const rawId = raw.PRDLST_REPORT_NO ? normalizeProductId(raw.PRDLST_REPORT_NO) : undefined;
  const productId = isValidProductId(rawId) ? rawId : undefined;
  const barcode = normalizeBarcode(raw.BAR_CD);
  // 안정 ID: SEQ 우선, 없으면 (productId|barcode|index) 결정론 합성.
  const id = (raw.SEQ?.trim() || `RECALL:${productId ?? barcode ?? "?"}:${index}`).trim();
  return {
    id,
    ...(productId ? { productId } : {}),
    ...(barcode ? { barcode } : {}),
    reason: (raw.RTRVL_RESN ?? "").trim(),
    ...(raw.RTRVL_GRAD?.trim() ? { grade: raw.RTRVL_GRAD.trim() } : {}),
    kind,
    ...(raw.IMG_URL?.trim() ? { imageUrl: raw.IMG_URL.trim() } : {}),
    reportedAt: normalizeDate(raw.CRET_DTM) ?? "",
    source: "RECALL",
  };
}

export interface NormalizedClosure {
  manufacturerId: string;
  businessStatus: BusinessStatus;
}

export function normalizeClosure(raw: RawClosure): NormalizedClosure {
  const manufacturerId = (raw.LCNS_NO?.trim() || `BSSH:${(raw.BSSH_NM ?? "").trim()}`).trim();
  const closed = (raw.BSN_STATE_NM ?? "").includes("폐업");
  return { manufacturerId, businessStatus: closed ? "CLOSED" : "ACTIVE" };
}
