import { describe, expect, it } from "vitest";
import proj4 from "proj4";
import { isPlausibleKoreaLatLng, toWgs84 } from "./coords.js";

// 서울시청 근방(WGS84). coords.js import로 한국 EPSG 정의가 등록된다.
const SEOUL = { lat: 37.5663, lng: 126.9779 };

describe("toWgs84 — 좌표 변환 (M4 DoD #3)", () => {
  it("WGS84 입력은 그대로 통과(x=lng, y=lat)", () => {
    expect(toWgs84(126.9779, 37.5663, "EPSG:4326")).toEqual({ lat: 37.5663, lng: 126.9779 });
  });

  it("EPSG:5174 왕복(round-trip) 허용오차 내 일치 + 한국 범위", () => {
    const [x, y] = proj4("EPSG:4326", "EPSG:5174", [SEOUL.lng, SEOUL.lat]);
    const back = toWgs84(x!, y!, "EPSG:5174");
    expect(back.lat).toBeCloseTo(SEOUL.lat, 6);
    expect(back.lng).toBeCloseTo(SEOUL.lng, 6);
    expect(isPlausibleKoreaLatLng(back)).toBe(true);
  });

  it("EPSG:5181(GRS80 중부원점) 왕복 일치", () => {
    const [x, y] = proj4("EPSG:4326", "EPSG:5181", [SEOUL.lng, SEOUL.lat]);
    const back = toWgs84(x!, y!, "EPSG:5181");
    expect(back.lat).toBeCloseTo(SEOUL.lat, 6);
    expect(back.lng).toBeCloseTo(SEOUL.lng, 6);
  });

  it("기본 EPSG는 5174 (from 생략 가능)", () => {
    const [x, y] = proj4("EPSG:4326", "EPSG:5174", [SEOUL.lng, SEOUL.lat]);
    expect(toWgs84(x!, y!)).toEqual(toWgs84(x!, y!, "EPSG:5174"));
  });

  it("결정론: 동일 입력 2회 → 동일 결과", () => {
    const [x, y] = proj4("EPSG:4326", "EPSG:5174", [SEOUL.lng, SEOUL.lat]);
    expect(toWgs84(x!, y!, "EPSG:5174")).toEqual(toWgs84(x!, y!, "EPSG:5174"));
  });
});

describe("isPlausibleKoreaLatLng", () => {
  it("한국 범위 안/밖 판정", () => {
    expect(isPlausibleKoreaLatLng({ lat: 37.5, lng: 127 })).toBe(true);
    expect(isPlausibleKoreaLatLng({ lat: 0, lng: 0 })).toBe(false);
    expect(isPlausibleKoreaLatLng({ lat: 48, lng: 2 })).toBe(false); // 파리
  });
});
