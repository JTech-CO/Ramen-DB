// 운영자 검수(M7) — PENDING → APPROVED/REJECTED. approved만 공개(백서 §3.3).

import type { ModerationStatus } from "@ramen/core-domain";

export type ModerationDecision = "APPROVED" | "REJECTED";

/** 검수 결정을 적용한 새 엔티티 반환(불변). */
export function moderate<T extends { moderation: ModerationStatus }>(
  entity: T,
  decision: ModerationDecision,
): T {
  return { ...entity, moderation: decision };
}
