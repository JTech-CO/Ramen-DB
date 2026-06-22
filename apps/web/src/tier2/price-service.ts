// request-time 가격 서비스 — provider 조회를 묶고 약관 허용 TTL 캐시(인메모리)만 둔다.
// **영속 저장 절대 없음(INV-4)**: 캐시는 TtlCache(디스크/DB 미사용), TTL 경과분은 재조회.
// 모든 견적에 source·fetchedAt(INV-9). 제휴 노출은 affiliate-view로 문구 강제(INV-10).

import type { Clock, PriceQuery, PriceQuote } from "./price-quote.js";
import { systemClock } from "./price-quote.js";
import { TtlCache } from "./cache.js";
import { buildAffiliateView, type AffiliateView } from "./affiliate-view.js";
import type { PriceProvider, ProviderOptions } from "./providers/provider.js";

/** 약관 허용 캐시 기본 TTL — 10분(ADR-0003). 가격은 상세 진입 on-demand. */
export const DEFAULT_TTL_MS = 10 * 60 * 1000;

export interface PriceServiceOptions {
  providers: PriceProvider[];
  ttlMs?: number;
  clock?: Clock;
  fetchImpl?: typeof fetch;
  limit?: number;
}

export class PriceService {
  private readonly providers: PriceProvider[];
  private readonly cache: TtlCache<PriceQuote[]>;
  private readonly providerOpts: ProviderOptions;

  constructor(opts: PriceServiceOptions) {
    const clock = opts.clock ?? systemClock;
    this.providers = opts.providers;
    this.cache = new TtlCache<PriceQuote[]>(opts.ttlMs ?? DEFAULT_TTL_MS, clock);
    this.providerOpts = {
      ...(opts.fetchImpl ? { fetchImpl: opts.fetchImpl } : {}),
      clock,
      ...(opts.limit !== undefined ? { limit: opts.limit } : {}),
    };
  }

  private cacheKey(query: PriceQuery): string {
    return query.barcode ? `bc:${query.barcode}` : `nm:${query.name}`;
  }

  /**
   * request-time 가격 조회. 캐시 히트 시 캐시값, 미스 시 provider 병렬 조회 후 TTL 캐시.
   * 한 provider 실패는 다른 provider 결과를 막지 않는다(부분 성공). 영속 저장 없음(INV-4).
   * **항상 buildAffiliateView를 단일 출구로 거쳐** 제휴 링크엔 대가성 문구가 부착된다(INV-10).
   */
  async lookup(query: PriceQuery): Promise<AffiliateView> {
    const key = this.cacheKey(query);
    const cached = this.cache.get(key);
    if (cached !== undefined) {
      return buildAffiliateView(cached);
    }
    const settled = await Promise.all(
      this.providers.map((p) =>
        p.search(query, this.providerOpts).catch(() => [] as PriceQuote[]),
      ),
    );
    const quotes = settled.flat();
    this.cache.set(key, quotes);
    return buildAffiliateView(quotes);
  }

  /** 진단용 — 캐시 항목 수(영속 아님). */
  get cacheSize(): number {
    return this.cache.size;
  }
}
