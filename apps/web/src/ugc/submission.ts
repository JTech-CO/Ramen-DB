// UGC 제출(M7) — **사이트 자체 제출분만** 수용(INV-8). 외부 fetch/크롤러를 절대 사용하지 않는다.
// 입력은 사이트 폼에서 온 데이터 객체이며, 검증 통과 시 PENDING 엔티티로 만든다(운영자 검수 대기).

import type { CurationInput, Recipe, RecipeInput, ShopCuration } from "@ramen/core-domain";
import { validateCurationInput, validateRecipeInput } from "@ramen/core-domain";

export type SubmitResult<T> = { ok: true; entity: T } | { ok: false; errors: string[] };

export interface RecipeSubmitContext {
  /** 앱이 부여하는 식별자(결정론·테스트 용이) */
  id: string;
  /** 제출 시각 ISO 8601 */
  submittedAt: string;
  /** 참조 무결성 검증용 알려진 품목제조보고번호(INV-5) */
  knownProductIds: ReadonlySet<string>;
}

export interface CurationSubmitContext {
  id: string;
  submittedAt: string;
  /** 알려진 인허가관리번호 */
  knownShopIds: ReadonlySet<string>;
}

/** 레시피 제출 — 검증 후 PENDING 레시피 생성. 외부 콘텐츠 수집 없음(INV-8). */
export function submitRecipe(input: RecipeInput, ctx: RecipeSubmitContext): SubmitResult<Recipe> {
  const v = validateRecipeInput(input, ctx.knownProductIds);
  if (!v.valid) return { ok: false, errors: v.errors };
  const entity: Recipe = {
    id: ctx.id,
    title: input.title.trim(),
    baseProductIds: input.baseProductIds.map((s) => s.trim()),
    ingredients: input.ingredients.map((s) => s.trim()).filter((s) => s.length > 0),
    steps: input.steps.map((s) => s.trim()).filter((s) => s.length > 0),
    author: input.author.trim(),
    submittedAt: ctx.submittedAt,
    moderation: "PENDING",
  };
  return { ok: true, entity };
}

/** 맛집 큐레이션 제출 — 검증 후 PENDING 큐레이션 생성. 외부 수집 없음(INV-8). */
export function submitCuration(
  input: CurationInput,
  ctx: CurationSubmitContext,
): SubmitResult<ShopCuration> {
  const v = validateCurationInput(input, ctx.knownShopIds);
  if (!v.valid) return { ok: false, errors: v.errors };
  const entity: ShopCuration = {
    id: ctx.id,
    shopId: input.shopId.trim(),
    rating: input.rating,
    comment: input.comment.trim(),
    author: input.author.trim(),
    submittedAt: ctx.submittedAt,
    moderation: "PENDING",
  };
  return { ok: true, entity };
}
