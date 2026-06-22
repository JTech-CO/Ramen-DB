// @ramen/core-domain — 순수 도메인. 타입·불변식 단언·status 도출 규칙.
// 외부 패키지 의존 없음(INV-3). PriceQuote(Tier2)는 여기 없다(INV-4).

export type {
  SourceRef,
  Confidence,
  ProductStatus,
  PackageType,
  BusinessStatus,
  Nutrition,
  StatusInfo,
  RamenProduct,
  ProductDraft,
  Manufacturer,
  RamenShop,
  RecallEvent,
  Recipe,
  ShopCuration,
  ModerationStatus,
} from "./types.js";

export type { RecipeInput, CurationInput, ValidationResult } from "./ugc.js";
export {
  MAX_TITLE_LEN,
  MAX_COMMENT_LEN,
  validateRecipeInput,
  validateCurationInput,
  isPublic,
} from "./ugc.js";

export {
  normalizeProductId,
  isValidProductId,
  assertStatusInfo,
  isEstimated,
  statusDisplayLabel,
  hasValidStatus,
} from "./invariants.js";

export type { StatusSignals, RecallMatchReport } from "./status.js";
export {
  STATUS_SOURCE,
  DEFAULT_ABSENCE_THRESHOLD,
  deriveStatus,
  deriveProductStatus,
  finalizeProduct,
  deriveAndFinalize,
  recallMatchReport,
} from "./status.js";
