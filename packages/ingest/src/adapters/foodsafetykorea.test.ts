import { describe, expect, it } from "vitest";
import {
  fetchFoodSafetyRows,
  fetchProductReportsByFoodTypes,
  fetchTier1ProductData,
  mapNutritionRow,
  mapProductReportRow,
  mapRecallRow,
} from "./foodsafetykorea.js";
import { nutritionMatchKey } from "../normalize.js";

/** URL 내용으로 응답을 라우팅하는 mock(서비스ID·필터 검증용). nonJson=true면 JSON 파싱 실패 재현. */
function routedFetch(routes: { match: string; payload?: unknown; nonJson?: boolean }[]) {
  const state = { urls: [] as string[] };
  const fn = (async (input: Parameters<typeof fetch>[0]) => {
    const url = String(input);
    state.urls.push(url);
    const route = routes.find((r) => url.includes(r.match));
    if (!route) throw new Error(`라우트 없음: ${url}`);
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => {
        if (route.nonJson) throw new SyntaxError("Unexpected token <");
        return route.payload;
      },
    } as unknown as Response;
  }) as typeof fetch;
  return { fn, state };
}

// 식품안전나라 envelope 형태의 mock 응답.
function envelope(serviceId: string, rows: Record<string, string>[], total = rows.length) {
  return {
    [serviceId]: {
      total_count: String(total),
      RESULT: { CODE: "INFO-000", MSG: "정상" },
      row: rows,
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

describe("fetchFoodSafetyRows — envelope·페이징", () => {
  it("root=SERVICE_ID에서 row 추출, 키는 경로에 삽입", async () => {
    const { fn, state } = mockFetch([envelope("I1250", [{ PRDLST_NM: "신라면" }], 1)]);
    const rows = await fetchFoodSafetyRows("I1250", { serviceKey: "KEY123", fetchImpl: fn });
    expect(rows).toEqual([{ PRDLST_NM: "신라면" }]);
    expect(state.urls[0]).toContain("/KEY123/I1250/json/1/1000");
  });

  it("total_count까지 페이지 루프", async () => {
    const page1 = envelope("I1250", [{ PRDLST_REPORT_NO: "1" }], 2);
    const page2 = envelope("I1250", [{ PRDLST_REPORT_NO: "2" }], 2);
    const { fn, state } = mockFetch([page1, page2]);
    const rows = await fetchFoodSafetyRows("I1250", {
      serviceKey: "K",
      fetchImpl: fn,
      pageSize: 1,
    });
    expect(rows).toHaveLength(2);
    expect(state.calls).toBe(2);
  });

  it("INFO-200(데이터 없음)은 빈 결과로 정상 종료", async () => {
    const { fn } = mockFetch([{ I1250: { RESULT: { CODE: "INFO-200", MSG: "데이터없음" } } }]);
    const rows = await fetchFoodSafetyRows("I1250", { serviceKey: "K", fetchImpl: fn });
    expect(rows).toEqual([]);
  });

  it("오류 코드는 throw", async () => {
    const { fn } = mockFetch([{ I1250: { RESULT: { CODE: "ERROR-300", MSG: "키 오류" } } }]);
    await expect(
      fetchFoodSafetyRows("I1250", { serviceKey: "BAD", fetchImpl: fn }),
    ).rejects.toThrow(/ERROR-300/);
  });

  it("JSON 아닌 응답(인증키 미승인 HTML)은 재시도 소진 후 명확한 메시지로 throw", async () => {
    const { fn, state } = routedFetch([{ match: "/I2790/", nonJson: true }]);
    await expect(
      fetchFoodSafetyRows("I2790", { serviceKey: "K", fetchImpl: fn, retries: 2, retryDelayMs: 0 }),
    ).rejects.toThrow(/인증키 미승인/);
    expect(state.urls.length).toBe(3); // 최초 1 + 재시도 2
  });
});

describe("fetchProductReportsByFoodTypes — 식품유형 서버필터·중복제거·부분성공", () => {
  function env1250(rows: Record<string, string>[]) {
    return {
      I1250: { total_count: String(rows.length), RESULT: { CODE: "INFO-000", MSG: "정상" }, row: rows },
    };
  }

  it("식품유형별 PRDLST_DCNM 필터 경로 + PK 중복 제거", async () => {
    const { fn, state } = mockFetch([
      env1250([
        { PRDLST_REPORT_NO: "1", PRDLST_NM: "신라면", BSSH_NM: "농심" },
        { PRDLST_REPORT_NO: "2", PRDLST_NM: "사리면", BSSH_NM: "x" },
      ]),
      env1250([
        { PRDLST_REPORT_NO: "2", PRDLST_NM: "사리면", BSSH_NM: "x" }, // 건면에도 동일 PK → dedup
        { PRDLST_REPORT_NO: "3", PRDLST_NM: "코레살 라멘", BSSH_NM: "y" },
      ]),
    ]);
    const products = await fetchProductReportsByFoodTypes(["유탕면", "건면"], {
      serviceKey: "K",
      fetchImpl: fn,
    });
    expect(products.map((p) => p.PRDLST_REPORT_NO)).toEqual(["1", "2", "3"]);
    expect(state.urls[0]).toContain(`PRDLST_DCNM=${encodeURIComponent("유탕면")}`);
    expect(state.urls[1]).toContain(`PRDLST_DCNM=${encodeURIComponent("건면")}`);
  });

  it("한 식품유형 실패는 건너뛰고 나머지 수집(부분 성공)", async () => {
    const { fn } = mockFetch([
      { I1250: { RESULT: { CODE: "ERROR-300", MSG: "오류" } } }, // 유탕면 실패
      env1250([{ PRDLST_REPORT_NO: "9", PRDLST_NM: "라멘", BSSH_NM: "z" }]),
    ]);
    const products = await fetchProductReportsByFoodTypes(["유탕면", "건면"], {
      serviceKey: "K",
      fetchImpl: fn,
    });
    expect(products.map((p) => p.PRDLST_REPORT_NO)).toEqual(["9"]);
  });
});

describe("fetchTier1ProductData — 식품유형 필터·영양 강등", () => {
  it("productFoodTypes 지정 + includeNutrition:false → 영양 호출 생략·빈 배열", async () => {
    const { fn, state } = routedFetch([
      {
        match: `PRDLST_DCNM=${encodeURIComponent("유탕면")}`,
        payload: {
          I1250: {
            total_count: "1",
            RESULT: { CODE: "INFO-000" },
            row: [{ PRDLST_REPORT_NO: "1", PRDLST_NM: "신라면", BSSH_NM: "농심" }],
          },
        },
      },
      {
        match: "/I0490/",
        payload: {
          I0490: {
            total_count: "1",
            RESULT: { CODE: "INFO-000" },
            row: [{ PRDTNM: "신라면", BRCDNO: "8801043011286" }],
          },
        },
      },
    ]);
    const { products, recalls, nutritionRows } = await fetchTier1ProductData({
      serviceKey: "K",
      fetchImpl: fn,
      productFoodTypes: ["유탕면"],
      includeNutrition: false,
    });
    expect(products[0]!.PRDLST_NM).toBe("신라면");
    expect(recalls[0]!.BAR_CD).toBe("8801043011286");
    expect(nutritionRows).toEqual([]);
    expect(state.urls.some((u) => u.includes("/I2790/"))).toBe(false); // 영양 호출 안 함
  });

  it("영양(I2790) 미승인(JSON아님) → 빈 배열로 강등, 제품·회수는 정상", async () => {
    const { fn } = routedFetch([
      {
        match: `PRDLST_DCNM=${encodeURIComponent("유탕면")}`,
        payload: {
          I1250: {
            total_count: "1",
            RESULT: { CODE: "INFO-000" },
            row: [{ PRDLST_REPORT_NO: "1", PRDLST_NM: "신라면", BSSH_NM: "농심" }],
          },
        },
      },
      {
        match: "/I0490/",
        payload: { I0490: { total_count: "0", RESULT: { CODE: "INFO-200" } } },
      },
      { match: "/I2790/", nonJson: true },
    ]);
    const { products, recalls, nutritionRows } = await fetchTier1ProductData({
      serviceKey: "K",
      fetchImpl: fn,
      productFoodTypes: ["유탕면"],
      retries: 0, // 재시도 백오프 없이 즉시 강등 확인
    });
    expect(products).toHaveLength(1);
    expect(recalls).toEqual([]);
    expect(nutritionRows).toEqual([]); // 강등(throw 아님)
  });
});

describe("매퍼 — 실제 필드명 → Raw 타입", () => {
  it("mapProductReportRow (I1250, 바코드 없음)", () => {
    const r = mapProductReportRow({
      PRDLST_REPORT_NO: "20210001",
      PRDLST_NM: "신라면",
      BSSH_NM: "농심",
      LCNS_NO: "MFR-NS",
      PRDLST_DCNM: "유탕면",
      PRMS_DT: "20210105",
    });
    expect(r).toEqual({
      PRDLST_REPORT_NO: "20210001",
      PRDLST_NM: "신라면",
      BSSH_NM: "농심",
      LCNS_NO: "MFR-NS",
      PRDLST_DCNM: "유탕면",
      PRMS_DT: "20210105",
    });
    expect(r.BAR_CD).toBeUndefined();
  });

  it("mapRecallRow (I0490 실제 필드명 매핑)", () => {
    const r = mapRecallRow({
      PRDTNM: "진라면 매운맛",
      PRDLST_REPORT_NO: "20210002",
      BRCDNO: "8801045011112",
      BSSHNM: "오뚜기",
      RTRVLPRVNS: "이물 혼입",
      RTRVL_GRDCD_NM: "2등급",
      IMG_FILE_PATH: "https://img/2.jpg",
      CRET_DTM: "20260501",
      RTRVLDSUSE_SEQ: "RC-1",
    });
    expect(r.PRDLST_NM).toBe("진라면 매운맛");
    expect(r.BAR_CD).toBe("8801045011112");
    expect(r.RTRVL_RESN).toBe("이물 혼입");
    expect(r.IMG_URL).toBe("https://img/2.jpg");
    expect(r.SEQ).toBe("RC-1");
  });
});

describe("mapNutritionRow (I2790, 식품명+제조사 키 — ADR-0007)", () => {
  it("NUTR_CONT 매핑 + matchKey, productId 없음", () => {
    const r = mapNutritionRow({
      DESC_KOR: "신라면",
      MAKER_NAME: "농심",
      NUTR_CONT1: "505",
      NUTR_CONT2: "79",
      NUTR_CONT3: "11",
      NUTR_CONT4: "16",
      NUTR_CONT6: "1790",
    });
    expect(r.matchKey).toBe(nutritionMatchKey("신라면", "농심"));
    expect(r.productId).toBeUndefined();
    expect(r.nutrition?.energyKcal).toBe(505);
    expect(r.nutrition?.sodiumMg).toBe(1790);
  });
  it("필수 4종 결측이면 nutrition=null", () => {
    const r = mapNutritionRow({ DESC_KOR: "x", MAKER_NAME: "y", NUTR_CONT1: "100" });
    expect(r.nutrition).toBeNull();
  });
});

describe("fetchTier1ProductData — 제품+회수+영양 동시 수집", () => {
  it("세 서비스 조회 후 매핑(영양은 matchKey)", async () => {
    const { fn } = mockFetch([
      envelope("I1250", [{ PRDLST_REPORT_NO: "20210001", PRDLST_NM: "신라면", BSSH_NM: "농심" }], 1),
      envelope("I0490", [{ PRDTNM: "신라면", BRCDNO: "8801043011286" }], 1),
      envelope(
        "I2790",
        [{ DESC_KOR: "신라면", MAKER_NAME: "농심", NUTR_CONT1: "505", NUTR_CONT2: "79", NUTR_CONT3: "11", NUTR_CONT4: "16" }],
        1,
      ),
    ]);
    const { products, recalls, nutritionRows } = await fetchTier1ProductData({
      serviceKey: "K",
      fetchImpl: fn,
    });
    expect(products[0]!.PRDLST_NM).toBe("신라면");
    expect(recalls[0]!.BAR_CD).toBe("8801043011286");
    expect(nutritionRows[0]!.matchKey).toBe(nutritionMatchKey("신라면", "농심"));
    expect(nutritionRows[0]!.nutrition?.energyKcal).toBe(505);
  });
});
