// 음식점 조인(M4) — 라멘 필터 통과 음식점 + 모범음식점 플래그 → RamenShop.
// 인허가관리번호 PK. 빈 PK 드롭. 순수·결정론(PK 코드유닛 정렬).

import type { RamenShop, SourceRef } from "@ramen/core-domain";
import { isValidProductId } from "@ramen/core-domain";
import { compareCodeUnits } from "@ramen/shared";
import type { CorrectionList } from "./correction-list.js";
import { filterRamenShops } from "./shop-filter.js";
import type { NormalizedShop } from "./shop-normalize.js";

export interface ShopJoinInputs {
  shops: NormalizedShop[];
  /** 모범음식점 인허가관리번호 목록 */
  modelRestaurantIds: string[];
  corrections: CorrectionList;
}

export interface ShopJoinReport {
  ramenShops: number;
  withCoords: number;
  coordsMissing: number;
  active: number;
  closed: number;
  modelRestaurants: number;
}

export interface ShopJoinResult {
  shops: RamenShop[];
  report: ShopJoinReport;
}

const SRC_RESTAURANT: SourceRef = "RESTAURANT";

export function joinShops(inputs: ShopJoinInputs): ShopJoinResult {
  // 라멘 도메인 필터 + 빈/공백 인허가관리번호(PK) 드롭.
  const ramen = filterRamenShops(inputs.shops, inputs.corrections).filter((s) =>
    isValidProductId(s.id),
  );
  const modelSet = new Set(
    inputs.modelRestaurantIds.map((id) => id.trim()).filter((id) => id.length > 0),
  );

  let withCoords = 0;
  let active = 0;
  let closed = 0;
  let modelRestaurants = 0;

  const shops: RamenShop[] = ramen.map((s) => {
    const hasCoords = s.lat !== undefined && s.lng !== undefined;
    if (hasCoords) withCoords++;
    if (s.businessStatus === "ACTIVE") active++;
    else closed++;
    const isModel = modelSet.has(s.id);
    if (isModel) modelRestaurants++;

    const shop: RamenShop = {
      id: s.id,
      name: s.name,
      address: s.address,
      ...(hasCoords ? { lat: s.lat, lng: s.lng } : {}),
      businessStatus: s.businessStatus,
      ...(s.category ? { category: s.category } : {}),
      isModelRestaurant: isModel,
      source: SRC_RESTAURANT,
    };
    return shop;
  });

  shops.sort((a, b) => compareCodeUnits(a.id, b.id));

  return {
    shops,
    report: {
      ramenShops: shops.length,
      withCoords,
      coordsMissing: shops.length - withCoords,
      active,
      closed,
      modelRestaurants,
    },
  };
}
