// env 자격으로 가격 provider 구성(라이브 키 연동 진입점). 키 없는 provider는 제외(부분 구성 허용).
// 키는 env에서만(INV-1). 어떤 provider도 키가 없으면 빈 배열 → PriceService는 빈 결과 반환.

import { CoupangPartnersProvider, loadCoupangCredentials } from "./providers/coupang-partners.js";
import { NaverShoppingProvider, loadNaverCredentials } from "./providers/naver-shopping.js";
import type { PriceProvider } from "./providers/provider.js";

export function createProvidersFromEnv(env: NodeJS.ProcessEnv = process.env): PriceProvider[] {
  const providers: PriceProvider[] = [];
  if (env.NAVER_SEARCH_CLIENT_ID?.trim() && env.NAVER_SEARCH_CLIENT_SECRET?.trim()) {
    providers.push(new NaverShoppingProvider(loadNaverCredentials(env)));
  }
  if (env.COUPANG_PARTNERS_ACCESS_KEY?.trim() && env.COUPANG_PARTNERS_SECRET_KEY?.trim()) {
    providers.push(new CoupangPartnersProvider(loadCoupangCredentials(env)));
  }
  return providers;
}
