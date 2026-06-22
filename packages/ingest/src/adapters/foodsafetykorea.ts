// 식품안전나라 OpenAPI 라이브 어댑터 — 품목제조보고/회수 등 식약처 제공 데이터.
// data.go.kr 15062098/15074318은 실제로 openapi.foodsafetykorea.go.kr로 호출된다(표준 data.go.kr
// envelope 아님). 서비스키는 **경로**에 삽입(헤더/쿼리 아님), 응답 root = SERVICE_ID.
// envelope: json[SID].row[] / json[SID].total_count / json[SID].RESULT.CODE("INFO-000" 성공).
//
// 주의(런북 9): SERVICE_ID·필드명은 권위 가이드 기반이나 라이브 1건 호출로 최종 확정한다.
// - 품목제조보고 본체 = I1250 (data.go.kr 15062098 '원재료' 변형은 C002 — opts로 교체).
// - 회수·판매중지 = I0490 (필드명이 품목제조보고와 다름: PRDTNM/BRCDNO/IMG_FILE_PATH).
// - 영양성분 통합DB = I2790은 **품목제조보고번호를 제공하지 않음** → 조인 전략 별도(ADR-0007). 여기 미배선.

import type { Nutrition } from "@ramen/core-domain";
import type { RawProductReport, RawRecall } from "../raw-types.js";
import { nutritionMatchKey, parseNum, type NormalizedNutritionRow } from "../normalize.js";

export const FOOD_SAFETY_BASE = "http://openapi.foodsafetykorea.go.kr/api";

export const FOOD_SAFETY_SERVICE_IDS = {
  PRODUCT_REPORT: "I1250",
  RECALL: "I0490",
  NUTRITION: "I2790",
} as const;

const PAGE_MAX = 1000; // 식품안전나라 1회 최대 행수
const SUCCESS = "INFO-000";
const NO_DATA = "INFO-200";
const REQUEST_TIMEOUT_MS = 60_000; // 1회 요청 상한(미승인 필터로 인한 무한 대기 방지)

