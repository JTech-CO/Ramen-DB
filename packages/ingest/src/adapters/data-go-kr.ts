// data.go.kr OpenAPI 라이브 fetch 어댑터 — 외부 호출은 ingest에 격리(docs/FILE_TREE).
// 서비스키는 env에서만 읽는다(INV-1). 응답 스키마가 바뀌면 이 파일만 갱신(런북 9).
// 단위 테스트는 픽스처로 수행하며 이 어댑터는 라이브 수집(키 확보 후)에서만 호출한다.

export interface DataGoKrEndpoint {
  /** 전체 URL (서비스키·페이지 파라미터 제외) */
  baseUrl: string;
  /** 결과 envelope에서 행 배열을 꺼내는 함수 */
  extractRows: (json: unknown) => unknown[];
  /** envelope에서 전체 건수를 꺼내는 함수(페이지네이션 종료 판단) */
  extractTotal: (json: unknown) => number;
}

export interface FetchOptions {
  serviceKey: string;
  numOfRows?: number;
  /** 추가 쿼리 파라미터 */
  params?: Record<string, string>;
  /** 안전 상한(무한 루프 방지) */
  maxPages?: number;
  fetchImpl?: typeof fetch;
}

/** env에서 data.go.kr 서비스키 로드. 없으면 명확히 실패(INV-1). */
export function loadServiceKey(env: NodeJS.ProcessEnv = process.env): string {
  const key = env.DATA_GO_KR_SERVICE_KEY?.trim();
  if (!key) {
    throw new Error(
      "DATA_GO_KR_SERVICE_KEY 미설정: .env 또는 Actions secret로 주입하세요(INV-1). 커밋 금지.",
    );
  }
  return key;
}

/** 페이지네이션 전체 수집. 라이브 전용(네트워크). */
export async function fetchAllRows<TRaw>(
  endpoint: DataGoKrEndpoint,
  opts: FetchOptions,
): Promise<TRaw[]> {
  const doFetch = opts.fetchImpl ?? fetch;
  const numOfRows = opts.numOfRows ?? 1000;
  const maxPages = opts.maxPages ?? 1000;
  const rows: TRaw[] = [];

  for (let pageNo = 1; pageNo <= maxPages; pageNo++) {
    const url = new URL(endpoint.baseUrl);
    url.searchParams.set("serviceKey", opts.serviceKey);
    url.searchParams.set("type", "json");
    url.searchParams.set("pageNo", String(pageNo));
    url.searchParams.set("numOfRows", String(numOfRows));
    for (const [k, v] of Object.entries(opts.params ?? {})) {
      url.searchParams.set(k, v);
    }

    const res = await doFetch(url);
    if (!res.ok) {
      throw new Error(`data.go.kr fetch 실패: ${res.status} ${res.statusText} (page ${pageNo})`);
    }
    const json: unknown = await res.json();
    const pageRows = endpoint.extractRows(json) as TRaw[];
    rows.push(...pageRows);

    const total = endpoint.extractTotal(json);
    if (rows.length >= total || pageRows.length === 0) break;
  }
  return rows;
}
