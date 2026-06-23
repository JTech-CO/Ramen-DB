// data.go.kr 일반음식점 표준 REST 어댑터 — apis.data.go.kr/1741000/general_restaurants/info.
// 식약처(키=경로)와 달리 data.go.kr은 serviceKey를 **쿼리파라미터**로 받는다. 응답은 표준
// envelope: response.header.resultCode("0" 성공) / response.body.items[] / totalCount.
// 좌표 CRD_INFO_X/Y는 EPSG:5174(중부원점 Bessel) 투영미터 → normalizeRestaurant가 WGS84로 변환.
// 전국 2.28M행 + 서버사이드 업태/지역 필터 없음(페이지네이션만) → maxRows 상한으로 수집,
// 라멘 도메인 필터는 호출부(joinShops)의 클라이언트 필터로 적용. 전량 커버는 벌크파일 후속.

import type { RawRestaurant } from "../raw-types.js";

export const DATAGOKR_RESTAURANT_ENDPOINT =
  "https://apis.data.go.kr/1741000/general_restaurants/info";

const PAGE_MAX = 100; // numOfRows 최대(가이드)
// 게이트웨이는 깊은 오프셋 페이지에서 30~60s까지 걸린다(2.28M 테이블) → 넉넉히 90s, 짧으면 정상 응답을 끊는다.
const REQUEST_TIMEOUT_MS = 90_000;
const MAX_CONSECUTIVE_FAILURES = 6; // 느린 구간을 견디고, 진짜 장애일 때만 부분 결과로 중단

export interface DataGoKrRestaurantOptions {
  /** data.go.kr serviceKey(쿼리). env에서만(INV-1). */
  serviceKey: string;
  fetchImpl?: typeof fetch;
  /** 1회 행수(≤100) */
  numOfRows?: number;
  /** 수집 상한(쿼터·시간 보호). 기본 100k. */
  maxRows?: number;
  endpoint?: string;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
}

type Row = Record<string, string | null>;

