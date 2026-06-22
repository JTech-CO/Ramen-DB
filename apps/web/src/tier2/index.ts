// Tier2(가격·제휴) 공개 API — apps/web 런타임 전용. 비영속(INV-4).

export type { PriceQuote, PriceQuoteView, PriceQuery, Clock } from "./price-quote.js";
export { systemClock, isoFrom } from "./price-quote.js";

export {
  COUPANG_PARTNERS_DISCLOSURE,
  APPROVED_DISCLOSURES,
  isConfirmedDisclosure,
} from "./disclosure.js";

export { TtlCache } from "./cache.js";

export type { PriceProvider, ProviderOptions } from "./providers/provider.js";
export type { NaverCredentials } from "./providers/naver-shopping.js";
export { NaverShoppingProvider, loadNaverCredentials } from "./providers/naver-shopping.js";
export type { CoupangCredentials } from "./providers/coupang-partners.js";
export {
  CoupangPartnersProvider,
  loadCoupangCredentials,
  coupangDatetime,
  buildCoupangAuth,
} from "./providers/coupang-partners.js";

export type { PriceServiceOptions } from "./price-service.js";
export { PriceService, DEFAULT_TTL_MS } from "./price-service.js";

export { createProvidersFromEnv } from "./provider-factory.js";

export type { AffiliateView } from "./affiliate-view.js";
export { buildAffiliateView, hasAffiliate } from "./affiliate-view.js";
