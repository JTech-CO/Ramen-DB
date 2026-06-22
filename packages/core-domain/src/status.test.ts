import { describe, expect, it } from "vitest";
import type { ProductDraft, RecallEvent } from "./types.js";
import {
  deriveAndFinalize,
  deriveProductStatus,
  deriveStatus,
  recallMatchReport,
} from "./status.js";
import { assertStatusInfo, isEstimated, statusDisplayLabel } from "./invariants.js";

function recall(kind: "RECALL" | "SALES_HALT", over: Partial<RecallEvent> = {}): RecallEvent {
  return { id: "RC", reason: "사유", kind, reportedAt: "2026-05-01", source: "RECALL", ...over };
}

function makeDraft(over: Partial<ProductDraft> = {}): ProductDraft {
  return {
    id: "20210001",
    name: "신라면",
    packageType: "BAG",
    manufacturerId: "MFR-NS",
    nutrition: null,
    sourceRefs: ["PRODUCT_REPORT"],
    updatedAt: "2026-06-18",
    manufacturerStatus: "ACTIVE",
    recallEvents: [],
    ...over,
  };
}

describe("deriveStatus — 우선순위 규칙 (M2 DoD #1)", () => {
  it("① 회수 → RECALLED high", () => {
    expect(
      deriveStatus({
        recallEvents: [recall("RECALL")],
        manufacturerStatus: "ACTIVE",
        presentInCurrentRoster: true,
        consecutiveAbsence: 0,
      }),
    ).toEqual({ status: "RECALLED", statusSource: "RECALL", statusConfidence: "high" });
  });

  it("① 판매중지만 → SALES_HALTED high", () => {
    const r = deriveStatus({
      recallEvents: [recall("SALES_HALT")],
      manufacturerStatus: "ACTIVE",
      presentInCurrentRoster: true,
      consecutiveAbsence: 0,
    });
    expect(r.status).toBe("SALES_HALTED");
    expect(r.statusConfidence).toBe("high");
  });

  it("① 회수+판매중지 동시 → RECALLED 우선", () => {
    expect(
      deriveStatus({
        recallEvents: [recall("SALES_HALT", { id: "a" }), recall("RECALL", { id: "b" })],
        manufacturerStatus: "ACTIVE",
        presentInCurrentRoster: true,
        consecutiveAbsence: 0,
      }).status,
    ).toBe("RECALLED");
  });

  it("② 제조사 폐업 → DISCONTINUED? medium", () => {
    expect(
      deriveStatus({
        recallEvents: [],
        manufacturerStatus: "CLOSED",
        presentInCurrentRoster: true,
        consecutiveAbsence: 0,
      }),
    ).toEqual({
      status: "DISCONTINUED?",
      statusSource: "MANUFACTURER_CLOSURE",
      statusConfidence: "medium",
    });
  });

  it("③ 스냅샷 연속 부재(임계 이상) → DISCONTINUED? low", () => {
    expect(
      deriveStatus({
        recallEvents: [],
        manufacturerStatus: "ACTIVE",
        presentInCurrentRoster: false,
        consecutiveAbsence: 2,
      }),
    ).toEqual({
      status: "DISCONTINUED?",
      statusSource: "SNAPSHOT_ABSENCE",
      statusConfidence: "low",
    });
  });

  it("③ 부재가 임계 미만이면 아직 단종 아님 → ON_SALE", () => {
    expect(
      deriveStatus({
        recallEvents: [],
        manufacturerStatus: "ACTIVE",
        presentInCurrentRoster: false,
        consecutiveAbsence: 1,
      }).status,
    ).toBe("ON_SALE");
  });

  it("④ 신호 없음(로스터 존재) → ON_SALE high", () => {
    expect(
      deriveStatus({
        recallEvents: [],
        manufacturerStatus: "ACTIVE",
        presentInCurrentRoster: true,
        consecutiveAbsence: 0,
      }),
    ).toEqual({ status: "ON_SALE", statusSource: "PRODUCT_REPORT", statusConfidence: "high" });
  });

  it("우선순위: 회수 > 폐업 (폐업이어도 회수면 RECALLED high)", () => {
    expect(
      deriveStatus({
        recallEvents: [recall("RECALL")],
        manufacturerStatus: "CLOSED",
        presentInCurrentRoster: true,
        consecutiveAbsence: 5,
      }).status,
    ).toBe("RECALLED");
  });

  it("우선순위: 폐업(medium) > 부재(low)", () => {
    const r = deriveStatus({
      recallEvents: [],
      manufacturerStatus: "CLOSED",
      presentInCurrentRoster: false,
      consecutiveAbsence: 9,
    });
    expect(r.statusConfidence).toBe("medium");
    expect(r.statusSource).toBe("MANUFACTURER_CLOSURE");
  });
});

