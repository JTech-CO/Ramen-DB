import { describe, expect, it } from "vitest";
import { contentHash } from "@ramen/shared";
import { joinProducts, type JoinInputs } from "./join.js";
import {
  normalizeClosure,
  normalizeNutrition,
  normalizeProductReport,
  normalizeRecall,
  nutritionMatchKey,
} from "./normalize.js";
import type { CorrectionList } from "./correction-list.js";
import {
  AS_OF,
  RAW_CLOSURES,
  RAW_NUTRITION,
  RAW_PRODUCTS,
  RAW_RECALLS,
} from "./__fixtures__/sample.js";

const CORRECTIONS: CorrectionList = {
  version: "test",
  include: ["20210008"],
  exclude: ["20210009"],
};

function buildInputs(): JoinInputs {
  return {
    products: RAW_PRODUCTS.map(normalizeProductReport),
    nutritions: RAW_NUTRITION.map(normalizeNutrition),
    recalls: RAW_RECALLS.map(normalizeRecall),
    closures: RAW_CLOSURES.map(normalizeClosure),
    corrections: CORRECTIONS,
  };
}

const result = joinProducts(buildInputs(), { asOf: AS_OF });
const get = (id: string) => result.products.find((p) => p.id === id)!;

describe("joinProducts — 도메인 필터 + 조인", () => {
  it("라면만 남고 PK 정렬(결정론 순서)", () => {
    expect(result.products.map((p) => p.id)).toEqual([
      "20210001",
      "20210002",
      "20210003",
      "20210006",
      "20210008",
    ]);
  });

  it("결정론: 동일 입력 2회 → 동일 산출(해시 일치) — INV-7 토대", () => {
    const again = joinProducts(buildInputs(), { asOf: AS_OF });
    expect(again.products).toEqual(result.products);
    expect(contentHash(again.products)).toBe(contentHash(result.products));
  });

  it("DoD#3 영양 미커버 제품은 nutrition=null (빈칸 미채움, Q2 갭)", () => {
    expect(get("20210006").nutrition).toBeNull();
    expect(get("20210001").nutrition).not.toBeNull();
    expect(result.report.nutritionMatched).toBe(4);
    expect(result.report.nutritionMissing).toBe(1);
    expect(result.report.nutritionCoverage).toBeCloseTo(0.8, 5);
  });

  it("DoD#4 모든 레코드 sourceRefs 채워짐(INV-9), PRODUCT_REPORT 포함", () => {
    for (const p of result.products) {
      expect(p.sourceRefs.length).toBeGreaterThan(0);
      expect(p.sourceRefs).toContain("PRODUCT_REPORT");
    }
    expect(get("20210001").sourceRefs).toEqual([
      "PRODUCT_REPORT",
      "NUTRITION",
      "RECALL",
      "MANUFACTURER_CLOSURE",
    ]);
    expect(get("20210002").sourceRefs).toEqual(["PRODUCT_REPORT", "NUTRITION", "RECALL"]);
    expect(get("20210003").sourceRefs).toEqual(["PRODUCT_REPORT", "NUTRITION"]);
    expect(get("20210006").sourceRefs).toEqual(["PRODUCT_REPORT", "MANUFACTURER_CLOSURE"]);
  });

  it("바코드 보강: P2는 회수 피드 바코드로 채워짐", () => {
    expect(get("20210002").barcode).toBe("8801045011112");
    expect(result.report.barcodeEnriched).toBe(1);
  });

  it("회수 매칭: 번호(P2)·바코드(P1) 둘 다, 카운트=2", () => {
    expect(get("20210001").recallEvents.map((r) => r.id)).toEqual(["RC-0002"]);
    expect(get("20210002").recallEvents.map((r) => r.id)).toEqual(["RC-0001"]);
    expect(result.report.recallMatchedProducts).toBe(2);
  });

  it("이미지 보강: 회수 피드 제공분", () => {
    expect(get("20210002").imageUrl).toBe("https://example.go.kr/img/20210002.jpg");
    expect(get("20210001").imageUrl).toBeUndefined();
  });

  it("제조사 폐업 상태 결합", () => {
    expect(get("20210006").manufacturerStatus).toBe("CLOSED");
    expect(get("20210001").manufacturerStatus).toBe("ACTIVE");
    expect(result.report.manufacturersClosed).toBe(1);
  });

  it("updatedAt은 asOf 주입(결정론)", () => {
    expect(get("20210001").updatedAt).toBe(AS_OF);
  });
});

