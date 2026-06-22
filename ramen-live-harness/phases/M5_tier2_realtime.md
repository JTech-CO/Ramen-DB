# M5 — Tier2 실시간 조회·제휴 ★

**상태**: 완료 ✅  **갱신**: 2026-06-18

## 맥락
백서 Phase 2. 제품 상세 진입 시 가격·구매링크를 **request-time로 실시간 조회**해 표시한다(비영속). 네이버쇼핑(가격) + 쿠팡 파트너스(제휴 구매링크). 이 milestone의 본질은 **법적 가드레일**: Tier2 데이터는 영속 저장 금지(INV-4), 출처·조회시각 표기(INV-9), 쿠팡 대가성 문구 확정형 표기(INV-10). 약관·DB제작자권 근거는 ADR-0003. PriceQuote는 `apps/web`에만(경계 룰).

## 진입조건 (DoR)
- [x] M4 DoD 통과
- [x] ADR-0003(외부 데이터 정책) + INV-4·INV-9·INV-10 확인
- [x] PriceQuote 경계(`apps/web` 전용) + 대가성 문구 토대(M0 scaffolding) 존재
- [~] 네이버/쿠팡 API 키 — 라이브 조회 시점 보류. DoD는 mock fetch 픽스처 기반.

## 할 일
인메모리 TTL 캐시(비영속) → 가격 provider 어댑터(네이버쇼핑: 가격, 쿠팡 파트너스: HMAC 제휴 딥링크) → request-time 가격 서비스(provider 조회 → fetchedAt·source 부착 → TTL 캐시 → PriceQuoteView 런타임 마커) → 제휴 뷰 빌더(INV-10 확정형 문구 강제). 키는 env에서만(INV-1). 모두 `apps/web/src/tier2`.

## 참조
`docs/TECHNICAL` §1.2·§3.2, ADR-0001·0003, INV-4(비영속)·INV-9(출처·조회시각)·INV-10(대가성 문구)·INV-1(키).

## DoD (완료 게이트)
1. [x] request-time 조회: mock fetch로 네이버쇼핑→PriceQuote, 쿠팡 딥링크→제휴 PriceQuote 정규화. 결정론(clock 주입).
2. [x] **INV-4 비영속**: 인메모리 TTL 캐시만. TTL 경과 후 재조회 시 provider 재호출. Tier2 경로 디스크/DB/스냅샷 기록 없음. PriceQuoteView runtime-only 마커.
3. [x] **INV-9 출처·조회시각**: 모든 PriceQuote에 `source`·`fetchedAt`(ISO).
4. [x] **INV-10 대가성 문구**: 제휴 링크 노출 뷰 확정형 문구 강제, 조건부 거부, 가드 throw.
5. [x] 서비스키 env 로드(INV-1), 미설정 시 throw.

## 검증
`npm test -w @ramen/web`; build/typecheck/lint green. (라이브 호출은 키 확보 후 별도 검증)

## 증거
~~~
# 2026-06-18
npm test -w @ramen/web → 5 files 21 tests passed
  cache(3) / affiliate-view(4) / price-service(5) / coupang-partners(5) / naver-shopping(4)
npm run build/typecheck/lint/test → 전부 exit 0 (전체 114 테스트)

DoD#1 정규화: 네이버 items→PriceQuote(태그제거·가격없는항목 제외), 쿠팡 deeplink→affiliate PriceQuote. clock 주입 결정론.
DoD#2 INV-4: TtlCache 만료·폐기; PriceService TTL(5000) 경과 후 provider.calls 1→2(재조회=영속 부재).
  PriceQuoteView.__tier2RuntimeOnly=true. grep 결과 tier2 경로에 node:fs/writeFile/DB/persist 전무.
