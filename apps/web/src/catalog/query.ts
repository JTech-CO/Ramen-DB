// 카탈로그 쿼리(순수) — 필터·정렬·페이지네이션·검색 인덱스·패싯. 대량 데이터 대비 토대.
// 빌드타임(정적 페이지)과 클라이언트 검색이 동일 개념을 공유한다.

import type {
  BusinessStatus,
  PackageType,
  ProductStatus,
  RamenProduct,
  RamenShop,
} from "@ramen/core-domain";
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

// ── 동일 제품 중복 제거(표시 전용) ──
// 품목제조보고(I1250)는 한 소비자 제품을 공장·재신고별로 여러 보고번호로 등록한다
// (예: '신라면'이 (주)농심의 LCNS 3개로 3건). PK(품목제조보고번호)는 보존하되(INV-5),
// 카탈로그/검색 표시에서만 (제품명+제조사명)으로 대표 1건을 노출한다.
// 제조사명이 다른 동명 제품(예: 14개 업체의 '생라멘')은 서로 다른 제품이므로 보존한다.

/** 표시용 정규화 키 — 공백 제거·소문자. (제품명+제조사명) 동일 = 같은 소비자 제품. */
function dedupeKey(p: RamenProduct): string {
  const norm = (s: string): string => s.replace(/\s+/g, "").toLowerCase();
  return `${norm(p.name)}|${norm(p.manufacturerName ?? "")}`;
}

/** 상태 심각도 — 대표 선택 시 안전정보(회수/판매중지)를 숨기지 않도록 높게 둔다. */
const STATUS_SEVERITY: Record<ProductStatus, number> = {
  RECALLED: 3,
  SALES_HALTED: 2,
  ON_SALE: 1,
  "DISCONTINUED?": 0,
};

/** 정보 풍부도(영양>바코드>이미지) — 대표 동률 시 더 풍부한 레코드 우선. */
function dataScore(p: RamenProduct): number {
  return (p.nutrition ? 4 : 0) + (p.barcode ? 2 : 0) + (p.imageUrl ? 1 : 0);
}

/** a가 b보다 대표로 더 적합하면 true. 전순서(모든 동률은 PK 코드유닛으로 확정)·결정론. */
function preferAsRepresentative(a: RamenProduct, b: RamenProduct): boolean {
  const sa = STATUS_SEVERITY[a.status];
  const sb = STATUS_SEVERITY[b.status];
  if (sa !== sb) return sa > sb; // 회수/판매중지 우선(안전정보 보존)
  const da = dataScore(a);
  const db = dataScore(b);
  if (da !== db) return da > db;
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt; // 최신
  return compareCodeUnits(a.id, b.id) < 0; // PK 최소(결정론 tiebreak)
}

/**
 * 같은 소비자 제품(제품명+제조사명)의 여러 품목제조보고번호를 대표 1건으로 합친다(표시 전용).
 * 스냅샷 원본(전체 PK)은 불변(INV-5/7). 입력 순서와 무관한 결정론적 결과.
 */
export function dedupeProducts(products: RamenProduct[]): RamenProduct[] {
  const reps = new Map<string, RamenProduct>();
  for (const p of products) {
    const key = dedupeKey(p);
    const cur = reps.get(key);
    if (!cur || preferAsRepresentative(p, cur)) reps.set(key, p);
  }
  return [...reps.values()].sort(
    (a, b) => compareCodeUnits(a.name, b.name) || compareCodeUnits(a.id, b.id),
  );
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
  /** 제조사명(표시·동명 제품 구분용) */
  mfr: string;
  pkg: PackageType;
  status: ProductStatus;
  /** 에너지(kcal), 없으면 null */
  kcal: number | null;
  /** 공식 이미지 URL(있을 때만 — 현재 회수 피드 제공분 한정) */
  img?: string;
}

export function buildSearchIndex(products: RamenProduct[]): SearchEntry[] {
  return sortProducts(products, "name").map((p) => ({
    id: p.id,
    name: p.name,
    mid: p.manufacturerId,
    mfr: p.manufacturerName ?? "",
    pkg: p.packageType,
    status: p.status,
    kcal: p.nutrition?.energyKcal ?? null,
    ...(p.imageUrl ? { img: p.imageUrl } : {}),
  }));
}

// ── 음식점 검색 인덱스 + 지역(시/도) ──

const REGION_MATCHERS: Array<[RegExp, string]> = [
  [/^서울/, "서울"],
  [/^부산/, "부산"],
  [/^대구/, "대구"],
  [/^인천/, "인천"],
  [/^광주/, "광주"],
  [/^대전/, "대전"],
  [/^울산/, "울산"],
  [/^세종/, "세종"],
  [/^경기/, "경기"],
  [/^강원/, "강원"],
  [/^충청북도|^충북/, "충북"],
  [/^충청남도|^충남/, "충남"],
  [/^전라북도|^전북/, "전북"],
  [/^전라남도|^전남/, "전남"],
  [/^경상북도|^경북/, "경북"],
  [/^경상남도|^경남/, "경남"],
  [/^제주/, "제주"],
];

/** 광역시·도 순서(지역 정렬·필터 옵션). */
export const SHOP_REGION_ORDER = [
  "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
  "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주", "기타",
];

/** 주소에서 시/도 지역(대분류) 추출(매칭 없으면 기타). */
export function shopRegion(address: string): string {
  const a = address.trim();
  for (const [re, region] of REGION_MATCHERS) if (re.test(a)) return region;
  return "기타";
}

/** 주소에서 시/군/구(중분류) 추출 — 예: "경기도 수원시 영통구 …" → "수원시 영통구". 없으면 빈 문자열. */
export function shopRegion2(address: string): string {
  const tokens = address.trim().split(/\s+/);
  const rest = tokens.slice(1); // 시/도 제거
  const out: string[] = [];
  for (const t of rest) {
    if (/[시군구]$/.test(t)) {
      out.push(t);
      if (t.endsWith("구") || t.endsWith("군") || out.length >= 2) break;
    } else break; // 시/군/구 외 토큰(도로명·동) 만나면 멈춤
  }
  return out.join(" ");
}

/** 음식점 클라이언트 인덱스(경량). 이름순 정렬·지역(대/중분류) 부여. */
export interface ShopEntry {
  id: string;
  name: string;
  /** 업태 */
  cat: string;
  /** 시/도(대분류) */
  region: string;
  /** 시/군/구(중분류) */
  region2: string;
  addr: string;
  status: BusinessStatus;
  lat?: number;
  lng?: number;
}

export function buildShopIndex(shops: RamenShop[]): ShopEntry[] {
  return sortShops(shops).map((s) => ({
    id: s.id,
    name: s.name,
    cat: s.category ?? "",
    region: shopRegion(s.address),
    region2: shopRegion2(s.address),
    addr: s.address,
    status: s.businessStatus,
    ...(s.lat !== undefined ? { lat: s.lat } : {}),
    ...(s.lng !== undefined ? { lng: s.lng } : {}),
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
