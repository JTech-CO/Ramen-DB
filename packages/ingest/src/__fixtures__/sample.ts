// 고정 픽스처 — M1 단위 테스트용. 라이브 API 미사용, 결정론 보장.
// 케이스: TP/FP/FN/TN, 영양 커버리지 갭, 바코드 보강, 회수(번호·바코드 매칭),
// 제조사 폐업, 품목제조보고번호 공백 변형(RUNBOOK 6).

import type { RawClosure, RawNutrition, RawProductReport, RawRecall } from "../raw-types.js";

export const RAW_PRODUCTS: RawProductReport[] = [
  // P1 TP: 신라면(키워드 라면), 바코드 보유, 영양 보유, 회수는 바코드로 매칭.
  {
    PRDLST_REPORT_NO: "20210001",
    PRDLST_NM: "신라면",
    BSSH_NM: "농심",
    LCNS_NO: "MFR-NS",
    PRDLST_DCNM: "유탕면",
    BAR_CD: "8801043011286",
    PRMS_DT: "20210105",
  },
  // P2 TP: 진라면, 바코드 없음(회수 피드로 보강), 영양 보유, 판매중지 회수(번호 매칭).
  {
    PRDLST_REPORT_NO: "20210002",
    PRDLST_NM: "진라면 매운맛",
    BSSH_NM: "오뚜기",
    LCNS_NO: "MFR-OT",
    PRDLST_DCNM: "유탕면",
    PRMS_DT: "20210210",
  },
  // P3 TP: 컵라면(키워드 컵라면), CUP 추론, 영양 보유.
  {
    PRDLST_REPORT_NO: "20210003",
    PRDLST_NM: "오뚜기 컵라면 김치",
    BSSH_NM: "오뚜기",
    LCNS_NO: "MFR-OT",
    PRDLST_DCNM: "유탕면",
    BAR_CD: "8801045022345",
    PRMS_DT: "20210303",
  },
  // P4 TN: 튀김우동 — 음성키워드 '우동'.
  {
    PRDLST_REPORT_NO: "20210004",
    PRDLST_NM: "튀김우동",
    BSSH_NM: "농심",
    LCNS_NO: "MFR-NS",
    PRDLST_DCNM: "유탕면",
    PRMS_DT: "20210404",
  },
  // P5 TN: 라면땅 — 음성키워드 '라면땅'(유탕면으로 오분류된 과자).
  {
    PRDLST_REPORT_NO: "20210005",
    PRDLST_NM: "라면땅",
    BSSH_NM: "서주",
    LCNS_NO: "MFR-SJ",
    PRDLST_DCNM: "유탕면",
    PRMS_DT: "20210505",
  },
  // P6 TP: 코레살 라멘(키워드 라멘), 건면, 영양 미커버(null), 제조사 폐업.
  {
    PRDLST_REPORT_NO: "20210006",
    PRDLST_NM: "코레살 라멘",
    BSSH_NM: "폐업식품",
    LCNS_NO: "MFR-CL",
    PRDLST_DCNM: "건면",
    BAR_CD: "8801099033111",
    PRMS_DT: "20200606",
  },
  // P7 TN: 스파게티면 — 음성키워드 '스파게티'.
  {
    PRDLST_REPORT_NO: "20210007",
    PRDLST_NM: "스파게티면",
    BSSH_NM: "면사랑",
    LCNS_NO: "MFR-MS",
    PRDLST_DCNM: "건면",
    PRMS_DT: "20210707",
  },
  // P8 FN→보정포함: 안성탕면 — 라면이나 '라면' 키워드 없음(보정 include로 구제).
  {
    PRDLST_REPORT_NO: "20210008",
    PRDLST_NM: "안성탕면",
    BSSH_NM: "농심",
    LCNS_NO: "MFR-NS",
    PRDLST_DCNM: "유탕면",
    BAR_CD: "8801043055678",
    PRMS_DT: "20210808",
  },
  // P9 FP→보정제외: 라면스프(조미료) — '라면' 키워드 걸리나 라면 아님(보정 exclude로 제거).
  {
    PRDLST_REPORT_NO: "20210009",
    PRDLST_NM: "진한 라면스프",
    BSSH_NM: "오뚜기",
    LCNS_NO: "MFR-OT",
    PRDLST_DCNM: "유탕면",
    PRMS_DT: "20210909",
  },
];