describe("INV-5 — 빈/공백 PK 드롭 (조인 키 오염 차단)", () => {
  it("PRDLST_REPORT_NO가 빈/공백인 제품은 산출에서 제외되고 영양 교차오염 없음", () => {
    const products = [
      { PRDLST_REPORT_NO: "", PRDLST_NM: "유령라면", BSSH_NM: "A", LCNS_NO: "M1", PRDLST_DCNM: "유탕면" },
      { PRDLST_REPORT_NO: "   ", PRDLST_NM: "공백라면", BSSH_NM: "B", LCNS_NO: "M2", PRDLST_DCNM: "유탕면" },
      { PRDLST_REPORT_NO: "20210001", PRDLST_NM: "신라면", BSSH_NM: "농심", LCNS_NO: "MFR-NS", PRDLST_DCNM: "유탕면" },
    ].map(normalizeProductReport);
    // 빈 키 영양행(교차오염 유발 시도)
    const nutritions = [
      normalizeNutrition({ PRDLST_REPORT_NO: "", ENERC: "999", CHOCDF: "99", PROT: "99", FATCE: "99" }),
      normalizeNutrition({ PRDLST_REPORT_NO: "20210001", ENERC: "505", CHOCDF: "79", PROT: "11", FATCE: "16" }),
    ];
    const r = joinProducts(
      { products, nutritions, recalls: [], closures: [], corrections: CORRECTIONS },
      { asOf: AS_OF },
    );
    expect(r.products.map((p) => p.id)).toEqual(["20210001"]); // 빈 PK 2건 드롭
    expect(r.products[0]!.nutrition!.energyKcal).toBe(505); // 999 오염 없음
  });
});

describe("영양 식품명+제조사 매칭 (ADR-0007, 라이브 I2790)", () => {
  it("PK 영양이 없어도 식품명+제조사로 영양 조인", () => {
    const products = [
      normalizeProductReport({
        PRDLST_REPORT_NO: "30000001",
        PRDLST_NM: "왕뚜껑 큰사발면",
        BSSH_NM: "한국야쿠르트",
        LCNS_NO: "M9",
        PRDLST_DCNM: "유탕면",
      }),
    ];
    // 라이브 영양 행: productId 없이 matchKey만(I2790).
    const nutritionRows = [
      {
        matchKey: nutritionMatchKey("왕뚜껑 큰사발면", "한국야쿠르트"),
        nutrition: { servingBasis: "100g", energyKcal: 450, carbG: 70, proteinG: 9, fatG: 14 },
      },
    ];
    const r = joinProducts(
      { products, nutritions: nutritionRows, recalls: [], closures: [], corrections: CORRECTIONS },
      { asOf: AS_OF },
    );
    expect(r.products[0]!.nutrition?.energyKcal).toBe(450);
    expect(r.products[0]!.sourceRefs).toContain("NUTRITION");
    expect(r.report.nutritionMatched).toBe(1);
  });
});

describe("INV-5 — 품목제조보고번호 PK 안정성 (M1 DoD #2)", () => {
  it("제품명만 바뀐 리뉴얼에도 동일 PK·레코드 연속성", () => {
    const renamedRaw = RAW_PRODUCTS.map((p) =>
      p.PRDLST_REPORT_NO === "20210001" ? { ...p, PRDLST_NM: "신라면 (대용량 리뉴얼)" } : p,
    );
    const renamed = joinProducts(
      { ...buildInputs(), products: renamedRaw.map(normalizeProductReport) },
      { asOf: AS_OF },
    );
    const orig = get("20210001");
    const ren = renamed.products.find((p) => p.id === "20210001")!;

    expect(ren.id).toBe(orig.id); // PK 불변
    expect(ren.name).toBe("신라면 (대용량 리뉴얼)"); // 이름은 변동(비키)
    expect(ren.manufacturerId).toBe(orig.manufacturerId); // 제조사 연속
    expect(ren.packageType).toBe(orig.packageType);
    expect(ren.sourceRefs).toEqual(orig.sourceRefs);
  });
});
