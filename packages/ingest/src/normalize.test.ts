import { describe, expect, it } from "vitest";
import {
  inferPackageType,
  normalizeBarcode,
  normalizeClosure,
  normalizeDate,
  normalizeNutrition,
  normalizeProductReport,
  normalizeRecall,
  parseNum,
} from "./normalize.js";
import { RAW_PRODUCTS, RAW_NUTRITION, RAW_RECALLS } from "./__fixtures__/sample.js";

describe("parseNum", () => {
  it("콤마·공백 처리, 빈값·비수치는 undefined", () => {
    expect(parseNum("1,234")).toBe(1234);
    expect(parseNum(" 525 ")).toBe(525);
    expect(parseNum("")).toBeUndefined();
    expect(parseNum("abc")).toBeUndefined();
    expect(parseNum(undefined)).toBeUndefined();
  });
  it("단위 접미사 붙은 수치는 선행 숫자 추출", () => {
    expect(parseNum("12g")).toBe(12);
    expect(parseNum("1,790mg")).toBe(1790);
    expect(parseNum("505 kcal")).toBe(505);
  });
  it("16진수/지수표기를 그대로 수용하지 않음", () => {
    expect(parseNum("0x10")).toBe(0); // 선행 '0'만 — 16이 아님
    expect(parseNum("1e3")).toBe(1); // 선행 '1'만 — 1000이 아님
  });
});

describe("normalizeBarcode", () => {
  it("숫자만 추출, 빈 값은 undefined", () => {
    expect(normalizeBarcode("8801043011286")).toBe("8801043011286");
    expect(normalizeBarcode(" 8801043-011286 ")).toBe("8801043011286");
    expect(normalizeBarcode("")).toBeUndefined();
    expect(normalizeBarcode("abc")).toBeUndefined();
    expect(normalizeBarcode(undefined)).toBeUndefined();
  });
});

describe("normalizeDate", () => {
  it("YYYYMMDD/대시/undefined", () => {
    expect(normalizeDate("20210105")).toBe("2021-01-05");
    expect(normalizeDate("2021-01-05")).toBe("2021-01-05");
    expect(normalizeDate(undefined)).toBeUndefined();
  });
  it("월/일 범위 무효는 ISO로 만들지 않고 undefined", () => {
    expect(normalizeDate("20261301")).toBeUndefined(); // 13월
    expect(normalizeDate("20260000")).toBeUndefined(); // 00월 00일
    expect(normalizeDate("2026-13-99")).toBeUndefined();
    expect(normalizeDate("not-a-date")).toBeUndefined();
  });
});

describe("inferPackageType", () => {
  it("컵/용기/사발 힌트 → CUP, 그 외 BAG", () => {
    expect(inferPackageType("오뚜기 컵라면 김치")).toBe("CUP");
    expect(inferPackageType("왕뚜껑 큰사발면")).toBe("CUP");
    expect(inferPackageType("신라면")).toBe("BAG");
  });
});

describe("normalizeProductReport", () => {
  it("필드 매핑·PK·packageType", () => {
    const p1 = normalizeProductReport(RAW_PRODUCTS[0]!);
    expect(p1.id).toBe("20210001");
    expect(p1.manufacturerId).toBe("MFR-NS");
    expect(p1.foodType).toBe("유탕면");
    expect(p1.barcode).toBe("8801043011286");
    expect(p1.packageType).toBe("BAG");
  });

  it("품목제조보고번호 공백 변형을 trim (RUNBOOK 6)", () => {
    const p = normalizeProductReport({
      PRDLST_REPORT_NO: "  20210001  ",
      PRDLST_NM: "신라면",
      BSSH_NM: "농심",
      LCNS_NO: "MFR-NS",
      PRDLST_DCNM: "유탕면",
    });
    expect(p.id).toBe("20210001");
  });

  it("LCNS_NO 없으면 업소명 기반 안정 키", () => {
    const p = normalizeProductReport({
      PRDLST_REPORT_NO: "X",
      PRDLST_NM: "면",
      BSSH_NM: "어떤회사",
    });
    expect(p.manufacturerId).toBe("BSSH:어떤회사");
  });
});

describe("normalizeNutrition", () => {
  it("필수 4종 매핑, 미제공 선택 필드는 키 자체가 없음", () => {
    const p2 = normalizeNutrition(RAW_NUTRITION[1]!); // 20210002, SUGAR 미제공
    expect(p2.productId).toBe("20210002");
    expect(p2.nutrition).not.toBeNull();
    expect(p2.nutrition!.energyKcal).toBe(500);
    expect(p2.nutrition!.sodiumMg).toBe(1700);
    expect("sugarG" in p2.nutrition!).toBe(false);
    expect("cholesterolMg" in p2.nutrition!).toBe(false);
  });

  it("공백 키도 정규화되어 매칭 가능", () => {
    const p1 = normalizeNutrition(RAW_NUTRITION[0]!); // " 20210001 "
    expect(p1.productId).toBe("20210001");
    expect(p1.nutrition!.energyKcal).toBe(505);
  });

  it("필수 4종 중 하나라도 결측이면 nutrition=null (0 날조 금지)", () => {
    const missing = normalizeNutrition({
      PRDLST_REPORT_NO: "20219999",
      NUT_CONT_SRTR_QUA: "100g",
      ENERC: "500",
      CHOCDF: "80",
      PROT: "N/A", // 비수치
      FATCE: "15",
    });
    expect(missing.nutrition).toBeNull();
  });
});

describe("normalizeRecall", () => {
  it("판매중지 → SALES_HALT, 번호·바코드·이미지·등급", () => {
    const r1 = normalizeRecall(RAW_RECALLS[0]!, 0);
    expect(r1.kind).toBe("SALES_HALT");
    expect(r1.productId).toBe("20210002");
    expect(r1.barcode).toBe("8801045011112");
    expect(r1.imageUrl).toBe("https://example.go.kr/img/20210002.jpg");
    expect(r1.grade).toBe("2등급");
    expect(r1.source).toBe("RECALL");
  });

  it("회수 → RECALL, 번호 없으면 productId undefined", () => {
    const r2 = normalizeRecall(RAW_RECALLS[1]!, 1);
    expect(r2.kind).toBe("RECALL");
    expect(r2.productId).toBeUndefined();
    expect(r2.barcode).toBe("8801043011286");
  });
});

describe("normalizeClosure", () => {
  it("폐업 → CLOSED, 영업 → ACTIVE", () => {
    expect(normalizeClosure({ LCNS_NO: "MFR-CL", BSN_STATE_NM: "폐업" }).businessStatus).toBe(
      "CLOSED",
    );
    expect(normalizeClosure({ LCNS_NO: "MFR-NS", BSN_STATE_NM: "영업/정상" }).businessStatus).toBe(
      "ACTIVE",
    );
  });
});
