// UGC(M7) 공개 API — 자체 제출·검수·저장(INV-8: 외부 크롤링 없음).

export type {
  SubmitResult,
  RecipeSubmitContext,
  CurationSubmitContext,
} from "./submission.js";
export { submitRecipe, submitCuration } from "./submission.js";

export type { ModerationDecision } from "./moderation.js";
export { moderate } from "./moderation.js";

export type { UgcRepository, ListOptions } from "./repository.js";
export { InMemoryUgcRepository } from "./repository.js";
