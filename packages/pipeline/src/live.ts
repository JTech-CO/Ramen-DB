// 라이브 Tier1 수집 → RawInputs 조립(키 제공 시). 식약처 제품·회수·영양(식품명+제조사 매칭).
// 제조사 폐업·음식점(LOCALDATA)은 이관 확인 후 추가(ADR-0007) — 현재 미배선.
// 네트워크 호출. 서비스키는 env에서만(INV-1).

import {
  fetchGeneralRestaurants,
  fetchTier1ProductData,
  loadServiceKey,
  NOODLE_FOOD_TYPES,
  type CorrectionList,
  type RawRestaurant,
} from "@ramen/ingest";
import type { RawInputs } from "./build.js";

const EMPTY_CORRECTIONS: CorrectionList = { version: "live", include: [], exclude: [] };

export interface LiveFetchOptions {
  serviceKey?: string;
  fetchImpl?: typeof fetch;
  /** 스모크 테스트용 행수 상한 */
  maxRows?: number;
  /** 제품 SERVICE_ID 교체(I1250 기본, 15062098 원재료변형 C002 등) */
  productServiceId?: string;
  /** 제품 식품유형 서버필터(기본 = 면류 NOODLE_FOOD_TYPES). [] 주면 전량 수집. */
  productFoodTypes?: readonly string[];
  /** 영양(I2790) 포함 여부(기본 true·미승인 시 자동 강등). false면 호출 자체 생략. */
  includeNutrition?: boolean;
  corrections?: CorrectionList;
  /** data.go.kr 음식점 serviceKey(쿼리). 있으면 일반음식점 수집(라멘 필터는 joinShops). */
  restaurantServiceKey?: string;
  /** 음식점 수집 상한(전국 2.28M·서버필터 없음 → 명시적 상한 필수). */
  restaurantMaxRows?: number;
  shopCorrections?: CorrectionList;
}

/**
 * 식약처 라이브 데이터로 RawInputs를 만든다. 영양은 식품명+제조사 매칭 행(nutritionRows)으로 주입.
 * 제품은 면류 식품유형 서버필터로 좁혀 받는다(라이브 I1250 100만건+ 전량 회피).
 * closures/restaurants는 비움(ADR-0007 결정 대기). serviceKey 미지정 시 env에서 로드(INV-1).
 */
export async function fetchLiveRawInputs(opts: LiveFetchOptions = {}): Promise<RawInputs> {
  const serviceKey = opts.serviceKey ?? loadServiceKey();
  const productFoodTypes = opts.productFoodTypes ?? [...NOODLE_FOOD_TYPES];
  const { products, recalls, nutritionRows } = await fetchTier1ProductData({
    serviceKey,
    productFoodTypes,
    ...(opts.includeNutrition !== undefined ? { includeNutrition: opts.includeNutrition } : {}),
    ...(opts.fetchImpl ? { fetchImpl: opts.fetchImpl } : {}),
    ...(opts.maxRows !== undefined ? { maxRows: opts.maxRows } : {}),
    ...(opts.productServiceId ? { productServiceId: opts.productServiceId } : {}),
  });
  // 음식점(선택) — data.go.kr 키가 있으면 일반음식점 수집. 라멘 도메인 필터는 buildSnapshot(joinShops)에서.
  let restaurants: RawRestaurant[] = [];
  if (opts.restaurantServiceKey?.trim()) {
    restaurants = await fetchGeneralRestaurants({
      serviceKey: opts.restaurantServiceKey,
      ...(opts.fetchImpl ? { fetchImpl: opts.fetchImpl } : {}),
      ...(opts.restaurantMaxRows !== undefined ? { maxRows: opts.restaurantMaxRows } : {}),
    });
  }

  return {
    products,
    nutritions: [],
    nutritionRows,
    recalls,
    closures: [],
    corrections: opts.corrections ?? EMPTY_CORRECTIONS,
    ...(restaurants.length > 0 ? { restaurants } : {}),
    ...(opts.shopCorrections ? { shopCorrections: opts.shopCorrections } : {}),
  };
}