DoD#3 INV-9: 전 PriceQuote source(네이버쇼핑/쿠팡)·fetchedAt(ISO, clock) 보존.
DoD#4 INV-10: 제휴 링크 시 COUPANG_PARTNERS_DISCLOSURE 부착, '받을 수 있음'·'소정의' 등 조건부 → throw.
DoD#5 INV-1: loadNaver/CoupangCredentials 미설정 → throw, 설정 시 로드.
부가: 쿠팡 HMAC-SHA256 서명 결정론·CEA 구조(서명 hex 64), 부분 provider 실패 격리, 바코드/이름 캐시키 분리.

# 적대적 검증 후 INV-10 하드닝(2건 수정)
- B-1(HIGH): isConfirmedDisclosure deny-list 정규식이 조건부 변형('수도 있'·'받게 될 수 있'·'간혹'·'지도 모릅니다') 통과
  → allow-list(APPROVED_DISCLOSURES 정확 일치, 공백 정규화)로 전환. 변형 6종 차단 테스트 추가.
- B-2(MED): lookup이 raw 뷰 반환해 buildAffiliateView 우회 가능 + hasAffiliate가 affiliate 플래그에만 의존
  → lookup이 항상 buildAffiliateView 단일 출구 거쳐 AffiliateView 반환. hasAffiliate에 쿠팡 URL 도메인 fail-safe 추가.
- INV-4/9/1은 적대적 검증에서 우회 경로 없음 확인(싱크 부재·인메모리 캐시·Snapshot 타입 한정·필드명 테스트·lint 다층).
- web 24 테스트(전체 117).

# 네이버 실키 라이브 검증 + INV-10 허위문구 회귀 수정(2026-06-22)
- 라이브 스모크 러너 `apps/web/src/tier2-smoke.ts` 추가(print-only, **비영속 INV-4**: 결과 미기록). `node --env-file=.env apps/web/dist/tier2-smoke.js [제품명]`. 네이버쇼핑 가격 경로 실키 동작 입증(견적 5건).
- **라이브가 적발한 실버그(B-2 fail-safe 역효과)**: B-2에서 추가한 `hasAffiliate`의 쿠팡-URL 도메인 판정이, 네이버쇼핑이 노출하는 **제3자** `link.coupang.com`(affiliate:false)을 우리 제휴로 오인 → 수수료 무관한데 대가성 문구를 붙이는 **허위 표시**(INV-10을 반대 방향으로 위반). 라면 검색엔 쿠팡 셀러가 상존해 대부분 상세에 노출됐을 문제였음.
- **수정**: `hasAffiliate`를 권위 신호 `affiliate===true` + 우리 provider source(`"쿠팡"`) 스코프로 한정, 제3자 URL 도메인 판정 제거(우리 CoupangPartnersProvider는 항상 affiliate:true+source:"쿠팡"이라 fail-safe 유지됨). `renderPriceSection` rel은 제휴 링크에만 `sponsored`. eslint `site/**`(생성물) ignore로 verify 안정화.
- 회귀 테스트 +2(제3자 쿠팡URL→문구 없음 / 비제휴 rel). **전체 182 테스트**, `npm run verify` exit 0. 재실행 스모크에서 허위 문구 사라짐 확인.
~~~

## 롤백 계획
Tier2 경로는 `apps/web/src/tier2`에 격리 — 제거/비활성으로 영속 자산(스냅샷) 무영향. provider 약관 변경 시 해당 어댑터만 갱신.

## 리스크 / 미지수
- 제공자 약관·쿼터(네이버 일 25,000회·카카오 쿼터): 가격은 상세 진입 on-demand로만(목록·스냅샷 미적재, ADR-0003).
- 쿠팡 HMAC 서명·딥링크 수용은 라이브 키로만 최종 검증(서명 알고리즘은 결정론 단위 검증).
- DB제작자권: 출처 이동 유도(링크) + 비영속 유지.

## 주의
**Tier2 데이터를 절대 영속 저장·스냅샷 적재하지 않는다(INV-4 레드라인).** 캐시는 약관 허용 TTL만. 제휴 링크 화면엔 항상 확정형 대가성 문구(INV-10) — 조건부('받을 수 있음') 금지.
