import { describe, expect, it } from "vitest";
import { createProvidersFromEnv } from "./provider-factory.js";

describe("createProvidersFromEnv — 키 있는 provider만 구성 (INV-1)", () => {
  it("네이버+쿠팡 키 모두 → 2개", () => {
    const ps = createProvidersFromEnv({
      NAVER_SEARCH_CLIENT_ID: "a",
      NAVER_SEARCH_CLIENT_SECRET: "b",
      COUPANG_PARTNERS_ACCESS_KEY: "c",
      COUPANG_PARTNERS_SECRET_KEY: "d",
    });
    expect(ps.map((p) => p.source).sort()).toEqual(["네이버쇼핑", "쿠팡"]);
  });

  it("네이버 키만 → 네이버만", () => {
    const ps = createProvidersFromEnv({
      NAVER_SEARCH_CLIENT_ID: "a",
      NAVER_SEARCH_CLIENT_SECRET: "b",
    });
    expect(ps.map((p) => p.source)).toEqual(["네이버쇼핑"]);
  });

  it("키 없음 → 빈 배열(부분 구성 허용)", () => {
    expect(createProvidersFromEnv({})).toEqual([]);
  });
});
