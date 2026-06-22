# M6 — UI / 프론트엔드 (정적 HTML 생성기)

**상태**: 완료 ✅  **갱신**: 2026-06-19

## 맥락
Tier1 스냅샷(제품·음식점)을 사용자에게 노출한다. 렌더 방식은 정적 HTML 생성기(순수 TS, 의존성 최소, 정적 호스팅 정합 — ADR-0006). 제품 상세의 가격/제휴는 Tier2 request-time이며, 렌더 계약으로 **출처·조회시각(INV-9)·대가성 문구(INV-10)** 를 강제한다. status는 confidence<high를 '추정'으로(INV-6). 경계: web → core-domain(타입)·shared·자체 tier2만(pipeline import 금지). 디자인은 anti-cliché.

## 진입조건 (DoR)
- [x] M5 DoD 통과 (Tier2 서비스·뷰)
- [x] 렌더 방식 결정 = 정적 HTML 생성기(사용자 승인)
- [x] 스냅샷 JSON 산출물(M3) 존재
- [x] INV-6·INV-9·INV-10 + anti-cliché 가드 확인

## 할 일
HTML 이스케이프(XSS) → 디자인 토큰 CSS(중성색+단일 accent, flat) → 렌더 함수(제품 카드/목록·상세+영양표·음식점 목록·status 배지·제휴 가격 섹션) → 정적 사이트 생성 CLI(스냅샷 JSON → site/*.html). 음식점 지도는 좌표 보유·목록 우선(경량 지도 후속).

## 참조
`docs/DESIGN`(anti-cliché), INV-6·INV-9·INV-10·INV-3, ADR-0006. DOD_GUIDE 아키타입 7.

## DoD (완료 게이트)
1. build/typecheck/lint/test green.
2. 핵심 렌더 함수 단위 테스트(제품 카드·상세·음식점·제휴 섹션). 결정론(같은 입력 → 같은 HTML).
3. INV-6: DISCONTINUED?는 '단종 추정'으로 렌더, 단정 '단종'/'단종됨' 미출현.
4. INV-9: 출처 표기가 렌더에 포함.
5. INV-10: 제휴(쿠팡) 링크 렌더 시 확정형 대가성 문구 동반(renderPriceSection 단일 경로).
6. XSS: 외부 데이터(제품명 등) HTML 이스케이프.
7. 정적 사이트 산출물 생성 + 시연(가로 스크롤 없음·기본 접근성·디자인 토큰).
8. anti-cliché: 그라데이션/네온/blur/장식 이모지 부재.

## 검증
`npm test -w @ramen/web`; `npm run site -w @ramen/web` → site/*.html 생성 후 렌더 확인(스크린샷).

## 증거
~~~
# 2026-06-19
npm test -w @ramen/web → 39 tests passed (render 12 + tier2 27). 전체 142 green.
npm run build/typecheck/lint → exit 0.
사이트 생성: npm run snapshot → npm run site → site/{index,shops,product-*.html} 생성(gitignore).

DoD#3 INV-6: renderStatus(DISCONTINUED?, medium)="단종 추정", "단종됨" 미출현. 생성물 "코레살 라멘 → 단종 추정".
DoD#4 INV-9: 카드·상세에 "출처: 식품(첨가물)품목제조보고 (식품의약품안전처) …" 렌더.
DoD#5 INV-10: renderPriceSection — 제휴(쿠팡) 뷰에 확정형 대가성 문구 + 출처·조회시각(INV-9) + rel="nofollow sponsored". 빈 뷰는 "실시간 조회" 안내.
DoD#6 XSS: 제품명 <script> → &lt;script&gt; 이스케이프.
DoD#7 산출물: index(3개)·shops(3곳)·상세 3페이지 생성, 가로 스크롤 없는 grid(auto-fill minmax), lang=ko, 시맨틱 헤더/메인/푸터, 미리보기 시연.
DoD#8 anti-cliché: STYLES에 gradient/backdrop-blur/text-shadow/box-shadow/네온 부재(테스트 가드). 중성색+단일 accent, border 분리.

# UI 다관점 비평(워크플로 6관점)·quick win 적용(2026-06-19)
총평: 렌더 계약(불변식·a11y)은 견고하나 대량 목표 대비 탐색·결선·시각자산 부족.
적용한 quick win(저노력·고가치):
- UGC 꿀조합 상세 결선(site-build가 SITE_UGC/ugc.json → approved만 renderDetailPage). 검수 대기 숨김 검증.
- 제품 사진(imageUrl) lazy 렌더, safeUrl(http/https) 가드(가격·이미지 javascript: 차단).
- INV-10 렌더 가드(제휴 링크 있는데 disclosure null → throw).
- --warn 적색(#b91c1c)으로 accent와 분리, 음식점 좌표→지도 딥링크, 배지 이중공백 제거, 큐레이션 aria-label 순서 수정.
web +7 테스트(전체 165). data/ugc.sample.json으로 종단 시연.
남은 구조 부채(별도 결정): 검색·필터·정렬·페이지네이션/샤딩, 음식점 상세·지도 임베드, 카드 메타 강화.

# 검색·필터·페이지네이션 구조(2026-06-19) — 대량 데이터 대비
- `catalog/query.ts`(순수): paginate·filterProducts·sortProducts·sortShops·manufacturerFacets·statusFacets·buildSearchIndex. 결정론(코드유닛).
- 빌드타임 페이지네이션(무JS·크롤 가능): index.html + products-N.html, shops.html + shops-N.html, windowed 페이지네이션 내비(SITE_PER_PAGE, 기본 60).
- 클라이언트 검색(경량): search.html(shell) + search-index.json(경량 필드) + public/search.js(무프레임워크 텍스트검색·상태/포장 필터·정렬·클라이언트 페이지네이션). 정적 페이지는 JS 없이 동작(noscript 폴백).
- 테스트: query 13 + renderPagination 3 + renderSearchPage 1(전체 180). 종단: SITE_PER_PAGE=2로 products-2/shops-2·search-index(3) 생성·검증.
- 남음: 음식점 지역 샤딩(수십만), 제조사명 패싯 UI(Manufacturer 이름 필요), 음식점 상세·지도 임베드.
~~~

## 롤백 계획
view 계층·site-build를 커밋 분리. 산출물(site/)은 gitignore. 디자인 토큰 변경은 styles.ts 한 곳.

## 리스크 / 미지수
- 라이브 가격은 런타임(서버) 필요 — 정적 사이트에선 자리·문구만, 실제 호출은 M5 서비스 + 서버/엣지 함수에서.
- 지도는 후속(좌표 보유). 대량 제품 시 페이지 분할 필요.

## 주의
status 단정 금지(INV-6). 제휴 링크엔 항상 문구(INV-10). anti-cliché 자가점검(§8) 통과 후 출력. 외부 데이터 이스케이프.
