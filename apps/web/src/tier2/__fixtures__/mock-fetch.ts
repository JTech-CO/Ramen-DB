// 테스트용 mock fetch — 라이브 호출 없이 provider 정규화 검증(M5 DoD).

export interface MockFetch {
  fn: typeof fetch;
  state: { calls: number; lastUrl?: string };
}

export function makeFetch(payload: unknown, ok = true): MockFetch {
  const state: { calls: number; lastUrl?: string } = { calls: 0 };
  const fn = (async (input: Parameters<typeof fetch>[0]) => {
    state.calls++;
    state.lastUrl = input instanceof URL ? input.toString() : String(input);
    return {
      ok,
      status: ok ? 200 : 500,
      statusText: ok ? "OK" : "ERR",
      json: async () => payload,
    } as unknown as Response;
  }) as typeof fetch;
  return { fn, state };
}
