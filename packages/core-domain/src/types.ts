// ramen.live 코어 도메인 타입 — docs/TECHNICAL §2 스키마.
// 영속 엔티티는 Tier 1·3에 한한다. Tier 2(PriceQuote)는 apps/web 런타임 전용이며
// 이 패키지에 정의하지 않는다(INV-4).

/** 데이터셋 출처 ID. sourceRefs/statusSource에 기록한다(INV-9). */
export type SourceRef = string;

/** status 신뢰도 등급. high 미만은 UI에서 '추정'으로만 표기한다(INV-6). */
export type Confidence = "high" | "medium" | "low";

/**
 * 제품 판매상태.
 * - ON_SALE        판매중
 * - SALES_HALTED   판매중지 (회수 피드 기반, confidence high)
 * - RECALLED       회수      (회수 피드 기반, confidence high)
 * - DISCONTINUED?  단종추정  (제조사 폐업 or 스냅샷 부재, confidence < high)
 */
export type ProductStatus = "ON_SALE" | "SALES_HALTED" | "RECALLED" | "DISCONTINUED?";

export type PackageType = "BAG" | "CUP" | "OTHER";

export type BusinessStatus = "ACTIVE" | "CLOSED";

export interface Nutrition {
  /** 영양성분 함량 기준량 (예: "100g", "1회 제공량") */
  servingBasis: string;
  energyKcal: number;
  carbG: number;
  proteinG: number;
  fatG: number;
  sugarG?: number;
  satFatG?: number;
  transFatG?: number;
  sodiumMg?: number;
  cholesterolMg?: number;
}

/** 상태 + 근거 + 신뢰도는 항상 함께 다닌다(INV-6). */
export interface StatusInfo {
  status: ProductStatus;
  /** 상태 근거 데이터셋/규칙 */
  statusSource: SourceRef;
  statusConfidence: Confidence;
}

export interface RamenProduct {
  /** 품목제조보고번호 — 불변 PK(INV-5). 제품명·제조사명 변경에도 동일 레코드 유지. */
  id: string;
  /** 제품명 — 변동 가능, 비(非)키 */
  name: string;
  /** GTIN/KAN — Tier 2 상품 매칭 브리지 키 */
  barcode?: string;
  packageType: PackageType;
  /** → Manufacturer.id (인허가번호 LCNS_NO — 공장/사업장 단위) */
  manufacturerId: string;
  /** 제조사명(BSSH_NM) — 표시·동일제품 중복판정용(비키). 같은 브랜드가 공장별 LCNS_NO를
   *  여러 개 가지므로, 표시 중복 제거는 (제품명+제조사명)으로 한다. */
  manufacturerName?: string;
  /** 영양 DB 미커버 시 null(빈칸 미채움, Q2) */
  nutrition: Nutrition | null;
  status: ProductStatus;
  statusSource: SourceRef;
  statusConfidence: Confidence;
  /** 회수 피드 제공분 등 */
  imageUrl?: string;
  /** 패키지 표기 조리법 */
  officialRecipe?: string;
  /** 출처 데이터셋 ID 목록(INV-9) */
  sourceRefs: SourceRef[];
  /** ISO 8601 갱신 시각 */
  updatedAt: string;
}

/**
 * 조인 산출물(M1) = 상태 도출 입력(M2). status 3필드를 제외한 제품 코어 +
 * 도출에 필요한 신호(제조사 영업상태·매칭된 회수이벤트). M2가 여기에 status를
 * 부착하면 RamenProduct가 된다. (status 없는 미완성 레코드를 만들지 않기 위한 분리)
 */
export interface ProductDraft {
  /** 품목제조보고번호 — 불변 PK(INV-5) */
  id: string;
  name: string;
  barcode?: string;
  packageType: PackageType;
  manufacturerId: string;
  /** 제조사명(BSSH_NM) — RamenProduct로 전달(표시·중복판정). */
  manufacturerName?: string;
  nutrition: Nutrition | null;
  imageUrl?: string;
  officialRecipe?: string;
  sourceRefs: SourceRef[];
  updatedAt: string;
  // ── status 도출 입력(M2) ──
  /** 제조사 영업상태 — 폐업이면 DISCONTINUED? medium 후보 */
  manufacturerStatus: BusinessStatus;
  /** 품목제조보고번호/바코드로 매칭된 회수·판매중지 이벤트 */
  recallEvents: RecallEvent[];
}

export interface Manufacturer {
  /** 업체/업소 식별자(PK) */
  id: string;
  name: string;
  /** 폐업정보/인허가 이력 기반 */
  businessStatus: BusinessStatus;
  source: SourceRef;
}

export interface RamenShop {
  /** 인허가관리번호(PK) */
  id: string;
  name: string;
  address: string;
  /** WGS84 위경도(좌표 정규화 후) */
  lat?: number;
  lng?: number;
  businessStatus: BusinessStatus;
  /** 업태 */
  category?: string;
  isModelRestaurant?: boolean;
  source: SourceRef;
}

export interface RecallEvent {
  id: string;
  /** 품목제조보고번호 */
  productId?: string;
  barcode?: string;
  reason: string;
  /** 회수등급 */
  grade?: string;
  /** 회수·판매중지 유형 */
  kind: "RECALL" | "SALES_HALT";
  /** 제품사진 URL — 회수 피드 제공분(RamenProduct.imageUrl로 전달) */
  imageUrl?: string;
  /** ISO 8601 */
  reportedAt: string;
  /** 회수·판매중지 데이터셋 */
  source: SourceRef;
}

/** UGC 검수 상태 — approved만 공개(운영자 검수, 백서 §3.3). */
export type ModerationStatus = "PENDING" | "APPROVED" | "REJECTED";

/** Tier 3 UGC — 사이트 자체 제출분만 수용(INV-8). */
export interface Recipe {
  id: string;
  title: string;
  /** 사용 라면 제품(품목제조보고번호) */
  baseProductIds: string[];
  ingredients: string[];
  steps: string[];
  /** 사이트 가입 유저 */
  author: string;
  /** ISO 8601 */
  submittedAt: string;
  /** 검수 상태(공개 여부) */
  moderation: ModerationStatus;
}

/** Tier 3 UGC — 맛집 큐레이션(평점·코멘트). 음식점(인허가관리번호) 참조. */
export interface ShopCuration {
  id: string;
  /** 음식점 인허가관리번호 */
  shopId: string;
  /** 평점 1–5 */
  rating: number;
  comment: string;
  author: string;
  submittedAt: string;
  moderation: ModerationStatus;
}
