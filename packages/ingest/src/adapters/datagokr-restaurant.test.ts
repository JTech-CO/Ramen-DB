import { describe, expect, it } from "vitest";
import { fetchGeneralRestaurants, mapRestaurantRow } from "./datagokr-restaurant.js";

/** 표준 data.go.kr envelope. */
function envelope(rows: Record<string, string | null>[], total = rows.length, code = "0") {
  return {
    response: {
      header: { resultCode: code, resultMsg: code === "0" ? "정상" : "오류" },
      body: { items: rows, totalCount: String(total) },
    },
  };
}

function mockFetch(payloads: unknown[]) {
  const state = { calls: 0, urls: [] as string[] };
  const fn = (async (input: Parameters<typeof fetch>[0]) => {
    const i = state.calls;
    state.calls++;
    state.urls.push(String(input));
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => payloads[Math.min(i, payloads.length - 1)],
    } as unknown as Response;
  }) as typeof fetch;
  return { fn, state };
}

describe("mapRestaurantRow — data.go.kr 일반음식점 필드 → RawRestaurant", () => {
  it("실응답 필드 매핑(2026-06-23 확정)", () => {
    const r = mapRestaurantRow({
      MNG_NO: "6520000-101-2026-00199",
      BPLC_NM: "멘야 산다이메",
      ROAD_NM_ADDR: "서울 강남구 ...",
      LOTNO_ADDR: "서울 강남구 역삼동 ...",
      CRD_INFO_X: "200123.4",
      CRD_INFO_Y: "450123.4",
      SALS_STTS_NM: "영업/정상",
      DTL_SALS_STTS_NM: "영업",
      BZSTAT_SE_NM: "일식",
      LCPMT_YMD: "2020-03-01",
    });
    expect(r.MGTNO).toBe("6520000-101-2026-00199");
    expect(r.BPLCNM).toBe("멘야 산다이메");
    expect(r.RDNWHLADDR).toBe("서울 강남구 ...");
    expect(r.SITEWHLADDR).toBe("서울 강남구 역삼동 ...");
    expect(r.X).toBe("200123.4");
    expect(r.Y).toBe("450123.4");
    expect(r.TRDSTATENM).toBe("영업/정상");
    expect(r.DTLSTATENM).toBe("영업");
    expect(r.UPTAENM).toBe("일식");
    expect(r.APVPERMYMD).toBe("2020-03-01");
  });

  it("null·빈 문자열 필드는 생략(빈칸 미채움)", () => {
    const r = mapRestaurantRow({ MNG_NO: "1", BPLC_NM: "x", CRD_INFO_X: null, ROAD_NM_ADDR: "" });
    expect(r.X).toBeUndefined();
    expect(r.Y).toBeUndefined();
    expect(r.RDNWHLADDR).toBeUndefined();
  });
});

describe("fetchGeneralRestaurants — 페이지네이션·상한·중복·오류", () => {
  it("serviceKey 쿼리·페이지 파라미터·여러 페이지 수집", async () => {
    const { fn, state } = mockFetch([
      envelope([{ MNG_NO: "1", BPLC_NM: "a" }, { MNG_NO: "2", BPLC_NM: "b" }], 100),
      envelope([{ MNG_NO: "3", BPLC_NM: "c" }], 100), // rows < numOfRows → 마지막
    ]);
    const out = await fetchGeneralRestaurants({ serviceKey: "K", fetchImpl: fn, numOfRows: 2 });
    expect(out.map((r) => r.MGTNO)).toEqual(["1", "2", "3"]);
    expect(state.urls[0]).toContain("serviceKey=K");
    expect(state.urls[0]).toContain("pageNo=1");
    expect(state.urls[0]).toContain("numOfRows=2");
  });

  it("maxRows 상한에서 중단", async () => {
    const { fn } = mockFetch([
      envelope([{ MNG_NO: "1", BPLC_NM: "a" }, { MNG_NO: "2", BPLC_NM: "b" }], 100),
      envelope([{ MNG_NO: "3", BPLC_NM: "c" }, { MNG_NO: "4", BPLC_NM: "d" }], 100),
    ]);
    const out = await fetchGeneralRestaurants({ serviceKey: "K", fetchImpl: fn, numOfRows: 2, maxRows: 3 });
    expect(out.map((r) => r.MGTNO)).toEqual(["1", "2", "3"]);
  });

  it("관리번호 중복 제거", async () => {
    const { fn } = mockFetch([
      envelope([{ MNG_NO: "1", BPLC_NM: "a" }, { MNG_NO: "1", BPLC_NM: "a" }], 2),
      envelope([], 2), // 빈 페이지 → 종료
    ]);
    const out = await fetchGeneralRestaurants({ serviceKey: "K", fetchImpl: fn, numOfRows: 2 });
    expect(out.map((r) => r.MGTNO)).toEqual(["1"]);
  });

  it("items.item 중첩형도 추출", async () => {
    const { fn } = mockFetch([
      { response: { header: { resultCode: "0" }, body: { items: { item: [{ MNG_NO: "9", BPLC_NM: "z" }] }, totalCount: "1" } } },
    ]);
    const out = await fetchGeneralRestaurants({ serviceKey: "K", fetchImpl: fn, numOfRows: 100 });
    expect(out.map((r) => r.MGTNO)).toEqual(["9"]);
  });

  it("resultCode 오류는 첫 페이지면 throw", async () => {
    const { fn } = mockFetch([envelope([], 0, "30")]);
    await expect(
      fetchGeneralRestaurants({ serviceKey: "BAD", fetchImpl: fn, retries: 0 }),
    ).rejects.toThrow(/30/);
  });
});

/** 동작 시퀀스 mock: "throw" 또는 payload를 호출 순서대로 반환. */
function seqFetch(behaviors: (unknown | "throw")[]) {
  const state = { calls: 0 };
  const fn = (async () => {
    const b = behaviors[Math.min(state.calls, behaviors.length - 1)];
    state.calls++;
    if (b === "throw") throw new Error("simulated timeout");
    return { ok: true, status: 200, statusText: "OK", json: async () => b } as unknown as Response;
  }) as typeof fetch;
  return { fn, state };
}

describe("fetchGeneralRestaurants — 게이트웨이 장애 내성", () => {
  it("한 페이지 실패는 건너뛰고 계속(전체 중단 안 함)", async () => {
    const { fn } = seqFetch(["throw", envelope([{ MNG_NO: "5", BPLC_NM: "z" }], 1)]);
    const out = await fetchGeneralRestaurants({ serviceKey: "K", fetchImpl: fn, retries: 0 });
    expect(out.map((r) => r.MGTNO)).toEqual(["5"]); // page1 실패 스킵, page2 수집 후 마지막
  });

  it("연속 실패 한계 초과 시 부분 결과로 중단(throw 안 함)", async () => {
    const { fn, state } = seqFetch(["throw"]); // 항상 실패
    const out = await fetchGeneralRestaurants({ serviceKey: "K", fetchImpl: fn, retries: 0 });
    expect(out).toEqual([]); // crash 아님
    expect(state.calls).toBe(3); // 연속 3회 후 중단
  });
});
