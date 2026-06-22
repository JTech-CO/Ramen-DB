// @ramen/shared — 도메인·데이터를 모르는 순수 유틸만(INV-3).
// 출처표기(INV-9)·결정론 직렬화/해시(INV-7)·좌표 변환 헬퍼.

export type { DatasetSource, DatasetId } from "./attribution.js";
export { DATASET_SOURCES, attributionLabel } from "./attribution.js";

export { canonicalize, stableStringify } from "./stable-json.js";
export { sha256, contentHash } from "./hash.js";
export { compareCodeUnits } from "./compare.js";

export type { Epsg, LatLng } from "./coords.js";
export { toWgs84, isPlausibleKoreaLatLng } from "./coords.js";
