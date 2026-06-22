import { describe, expect, it } from "vitest";
import { PriceService } from "./price-service.js";
import type { PriceProvider, ProviderOptions } from "./providers/provider.js";
import type { PriceQuery, PriceQuote } from "./price-quote.js";

class FakeProvider implements PriceProvider {
  calls = 0;
  constructor(
    readonly source: string,
    private readonly quotes: PriceQuote[],
  ) {}
  async search(_q: PriceQuery, _o: ProviderOptions): Promise<PriceQuote[]> {
    this.calls++;
    return this.quotes.map((q) => ({ ...q }));
  }
}

const NAVER_Q: PriceQuote = {
  seller: "A마트",
  price: 9900,
  url: "https://shop/1",
  fetchedAt: "2026-06-18T00:00:00.000Z",
  source: "네이버쇼핑",
  affiliate: false,
};

describe("PriceService — request-time + 비영속 TTL (INV-4)", () => {
  it("조회 결과는 런타임 마커 뷰(INV-4), 출처·조회시각 보존(INV-9)", async () => {
    const prov = new FakeProvider("네이버쇼핑", [NAVER_Q]);
    const svc = new PriceService({ providers: [prov], ttlMs: 5000, clock: () => 1000 });
    const v = await svc.lookup({ name: "신라면" });
    expect(v.__tier2RuntimeOnly).toBe(true);
    expect(v.quotes).toHaveLength(1);
    expect(v.quotes[0]!.source).toBe("네이버쇼핑");
    expect(v.quotes[0]!.fetchedAt).toBe("2026-06-18T00:00:00.000Z");
  });

  it("TTL 내 재조회는 캐시 히트(provider 재호출 안 함)", async () => {
    let now = 1000;
    const prov = new FakeProvider("네이버쇼핑", [NAVER_Q]);
    const svc = new PriceService({ providers: [prov], ttlMs: 5000, clock: () => now });
    await svc.lookup({ name: "신라면" });
    now = 3000; // TTL(5000) 이내
    await svc.lookup({ name: "신라면" });
    expect(prov.calls).toBe(1); // 캐시 히트
  });

  it("INV-4 비영속: TTL 경과 후 재조회 → provider 재호출(영속 부재 입증)", async () => {
    let now = 1000;
    const prov = new FakeProvider("네이버쇼핑", [NAVER_Q]);
    const svc = new PriceService({ providers: [prov], ttlMs: 5000, clock: () => now });
    await svc.lookup({ name: "신라면" });
    expect(prov.calls).toBe(1);
    now = 1000 + 5000; // TTL 경과
    await svc.lookup({ name: "신라면" });
    expect(prov.calls).toBe(2); // 새로 조회 — 캐시는 영속 저장이 아님
  });

  it("부분 실패: 한 provider가 throw해도 다른 provider 결과 반환", async () => {
    const ok = new FakeProvider("네이버쇼핑", [NAVER_Q]);
    const bad: PriceProvider = {
      source: "bad",
      search: async () => {
        throw new Error("provider down");
      },
    };
    const svc = new PriceService({ providers: [bad, ok], clock: () => 0 });
    const v = await svc.lookup({ name: "신라면" });
    expect(v.quotes).toHaveLength(1);
    expect(v.quotes[0]!.source).toBe("네이버쇼핑");
  });

  it("바코드와 이름은 별도 캐시 키", async () => {
    const prov = new FakeProvider("네이버쇼핑", [NAVER_Q]);
    const svc = new PriceService({ providers: [prov], clock: () => 0 });
    await svc.lookup({ barcode: "8801043011286", name: "신라면" });
    await svc.lookup({ name: "신라면" });
    expect(prov.calls).toBe(2); // 키가 달라 각각 조회
  });
});
