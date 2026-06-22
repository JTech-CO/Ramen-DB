// 인메모리 TTL 캐시 — Tier2 비영속(INV-4)의 핵심. 디스크/DB 직렬화 절대 없음.
// 약관 허용 범위 내 캐시(ADR-0003). TTL 경과분은 조회 시 폐기되고 재조회로 새로 채운다.
// node:fs 등 영속 의존을 이 파일은 import하지 않는다.

import type { Clock } from "./price-quote.js";
import { systemClock } from "./price-quote.js";

interface Entry<T> {
  value: T;
  /** 만료 epoch ms */
  expiresAt: number;
}

/** 런타임 전용 TTL 캐시. 영속 저장소가 아니다(INV-4). */
export class TtlCache<T> {
  private readonly store = new Map<string, Entry<T>>();

  constructor(
    private readonly ttlMs: number,
    private readonly clock: Clock = systemClock,
  ) {}

  /** 만료되지 않은 값만 반환. 만료분은 즉시 폐기. */
  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (entry === undefined) return undefined;
    if (this.clock() >= entry.expiresAt) {
      this.store.delete(key); // 만료 → 폐기
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    this.store.set(key, { value, expiresAt: this.clock() + this.ttlMs });
  }

  /** 만료 항목을 일괄 정리(선택적 유지보수). */
  prune(): void {
    const now = this.clock();
    for (const [key, entry] of this.store) {
      if (now >= entry.expiresAt) this.store.delete(key);
    }
  }

  /** 현재 보관 항목 수(만료 미정리 포함) — 진단용. */
  get size(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }
}
