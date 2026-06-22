import { describe, expect, it } from "vitest";
import { buildAffiliateView, hasAffiliate } from "./affiliate-view.js";
import { COUPANG_PARTNERS_DISCLOSURE, isConfirmedDisclosure } from "./disclosure.js";
import type { PriceQuote } from "./price-quote.js";

const naver: PriceQuote = {
  seller: "A마트",
  price: 9900,
  url: "https://shop/1",
  fetchedAt: "t",
  source: "네이버쇼핑",
  affiliate: false,
};
const coupang: PriceQuote = {
  seller: "쿠팡",
  url: "https://link.coupang.com/abc",
  fetchedAt: "t",
  source: "쿠팡",
  affiliate: true,
};

describe("buildAffiliateView — 대가성 문구 강제 (INV-10)", () => {
  it("제휴 링크 없으면 disclosure=null", () => {
    const v = buildAffiliateView([naver]);
    expect(v.disclosure).toBeNull();
    expect(hasAffiliate(v.quotes)).toBe(false);
  });

  it("제휴 링크 있으면 확정형 문구 부착", () => {
    const v = buildAffiliateView([naver, coupang]);
    expect(v.disclosure).toBe(COUPANG_PARTNERS_DISCLOSURE);
    expect(hasAffiliate(v.quotes)).toBe(true);
  });

  it("제휴 링크 있는데 조건부·불확정 문구면 throw", () => {
    expect(() => buildAffiliateView([coupang], "소정의 수수료를 받을 수 있습니다")).toThrow(/INV-10/);
    expect(() => buildAffiliateView([coupang], "수수료를 제공받을 수 있음")).toThrow(/INV-10/);
  });

  it("네이버쇼핑이 노출한 제3자 쿠팡 URL은 제휴로 보지 않는다(허위 문구 금지) — 라이브 회귀", () => {
    // 가격비교 제공자가 link.coupang.com을 affiliate:false로 반환하는 흔한 케이스.
    // 우리는 수수료를 받지 않으므로 대가성 문구를 붙이면 안 된다.
    const naverCoupang: PriceQuote = {
      seller: "쿠팡",
      price: 200,
      url: "https://link.coupang.com/xyz",
      fetchedAt: "t",
      source: "네이버쇼핑",
      affiliate: false,
    };
    expect(hasAffiliate([naverCoupang])).toBe(false);
    expect(buildAffiliateView([naver, naverCoupang]).disclosure).toBeNull();
  });

  it("우리 쿠팡 provider 견적은 플래그 누락이어도 source로 문구 강제(fail-safe)", () => {
    const ourCoupangNoFlag: PriceQuote = {
      seller: "쿠팡",
      url: "https://link.coupang.com/abc",
      fetchedAt: "t",
      source: "쿠팡", // 우리 CoupangPartnersProvider의 source 라벨
      // affiliate 플래그 없음
    };
    expect(hasAffiliate([ourCoupangNoFlag])).toBe(true);
    expect(() => buildAffiliateView([ourCoupangNoFlag], "그냥 안내문")).toThrow(/INV-10/);
  });

  it("뷰는 비영속 마커 동반(INV-4)", () => {
    expect(buildAffiliateView([naver]).__tier2RuntimeOnly).toBe(true);
    expect(buildAffiliateView([naver, coupang]).__tier2RuntimeOnly).toBe(true);
  });
});

describe("isConfirmedDisclosure — allow-list 확정형 판정 (INV-10)", () => {
  it("승인 문구만 통과, 조건부·불확정 변형은 전부 거부", () => {
    expect(isConfirmedDisclosure(COUPANG_PARTNERS_DISCLOSURE)).toBe(true);
    // deny-list가 놓치던 조건부 변형들(B-1) — allow-list로 전부 차단
    expect(isConfirmedDisclosure("상황에 따라 수수료를 제공받을 수도 있으나 보통 제공받습니다")).toBe(false);
    expect(isConfirmedDisclosure("수수료를 받게 될 수 있으며 제공받습니다")).toBe(false);
    expect(isConfirmedDisclosure("간혹 수수료를 제공받습니다")).toBe(false);
    expect(isConfirmedDisclosure("수수료를 제공받을지도 모릅니다")).toBe(false);
    expect(isConfirmedDisclosure("소정의 수수료를 받을 수 있습니다")).toBe(false);
    expect(isConfirmedDisclosure("그냥 안내문")).toBe(false);
  });
  it("공백 변형은 정규화되어 통과", () => {
    expect(isConfirmedDisclosure(`  ${COUPANG_PARTNERS_DISCLOSURE}  `)).toBe(true);
  });
});
