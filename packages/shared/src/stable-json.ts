// 결정론적 직렬화 — idempotent 스냅샷(INV-7)의 토대.
// 키를 재귀적으로 정렬해 동일 입력 → 동일 바이트열을 보장한다. 생성시각 등
// 비결정 값은 호출부에서 산출 본문과 분리한다(런북 4).

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

/** 객체 키를 재귀 정렬한 정규형으로 변환. 배열 순서는 보존(호출부가 정렬 책임). */
export function canonicalize(value: unknown): Json {
  if (value === null || typeof value !== "object") {
    return value as Json;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  const obj = value as Record<string, unknown>;
  const out: Record<string, Json> = {};
  for (const key of Object.keys(obj).sort()) {
    const v = obj[key];
    if (v === undefined) continue; // undefined 필드는 직렬화에서 제외(결정론)
    out[key] = canonicalize(v);
  }
  return out;
}

/** 키 정렬된 결정론적 JSON 문자열. 동일 입력 → 동일 출력(INV-7). */
export function stableStringify(value: unknown, indent = 0): string {
  return JSON.stringify(canonicalize(value), null, indent);
}