describe("INV-6 — 모든 status는 source·confidence 동반 (M2 DoD #2)", () => {
  const signalsList = [
    makeDraft({ recallEvents: [recall("RECALL")] }),
    makeDraft({ manufacturerStatus: "CLOSED" }),
    makeDraft(),
  ];
  it("도출 결과가 항상 INV-6 충족(assertStatusInfo 통과)", () => {
    for (const d of signalsList) {
      const info = deriveProductStatus(d);
      expect(() => assertStatusInfo(info)).not.toThrow();
      expect(info.statusSource).toBeTruthy();
      expect(info.statusConfidence).toBeTruthy();
    }
  });
  it("finalizeProduct → status 3필드 포함 RamenProduct", () => {
    const p = deriveAndFinalize(makeDraft({ manufacturerStatus: "CLOSED" }));
    expect(p.status).toBe("DISCONTINUED?");
    expect(p.statusSource).toBe("MANUFACTURER_CLOSURE");
    expect(p.statusConfidence).toBe("medium");
    expect(p.sourceRefs).toContain("PRODUCT_REPORT");
  });
});

describe("INV-6 — confidence<high는 '추정' 표기 (M2 DoD #3)", () => {
  it("high는 단정, high 미만은 '추정' 마킹", () => {
    expect(statusDisplayLabel("ON_SALE", "high")).toBe("판매중");
    expect(statusDisplayLabel("RECALLED", "high")).toBe("회수");
    expect(statusDisplayLabel("SALES_HALTED", "high")).toBe("판매중지");
    expect(statusDisplayLabel("DISCONTINUED?", "medium")).toBe("단종 추정");
    expect(statusDisplayLabel("DISCONTINUED?", "low")).toBe("단종 추정");
    expect(isEstimated("high")).toBe(false);
    expect(isEstimated("medium")).toBe(true);
    expect(isEstimated("low")).toBe(true);
  });

  it("DISCONTINUED?는 단정형('단종됨')으로 표기되지 않는다", () => {
    const p = deriveAndFinalize(makeDraft({ manufacturerStatus: "CLOSED" }));
    const label = statusDisplayLabel(p.status, p.statusConfidence);
    expect(label).toContain("추정");
    expect(label).not.toBe("단종");
  });
});

describe("recallMatchReport — 매칭 일치율 (M2 DoD #4)", () => {
  it("번호/바코드 매칭 분류와 미매칭 집계", () => {
    const drafts: ProductDraft[] = [
      makeDraft({ id: "20210001", barcode: "BC1" }),
      makeDraft({ id: "20210002" }),
    ];
    const recalls: RecallEvent[] = [
      recall("RECALL", { id: "r1", productId: "20210001" }), // 번호
      recall("SALES_HALT", { id: "r2", barcode: "BC1" }), // 바코드
      recall("RECALL", { id: "r3", productId: "99999999" }), // 미매칭
      recall("RECALL", { id: "r4", barcode: "BCX" }), // 미매칭
    ];
    const rep = recallMatchReport(recalls, drafts);
    expect(rep.totalRecalls).toBe(4);
    expect(rep.matchedByNumber).toBe(1);
    expect(rep.matchedByBarcode).toBe(1);
    expect(rep.matched).toBe(2);
    expect(rep.unmatched).toBe(2);
    expect(rep.matchRate).toBeCloseTo(0.5, 5);
    expect(rep.unmatchedIds).toEqual(["r3", "r4"]);
  });
});
