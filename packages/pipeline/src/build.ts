// 스냅샷 빌드 오케스트레이션(M3, +M4 음식점) — raw → 정규화 → 필터 → 조인 → status → Snapshot.
// 제품(Tier1) + 음식점(LOCALDATA)을 한 스냅샷에 담는다. 순수·결정론(INV-7).

import type { ProductStatus, RamenProduct, RamenShop } from "@ramen/core-domain";
import { deriveAndFinalize } from "@ramen/core-domain";
import { contentHash, stableStringify, type Epsg } from "@ramen/shared";
import type {
  CorrectionList,
  JoinInputs,
  JoinReport,
  NormalizedNutritionRow,
  RawClosure,
  RawModelRestaurant,
  RawNutrition,
  RawProductReport,
  RawRecall,
  RawRestaurant,
  ShopJoinReport,
} from "@ramen/ingest";
import {
  joinProducts,
  joinShops,
  normalizeClosure,
  normalizeModelRestaurant,
  normalizeNutrition,
  normalizeProductReport,
  normalizeRecall,
  normalizeRestaurant,
} from "@ramen/ingest";

/** Tier1 풀 스냅샷 산출물. 본문(version + products + shops)만 해시 대상(INV-7). */
export interface Snapshot {
  /** 스냅샷 버전 태그 (예: snapshot-2026-W25) */
  version: string;
  /** PK 정렬된 라면 제품(status 부착 완료) */
  products: RamenProduct[];
  /** PK 정렬된 라면·라멘 음식점 */
  shops: RamenShop[];
}

const EMPTY_CORRECTIONS: CorrectionList = { version: "none", include: [], exclude: [] };

export interface RawInputs {
  products: RawProductReport[];
  nutritions: RawNutrition[];
  /** 사전 정규화된 영양 행(식품명+제조사 매칭용, 라이브 I2790). PK 영양과 병합된다. */
  nutritionRows?: NormalizedNutritionRow[];
  recalls: RawRecall[];
  closures: RawClosure[];
  /** 제품 도메인 보정 리스트 */
  corrections: CorrectionList;
  // ── 음식점 레이어(M4) — 선택. 없으면 빈 음식점 스냅샷 ──
  restaurants?: RawRestaurant[];
  modelRestaurants?: RawModelRestaurant[];
  /** 음식점 도메인 보정 리스트 */
  shopCorrections?: CorrectionList;
}

export interface BuildOptions {
  /** 스냅샷 기준시각 ISO (updatedAt 주입, 결정론) */
  asOf: string;
  /** 버전 태그 */
  version: string;
  /** 음식점 좌표 소스 EPSG (기본 5174) */
  epsg?: Epsg;
}

export interface BuildReport extends JoinReport {
  statusCounts: Record<ProductStatus, number>;
  /** 음식점 레이어 리포트 */
  shops: ShopJoinReport;
}

export interface BuildResult {
  snapshot: Snapshot;
  report: BuildReport;
}

function countStatuses(products: RamenProduct[]): Record<ProductStatus, number> {
  const counts: Record<ProductStatus, number> = {
    ON_SALE: 0,
    SALES_HALTED: 0,
    RECALLED: 0,
    "DISCONTINUED?": 0,
  };
  for (const p of products) counts[p.status]++;
  return counts;
}

/** raw 입력 전체를 정규화→필터→조인→status 도출하여 스냅샷(제품+음식점)을 만든다. */
export function buildSnapshot(raw: RawInputs, opts: BuildOptions): BuildResult {
  // ── 제품(Tier1) ──
  const joinInputs: JoinInputs = {
    products: raw.products.map(normalizeProductReport),
    // PK 기반 영양(픽스처) + 식품명/제조사 매칭 영양(라이브 I2790) 병합.
    nutritions: [...raw.nutritions.map(normalizeNutrition), ...(raw.nutritionRows ?? [])],
    recalls: raw.recalls.map(normalizeRecall),
    closures: raw.closures.map(normalizeClosure),
    corrections: raw.corrections,
  };
  const joined = joinProducts(joinInputs, { asOf: opts.asOf });
  const products = joined.products.map(deriveAndFinalize);

  // ── 음식점(LOCALDATA, M4) ──
  const shopResult = joinShops({
    shops: (raw.restaurants ?? []).map((r) => normalizeRestaurant(r, { epsg: opts.epsg })),
    modelRestaurantIds: (raw.modelRestaurants ?? []).map(normalizeModelRestaurant),
    corrections: raw.shopCorrections ?? EMPTY_CORRECTIONS,
  });

  return {
    snapshot: { version: opts.version, products, shops: shopResult.shops },
    report: { ...joined.report, statusCounts: countStatuses(products), shops: shopResult.report },
  };
}

/** 결정론적 JSON 직렬화(키 정렬). 동일 스냅샷 → 동일 바이트열(INV-7). */
export function serializeSnapshot(snapshot: Snapshot): string {
  return stableStringify(snapshot, 2);
}

/** 스냅샷 본문 해시(INV-7 게이트). version+products+shops만 대상, 생성시각 제외. */
export function snapshotHash(snapshot: Snapshot): string {
  return contentHash(snapshot);
}
