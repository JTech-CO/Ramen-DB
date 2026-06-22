// Tier 2: 런타임 전용. 영속 저장 금지(INV-4). apps/web에서만 정의·사용한다.
// request-time 조회 → 표시 → 약관 허용 캐시(TTL) 후 폐기. DB·스냅샷 적재 절대 금지.
// (ADR-0001 / ADR-0003)

/** 가격 견적 — 절대 영속 저장소·스냅샷에 기록하지 않는다(INV-4). 응답 후 폐기/캐시 TTL. */
export interface PriceQuote {
  seller: string;
  /** 가격(원). 제휴 구매링크(쿠팡 딥링크)는 가격이 없을 수 있어 선택. */
  price?: number;
  /** 구매/제휴 URL */
  url: string;
  /** 조회시각 ISO 8601 — 표시 필수(INV-9) */
  fetchedAt: string;
  /** 출처 표기 라벨(INV-9) — 예: "네이버쇼핑", "쿠팡" */
  source: string;
  /** 제휴(딥링크) 견적인가 — true면 대가성 문구 의무(INV-10) */
  affiliate?: boolean;
}

/**
 * 가격 조회 결과 렌더 모델. 영속화 경계를 타입 수준에서 차단하기 위한 마커.
 * 이 타입은 직렬화되어 디스크/DB에 저장되어선 안 된다(INV-4).
 */
export interface PriceQuoteView {
  readonly __tier2RuntimeOnly: true;
  quotes: PriceQuote[];
}

/** 제품 가격 조회 질의 — 바코드 우선, 없으면 제품명. */
export interface PriceQuery {
  barcode?: string;
  name: string;
}

/** 시각 주입(결정론 테스트·INV-9 fetchedAt). 기본은 런타임 벽시계. */
export type Clock = () => number;

export const systemClock: Clock = () => Date.now();

/** epoch ms → ISO 8601 (조회시각 표기, INV-9). */
export function isoFrom(clock: Clock): string {
  return new Date(clock()).toISOString();
}
