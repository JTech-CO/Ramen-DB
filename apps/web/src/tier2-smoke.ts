// Tier2 라이브 스모크 — 네이버쇼핑/쿠팡 가격 provider를 실제 키로 1회 조회해 결과를 "출력만" 한다.
// **비영속(INV-4)**: 어떤 결과도 파일/DB/스냅샷에 쓰지 않는다. console 출력 후 폐기.
// 키는 env에서만 주입(INV-1) — 키 값 자체는 절대 출력하지 않는다.
//
// 실행(레포 루트에서):
//   node --env-file=.env apps/web/dist/tier2-smoke.js [제품명]
// 예) node --env-file=.env apps/web/dist/tier2-smoke.js 신라면
//
// 제휴(쿠팡) 견적이 섞이면 PriceService가 buildAffiliateView를 단일 출구로 거쳐
// 확정형 대가성 문구(INV-10)를 부착한다. 여기선 문구 부착 여부만 표시한다.

import { createProvidersFromEnv, PriceService } from "./tier2/index.js";

/** URL의 host만 추출(긴 딥링크 대신 출처 식별용). 깨진 URL은 안전 표기. */
function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "(invalid-url)";
  }
}

async function main(): Promise<void> {
  const name = process.argv[2]?.trim() || process.env.SMOKE_QUERY?.trim() || "신라면";
  const providers = createProvidersFromEnv();

  if (providers.length === 0) {
    console.error(
      "구성된 Tier2 provider가 없습니다.\n" +
        "  .env에 NAVER_SEARCH_CLIENT_ID/SECRET (또는 COUPANG_PARTNERS_ACCESS_KEY/SECRET_KEY)를 넣고\n" +
        "  node --env-file=.env apps/web/dist/tier2-smoke.js 로 실행하세요(INV-1: 키는 커밋 금지).",
    );
    process.exitCode = 1;
    return;
  }

  console.log(`[Tier2 smoke] provider: ${providers.map((p) => p.source).join(", ")}`);
  console.log(`[Tier2 smoke] query="${name}"  (비영속 INV-4 — 출력만, 저장 없음)\n`);

  const service = new PriceService({ providers, limit: 5 });
  const view = await service.lookup({ name });

  console.log(
    `견적 ${view.quotes.length}건` + (view.disclosure ? "  · 대가성 문구 부착(INV-10)" : ""),
  );
  if (view.disclosure) console.log(`  ▸ ${view.disclosure}`);

  const top = view.quotes
    .slice()
    .sort((a, b) => (a.price ?? Number.POSITIVE_INFINITY) - (b.price ?? Number.POSITIVE_INFINITY))
    .slice(0, 8);
  for (const q of top) {
    const price = q.price !== undefined ? `${q.price.toLocaleString("ko-KR")}원` : "(가격없음)";
    console.log(`  - [${q.source}] ${q.seller} · ${price} · ${hostOf(q.url)} · ${q.fetchedAt}`);
  }
  if (view.quotes.length === 0) {
    console.log(
      "  (결과 0건 — 키 권한/일일한도/쿼리를 확인하세요. 네이버는 애플리케이션에 '검색' API 추가가 필요합니다.)",
    );
  }
}

main().catch((err) => {
  console.error("[Tier2 smoke] 실패:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