export interface FoodSafetyOptions {
  /** 서비스키(경로 삽입). env에서만(INV-1). */
  serviceKey: string;
  fetchImpl?: typeof fetch;
  /** 1회 행수(≤1000) */
  pageSize?: number;
  /** 안전 상한(무한 루프 방지) */
  maxRows?: number;
  baseUrl?: string;
  /** 경로 뒤 옵션 필터 (예: { CHNG_DT: "20260601" } → 변동분만) */
  filters?: Record<string, string>;
  /** 1회 요청 타임아웃(ms). 기본 60s. */
  timeoutMs?: number;
  /** 일시적 실패(비JSON 차단·네트워크·5xx·타임아웃) 재시도 횟수. 기본 3. */
  retries?: number;
  /** 재시도 선형 백오프 기본 간격(ms). 기본 500. */
  retryDelayMs?: number;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * 1개 페이지 요청 + JSON 파싱. 일시적 실패는 선형 백오프로 재시도한다.
 * 식품안전나라는 **일시적 차단(버스트 과다)·인증키 미승인** 모두 HTTP 200 + HTML(자바스크립트 alert)을
 * 돌려준다 → JSON 파싱 실패. 일시적 차단은 재시도로 회복되고, 진짜 미승인은 재시도를 소진하고 throw한다.
 */
async function fetchEnvelope(
  url: string,
  serviceId: string,
  doFetch: typeof fetch,
  timeoutMs: number,
  retries: number,
  retryDelayMs: number,
): Promise<Envelope> {
  let lastErr: Error = new Error(`식품안전나라 ${serviceId}: 알 수 없는 오류`);
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(retryDelayMs * attempt);
    try {
      const res = await doFetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) {
        lastErr = new Error(`식품안전나라 fetch 실패: ${res.status} ${res.statusText} (${serviceId})`);
        continue;
      }
      try {
        return (await res.json()) as Envelope;
      } catch {
        lastErr = new Error(
          `식품안전나라 ${serviceId}: JSON이 아닌 응답(인증키 미승인 또는 일시적 차단).`,
        );
        continue;
      }
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastErr;
}

type Row = Record<string, string>;
interface Envelope {
  [serviceId: string]:
    | { row?: Row[]; total_count?: string; RESULT?: { CODE?: string; MSG?: string } }
    | undefined;
}

/** 식품안전나라 서비스 전체 행을 페이지네이션으로 수집(라이브 전용, 네트워크). */
export async function fetchFoodSafetyRows(
  serviceId: string,
  opts: FoodSafetyOptions,
): Promise<Row[]> {
  const doFetch = opts.fetchImpl ?? fetch;
  const pageSize = Math.min(opts.pageSize ?? PAGE_MAX, PAGE_MAX);
  const maxRows = opts.maxRows ?? 1_000_000;
  const base = opts.baseUrl ?? FOOD_SAFETY_BASE;
  const filterPath = Object.entries(opts.filters ?? {})
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");

  const timeoutMs = opts.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const retries = opts.retries ?? 3;
  const retryDelayMs = opts.retryDelayMs ?? 500;

  const rows: Row[] = [];
  for (let start = 1; start <= maxRows; start += pageSize) {
    const end = start + pageSize - 1;
    const url = `${base}/${opts.serviceKey}/${serviceId}/json/${start}/${end}${filterPath ? `/${filterPath}` : ""}`;
    const json = await fetchEnvelope(url, serviceId, doFetch, timeoutMs, retries, retryDelayMs);
    const body = json[serviceId];
    if (!body) throw new Error(`식품안전나라 응답에 '${serviceId}' 루트 없음`);

    const code = body.RESULT?.CODE;
    if (code === NO_DATA) break;
    if (code && code !== SUCCESS) {
      throw new Error(`식품안전나라 오류 ${code}: ${body.RESULT?.MSG ?? ""} (${serviceId})`);
    }

    const page = body.row ?? [];
    rows.push(...page);
    const total = Number(body.total_count ?? page.length);
    if (page.length === 0 || rows.length >= total) break;
  }
  return rows;
}

/** I1250 행 → RawProductReport. 바코드 필드는 이 서비스에 없음(undefined). */
export function mapProductReportRow(row: Row): RawProductReport {
  return {
    PRDLST_REPORT_NO: row.PRDLST_REPORT_NO ?? "",
    PRDLST_NM: row.PRDLST_NM ?? "",
    BSSH_NM: row.BSSH_NM ?? "",
    ...(row.LCNS_NO ? { LCNS_NO: row.LCNS_NO } : {}),
    ...(row.PRDLST_DCNM ? { PRDLST_DCNM: row.PRDLST_DCNM } : {}),
    ...(row.PRMS_DT ? { PRMS_DT: row.PRMS_DT } : {}),
  };
}

/** I0490 행 → RawRecall. 실제 필드명(PRDTNM/BRCDNO/IMG_FILE_PATH 등)을 매핑. */
export function mapRecallRow(row: Row): RawRecall {
  return {
    ...(row.PRDTNM ? { PRDLST_NM: row.PRDTNM } : {}),
    ...(row.PRDLST_REPORT_NO ? { PRDLST_REPORT_NO: row.PRDLST_REPORT_NO } : {}),
    ...(row.BRCDNO ? { BAR_CD: row.BRCDNO } : {}),
    ...(row.BSSHNM ? { BSSH_NM: row.BSSHNM } : {}),
    ...(row.RTRVLPRVNS ? { RTRVL_RESN: row.RTRVLPRVNS } : {}),
    ...(row.RTRVL_GRDCD_NM ? { RTRVL_GRAD: row.RTRVL_GRDCD_NM } : {}),
    // 회수/판매중지 구분 전용 필드는 I0490에 명확치 않음 → kind는 기본 RECALL(런북 9, 확정 필요).
    ...(row.IMG_FILE_PATH ? { IMG_URL: row.IMG_FILE_PATH } : {}),
    ...(row.CRET_DTM ? { CRET_DTM: row.CRET_DTM } : {}),
    ...(row.RTRVLDSUSE_SEQ ? { SEQ: row.RTRVLDSUSE_SEQ } : {}),
  };
}

/**
 * I2790 영양 행 → NormalizedNutritionRow. 품목제조보고번호가 없으므로 식품명+제조사 matchKey 사용(ADR-0007).
 * NUTR_CONT1~6 = 에너지·탄수·단백·지방·당·나트륨. 포화/트랜스/콜레스테롤은 컬럼 순서 불확실 → 미매핑(런북 9).
 */
export function mapNutritionRow(row: Row): NormalizedNutritionRow {
  const name = row.DESC_KOR ?? row.FOOD_NM_KR ?? "";
  const maker = row.MAKER_NAME ?? row.BSSH_NM ?? "";
  const matchKey = nutritionMatchKey(name, maker);
  const energyKcal = parseNum(row.NUTR_CONT1);
  const carbG = parseNum(row.NUTR_CONT2);
  const proteinG = parseNum(row.NUTR_CONT3);
  const fatG = parseNum(row.NUTR_CONT4);
  if (
    energyKcal === undefined ||
    carbG === undefined ||
    proteinG === undefined ||
    fatG === undefined
  ) {
    return { matchKey, nutrition: null };
  }
  const sugarG = parseNum(row.NUTR_CONT5);
  const sodiumMg = parseNum(row.NUTR_CONT6);
  const nutrition: Nutrition = {
    servingBasis: row.SERVING_SIZE?.trim() || "100g",
    energyKcal,
    carbG,
    proteinG,
    fatG,
    ...(sugarG !== undefined ? { sugarG } : {}),
    ...(sodiumMg !== undefined ? { sodiumMg } : {}),
  };
  return { matchKey, nutrition };
}

/**
 * 품목제조보고(I1250)를 **식품유형(PRDLST_DCNM) 서버사이드 필터**로 좁혀 수집.
 * 라이브 I1250은 100만 건+(전 식품)이라 전량 수집은 비현실적 → 면류 식품유형만 서버에서 추려
 * 받는다(도메인 필터 ① 단계의 서버사이드 이행). 같은 품목제조보고번호는 1회만(중복 제거).
 * 한 식품유형 수집 실패(미승인·타임아웃 등)는 건너뛰고 나머지를 모은다(부분 성공).
 */
export async function fetchProductReportsByFoodTypes(
  foodTypes: readonly string[],
  opts: FoodSafetyOptions & { productServiceId?: string },
): Promise<RawProductReport[]> {
  const serviceId = opts.productServiceId ?? FOOD_SAFETY_SERVICE_IDS.PRODUCT_REPORT;
  const seen = new Set<string>();
  const out: RawProductReport[] = [];
  for (const foodType of foodTypes) {
    let rows: Row[];
    try {
      rows = await fetchFoodSafetyRows(serviceId, {
        ...opts,
        filters: { ...(opts.filters ?? {}), PRDLST_DCNM: foodType },
      });
    } catch (e) {
      process.stderr.write(
        `[ingest] 식품유형 '${foodType}' 수집 실패(건너뜀): ${e instanceof Error ? e.message : e}\n`,
      );
      continue;
    }
    for (const row of rows) {
      const id = (row.PRDLST_REPORT_NO ?? "").trim();
      // 빈 PK는 보존(정규화에서 isValidProductId로 드롭). 유효 PK는 식품유형 간 중복 제거.
      if (id) {
        if (seen.has(id)) continue;
        seen.add(id);
      }
      out.push(mapProductReportRow(row));
    }
  }
  return out;
}

/**
 * Tier1 식약처 라이브 수집(품목제조보고 + 회수 + 영양). 제조사폐업(LOCALDATA)은 별도(ADR-0007).
 * - `productFoodTypes` 주어지면 식품유형 서버필터로 제품을 좁혀 수집(라이브 권장). 없으면 전량.
 * - 영양은 식품명+제조사 매칭용 NormalizedNutritionRow로 산출(품목제조보고번호 미제공).
 *   I2790 미승인/장애 시에도 스냅샷을 막지 않는다 — 경고 후 빈 배열로 강등(부분 성공).
 */
export async function fetchTier1ProductData(
  opts: FoodSafetyOptions & {
    productServiceId?: string;
    productFoodTypes?: readonly string[];
    includeNutrition?: boolean;
  },
): Promise<{
  products: RawProductReport[];
  recalls: RawRecall[];
  nutritionRows: NormalizedNutritionRow[];
}> {
  const productServiceId = opts.productServiceId ?? FOOD_SAFETY_SERVICE_IDS.PRODUCT_REPORT;

  const productsPromise =
    opts.productFoodTypes && opts.productFoodTypes.length > 0
      ? fetchProductReportsByFoodTypes(opts.productFoodTypes, opts)
      : fetchFoodSafetyRows(productServiceId, opts).then((rows) => rows.map(mapProductReportRow));

  const recallsPromise = fetchFoodSafetyRows(FOOD_SAFETY_SERVICE_IDS.RECALL, opts).then((rows) =>
    rows.map(mapRecallRow),
  );

  const nutritionPromise =
    opts.includeNutrition === false
      ? Promise.resolve([] as NormalizedNutritionRow[])
      : fetchFoodSafetyRows(FOOD_SAFETY_SERVICE_IDS.NUTRITION, opts)
          .then((rows) => rows.map(mapNutritionRow))
          .catch((e) => {
            process.stderr.write(
              `[ingest] 영양(I2790) 수집 실패 — 영양 없이 진행: ${e instanceof Error ? e.message : e}\n`,
            );
            return [] as NormalizedNutritionRow[];
          });

  const [products, recalls, nutritionRows] = await Promise.all([
    productsPromise,
    recallsPromise,
    nutritionPromise,
  ]);
  return { products, recalls, nutritionRows };
}
