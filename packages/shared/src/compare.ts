// 결정론적 문자열 비교 — 정렬이 산출/해시를 좌우하는 경로(INV-7)에 사용한다.
// localeCompare는 호스트 로케일·ICU에 의존해 교차환경 비결정이므로, 코드유닛(사전식)
// 비교로 통일한다. (stable-json의 Object.keys().sort()와 동일한 결정론 규칙)

/** 코드유닛(UTF-16) 사전식 비교. 로케일 비의존, 동일 입력 → 동일 순서. */
export function compareCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
