// 결정론적 해시 — 스냅샷 산출물 동일성 검증(INV-7)에 사용.

import { createHash } from "node:crypto";
import { stableStringify } from "./stable-json.js";

/** 문자열의 sha256 hex. */
export function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** 값을 결정론적으로 직렬화한 뒤 해시. 동일 입력 → 동일 해시(INV-7). */
export function contentHash(value: unknown): string {
  return sha256(stableStringify(value));
}
