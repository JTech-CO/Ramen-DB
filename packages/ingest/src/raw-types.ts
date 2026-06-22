// 공공데이터 원시 응답 타입 — 식약처/LOCALDATA OpenAPI 필드 모델.
// 필드명은 data.go.kr 식약처 OpenAPI 관례에 따른다. 라이브 연동 시 실제 응답과
// 차이가 나면 이 파일(어댑터 계약)만 갱신한다(런북 9). 모든 raw 값은 문자열로 온다.

/** 식품(첨가물)품목제조보고 (data.go.kr 15062098). */
export interface RawProductReport {
  /** 품목제조보고번호 — PK */
  PRDLST_REPORT_NO: string;
  /** 제품명 */
  PRDLST_NM: string;
  /** 업소(제조사)명 */
  BSSH_NM: string;
  /** 인허가번호 — 제조사 식별 */
  LCNS_NO?: string;
  /** 품목유형(식품유형 분류명) — 예: 유탕면, 건면 */
  PRDLST_DCNM?: string;
  /** 원재료명 */
  RAWMTRL_NM?: string;
  /** 바코드(GTIN/KAN) — 제공되는 경우 */
  BAR_CD?: string;
  /** 보고/변경 일자 (YYYYMMDD 또는 ISO) */
  PRMS_DT?: string;
}

/** 식품영양성분 통합 DB (data.go.kr 15127578). 함량은 문자열 수치. */
export interface RawNutrition {
  /** 식품코드 */
  FOOD_CD?: string;
  /** 식품명 */
  FOOD_NM_KR?: string;
  /** 품목제조보고번호 — 조인 키 */
  PRDLST_REPORT_NO: string;
  BSSH_NM?: string;
  /** 영양성분 함량기준량 (예: "100g", "1회제공량(120g)") */
  NUT_CONT_SRTR_QUA?: string;
  /** 에너지(kcal) */
  ENERC?: string;
  /** 탄수화물(g) */
  CHOCDF?: string;
  /** 단백질(g) */
  PROT?: string;
  /** 지방(g) */
  FATCE?: string;
  /** 당류(g) */
  SUGAR?: string;
  /** 포화지방(g) */
  FASAT?: string;
  /** 트랜스지방(g) */
  FATRN?: string;
  /** 나트륨(mg) */
  NAT?: string;
  /** 콜레스테롤(mg) */
  CHOLE?: string;
}

/** 식품 회수·판매중지 정보 (data.go.kr 15074318). */
export interface RawRecall {
  /** 제품명 */
  PRDLST_NM?: string;
  /** 품목제조보고번호 */
  PRDLST_REPORT_NO?: string;
  /** 바코드번호 */
  BAR_CD?: string;
  /** 제조업체명 */
  BSSH_NM?: string;
  /** 회수/판매중지 사유 */
  RTRVL_RESN?: string;
  /** 회수등급 */
  RTRVL_GRAD?: string;
  /** 구분 — "회수" | "판매중지" */
  RTRVL_SE?: string;
  /** 제품사진 URL */
  IMG_URL?: string;
  /** 회수/공표 일자 */
  CRET_DTM?: string;
  /** 고유 식별(있으면) */
  SEQ?: string;
}

/** 식품제조가공업 폐업정보 (LOCALDATA 계열). */
export interface RawClosure {
  /** 인허가번호 — 제조사 식별(제품의 LCNS_NO와 매칭) */
  LCNS_NO?: string;
  /** 업소명 */
  BSSH_NM?: string;
  /** 영업상태명 — "영업/정상", "폐업" 등 */
  BSN_STATE_NM?: string;
  /** 폐업일자 */
  CLSBIZ_DT?: string;
}

/** 전국 일반음식점 표준데이터 (LOCALDATA). 좌표는 TM(중부원점) 문자열. */
export interface RawRestaurant {
  /** 관리번호 = 인허가관리번호(음식점 PK) */
  MGTNO: string;
  /** 사업장명 */
  BPLCNM: string;
  /** 도로명 전체주소 */
  RDNWHLADDR?: string;
  /** 지번 전체주소 */
  SITEWHLADDR?: string;
  /** 좌표정보 X (TM) */
  X?: string;
  /** 좌표정보 Y (TM) */
  Y?: string;
  /** 영업상태명 — "영업/정상", "폐업" 등 */
  TRDSTATENM?: string;
  /** 상세영업상태명 — "영업", "휴업", "폐업" 등 */
  DTLSTATENM?: string;
  /** 업태구분명 — "일식", "분식", "한식" 등 */
  UPTAENM?: string;
  /** 인허가일자 */
  APVPERMYMD?: string;
}

/** 모범음식점 정보 (LOCALDATA). 지정 업소의 인허가관리번호. */
export interface RawModelRestaurant {
  MGTNO: string;
  BPLCNM?: string;
}
