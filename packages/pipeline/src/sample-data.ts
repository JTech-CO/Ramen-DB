// CLI 데모용 소형 raw 샘플(라이브 키 없이 스냅샷 산출·해시 시연). 결정론 고정.
// 라이브 수집(키 확보 후)에서는 ingest/adapters로 대체된다.

import type { RawInputs } from "./build.js";

export const SAMPLE_INPUTS: RawInputs = {
  products: [
    { PRDLST_REPORT_NO: "20210001", PRDLST_NM: "신라면", BSSH_NM: "농심", LCNS_NO: "MFR-NS", PRDLST_DCNM: "유탕면", BAR_CD: "8801043011286", PRMS_DT: "20210105" },
    { PRDLST_REPORT_NO: "20210002", PRDLST_NM: "진라면 매운맛", BSSH_NM: "오뚜기", LCNS_NO: "MFR-OT", PRDLST_DCNM: "유탕면", PRMS_DT: "20210210" },
    { PRDLST_REPORT_NO: "20210006", PRDLST_NM: "코레살 라멘", BSSH_NM: "폐업식품", LCNS_NO: "MFR-CL", PRDLST_DCNM: "건면", BAR_CD: "8801099033111", PRMS_DT: "20200606" },
    { PRDLST_REPORT_NO: "20210004", PRDLST_NM: "튀김우동", BSSH_NM: "농심", LCNS_NO: "MFR-NS", PRDLST_DCNM: "유탕면", PRMS_DT: "20210404" },
  ],
  nutritions: [
    { PRDLST_REPORT_NO: "20210001", NUT_CONT_SRTR_QUA: "1회제공량(120g)", ENERC: "505", CHOCDF: "79", PROT: "11", FATCE: "16", NAT: "1790" },
    { PRDLST_REPORT_NO: "20210002", NUT_CONT_SRTR_QUA: "1회제공량(120g)", ENERC: "500", CHOCDF: "80", PROT: "10", FATCE: "15", NAT: "1700" },
  ],
  recalls: [
    { PRDLST_NM: "진라면 매운맛", PRDLST_REPORT_NO: "20210002", BAR_CD: "8801045011112", RTRVL_RESN: "이물 혼입", RTRVL_SE: "판매중지", CRET_DTM: "20260501", SEQ: "RC-0001" },
  ],
  closures: [
    { LCNS_NO: "MFR-CL", BSSH_NM: "폐업식품", BSN_STATE_NM: "폐업" },
    { LCNS_NO: "MFR-NS", BSSH_NM: "농심", BSN_STATE_NM: "영업/정상" },
  ],
  corrections: { version: "sample", include: [], exclude: [] },
  // ── 음식점 레이어(M4) 샘플 ──
  restaurants: [
    { MGTNO: "MGT-0001", BPLCNM: "스미스라멘", RDNWHLADDR: "서울특별시 중구 세종대로 110", X: "210000", Y: "450000", TRDSTATENM: "영업/정상", UPTAENM: "일식" },
    { MGTNO: "MGT-0002", BPLCNM: "오라면집", RDNWHLADDR: "서울특별시 종로구 종로 1", X: "195000", Y: "460000", TRDSTATENM: "영업/정상", UPTAENM: "분식" },
    { MGTNO: "MGT-0005", BPLCNM: "멘야하나", RDNWHLADDR: "부산광역시 ...", TRDSTATENM: "폐업", UPTAENM: "일식" },
    { MGTNO: "MGT-0003", BPLCNM: "김밥천국", X: "200000", Y: "455000", TRDSTATENM: "영업/정상", UPTAENM: "분식" },
  ],
  modelRestaurants: [{ MGTNO: "MGT-0001", BPLCNM: "스미스라멘" }],
  shopCorrections: { version: "sample", include: [], exclude: [] },
};

/** 데모 기준시각·버전(결정론 고정). */
export const SAMPLE_AS_OF = "2026-06-18";
export const SAMPLE_VERSION = "snapshot-2026-W25";
