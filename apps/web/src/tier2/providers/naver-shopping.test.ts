import { describe, expect, it } from "vitest";
import { NaverShoppingProvider, loadNaverCredentials } from "./naver-shopping.js";
import { makeFetch } from "../__fixtures__/mock-fetch.js";

const clock = () => Date.parse("2026-06-18T00:00:00.000Z");
const creds = { clientId: "id", clientSecret: "sec" };

describe("NaverShoppingProvider", () => {
  it("응답 → PriceQuote 정규화 + 출처·조회시각(INV-9), 태그 제거, 가격 없는 항목 제외", async () => {
    const { fn } = makeFetch({
      items: [
        { title: "<b>신라면</b> 멀티팩", link: "https://shop/1", lprice: "12900", mallName: "A마트" },
        { title: "신라면", link: "https://shop/2", lprice: "9900", mallName: "<b>B</b>몰" },
        { title: "가격없음", link: "https://shop/3" }, // lprice 없음 → 제외
      ],
    });
    const p = new NaverShoppingProvider(creds);
    const quotes = await p.search({ name: "신라면" }, { fetchImpl: fn, clock });

    expect(quotes).toHaveLength(2);
    expect(quotes[0]).toMatchObject({
      seller: "A마트",
      price: 12900,
      url: "https://shop/1",
      source: "네이버쇼핑",
      affiliate: false,
    });
    expect(quotes[1]!.seller).toBe("B몰"); // 태그 제거
    for (const q of quotes) {
      expect(q.source).toBe("네이버쇼핑");
      expect(q.fetchedAt).toBe("2026-06-18T00:00:00.000Z"); // 조회시각(INV-9)
    }
  });

  it("바코드가 있으면 바코드로 질의", async () => {
    const { fn, state } = makeFetch({ items: [] });
    const p = new NaverShoppingProvider(creds);
    await p.search({ barcode: "8801043011286", name: "신라면" }, { fetchImpl: fn, clock });
    expect(state.lastUrl).toContain("query=8801043011286");
  });

  it("non-ok 응답은 throw", async () => {
    const { fn } = makeFetch({}, false);
    const p = new NaverShoppingProvider(creds);
    await expect(p.search({ name: "x" }, { fetchImpl: fn })).rejects.toThrow(/네이버쇼핑 조회 실패/);
  });

  it("자격 미설정 시 throw, 설정 시 로드 (INV-1)", () => {
    expect(() => loadNaverCredentials({})).toThrow(/NAVER_SEARCH/);
    expect(
      loadNaverCredentials({ NAVER_SEARCH_CLIENT_ID: "a", NAVER_SEARCH_CLIENT_SECRET: "b" }),
    ).toEqual({ clientId: "a", clientSecret: "b" });
  });
});
