// @ramen/web — UI + Tier2 실시간 조회·제휴 렌더(PriceQuote는 여기에만, INV-4).
// 허용 import: core-domain(타입), shared (INV-3). ingest·pipeline import 금지.

import type { RamenProduct } from "@ramen/core-domain";
import { statusDisplayLabel } from "@ramen/core-domain";
import { attributionLabel } from "@ramen/shared";

// Tier2(가격·제휴) 런타임 API — 비영속(INV-4).
export * from "./tier2/index.js";

// 정적 렌더(M6) — 스냅샷 → HTML.
export {
  renderStatus,
  renderProductCard,
  renderProductList,
  renderNutrition,
  renderPriceSection,
  renderProductDetail,
  renderShop,
  renderShopList,
  renderRecipe,
  renderRecipes,
  renderCuration,
  renderCatalogPage,
  renderShopsPage,
  renderDetailPage,
  renderPagination,
  renderSearchPage,
  productHref,
} from "./view/render.js";
export { escapeHtml } from "./view/escape.js";

// 카탈로그 쿼리(M6+) — 필터·정렬·페이지네이션·검색 인덱스.
export type { Page, ProductFilter, ProductSortKey, Facet, SearchEntry } from "./catalog/query.js";
export {
  paginate,
  filterProducts,
  sortProducts,
  sortShops,
  manufacturerFacets,
  statusFacets,
  buildSearchIndex,
  STATUS_LABEL,
  PACKAGE_LABEL,
} from "./catalog/query.js";

// UGC(M7) — 자체 제출·검수·저장(INV-8).
export * from "./ugc/index.js";

/** 제품 카드 표시 모델(INV-6 단정 차단 라벨 + INV-9 출처). */
export interface ProductCardView {
  id: string;
  name: string;
  /** confidence<high는 '추정'으로 표기됨(INV-6) */
  statusLabel: string;
  /** 출처 표기(INV-9) */
  sources: string[];
}

export function toProductCard(p: RamenProduct): ProductCardView {
  return {
    id: p.id,
    name: p.name,
    statusLabel: statusDisplayLabel(p.status, p.statusConfidence),
    sources: p.sourceRefs.map(attributionLabel),
  };
}
