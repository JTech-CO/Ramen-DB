// 음식점(M4) 고정 픽스처. TP/FP/FN/TN, 좌표 유무, 영업/폐업, 모범음식점, 음성키워드.
// 좌표는 중부원점(EPSG:5174) TM — 중부 한국 범위로 변환되어야 한다.

import type { RawModelRestaurant, RawRestaurant } from "../raw-types.js";

export const RAW_RESTAURANTS: RawRestaurant[] = [
  // S1 TP: 라멘(일식), 좌표·영업, 모범음식점.
  {
    MGTNO: "MGT-0001",
    BPLCNM: "스미스라멘",
    RDNWHLADDR: "서울특별시 중구 세종대로 110",
    X: "210000",
    Y: "450000",
    TRDSTATENM: "영업/정상",
    DTLSTATENM: "영업",
    UPTAENM: "일식",
    APVPERMYMD: "20190301",
  },
  // S2 TP: 라면(분식), 좌표·영업.
  {
    MGTNO: "MGT-0002",
    BPLCNM: "오라면집",
    RDNWHLADDR: "서울특별시 종로구 종로 1",
    X: "195000",
    Y: "460000",
    TRDSTATENM: "영업/정상",
    UPTAENM: "분식",
  },
  // S3 TN: 김밥천국(분식) — 키워드 없음.
  {
    MGTNO: "MGT-0003",
    BPLCNM: "김밥천국",
    SITEWHLADDR: "서울특별시 마포구 ...",
    X: "200000",
    Y: "455000",
    TRDSTATENM: "영업/정상",
    UPTAENM: "분식",
  },
  // S4 TN: 스시조(일식) — 키워드 없음, 좌표 없음.
  {
    MGTNO: "MGT-0004",
    BPLCNM: "스시조",
    RDNWHLADDR: "서울특별시 강남구 ...",
    TRDSTATENM: "영업/정상",
    UPTAENM: "일식",
  },
  // S5 TP: 멘야하나(일식), 폐업, 좌표 없음.
  {
    MGTNO: "MGT-0005",
    BPLCNM: "멘야하나",
    RDNWHLADDR: "부산광역시 ...",
    X: "",
    Y: "",
    TRDSTATENM: "폐업",
    DTLSTATENM: "폐업",
    UPTAENM: "일식",
  },
  // S6 FP→보정제외: 원조라면땅(분식) — '라면' 키워드 걸리나 과자 가게.
  {
    MGTNO: "MGT-0006",
    BPLCNM: "원조라면땅",
    X: "205000",
    Y: "470000",
    TRDSTATENM: "영업/정상",
    UPTAENM: "분식",
  },
  // S7 FN→보정포함: 하카타분코(일식 라멘 브랜드) — 상호에 키워드 없음.
  {
    MGTNO: "MGT-0007",
    BPLCNM: "하카타분코",
    RDNWHLADDR: "서울특별시 용산구 ...",
    X: "198000",
    Y: "452000",
    TRDSTATENM: "영업/정상",
    UPTAENM: "일식",
  },
  // S8 TN: 편의점(음성키워드) — 컵라면 제공처.
  {
    MGTNO: "MGT-0008",
    BPLCNM: "역전편의점",
    X: "201000",
    Y: "458000",
    TRDSTATENM: "영업/정상",
    UPTAENM: "기타",
  },
];

/** 정답 라벨(실제 라멘/라면 음식점 여부). */
export const EXPECTED_RAMEN_SHOP: Record<string, boolean> = {
  "MGT-0001": true,
  "MGT-0002": true,
  "MGT-0003": false,
  "MGT-0004": false,
  "MGT-0005": true,
  "MGT-0006": false,
  "MGT-0007": true,
  "MGT-0008": false,
};

export const RAW_MODEL_RESTAURANTS: RawModelRestaurant[] = [
  { MGTNO: "MGT-0001", BPLCNM: "스미스라멘" },
];
