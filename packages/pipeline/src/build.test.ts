import { describe, expect, it } from "vitest";
import { buildSnapshot, serializeSnapshot, snapshotHash } from "./build.js";
import { SAMPLE_AS_OF, SAMPLE_INPUTS, SAMPLE_VERSION } from "./sample-data.js";

const opts = { asOf: SAMPLE_AS_OF, version: SAMPLE_VERSION };

describe("buildSnapshot — 오케스트레이션", () => {
  it("필터→조인→status: 라면만, PK 정렬, status 부착", () => {
    const { snapshot } = buildSnapshot(SAMPLE_INPUTS, opts);
    expect(snapshot.products.map((p) => p.id)).toEqual(["20210001", "20210002", "20210006"]);
    // 튀김우동(20210004)은 음성키워드로 제외.
    const byId = (id: string) => snapshot.products.find((p) => p.id === id)!;
    expect(byId("20210001").status).toBe("ON_SALE"); // 신호 없음
    expect(byId("20210002").status).toBe("SALES_HALTED"); // 판매중지 회수
    expect(byId("20210006").status).toBe("DISCONTINUED?"); // 제조사 폐업
    expect(byId("20210006").statusConfidence).toBe("medium");
  });

  it("statusCounts 리포트", () => {
    const { report } = buildSnapshot(SAMPLE_INPUTS, opts);
    expect(report.statusCounts).toEqual({
      ON_SALE: 1,
      SALES_HALTED: 1,
      RECALLED: 0,
      "DISCONTINUED?": 1,
    });
  });

  it("INV-7 idempotency: 동일 입력 2회 → 산출·해시·직렬화 동일", () => {
    const a = buildSnapshot(SAMPLE_INPUTS, opts);
    const b = buildSnapshot(SAMPLE_INPUTS, opts);
    expect(a.snapshot).toEqual(b.snapshot);
    expect(snapshotHash(a.snapshot)).toBe(snapshotHash(b.snapshot));
    expect(serializeSnapshot(a.snapshot)).toBe(serializeSnapshot(b.snapshot));
  });

  it("INV-7: 직렬화 본문에 벽시계 시각 없음(updatedAt=asOf 결정론)", () => {
    const { snapshot } = buildSnapshot(SAMPLE_INPUTS, opts);
    const body = serializeSnapshot(snapshot);
    // 본문의 updatedAt은 주입된 asOf만(고정).
    expect(body).toContain(SAMPLE_AS_OF);
    for (const p of snapshot.products) expect(p.updatedAt).toBe(SAMPLE_AS_OF);
  });

  it("모든 산출 레코드 INV-6(status·source·confidence) 충족", () => {
    const { snapshot } = buildSnapshot(SAMPLE_INPUTS, opts);
    for (const p of snapshot.products) {
      expect(p.status).toBeTruthy();
      expect(p.statusSource).toBeTruthy();
      expect(p.statusConfidence).toBeTruthy();
      expect(p.sourceRefs).toContain("PRODUCT_REPORT");
    }
  });

  it("INV-4 계약: 영속 스냅샷에 Tier2(가격/제휴) 키가 없다 (이름 회피 누설 차단)", () => {
    const { snapshot } = buildSnapshot(SAMPLE_INPUTS, opts);
    const body = serializeSnapshot(snapshot);
    // 가격/판매자/제휴/조회시각 류 키가 직렬화 본문에 존재하면 INV-4 위반(이름 회피 변형 포함).
    const forbidden =
      /"(price|lprice|cost|seller|vendor|mall|affiliate|fetchedAt|priceQuote|offerUrl|coupang|naver)"/i;
    expect(forbidden.test(body)).toBe(false);
  });
});

describe("buildSnapshot — 음식점 레이어(M4 통합)", () => {
  it("라멘 음식점만 스냅샷에 포함, PK 정렬(김밥천국 제외)", () => {
    const { snapshot } = buildSnapshot(SAMPLE_INPUTS, opts);
    expect(snapshot.shops.map((s) => s.id)).toEqual(["MGT-0001", "MGT-0002", "MGT-0005"]);
  });

  it("음식점 리포트(좌표·영업·모범 집계)", () => {
    const { report } = buildSnapshot(SAMPLE_INPUTS, opts);
    expect(report.shops.ramenShops).toBe(3);
    expect(report.shops.withCoords).toBe(2);
    expect(report.shops.coordsMissing).toBe(1); // 멘야하나 좌표 없음
    expect(report.shops.active).toBe(2);
    expect(report.shops.closed).toBe(1); // 멘야하나 폐업
    expect(report.shops.modelRestaurants).toBe(1);
  });

  it("음식점도 INV-7 멱등(2회 동일) + source(INV-9)", () => {
    const a = buildSnapshot(SAMPLE_INPUTS, opts).snapshot.shops;
    const b = buildSnapshot(SAMPLE_INPUTS, opts).snapshot.shops;
    expect(a).toEqual(b);
    for (const s of a) expect(s.source).toBe("RESTAURANT");
  });
});
