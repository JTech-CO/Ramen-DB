// HTML 이스케이프 — 외부 데이터(제품명·주소 등)를 안전하게 렌더(XSS 차단).

const ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ENTITIES[c] ?? c);
}

/** 속성값(URL 등) 이스케이프 — 위와 동일하나 의미 명시. */
export function escapeAttr(value: unknown): string {
  return escapeHtml(value);
}
