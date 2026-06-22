// 조인 — 품목제조보고번호(PK)로 제품+영양+회수+제조사상태 병합 → ProductDraft.
// 바코드 보강(회수 피드), 영양 미커버 시 nutrition=null, sourceRefs 채움(INV-9).
// 순수·결정론: 동일 입력 → 동일 출력(updatedAt는 asOf로 주입, INV-7 정합).

import type { ProductDraft, RecallEvent, SourceRef } from "@ramen/core-domain";
import { isValidProductId, normalizeProductId } from "@ramen/core-domain";
import { compareCodeUnits } from "@ramen/shared";
import type { CorrectionList } from "./correction-list.js";
import { filterRamenProducts } from "./domain-filter.js";
import { nutritionMatchKey } from "./normalize.js";
import type { NormalizedClosure, NormalizedNutritionRow, NormalizedProduct } from "./normalize.js";

export interface JoinInputs {
  /** 정규화된 전체 제품(조인이 라면 도메인 필터를 적용) */
  products: NormalizedProduct[];
  nutritions: NormalizedNutritionRow[];
  recalls: RecallEvent[];
  closures: NormalizedClosure[];
  corrections: CorrectionList;
}

export interface JoinOptions {
  /** 스냅샷 기준시각 ISO — updatedAt에 주입(결정론) */
  asOf: string;
}

export interface JoinReport {
  ramenProducts: number;
  nutritionMatched: number;
  /** 영양 DB 미커버(nutrition=null) — Q2 커버리지 갭 */
  nutritionMissing: number;
  nutritionCoverage: number;
  recallMatchedProducts: number;
  barcodeEnriched: number;
  manufacturersClosed: number;
}

export interface JoinResult {
  products: ProductDraft[];
  report: JoinReport;
}

const SRC_PRODUCT: SourceRef = "PRODUCT_REPORT";
const SRC_NUTRITION: SourceRef = "NUTRITION";
const SRC_RECALL: SourceRef = "RECALL";
const SRC_CLOSURE: SourceRef = "MANUFACTURER_CLOSURE";

export function joinProducts(inputs: JoinInputs, opts: JoinOptions): JoinResult {
  // 빈/공백 품목제조보고번호(PK) 제품은 드롭한다(INV-5: 무효 PK 금지, 조인 키 오염 차단).
  const ramen = filterRamenProducts(inputs.products, inputs.corrections).filter((p) =>
    isValidProductId(p.id),
  );

  // 영양 조인: 품목제조보고번호(있으면) 우선, 없으면 식품명+제조사 매칭(ADR-0007).
  const nutritionByPid = new Map<string, NormalizedNutritionRow>();
  const nutritionByMatchKey = new Map<string, NormalizedNutritionRow>();
  for (const n of inputs.nutritions) {
    if (n.productId) {
      const key = normalizeProductId(n.productId);
      if (isValidProductId(key)) nutritionByPid.set(key, n);
    }
    if (n.matchKey) nutritionByMatchKey.set(n.matchKey, n);
  }

  const recallsByPid = new Map<string, RecallEvent[]>();
  const recallsByBarcode = new Map<string, RecallEvent[]>();
  for (const r of inputs.recalls) {
    if (r.productId && isValidProductId(r.productId)) {
      push(recallsByPid, normalizeProductId(r.productId), r);
    }
    if (r.barcode) push(recallsByBarcode, r.barcode.trim(), r);
  }

  const closureByMid = new Map<string, NormalizedClosure>();
  for (const c of inputs.closures) {
    closureByMid.set(c.manufacturerId, c);
  }

  let nutritionMatched = 0;
  let recallMatchedProducts = 0;
  let barcodeEnriched = 0;
  let manufacturersClosed = 0;

  const products: ProductDraft[] = ramen.map((p) => {
    // PK 매칭 우선, 없으면 식품명+제조사 매칭(ADR-0007).
    const nutRow =
      nutritionByPid.get(p.id) ?? nutritionByMatchKey.get(nutritionMatchKey(p.name, p.manufacturerName));
    // 영양 행이 있어도 필수값 결측(null)이면 미커버로 취급(0 날조 금지).
    const nutrition = nutRow ? nutRow.nutrition : null;
    if (nutrition) nutritionMatched++;

    // 회수 매칭: 품목제조보고번호 ∪ 바코드(중복 id 제거).
    const matched = new Map<string, RecallEvent>();
    for (const r of recallsByPid.get(p.id) ?? []) matched.set(r.id, r);
    if (p.barcode) {
      for (const r of recallsByBarcode.get(p.barcode.trim()) ?? []) matched.set(r.id, r);
    }
    const recallEvents = [...matched.values()].sort((a, b) => compareCodeUnits(a.id, b.id));
    if (recallEvents.length > 0) recallMatchedProducts++;

    // 바코드 보강: 제품에 없고 매칭 회수에 있으면 채움.
    let barcode = p.barcode;
    if (!barcode) {
      const fromRecall = recallEvents.find((r) => r.barcode)?.barcode;
      if (fromRecall) {
        barcode = fromRecall;
        barcodeEnriched++;
      }
    }

    // 제품 이미지: 회수 피드 제공분(결정론 위해 첫 id 순).
    const imageUrl = recallEvents.find((r) => r.imageUrl)?.imageUrl;

    // 제조사 상태(폐업정보가 있을 때만 출처 기록).
    const closure = closureByMid.get(p.manufacturerId);
    const manufacturerStatus = closure?.businessStatus ?? "ACTIVE";
    if (closure?.businessStatus === "CLOSED") manufacturersClosed++;

    const sourceRefs: SourceRef[] = [SRC_PRODUCT];
    if (nutrition) sourceRefs.push(SRC_NUTRITION);
    if (recallEvents.length > 0) sourceRefs.push(SRC_RECALL);
    if (closure) sourceRefs.push(SRC_CLOSURE);

    const draft: ProductDraft = {
      id: p.id,
      name: p.name,
      ...(barcode ? { barcode } : {}),
      packageType: p.packageType,
      manufacturerId: p.manufacturerId,
      nutrition,
      ...(imageUrl ? { imageUrl } : {}),
      sourceRefs,
      updatedAt: opts.asOf,
      manufacturerStatus,
      recallEvents,
    };
    return draft;
  });

  // 결정론적 정렬(PK) — 로케일 비의존 코드유닛 비교(INV-7 교차환경 일치).
  products.sort((a, b) => compareCodeUnits(a.id, b.id));

  const ramenCount = products.length;
  return {
    products,
    report: {
      ramenProducts: ramenCount,
      nutritionMatched,
      nutritionMissing: ramenCount - nutritionMatched,
      nutritionCoverage: ramenCount === 0 ? 1 : nutritionMatched / ramenCount,
      recallMatchedProducts,
      barcodeEnriched,
      manufacturersClosed,
    },
  };
}

function push<T>(m: Map<string, T[]>, k: string, v: T): void {
  const arr = m.get(k);
  if (arr) arr.push(v);
  else m.set(k, [v]);
}
