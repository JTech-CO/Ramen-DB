// 출처표기(INV-9) — 외부 출처 데이터 표시 시 출처를 명시하기 위한 데이터셋 레지스트리.
// Tier1 공공데이터 라이선스·Tier2 상용 API 약관 준수. shared는 도메인을 모르므로
// '데이터셋 메타'만 다룬다.

export interface DatasetSource {
  /** sourceRefs에 기록되는 안정 ID */
  id: string;
  /** 표시용 한글 명칭 */
  label: string;
  /** 발급/관리 기관 */
  provider: string;
  /** 데이터 계층 */
  tier: 1 | 2 | 3;
  /** 라이선스/약관 요지 */
  license: string;
}

/** Tier1 공공데이터 + Tier2 상용 API 출처 레지스트리. */
export const DATASET_SOURCES = {
  PRODUCT_REPORT: {
    id: "PRODUCT_REPORT",
    label: "식품(첨가물)품목제조보고",
    provider: "식품의약품안전처",
    tier: 1,
    license: "공공누리 / data.go.kr 15062098",
  },
  NUTRITION: {
    id: "NUTRITION",
    label: "식품영양성분 통합 DB",
    provider: "식품의약품안전처",
    tier: 1,
    license: "공공누리 / data.go.kr 15127578",
  },
  RECALL: {
    id: "RECALL",
    label: "식품 회수·판매중지 정보",
    provider: "식품의약품안전처",
    tier: 1,
    license: "공공누리 / data.go.kr 15074318",
  },
  MANUFACTURER_CLOSURE: {
    id: "MANUFACTURER_CLOSURE",
    label: "식품제조가공업 폐업정보",
    provider: "행정안전부 / LOCALDATA",
    tier: 1,
    license: "공공누리 / localdata.go.kr",
  },
  RESTAURANT: {
    id: "RESTAURANT",
    label: "전국 일반음식점 표준데이터",
    provider: "행정안전부 / LOCALDATA",
    tier: 1,
    license: "공공누리 / data.go.kr 15096283",
  },
  MODEL_RESTAURANT: {
    id: "MODEL_RESTAURANT",
    label: "모범음식점 정보",
    provider: "행정안전부 / LOCALDATA",
    tier: 1,
    license: "공공누리 / localdata.go.kr",
  },
} as const satisfies Record<string, DatasetSource>;

export type DatasetId = keyof typeof DATASET_SOURCES;

/** sourceRef ID로 표시용 출처 라벨을 얻는다. 미등록 ID는 그대로 반환(출처 누락 방지). */
export function attributionLabel(id: string): string {
  const known = (DATASET_SOURCES as Record<string, DatasetSource>)[id];
  return known ? `${known.label} (${known.provider})` : id;
}