interface ApiResponse {
  response?: {
    header?: { resultCode?: string; resultMsg?: string };
    body?: {
      items?: Row[] | { item?: Row[] };
      totalCount?: number | string;
    };
  };
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** 표준 data.go.kr 응답에서 행 배열 추출(items[] 또는 items.item[]). */
function extractRows(json: ApiResponse): Row[] {
  const items = json.response?.body?.items;
  if (Array.isArray(items)) return items;
  if (items && Array.isArray(items.item)) return items.item;
  return [];
}

function str(v: string | null | undefined): string | undefined {
  const t = (v ?? "").toString().trim();
  return t === "" ? undefined : t;
}

/**
 * data.go.kr 일반음식점 행 → RawRestaurant(기존 음식점 정규화 계약).
 * 필드 매핑(2026-06-23 실응답 확정): MNG_NO·BPLC_NM·ROAD_NM_ADDR·LOTNO_ADDR·
 * CRD_INFO_X/Y·SALS_STTS_NM·DTL_SALS_STTS_NM·BZSTAT_SE_NM(업태)·LCPMT_YMD(인허가일).
 */
export function mapRestaurantRow(row: Row): RawRestaurant {
  return {
    MGTNO: str(row.MNG_NO) ?? "",
    BPLCNM: str(row.BPLC_NM) ?? "",
    ...(str(row.ROAD_NM_ADDR) ? { RDNWHLADDR: str(row.ROAD_NM_ADDR)! } : {}),
    ...(str(row.LOTNO_ADDR) ? { SITEWHLADDR: str(row.LOTNO_ADDR)! } : {}),
    ...(str(row.CRD_INFO_X) ? { X: str(row.CRD_INFO_X)! } : {}),
    ...(str(row.CRD_INFO_Y) ? { Y: str(row.CRD_INFO_Y)! } : {}),
    ...(str(row.SALS_STTS_NM) ? { TRDSTATENM: str(row.SALS_STTS_NM)! } : {}),
    ...(str(row.DTL_SALS_STTS_NM) ? { DTLSTATENM: str(row.DTL_SALS_STTS_NM)! } : {}),
    ...(str(row.BZSTAT_SE_NM) ? { UPTAENM: str(row.BZSTAT_SE_NM)! } : {}),
    ...(str(row.LCPMT_YMD) ? { APVPERMYMD: str(row.LCPMT_YMD)! } : {}),
  };
}

/** 1개 페이지 요청+파싱. 일시적 실패(비JSON·네트워크·5xx·타임아웃)는 선형 백오프 재시도. */
async function fetchPage(
  url: string,
  doFetch: typeof fetch,
  timeoutMs: number,
  retries: number,
  retryDelayMs: number,
): Promise<ApiResponse> {
  let lastErr: Error = new Error("data.go.kr 일반음식점: 알 수 없는 오류");
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(retryDelayMs * attempt);
    try {
      const res = await doFetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        lastErr = new Error(`data.go.kr 일반음식점 fetch 실패: ${res.status} ${res.statusText}`);
        continue;
      }
      try {
        return (await res.json()) as ApiResponse;
      } catch {
        lastErr = new Error("data.go.kr 일반음식점: JSON이 아닌 응답(키 미승인 또는 일시적 차단).");
        continue;
      }
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastErr;
}

/**
 * 일반음식점 페이지네이션 수집(maxRows 상한). 관리번호 중복 제거.
 * 라멘 필터는 호출부(joinShops 도메인 필터)에서 적용한다.
 */
export async function fetchGeneralRestaurants(
  opts: DataGoKrRestaurantOptions,
): Promise<RawRestaurant[]> {
  const doFetch = opts.fetchImpl ?? fetch;
  const numOfRows = Math.min(opts.numOfRows ?? PAGE_MAX, PAGE_MAX);
  const maxRows = opts.maxRows ?? 100_000;
  const endpoint = opts.endpoint ?? DATAGOKR_RESTAURANT_ENDPOINT;
  const timeoutMs = opts.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const retries = opts.retries ?? 1;
  const retryDelayMs = opts.retryDelayMs ?? 500;
  const key = encodeURIComponent(opts.serviceKey);

  const out: RawRestaurant[] = [];
  const seen = new Set<string>();
  let consecutiveFailures = 0;
  for (let pageNo = 1; out.length < maxRows; pageNo++) {
    const url = `${endpoint}?serviceKey=${key}&pageNo=${pageNo}&numOfRows=${numOfRows}&returnType=json`;
    let json: ApiResponse;
    try {
      json = await fetchPage(url, doFetch, timeoutMs, retries, retryDelayMs);
      consecutiveFailures = 0;
    } catch (e) {
      // 한 페이지가 재시도까지 실패해도 전체 스캔을 죽이지 않는다 — 건너뛰고 다음 페이지로.
      // 연속 실패가 한계를 넘으면 게이트웨이 장애로 보고 부분 결과로 중단한다.
      consecutiveFailures++;
      process.stderr.write(
        `[ingest] 일반음식점 page ${pageNo} 실패(${consecutiveFailures}연속, 수집 ${out.length}건): ${e instanceof Error ? e.message : e}\n`,
      );
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        process.stderr.write(`[ingest] 연속 실패 ${MAX_CONSECUTIVE_FAILURES}회 — 부분 결과 ${out.length}건으로 중단\n`);
        break;
      }
      continue;
    }
    const code = json.response?.header?.resultCode;
    if (code !== undefined && code !== "0" && code !== "00") {
      const msg = `data.go.kr 일반음식점 오류 ${code}: ${json.response?.header?.resultMsg ?? ""}`;
      // 첫 페이지부터 오류면 설정 문제(키·승인)로 보고 throw. 수집 중이면 쿼터초과 등으로 보고 부분 중단.
      if (out.length === 0) throw new Error(msg);
      process.stderr.write(`[ingest] ${msg} — 부분 결과 ${out.length}건으로 중단\n`);
      break;
    }
    const rows = extractRows(json);
    if (rows.length === 0) break;
    for (const row of rows) {
      const mapped = mapRestaurantRow(row);
      const id = mapped.MGTNO;
      if (id) {
        if (seen.has(id)) continue;
        seen.add(id);
      }
      out.push(mapped);
      if (out.length >= maxRows) break;
    }
    if (rows.length < numOfRows) break; // 마지막 페이지
  }
  return out;
}
