// 좌표 정규화 — LOCALDATA TM(중부원점) 좌표 → WGS84로 통일(런북 11). 단일 변환기(proj4).
// 소스별 EPSG가 다를 수 있어(5174/5181/5179/2097) from을 명시받는다. 기본은 LOCALDATA 관례 5174.

import proj4 from "proj4";

/** 한국 행정 데이터에서 흔한 좌표계. */
export type Epsg =
  | "EPSG:4326" /* WGS84 위경도 */
  | "EPSG:5174" /* Bessel 중부원점(보정) — LOCALDATA 다수 */
  | "EPSG:5181" /* GRS80 중부원점 */
  | "EPSG:5179" /* UTM-K(GRS80) */
  | "EPSG:2097" /* Bessel 중부원점 */;

export interface LatLng {
  lat: number;
  lng: number;
}

// 한국 TM 좌표계 proj4 정의 등록.
// 투영·타원체·원점·축척은 EPSG 등록값과 일치(epsg.io 5174/5181/5179/2097 대조 확인).
// Bessel계(5174/2097)의 towgs84 7-파라미터는 **osgeo.kr(국토지리정보원 2002 고시 기반,
// 한국 GIS 사실상 표준) 세트**를 사용한다. epsg.io 공식 등록(Molodensky-Badekas 유도)값과는
// 약 16.7m 차이가 있으나, LOCALDATA(Bessel) 처리 관행상 이 세트가 표준이다.
// 부호는 PROJ Position Vector 규약. 측지 정밀이 필요하면 권위 측량점으로 재검증할 것(런북 11).
const KOREAN_DEFS: Record<Exclude<Epsg, "EPSG:4326">, string> = {
  "EPSG:5174":
    "+proj=tmerc +lat_0=38 +lon_0=127.0028902777778 +k=1 +x_0=200000 +y_0=500000 " +
    "+ellps=bessel +units=m +no_defs +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43",
  "EPSG:5181":
    "+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=500000 +ellps=GRS80 +units=m +no_defs",
  "EPSG:5179":
    "+proj=tmerc +lat_0=38 +lon_0=127.5 +k=0.9996 +x_0=1000000 +y_0=2000000 " +
    "+ellps=GRS80 +units=m +no_defs",
  "EPSG:2097":
    "+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=500000 " +
    "+ellps=bessel +units=m +no_defs +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43",
};

for (const [code, def] of Object.entries(KOREAN_DEFS)) {
  proj4.defs(code, def);
}

/**
 * 입력 좌표를 WGS84(EPSG:4326) 위경도로 변환한다. from이 WGS84면 그대로 통과.
 * 결정론(외부 상태 없음). 변환 불가 좌표는 호출부가 결측 처리한다.
 */
export function toWgs84(x: number, y: number, from: Epsg = "EPSG:5174"): LatLng {
  if (from === "EPSG:4326") {
    return { lat: y, lng: x };
  }
  const [lng, lat] = proj4(from, "EPSG:4326", [x, y]);
  return { lat, lng };
}

/** 한국 영역 위경도 타당성(대략 범위). 변환 결과 sanity 체크용. */
export function isPlausibleKoreaLatLng({ lat, lng }: LatLng): boolean {
  return lat >= 33 && lat <= 39 && lng >= 124 && lng <= 132;
}
