// 스냅샷 diff(M3, +M4 음식점) — 전주 대비 제품·음식점 변경 분류.
// 결정론: 모든 목록을 PK 코드유닛 정렬. 제품 updatedAt는 매 스냅샷 변하므로 변경 판정에서 제외.

import type { RamenProduct, RamenShop } from "@ramen/core-domain";
import { compareCodeUnits, contentHash } from "@ramen/shared";
import type { Snapshot } from "./build.js";

export interface ProductChanges {
  /** 신규(현재에만 존재) */
  added: string[];
  /**
   * 로스터 이탈(직전에만 존재). 단종추정(DISCONTINUED? low) 후보지만, 현재 파이프라인은
   * 이 신호를 status 도출로 환류하지 않는다(부재 카운터 미배선 — status.ts deriveProductStatus 주석).
   */
  removed: string[];
  /** 판매중지/회수로 신규 진입 */
  nowHalted: string[];
  /** 단종추정(DISCONTINUED?)으로 신규 진입 */
  nowDiscontinued: string[];
  /** status 외 필드 변경(이름·영양·바코드 등) */
  changed: string[];
  counts: {
    added: number;
    removed: number;
    nowHalted: number;
    nowDiscontinued: number;
    changed: number;
  };
}

export interface ShopChanges {
  /** 신규 등록 음식점 */
  added: string[];
  /** 로스터 이탈(명단 제거) */
  removed: string[];
  /** 영업 → 폐업 전환 */
  nowClosed: string[];
  /** 폐업 → 영업 전환(재개) */
  reopened: string[];
  /** 영업상태 외 필드 변경(이름·주소·좌표·업태·모범 등) */
  changed: string[];
  counts: {
    added: number;
    removed: number;
    nowClosed: number;
    reopened: number;
    changed: number;
  };
}

export interface SnapshotDiff {
  prevVersion: string;
  currVersion: string;
  products: ProductChanges;
  shops: ShopChanges;
}

const HALT_STATUSES = new Set<RamenProduct["status"]>(["SALES_HALTED", "RECALLED"]);

/** 제품 변경 판정용 비교본(매 스냅샷 변하는 updatedAt 제외). */
function productComparable(p: RamenProduct): Record<string, unknown> {
  return {
    name: p.name,
    barcode: p.barcode,
    packageType: p.packageType,
    manufacturerId: p.manufacturerId,
    nutrition: p.nutrition,
    imageUrl: p.imageUrl,
    officialRecipe: p.officialRecipe,
    sourceRefs: p.sourceRefs,
    status: p.status,
    statusSource: p.statusSource,
    statusConfidence: p.statusConfidence,
  };
}

function sortAll(...arrays: string[][]): void {
  for (const arr of arrays) arr.sort(compareCodeUnits);
}

function diffProducts(prev: RamenProduct[], curr: RamenProduct[]): ProductChanges {
  const prevById = new Map(prev.map((p) => [p.id, p]));
  const currById = new Map(curr.map((p) => [p.id, p]));
  const added: string[] = [];
  const removed: string[] = [];
  const nowHalted: string[] = [];
  const nowDiscontinued: string[] = [];
  const changed: string[] = [];

  for (const id of currById.keys()) if (!prevById.has(id)) added.push(id);
  for (const id of prevById.keys()) if (!currById.has(id)) removed.push(id);

  for (const [id, c] of currById) {
    const p = prevById.get(id);
    if (!p) continue;
    const statusChanged = p.status !== c.status;
    if (statusChanged && HALT_STATUSES.has(c.status) && !HALT_STATUSES.has(p.status)) {
      nowHalted.push(id);
    } else if (statusChanged && c.status === "DISCONTINUED?" && p.status !== "DISCONTINUED?") {
      nowDiscontinued.push(id);
    } else if (contentHash(productComparable(p)) !== contentHash(productComparable(c))) {
      changed.push(id);
    }
  }

  sortAll(added, removed, nowHalted, nowDiscontinued, changed);
  return {
    added,
    removed,
    nowHalted,
    nowDiscontinued,
    changed,
    counts: {
      added: added.length,
      removed: removed.length,
      nowHalted: nowHalted.length,
      nowDiscontinued: nowDiscontinued.length,
      changed: changed.length,
    },
  };
}

function diffShops(prev: RamenShop[], curr: RamenShop[]): ShopChanges {
  const prevById = new Map(prev.map((s) => [s.id, s]));
  const currById = new Map(curr.map((s) => [s.id, s]));
  const added: string[] = [];
  const removed: string[] = [];
  const nowClosed: string[] = [];
  const reopened: string[] = [];
  const changed: string[] = [];

  for (const id of currById.keys()) if (!prevById.has(id)) added.push(id);
  for (const id of prevById.keys()) if (!currById.has(id)) removed.push(id);

  for (const [id, c] of currById) {
    const p = prevById.get(id);
    if (!p) continue;
    if (p.businessStatus !== c.businessStatus) {
      if (c.businessStatus === "CLOSED") nowClosed.push(id);
      else reopened.push(id);
    } else if (contentHash(p) !== contentHash(c)) {
      // RamenShop은 휘발 타임스탬프가 없어 레코드 전체 비교.
      changed.push(id);
    }
  }

  sortAll(added, removed, nowClosed, reopened, changed);
  return {
    added,
    removed,
    nowClosed,
    reopened,
    changed,
    counts: {
      added: added.length,
      removed: removed.length,
      nowClosed: nowClosed.length,
      reopened: reopened.length,
      changed: changed.length,
    },
  };
}

export function diffSnapshots(prev: Snapshot, curr: Snapshot): SnapshotDiff {
  return {
    prevVersion: prev.version,
    currVersion: curr.version,
    products: diffProducts(prev.products, curr.products),
    shops: diffShops(prev.shops, curr.shops),
  };
}
