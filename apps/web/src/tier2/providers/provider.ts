// 가격 provider 공통 계약 — request-time 조회. 결과는 비영속(INV-4).

import type { Clock, PriceQuery, PriceQuote } from "../price-quote.js";

export interface PriceProvider {
  /** 출처 라벨(INV-9) */
  readonly source: string;
  /** request-time 조회. 실패 시 throw 또는 빈 배열. */
  search(query: PriceQuery, opts: ProviderOptions): Promise<PriceQuote[]>;
}

export interface ProviderOptions {
  /** 주입형 fetch(테스트 mock). 기본은 전역 fetch. */
  fetchImpl?: typeof fetch;
  /** 조회시각(INV-9)·서명시각 결정론 주입. */
  clock?: Clock;
  /** 결과 최대 개수. */
  limit?: number;
}
