// @ramen/ingest — 공공데이터 fetch·정규화·라면 도메인 필터·조인.
// 허용 import: core-domain, shared (INV-3). 외부 API 호출은 adapters/에 격리.

export type {
  RawProductReport,
  RawNutrition,
  RawRecall,
  RawClosure,
  RawRestaurant,
  RawModelRestaurant,
} from "./raw-types.js";

export type {
  NormalizedProduct,
  NormalizedNutritionRow,
  NormalizedClosure,
} from "./normalize.js";
export {
  parseNum,
  normalizeDate,
  normalizeBarcode,
  nutritionMatchKey,
  inferPackageType,
  normalizeProductReport,
  normalizeNutrition,
  normalizeRecall,
  normalizeClosure,
} from "./normalize.js";

export type { CorrectionList } from "./correction-list.js";
export { RAMEN_CORRECTIONS_V1 } from "./correction-list.js";

export type { FilterReason, FilterDecision, LabeledProduct, FilterReport } from "./domain-filter.js";
export {
  NOODLE_FOOD_TYPES,
  RAMEN_KEYWORDS,
  NEGATIVE_KEYWORDS,
  classifyProduct,
  filterRamenProducts,
  filterPrecisionReport,
  precisionFrom,
} from "./domain-filter.js";

export type { JoinInputs, JoinOptions, JoinReport, JoinResult } from "./join.js";
export { joinProducts } from "./join.js";

// ── 음식점 레이어(M4) ──
export type { NormalizedShop } from "./shop-normalize.js";
export {
  deriveShopStatus,
  normalizeRestaurant,
  normalizeModelRestaurant,
} from "./shop-normalize.js";

export type { ShopFilterReason, ShopFilterDecision, LabeledShop } from "./shop-filter.js";
export {
  RAMEN_SHOP_CATEGORIES,
  RAMEN_SHOP_KEYWORDS,
  RAMEN_SHOP_CHAINS,
  SHOP_NEGATIVE_KEYWORDS,
  classifyShop,
  filterRamenShops,
  shopFilterPrecisionReport,
} from "./shop-filter.js";

export type { ShopJoinInputs, ShopJoinReport, ShopJoinResult } from "./shop-join.js";
export { joinShops } from "./shop-join.js";

export type { DataGoKrEndpoint, FetchOptions } from "./adapters/data-go-kr.js";
export { loadServiceKey, fetchAllRows } from "./adapters/data-go-kr.js";

export type { DataGoKrRestaurantOptions } from "./adapters/datagokr-restaurant.js";
export {
  DATAGOKR_RESTAURANT_ENDPOINT,
  fetchGeneralRestaurants,
  mapRestaurantRow,
} from "./adapters/datagokr-restaurant.js";

export type { FoodSafetyOptions } from "./adapters/foodsafetykorea.js";
export {
  FOOD_SAFETY_BASE,
  FOOD_SAFETY_SERVICE_IDS,
  fetchFoodSafetyRows,
  fetchProductReportsByFoodTypes,
  mapProductReportRow,
  mapRecallRow,
  mapNutritionRow,
  fetchTier1ProductData,
} from "./adapters/foodsafetykorea.js";
