import { describe, expect, it } from "vitest";
import { isPlausibleKoreaLatLng } from "@ramen/shared";
import {
  deriveShopStatus,
  normalizeModelRestaurant,
  normalizeRestaurant,
} from "./shop-normalize.js";
import { RAW_RESTAURANTS } from "./__fixtures__/shops.js";

const byId = (id: string) => RAW_RESTAURANTS.find((r) => r.MGTNO === id)!;

describe("deriveShopStatus", () => {
  it("영업/정상 → ACTIVE, 폐업·휴업·말소 → CLOSED", () => {
    expect(deriveShopStatus("영업/정상")).toBe("ACTIVE");
    expect(deriveShopStatus("폐업")).toBe("CLOSED");
    expect(deriveShopStatus("휴업")).toBe("CLOSED");
    expect(deriveShopStatus("취소/말소")).toBe("CLOSED");
    expect(deriveShopStatus("")).toBe("CLOSED"); // 불명은 보수적 CLOSED
  });
});

describe("normalizeRestaurant", () => {
  it("PK·이름·주소·업태·영업상태 매핑", () => {
    const s1 = normalizeRestaurant(byId("MGT-0001"));
    expect(s1.id).toBe("MGT-0001");
    expect(s1.name).toBe("스미스라멘");
    expect(s1.address).toBe("서울특별시 중구 세종대로 110");
    expect(s1.category).toBe("일식");
    expect(s1.businessStatus).toBe("ACTIVE");
  });

  it("좌표 TM→WGS84 변환 후 한국 범위 내 (M4 DoD #3)", () => {
    const s1 = normalizeRestaurant(byId("MGT-0001"));
    expect(s1.lat).toBeDefined();
    expect(s1.lng).toBeDefined();
    expect(isPlausibleKoreaLatLng({ lat: s1.lat!, lng: s1.lng! })).toBe(true);
  });

  it("좌표 결측/무효는 lat/lng 생략(빈칸 미채움)", () => {
    const s5 = normalizeRestaurant(byId("MGT-0005")); // X=""/Y=""
    expect(s5.lat).toBeUndefined();
    expect(s5.lng).toBeUndefined();
    const origin = normalizeRestaurant({
      MGTNO: "Z",
      BPLCNM: "원점",
      X: "0",
      Y: "0",
      UPTAENM: "일식",
    });
    expect(origin.lat).toBeUndefined(); // (0,0)은 무효
  });

  it("폐업 음식점 CLOSED", () => {
    expect(normalizeRestaurant(byId("MGT-0005")).businessStatus).toBe("CLOSED");
  });

  it("도로명 우선, 없으면 지번 주소", () => {
    expect(normalizeRestaurant(byId("MGT-0003")).address).toBe("서울특별시 마포구 ...");
  });

  it("결정론: 동일 입력 2회 동일", () => {
    expect(normalizeRestaurant(byId("MGT-0001"))).toEqual(normalizeRestaurant(byId("MGT-0001")));
  });
});

describe("normalizeModelRestaurant", () => {
  it("인허가관리번호 추출", () => {
    expect(normalizeModelRestaurant({ MGTNO: " MGT-0001 " })).toBe("MGT-0001");
  });
});
