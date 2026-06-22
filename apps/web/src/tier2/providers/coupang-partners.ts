// 쿠팡 파트너스 provider — 제휴 딥링크(구매 링크) 생성(request-time, 비영속 INV-4).
// HMAC-SHA256 서명 인증. 제휴 링크이므로 노출 화면엔 대가성 문구 의무(INV-10, affiliate-view).
// 결과 저장 금지(ADR-0003). 출처·조회시각 표기(INV-9).

import { createHmac } from "node:crypto";
import { isoFrom, systemClock, type PriceQuery, type PriceQuote } from "../price-quote.js";
import type { PriceProvider, ProviderOptions } from "./provider.js";

const HOST = "https://api-gateway.coupang.com";
const PATH = "/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink";

export interface CoupangCredentials {
  accessKey: string;
  secretKey: string;
}

/** env에서 쿠팡 파트너스 자격 로드(INV-1). 미설정 시 명확 실패. */
export function loadCoupangCredentials(env: NodeJS.ProcessEnv = process.env): CoupangCredentials {
  const accessKey = env.COUPANG_PARTNERS_ACCESS_KEY?.trim();
  const secretKey = env.COUPANG_PARTNERS_SECRET_KEY?.trim();
  if (!accessKey || !secretKey) {
    throw new Error(
      "COUPANG_PARTNERS_ACCESS_KEY/SECRET_KEY 미설정: .env 또는 secret로 주입(INV-1). 커밋 금지.",
    );
  }
  return { accessKey, secretKey };
}

/** 쿠팡 서명용 시각 — yyMMdd'T'HHmmss'Z' (GMT). 결정론(clock 주입). */
export function coupangDatetime(epochMs: number): string {
  const d = new Date(epochMs);
  const p = (n: number): string => String(n).padStart(2, "0");
  const yy = p(d.getUTCFullYear() % 100);
  return `${yy}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

/** 쿠팡 파트너스 HMAC 인증 헤더(CEA). message = datetime + method + path + query. */
export function buildCoupangAuth(
  method: string,
  path: string,
  query: string,
  creds: CoupangCredentials,
  datetime: string,
): string {
  const message = datetime + method + path + query;
  const signature = createHmac("sha256", creds.secretKey).update(message).digest("hex");
  return `CEA algorithm=HmacSHA256, access-key=${creds.accessKey}, signed-date=${datetime}, signature=${signature}`;
}

interface CoupangDeeplinkItem {
  shortenUrl?: string;
  landingUrl?: string;
}

export class CoupangPartnersProvider implements PriceProvider {
  readonly source = "쿠팡";

  constructor(private readonly creds: CoupangCredentials) {}

  async search(query: PriceQuery, opts: ProviderOptions = {}): Promise<PriceQuote[]> {
    const doFetch = opts.fetchImpl ?? fetch;
    const clock = opts.clock ?? systemClock;
    const datetime = coupangDatetime(clock());
    const target = `https://www.coupang.com/np/search?q=${encodeURIComponent(query.name)}`;

    const res = await doFetch(`${HOST}${PATH}`, {
      method: "POST",
      headers: {
        Authorization: buildCoupangAuth("POST", PATH, "", this.creds, datetime),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ coupangUrls: [target] }),
    });
    if (!res.ok) {
      throw new Error(`쿠팡 파트너스 조회 실패: ${res.status} ${res.statusText}`);
    }
    const json = (await res.json()) as { data?: CoupangDeeplinkItem[] };
    const fetchedAt = isoFrom(clock);

    const quotes: PriceQuote[] = [];
    for (const item of json.data ?? []) {
      const url = item.shortenUrl ?? item.landingUrl;
      if (!url) continue;
      // 제휴 구매 링크 — 가격 없음. affiliate:true → 대가성 문구 의무(INV-10).
      quotes.push({ seller: "쿠팡", url, fetchedAt, source: this.source, affiliate: true });
    }
    return quotes;
  }
}
