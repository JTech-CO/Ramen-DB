import { describe, expect, it } from "vitest";
import {
  CoupangPartnersProvider,
  buildCoupangAuth,
  coupangDatetime,
  loadCoupangCredentials,
} from "./coupang-partners.js";
import { makeFetch } from "../__fixtures__/mock-fetch.js";

const clock = () => Date.parse("2026-06-18T09:15:00.000Z");
const creds = { accessKey: "AK", secretKey: "SK" };

describe("쿠팡 파트너스 인증", () => {
  it("coupangDatetime: yyMMddTHHmmssZ (GMT)", () => {
    expect(coupangDatetime(Date.parse("2026-06-18T09:15:00Z"))).toBe("260618T091500Z");
  });

  it("HMAC 서명: 결정론 + CEA 구조 + SHA256 hex", () => {
    const a = buildCoupangAuth("POST", "/path", "", creds, "260618T091500Z");
    const b = buildCoupangAuth("POST", "/path", "", creds, "260618T091500Z");
    expect(a).toBe(b); // 결정론
    expect(a).toContain("CEA algorithm=HmacSHA256");
    expect(a).toContain("access-key=AK");
    expect(a).toContain("signed-date=260618T091500Z");
    expect(a).toMatch(/signature=[0-9a-f]{64}/); // SHA256 hex 64자
  });

  it("입력 다르면 서명 다름", () => {
    const a = buildCoupangAuth("POST", "/path", "", creds, "260618T091500Z");
    const b = buildCoupangAuth("POST", "/other", "", creds, "260618T091500Z");
    expect(a).not.toBe(b);
  });
});

describe("CoupangPartnersProvider", () => {
  it("딥링크 응답 → 제휴 PriceQuote (가격 없음, affiliate:true, 출처·조회시각)", async () => {
    const { fn } = makeFetch({ data: [{ shortenUrl: "https://link.coupang.com/abc" }] });
    const p = new CoupangPartnersProvider(creds);
    const quotes = await p.search({ name: "신라면" }, { fetchImpl: fn, clock });

    expect(quotes).toHaveLength(1);
    expect(quotes[0]).toMatchObject({
      seller: "쿠팡",
      url: "https://link.coupang.com/abc",
      source: "쿠팡",
      affiliate: true,
    });
    expect(quotes[0]!.price).toBeUndefined(); // 제휴 링크 — 가격 없음
    expect(quotes[0]!.fetchedAt).toBe("2026-06-18T09:15:00.000Z");
  });

  it("자격 미설정 시 throw (INV-1)", () => {
    expect(() => loadCoupangCredentials({})).toThrow(/COUPANG_PARTNERS/);
  });
});
