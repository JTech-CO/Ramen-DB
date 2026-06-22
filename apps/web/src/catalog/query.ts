// 카탈로그 쿼리(순수) — 필터·정렬·페이지네이션·검색 인덱스·패싯. 대량 데이터 대비 토대.
// 빌드타임(정적 페이지)과 클라이언트 검색이 동일 개념을 공유한다.

import type { PackageType, ProductStatus, RamenProduct, RamenShop } from "@ramen/core-domain";
import { compareCodeUnits } from "@ramen/shared";

/** 음식점 이름순 정렬(동점 PK). 결정론. */
export function sortShops(shops: RamenShop[]): RamenShop[] {
  return [...shops].sort((a, b) => compareCodeUnits(a.name, b.name) || compareCodeUnits(a.id, b.id));
}

export interface Page<T> {
  items: T[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

/** 1-based 페이지네이션. page는 [1, totalPages]로 클램프. 빈 목록도 totalPages=1. */
export function paginate<T>(items: T[], page: number, perPage: number): Page<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, perPage)));
  const p = Math.min(Math.max(1, Math.floor(page)), totalPages);
  const start = (p - 1) * perPage;
  return { items: items.slice(start, start + perPage), page: p, perPage, total, totalPages };
}

export interface ProductFilter {
  text?: string;
  packageType?: PackageType;
  status?: ProductStatus;
  manufacturerId?: string;
}

export function filterProducts(products: RamenProduct[], f: ProductFilter): RamenProduct[] {
  const q = f.text?.trim().toLowerCase();
  return products.filter((p) => {
    if (q && !p.name.toLowerCase().includes(q)) return false;
    if (f.packageType && p.packageType !== f.packageType) return false;
    if (f.status && p.status !== f.status) return false;
    if (f.manufacturerId && p.manufacturerId !== f.manufacturerId) return false;
    return true;
  });
}

export type ProductSortKey = "name" | "kcal" | "sodium";

function metric(p: RamenProduct, key: "kcal" | "sodium"): number {
  if (!p.nutrition) return Number.POSITIVE_INFINITY; // 영양 없는 항목은 뒤로
  return key === "kcal" ? p.nutrition.energyKcal : (p.nutrition.sodiumMg ?? Number.POSITIVE_INFINITY);
}

/** 결정론 정렬(동점은 PK 코드유닛). 이름은 코드유닛 사전식. */
export function sortProducts(
  products: RamenProduct[],
  key: ProductSortKey = "name",
  dir: "asc" | "desc" = "asc",
): RamenProduct[] {
  const sign = dir === "desc" ? -1 : 1;
  return [...products].sort((a, b) => {
    const primary =
      key === "name" ? compareCodeUnits(a.name, b.name) : metric(a, key) - metric(b, key);
    return sign * primary || compareCodeUnits(a.id, b.id);
  });
}

// ── 패싯(필터 옵션 + 개수) ──

export interface Facet {
  value: string;
  count: number;
}

export function manufacturerFacets(products: RamenProduct[]): Facet[] {
  const counts = new Map<string, number>();
  for (const p of products) counts.set(p.manufacturerId, (counts.get(p.manufacturerId) ?? 0) + 1);
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || compareCodeUnits(a.value, b.value));
}

export function statusFacets(products: RamenProduct[]): Record<ProductStatus, number> {
  const c: Record<ProductStatus, number> = {
    ON_SALE: 0,
    SALES_HALTED: 0,
    RECALLED: 0,
    "DISCONTINUED?": 0,
  };
  for (const p of products) c[p.status]++;
  return c;
}

// ── 클라이언트 검색 인덱스(경량) ──

export interface SearchEntry {
  id: string;
  name: string;
  /** 제조사 식별자 */
  mid: string;
  pkg: PackageType;
  status: ProductStatus;
  /** 에너지(kcal), 없으면 null */
  kcal: number | null;
}

export function buildSearchIndex(products: RamenProduct[]): SearchEntry[] {
  return sortProducts(products, "name").map((p) => ({
    id: p.id,
    name: p.name,
    mid: p.manufacturerId,
    pkg: p.packageType,
    status: p.status,
    kcal: p.nutrition?.energyKcal ?? null,
  }));
}

/** 필터/검색 UI 라벨. */
export const STATUS_LABEL: Record<ProductStatus, string> = {
  ON_SALE: "판매중",
  SALES_HALTED: "판매중지",
  RECALLED: "회수",
  "DISCONTINUED?": "단종 추정",
};

export const PACKAGE_LABEL: Record<PackageType, string> = {
  BAG: "봉지",
  CUP: "컵",
  OTHER: "기타",
};
