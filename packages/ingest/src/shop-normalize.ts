// 음식점 정규화(M4) — LOCALDATA raw → 도메인 중간형. 인허가관리번호 PK·주소·좌표→WGS84·영업상태.
// 순수·결정론. 좌표 결측/무효(한국 범위 밖)는 lat/lng 생략(빈칸 미채움).

import type { BusinessStatus } from "@ramen/core-domain";
import { isPlausibleKoreaLatLng, toWgs84, type Epsg, type LatLng } from "@ramen/shared";
import { normalizeDate, parseNum } from "./normalize.js";
import type { RawModelRestaurant, RawRestaurant } from "./raw-types.js";

export interface NormalizedShop {
  /** 인허가관리번호(PK) */
  id: string;
  name: string;
  address: string;
  lat?: number;
  lng?: number;
  businessStatus: BusinessStatus;
  /** 업태 */
  category: string;
  approvedAt?: string;
}

/** 영업상태명 → ACTIVE/CLOSED. 폐업·말소·취소·휴업은 CLOSED, 영업/정상은 ACTIVE, 불명은 보수적 CLOSED. */
export function deriveShopStatus(stateName: string): BusinessStatus {
  if (/폐업|말소|취소|직권|휴업/.test(stateName)) return "CLOSED";
  if (/영업|정상/.test(stateName)) return "ACTIVE";
  return "CLOSED";
}

function toShopCoords(rawX: string | undefined, rawY: string | undefined, epsg: Epsg): LatLng | undefined {
  const x = parseNum(rawX);
  const y = parseNum(rawY);
  if (x === undefined || y === undefined || (x === 0 && y === 0)) return undefined;
  const ll = toWgs84(x, y, epsg);
  // 한국 범위 밖이면 좌표계 오판/오류로 보고 결측 처리(런북 11).
  return isPlausibleKoreaLatLng(ll) ? ll : undefined;
}

export function normalizeRestaurant(
  raw: RawRestaurant,
  opts: { epsg?: Epsg } = {},
): NormalizedShop {
  const id = raw.MGTNO.trim();
  const name = raw.BPLCNM.trim();
  const address = (raw.RDNWHLADDR?.trim() || raw.SITEWHLADDR?.trim() || "").trim();
  const stateName = `${raw.TRDSTATENM ?? ""} ${raw.DTLSTATENM ?? ""}`;
  const coords = toShopCoords(raw.X, raw.Y, opts.epsg ?? "EPSG:5174");
  const approvedAt = normalizeDate(raw.APVPERMYMD);
  return {
    id,
    name,
    address,
    ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
    businessStatus: deriveShopStatus(stateName),
    category: (raw.UPTAENM ?? "").trim(),
    ...(approvedAt ? { approvedAt } : {}),
  };
}

/** 모범음식점 raw → 인허가관리번호. */
export function normalizeModelRestaurant(raw: RawModelRestaurant): string {
  return raw.MGTNO.trim();
}
