// 네이버쇼핑 검색 API provider — 가격 조회(request-time, 비영속 INV-4).
// 결과 저장/DB화 금지(ADR-0003): 호출부가 표시 후 폐기하거나 TTL 캐시만. 출처·조회시각 표기(INV-9).

import { isoFrom, systemClock, type PriceQuery, type PriceQuote } from "../price-quote.js";
import type { PriceProvider, ProviderOptions } from "./provider.js";

const ENDPOINT = "https://openapi.naver.com/v1/search/shop.json";

export interface NaverCredentials {
  clientId: string;
  clientSecret: string;
}

/** env에서 네이버 검색 API 자격 로드(INV-1). 미설정 시 명확 실패. */
export function loadNaverCredentials(env: NodeJS.ProcessEnv = process.env): NaverCredentials {
  const clientId = env.NAVER_SEARCH_CLIENT_ID?.trim();
  const clientSecret = env.NAVER_SEARCH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error(
      "NAVER_SEARCH_CLIENT_ID/SECRET 미설정: .env 또는 secret로 주입(INV-1). 커밋 금지.",
    );
  }
  return { clientId, clientSecret };
}

interface NaverShopItem {
  title?: string;
  link?: string;
  lprice?: string;
  mallName?: string;
}

/** HTML 태그 제거(네이버 title에 <b> 등 혼입). */
function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, "").trim();
}

export class NaverShoppingProvider implements PriceProvider {
  readonly source = "네이버쇼핑";

  constructor(private readonly creds: NaverCredentials) {}

  async search(query: PriceQuery, opts: ProviderOptions = {}): Promise<PriceQuote[]> {
    const doFetch = opts.fetchImpl ?? fetch;
    const clock = opts.clock ?? systemClock;
    const display = opts.limit ?? 10;

    const url = new URL(ENDPOINT);
    url.searchParams.set("query", query.barcode ? query.barcode : query.name);
    url.searchParams.set("display", String(display));
    url.searchParams.set("sort", "asc"); // 최저가 우선

    const res = await doFetch(url, {
      headers: {
        "X-Naver-Client-Id": this.creds.clientId,
        "X-Naver-Client-Secret": this.creds.clientSecret,
      },
    });
    if (!res.ok) {
      throw new Error(`네이버쇼핑 조회 실패: ${res.status} ${res.statusText}`);
    }
    const json = (await res.json()) as { items?: NaverShopItem[] };
    const fetchedAt = isoFrom(clock);

    const quotes: PriceQuote[] = [];
    for (const item of json.items ?? []) {
      const price = Number(item.lprice);
      if (!item.link || !Number.isFinite(price)) continue;
      quotes.push({
        seller: stripTags(item.mallName ?? "").trim() || "판매처",
        price,
        url: item.link,
        fetchedAt,
        source: this.source,
        affiliate: false,
      });
    }
    return quotes;
  }
}
