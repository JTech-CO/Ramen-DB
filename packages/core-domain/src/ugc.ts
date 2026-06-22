// UGC 검증(M7) — 순수 도메인 규칙. 레시피/큐레이션 입력의 필수 필드·참조 무결성 검증.
// 크롤링 금지(INV-8)는 인입 경로(web)의 구조적 제약이며, 여기서는 '자체 제출 콘텐츠'의 유효성만 본다.

import type { ModerationStatus } from "./types.js";

export interface RecipeInput {
  title: string;
  /** 사용 라면 제품(품목제조보고번호) */
  baseProductIds: string[];
  ingredients: string[];
  steps: string[];
  /** 사이트 가입 유저(INV-8: 자체 제출 식별) */
  author: string;
}

export interface CurationInput {
  /** 음식점 인허가관리번호 */
  shopId: string;
  rating: number;
  comment: string;
  author: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export const MAX_TITLE_LEN = 120;
export const MAX_COMMENT_LEN = 1000;

function nonEmpty(s: unknown): s is string {
  return typeof s === "string" && s.trim().length > 0;
}

/** 레시피 입력 검증. author 필수(INV-8), baseProductIds는 알려진 품목제조보고번호여야 함(INV-5). */
export function validateRecipeInput(
  input: RecipeInput,
  knownProductIds: ReadonlySet<string>,
): ValidationResult {
  const errors: string[] = [];
  if (!nonEmpty(input.author)) errors.push("작성자(사이트 가입 유저)가 필요합니다(INV-8).");
  if (!nonEmpty(input.title)) errors.push("제목이 필요합니다.");
  else if (input.title.length > MAX_TITLE_LEN) errors.push("제목이 너무 깁니다.");
  if (!input.ingredients?.some(nonEmpty)) errors.push("재료가 1개 이상 필요합니다.");
  if (!input.steps?.some(nonEmpty)) errors.push("조리 단계가 1개 이상 필요합니다.");
  if (!input.baseProductIds || input.baseProductIds.length === 0) {
    errors.push("사용 라면 제품을 1개 이상 지정해야 합니다.");
  } else {
    const unknown = input.baseProductIds.filter((id) => !knownProductIds.has(id.trim()));
    if (unknown.length > 0) {
      errors.push(`알 수 없는 제품(품목제조보고번호): ${unknown.join(", ")} (INV-5)`);
    }
  }
  return { valid: errors.length === 0, errors };
}

/** 큐레이션 입력 검증. author 필수(INV-8), shopId는 알려진 인허가관리번호, 평점 1–5 정수. */
export function validateCurationInput(
  input: CurationInput,
  knownShopIds: ReadonlySet<string>,
): ValidationResult {
  const errors: string[] = [];
  if (!nonEmpty(input.author)) errors.push("작성자가 필요합니다(INV-8).");
  if (!nonEmpty(input.comment)) errors.push("코멘트가 필요합니다.");
  else if (input.comment.length > MAX_COMMENT_LEN) errors.push("코멘트가 너무 깁니다.");
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    errors.push("평점은 1–5 사이 정수여야 합니다.");
  }
  if (!nonEmpty(input.shopId) || !knownShopIds.has(input.shopId.trim())) {
    errors.push("알 수 없는 음식점(인허가관리번호)입니다.");
  }
  return { valid: errors.length === 0, errors };
}

/** approved만 공개(운영자 검수, 백서 §3.3). */
export function isPublic(entity: { moderation: ModerationStatus }): boolean {
  return entity.moderation === "APPROVED";
}