/** 정답 라벨(실제 라면 여부) — 정밀도 리포트용. */
export const EXPECTED_RAMEN: Record<string, boolean> = {
  "20210001": true,
  "20210002": true,
  "20210003": true,
  "20210004": false,
  "20210005": false,
  "20210006": true,
  "20210007": false,
  "20210008": true,
  "20210009": false,
};

export const RAW_NUTRITION: RawNutrition[] = [
  // 주의: 품목제조보고번호에 공백 변형(RUNBOOK 6) — 조인 키 정규화로 매칭되어야 한다.
  {
    PRDLST_REPORT_NO: " 20210001 ",
    NUT_CONT_SRTR_QUA: "1회제공량(120g)",
    ENERC: "505",
    CHOCDF: "79",
    PROT: "11",
    FATCE: "16",
    SUGAR: "4",
    FASAT: "8",
    FATRN: "0",
    NAT: "1790",
    CHOLE: "0",
  },
  {
    PRDLST_REPORT_NO: "20210002",
    NUT_CONT_SRTR_QUA: "1회제공량(120g)",
    ENERC: "500",
    CHOCDF: "80",
    PROT: "10",
    FATCE: "15",
    NAT: "1700",
    // 당·포화·트랜스·콜레스테롤 미제공 → 해당 필드 undefined.
  },
  {
    PRDLST_REPORT_NO: "20210003",
    NUT_CONT_SRTR_QUA: "1회제공량(110g)",
    ENERC: "440",
    CHOCDF: "70",
    PROT: "9",
    FATCE: "13",
    NAT: "1500",
  },
  {
    PRDLST_REPORT_NO: "20210008",
    NUT_CONT_SRTR_QUA: "1회제공량(125g)",
    ENERC: "525",
    CHOCDF: "82",
    PROT: "12",
    FATCE: "17",
    NAT: "1600",
  },
  // P6(20210006)은 영양 DB 미커버 → nutrition=null (Q2 갭).
];

export const RAW_RECALLS: RawRecall[] = [
  // R1: P2 판매중지(번호 매칭) + 바코드 제공(보강) + 이미지.
  {
    PRDLST_NM: "진라면 매운맛",
    PRDLST_REPORT_NO: "20210002",
    BAR_CD: "8801045011112",
    BSSH_NM: "오뚜기",
    RTRVL_RESN: "이물 혼입",
    RTRVL_GRAD: "2등급",
    RTRVL_SE: "판매중지",
    IMG_URL: "https://example.go.kr/img/20210002.jpg",
    CRET_DTM: "20260501",
    SEQ: "RC-0001",
  },
  // R2: P1 회수(바코드만 매칭, 번호 없음).
  {
    PRDLST_NM: "신라면",
    BAR_CD: "8801043011286",
    BSSH_NM: "농심",
    RTRVL_RESN: "표시기준 위반",
    RTRVL_GRAD: "3등급",
    RTRVL_SE: "회수",
    CRET_DTM: "20260512",
    SEQ: "RC-0002",
  },
];

export const RAW_CLOSURES: RawClosure[] = [
  // P6 제조사 폐업 → CLOSED.
  { LCNS_NO: "MFR-CL", BSSH_NM: "폐업식품", BSN_STATE_NM: "폐업", CLSBIZ_DT: "20240131" },
  // MFR-NS(P1·P8 제조사) 영업 확인 → ACTIVE. 폐업정보 데이터셋이 상태를 확인했으므로
  // 해당 제품 sourceRefs에 MANUFACTURER_CLOSURE가 provenance로 포함된다.
  { LCNS_NO: "MFR-NS", BSSH_NM: "농심", BSN_STATE_NM: "영업/정상" },
];

/** 스냅샷 기준시각(결정론 주입용). */
export const AS_OF = "2026-06-18";
