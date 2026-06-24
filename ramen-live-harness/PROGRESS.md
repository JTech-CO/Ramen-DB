# PROGRESS.md — 상태 인계 (매 세션 갱신)

> 이 팩에서 **매 세션 바뀌는 유일한 파일**. 세션이 끊겨도 이 파일만 읽으면 이어서 작업 가능해야 한다.

## 현재 상태
- **현재 phase**: **백서 목표 달성 🎉** — 전국 **라면 872종 + 라멘 음식점 2,917곳**(실데이터)이 GitHub Pages 라이브: https://jtech-co.github.io/Ramen-DB/. 제품(식약처)·음식점(data.go.kr 벌크) 전량 커버, 중복제거·CI 자동배포·지도링크.
- **상태**: 전 계층 + 실데이터 + 공개 사이트 + 주간 자동배포 + **음식점 전량 커버(2,917곳)** + **UI 개편**(검색 통합·지역·즐겨찾기·점프 페이지네이션·소개 히어로). **206 테스트 green**. 남은 것: I2790 영양 활용신청, CI 시크릿 추가, 가격 런타임 서버, 실DB·인증(UGC).
- **마지막 갱신**: 2026-06-23, **UI 디테일 개선(다크모드·중분류·네이버지도·상태통합)** 세션

## 직전에 끝낸 것
- **UI 디테일 개선(2차)**: ① 히어로 = `Ramen.DB :: 전국 라면/라멘 DB` + 통계 **별도 박스** + 출처 "공공데이터 기반". ② **라이트/다크 모드**(헤더 토글, 기본 라이트, localStorage, FOUC 방지 head 스크립트, `[data-theme=dark]` 팔레트). ③ 제품: 판매상태 **판매중/판매중지 통합**(단종추정만 '판매중지(추정)' 유지 INV-6), 정렬 **칼로리 높은/낮은순**, 제품 이미지 슬롯(imageUrl 있을 때 — 현재 회수분만). ④ 음식점: 지역 **중분류(시/군/구) 캐스케이드**(`shopRegion2`, rg→rg2 동적), 즐겨찾기 **토글 버튼**(On=초록, 체크박스 폐기), **네이버 지도** 딥링크(상호 검색, OSM 폐기). ⑤ 카드 호버·박스 등 디테일. web 테스트 갱신(전체 **207**). anti-cliché 유지.
- **UI 개편(5건)**: ① 네비를 **제품·음식점 2개**로 축소, 검색을 각 페이지에 통합(별도 검색탭 제거) → `index.html`/`shops.html`이 클라이언트 앱(`public/app.js`, 공용 product/shop 모드). ② **음식점 지역 정렬/필터**(주소→시/도 `shopRegion`, `buildShopIndex`/`shops-index.json`) + **즐겨찾기**(localStorage `ramendb:favShops`, 별 토글·"즐겨찾기만"). ③ **페이지네이션 점프**(1, 2, [숫자입력], 끝번호 — 가운데 페이지 직접 이동) — 정적/앱 양쪽. ④ **소개 히어로**(별도 메인 없이 목록 상단에 사이트 설명+통계). 정적 목록(products-1..N/shops-1..N)은 무JS·크롤 폴백 유지. ⑤ 벌크 시드에 **지번주소(col 36) 폴백** 추가 → 지역 미상('기타') 750→**0**. web 테스트 갱신(전체 **206**). anti-cliché 유지.

- **동일제품 중복 제거 + CI 자동배포 + 음식점 API 조사**(3건):
  - ① **중복 제거**: 품목제조보고(I1250)는 한 제품을 공장·재신고별로 여러 보고번호로 등록(예: '신라면'이 (주)농심 LCNS 3개). 진단: 이름만으론 안 됨(14개 업체의 '생라멘'은 서로 다른 제품). 키 = **(제품명+제조사명 BSSH_NM)**. `manufacturerName`을 RamenProduct까지 전달(types/join/status), `catalog/query.ts dedupeProducts`(안전상태>정보풍부>최신>PK 결정론 대표 선택), site-build가 카탈로그·상세·검색에 적용. 카드/상세/검색에 제조사명 표기(동명 제품 구분). **934→872(중복 62 제거)**, 신라면 3→1, 생라멘 14 보존. web +5 테스트(**192**). 라이브 확인 완료.
  - ② **CI 자동배포**: `.github/workflows/snapshot.yml` 확장 → 스냅샷(라이브)→사이트생성(중복제거)→gh-pages 푸시. workflow_dispatch+주간 cron. **검증**: dispatch 실행으로 checkout·npm ci·build 성공 확인, 시크릿 미설정 시 가드로 중단(샘플 배포 방지). ⚠️**활성화에 `DATA_GO_KR_SERVICE_KEY` repo secret 추가 필요**(자동 업로드는 INV-1 가드로 차단됨 — 사용자가 직접 추가).
  - ③ **음식점 API 조사**(서브에이전트): LOCALDATA(localdata.go.kr) **2026-04-16 폐지**(REST 호스트 다운). 정본 = data.go.kr OpenAPI **15154916**(행안부 일반음식점, `serviceKey` **쿼리**파라미터·odcloud `page/perPage`·`data[]`, 필드 `bplcNm/rdnWhlAddr/x·y/trdStateNm/uptaeNm/mgtNo`, 좌표 **EPSG:5174 Bessel** 투영미터). 모범음식점 = **15064964/I1590**(식약처, 기존 path키로 호출 가능하나 주소·좌표 없음 → 표준CSV 15096282 조인). **→ 음식점 라이브엔 새 data.go.kr serviceKey 필요**(15154916 활용신청, 자동승인). ADR-0007 음식점 절 추가.
- **공개 호스팅(GitHub Pages) + 사이트명 Ramen-DB**: 표시명 `ramen.live`→`Ramen-DB`(render.ts 5곳+README). 932종 사이트 재생성. **JTech-CO/Ramen-DB** 푸시 — `main`=소스(LICENSE·README 보존), `gh-pages`=빌드물(953파일+`.nojekyll`), 둘 다 단일 **"Initial commit"**(사용자 지정). Pages 소스를 gh-pages로 전환 → 라이브 검증(index/상세/검색/페이지네이션/search-index 932 전부 200, '신라면 — Ramen-DB/판매중'). 원래 히스토리는 로컬 `dev-history` 보존. `.env`·스냅샷·산출물 미푸시 확인.
- **Tier1 라이브 첫 스냅샷 — 전국 라면 932종(식약처 실데이터)**: `DATA_GO_KR_SERVICE_KEY`(식품안전나라 인증키)로 라이브 가동. **런북 9 확정**(실키 probe): I1250(품목제조, total 1,058,272)·I0490(회수, 351) 필드명·envelope 우리 매퍼와 일치, **I2790(영양)은 미승인**(같은 키로 200+HTML "인증키 유효하지 않음" — 서비스별 활용신청 필요). 구현: ① **식품유형 서버필터**(`fetchProductReportsByFoodTypes` — `PRDLST_DCNM=유탕면/건면…`로 면류만 받아 106만 전량 회피, 도메인 필터 ①단계 서버사이드 이행, PK 중복제거·식품유형별 부분성공) ② **영양 graceful degrade**(I2790 미승인/장애 시 경고 후 빈 배열, 스냅샷 안 막음; `SNAPSHOT_NUTRITION=off`로 호출 생략) ③ **버스트 스로틀링 재시도**(`fetchEnvelope` 선형 백오프 3회 — 식약처가 동시요청에 간헐 인증오류 HTML 반환, 키는 유효) ④ 요청 타임아웃 60s. 결과 **932 라면**(BAG 743·CUP 189, 전부 ON_SALE/high, 회수매칭 0=날조 없음, 키워드 오탐 1건 '클로렐라 면'→보정 후보). ingest +5 테스트(**187**), verify exit 0. 스냅샷은 snapshots/(gitignore). ADR-0007 라이브 확정 절 추가.
- **Tier2 네이버 라이브 검증 + INV-10 허위 대가성문구 회귀 수정**: 실키(`.env` 네이버)로 `apps/web/src/tier2-smoke.ts`(print-only, **비영속 INV-4** — 파일/DB 미기록) 추가, `node --env-file=.env apps/web/dist/tier2-smoke.js 신라면` → 견적 5건 정상 수신(네이버쇼핑 가격 경로 동작 입증). **라이브가 실버그 적발**: `hasAffiliate`의 쿠팡-URL fail-safe가 네이버쇼핑이 노출한 **제3자** `link.coupang.com`(affiliate:false)을 우리 제휴로 오판 → 수수료를 받지도 않는데 쿠팡 파트너스 대가성 문구를 붙이는 **허위 표시**(INV-10 역방향 위반). 라면은 네이버 결과에 쿠팡 셀러가 상존 → 대부분 상세에 노출됐을 문제. **수정**: 판정을 권위 신호(`affiliate===true`) + 우리 provider source(`"쿠팡"`) 스코프로 좁히고 제3자 URL 도메인 판정 제거. 부수로 `renderPriceSection`의 `rel`을 제휴 링크에만 `sponsored`(비제휴엔 `nofollow noopener`)로 분기 — 오표기 방지. eslint가 생성물 `site/**`를 린트해 verify 깨지던 설정 갭도 ignore 추가로 해소. 회귀 테스트 +2(라이브 회귀: 제3자 쿠팡URL→문구 없음 / 비제휴 rel). **182 테스트 green**, verify exit 0. 재실행 스모크에서 허위 문구 사라짐 확인.
- **검색·필터·페이지네이션 구조(대량 데이터 대비)**: `catalog/query.ts`(순수: paginate·filter·sort·facets·searchIndex) + 빌드타임 페이지네이션(index/products-N·shops/shops-N, 무JS·크롤 가능) + 클라이언트 검색(search.html + search-index.json + public/search.js, 무프레임워크, noscript 폴백). web +15 테스트(180). SITE_PER_PAGE로 페이지 크기 조절, 종단 검증.
- **UI 다관점 비평(워크플로) + quick win 적용**: 6관점 비평 종합. 적용 — UGC 꿀조합 상세 결선(approved만, 검수 대기 숨김), 제품 사진(imageUrl) lazy + safeUrl(http/https) 가드, INV-10 렌더 가드(제휴+disclosure null→throw), --warn 적색 분리, 음식점 좌표→지도 딥링크, 배지 공백·큐레이션 aria 수정. web +7 테스트(165). `data/ugc.sample.json` 종단 시연. **남은 구조 부채: 검색·필터·페이지네이션/샤딩, 음식점 상세·지도.**
- **M7 UGC 완료(DoD 6/6)**: core-domain `ugc.ts`(레시피·큐레이션 검증, 참조 무결성 INV-5) + `apps/web/src/ugc`(submission·moderation·repository). **INV-8**: 자체 제출만(외부 fetch/크롤러 부재 grep 확인, author 필수), 운영자 검수(PENDING→APPROVED/REJECTED) 후 approved만 공개. renderRecipe/renderCuration(작성자 표기·이스케이프). Tier3 저장소는 인메모리 추상(실DB 후속). core-domain +9, web +8 테스트(전체 158).
- **M6 UI 정적 생성기 완료(DoD 8/8)**: `apps/web/src/view`(escape·styles·render) + `site-build.ts`(스냅샷 JSON→site/*.html). 제품 카탈로그·상세(영양표)·음식점 목록·status 배지·제휴 가격 섹션. INV-6('단종 추정')·INV-9(출처)·INV-10(renderPriceSection 단일 경로 대가성 문구)·XSS 이스케이프 렌더 강제. anti-cliché(중성색+단일 accent, 그림자/그라데이션/blur 부재) 가드 테스트. web +12 렌더 테스트(전체 142). pipeline import 없이 산출물만 소비(경계 INV-3 유지). 미리보기 시연.
- **라이브 연동 배선**: 식품안전나라 어댑터(제품 I1250·회수 I0490·영양 I2790, 식품명+제조사 매칭 ADR-0007) + Tier2 env 팩토리 + 라이브 러너/CLI 모드. 키 주입 시 라이브 스냅샷.
- **라이브 연동 배선**: 식품안전나라 어댑터(`ingest/adapters/foodsafetykorea.ts`) — envelope·페이징·제품(I1250)·회수(I0490)·**영양(I2790) 매퍼**. 영양 조인 = **식품명+제조사 매칭**(ADR-0007 결정 반영, join에 PK→matchKey 폴백). Tier2 `provider-factory.ts`. 라이브 러너 `pipeline/live.ts`(`fetchLiveRawInputs`) + 스냅샷 CLI 라이브 모드(`DATA_GO_KR_SERVICE_KEY` 있으면 식약처 수집, `SNAPSHOT_MAX_ROWS`로 스모크 제한). mock 테스트 +13(전체 130). ADR-0007.
  - **다음(키 필요)**: `DATA_GO_KR_SERVICE_KEY`를 `.env`에 → `node --env-file=.env packages/pipeline/dist/snapshot.js` 스모크. 첫 실행으로 SERVICE_ID(I1250 vs C002)·필드·회수구분 확정(런북 9). 제조사폐업·음식점(LOCALDATA 이관)은 후속.
- **M5 Tier2 실시간·제휴 완료(DoD 5/5)**: `apps/web/src/tier2` — 인메모리 TtlCache(비영속) + 네이버쇼핑(가격)·쿠팡 파트너스(HMAC 제휴 딥링크) provider + request-time `PriceService`(TTL 캐시·fetchedAt·source·단일 출구 buildAffiliateView) + `buildAffiliateView`(INV-10 allow-list 확정형 문구 강제). 키 env 로드(INV-1). mock fetch·clock 주입 결정론. **INV-4 비영속**(TTL 재조회 입증 + tier2 fs/DB/persist 전무), **INV-9**(출처·조회시각), **INV-10**(대가성 문구). web +24 테스트.
  - **적대적 검증(단일 에이전트)**: INV-4/9/1 우회 경로 없음 확인. INV-10 2건 수정 — B-1 disclosure deny-list→allow-list(조건부 변형 통과 차단, HIGH), B-2 lookup 단일 출구 강제 + 쿠팡 URL fail-safe(MED).
- **M3 파이프라인 음식점 통합**: `Snapshot { version, products, shops }`로 확장. `buildSnapshot`이 `joinShops` 통합(RawInputs에 restaurants/modelRestaurants/shopCorrections 선택 필드). `diffSnapshots`를 `{ products, shops }` 섹션 구조로 재구성 — 음식점 diff(added/removed/nowClosed/reopened/changed) 추가. 멱등 해시 `87dcb70d…`(2회 동일). (pipeline +5 테스트)
- **M3 파이프라인 음식점 통합**: `Snapshot { version, products, shops }`로 확장. `buildSnapshot`이 `joinShops` 통합(RawInputs에 restaurants/modelRestaurants/shopCorrections 선택 필드). `diffSnapshots`를 `{ products, shops }` 섹션 구조로 재구성 — 음식점 diff(added/removed/nowClosed/reopened/changed) 추가. 멱등 해시 `87dcb70d…`(2회 동일), 음식점 source(INV-9)·좌표 결정론 유지. CLI는 제품·음식점 수와 양쪽 diff 출력. (pipeline +5 테스트, 전체 93)
- **M4 음식점 레이어 완료(DoD 6/6)**: shared 좌표 변환기(proj4, EPSG:5174/5181/5179/2097→WGS84, 왕복 검증) → 음식점 raw 타입(일반·모범) → 정규화(인허가관리번호 PK·주소·좌표·영업상태) → 라멘/라면 도메인 필터(업태+상호 키워드+보정, ADR-0004) → 모범 플래그 조인 → `RamenShop`. 좌표 결측/무효 생략, 빈 PK 드롭, 정밀도 0.75→보정→1.0. 좌표 정의 적대적 검증(권위 EPSG 대조) 통과.
- **M4 음식점 레이어 완료(DoD 6/6)**: shared 좌표 변환기(proj4, EPSG:5174/5181/5179/2097→WGS84, 왕복 검증) → 음식점 raw 타입(일반·모범) → 정규화(인허가관리번호 PK·주소·좌표·영업상태) → 라멘/라면 도메인 필터(업태+상호 키워드+보정, ADR-0004) → 모범 플래그 조인 → `RamenShop`. 좌표 결측/무효 생략, 빈 PK 드롭, 정밀도 0.75→보정→1.0. (ingest 음식점 모듈 +23 테스트, shared coords +6)
- **적대적 리뷰 패스(5차원→반증)**: 17건 발견·14건 확정 수정, 3건 기각(의도적 설계/도달불가). 주요 수정:
- **적대적 리뷰 패스(5차원→반증)**: 17건 발견·14건 확정 수정, 3건 기각(의도적 설계/도달불가). 주요 수정:
  - INV-5: 빈/공백 PK 드롭(`isValidProductId` 연결) — 영양·회수 교차오염 차단(HIGH).
  - 영양 필수 4종 결측을 0 날조 → nutrition=null(백서 §5). parseNum 단위 허용·16진수/지수 차단. normalizeDate 월/일 범위 검증.
  - 보정 키 정규화(공백 침묵실패 방지). 바코드 정규화(normalizeBarcode). recallMatchReport 키 정규화.
  - INV-7: 정렬 localeCompare → `compareCodeUnits`(shared) 코드유닛 통일(join·diff).
  - INV-4: 동적 import 경계 차단(ImportExpression) + 스냅샷 가격/제휴 키 부재 계약 테스트.
  - 스냅샷 부재 규칙③(DISCONTINUED? low) 미배선을 코드·diff 주석에 정직하게 문서화(향후 다주차 부재 카운터 연결).
  - 회귀방지 테스트 +8 (총 59). 스냅샷 해시 불변(f48ae65a) 재확인.
- **M3 주간 스냅샷 파이프라인 완료(DoD 4/4)**: `buildSnapshot`(raw→정규화→필터→조인→status) + `serializeSnapshot`(결정론 JSON) + `snapshotHash`(INV-7) + `diffSnapshots`(신규/이탈/판매중지/단종추정/변경) + CLI(`snapshot.ts`) + cron 워크플로(`snapshot.yml`). 산출 포맷 JSON 결정(ADR-0006).
  - DoD#1 멱등성(2회 해시 동일 f48ae65a…) / #2 아티팩트+cron / #3 diff 분류 / #4 시크릿 secret(INV-1). generatedAt는 meta 분리(INV-7).
- **M2 단종 status 도출 완료(DoD 4/4)**: `deriveStatus`(① 회수 high → ② 폐업 medium → ③ 스냅샷 부재 low → ④ ON_SALE high) + `finalizeProduct`(ProductDraft→RamenProduct) + `recallMatchReport`(번호/바코드 일치율). INV-6 강제·'추정' 표기. (core-domain/status.ts, 14 테스트)
- **M1 인제스트·조인 완료(DoD 5/5)**: 정규화(필드·단위·날짜·packageType) → 라면 도메인 필터(ADR-0004 ①식품유형 ②키워드 ③보정+정밀도 리포트) → 품목제조보고번호 조인(영양/회수/제조사상태 병합, 바코드·이미지 보강) → `ProductDraft`. data.go.kr fetch 어댑터(키 env, INV-1) 인터페이스 준비.
  - DoD#1 결정론(contentHash 일치) / #2 INV-5 PK 안정 / #3 nutrition=null(coverage 0.8) / #4 sourceRefs(INV-9) / #5 필터 정밀도(보정 전 0.8 → 후 1.0).
  - core-domain: `ProductDraft` 중간형 추가, `RecallEvent.imageUrl` 추가.
- **M0 스캐폴딩 완료(DoD 4/4)**: npm workspaces 모노레포(`packages/core-domain·ingest·pipeline·shared`, `apps/web`) + tsconfig(NodeNext·strict) + ESLint flat config 경계 룰 + prettier + GitHub Actions CI + `.gitignore`/`.env.example`.
  - DoD#1 build/typecheck/lint/test 전부 exit 0.
  - DoD#2 INV-3 경계 위반 3종(core-domain→shared, web→ingest, pipeline→web) lint 차단 확인.
  - DoD#3 INV-4 PriceQuote 참조/임포트 2종(ingest, pipeline) lint 차단 확인.
  - DoD#4 `git check-ignore`로 .env·snapshots·*.sqlite 무시, .env.example 추적 확인.
- **패키지 매니저 npm 전환** → ADR-0005. (Node 25.2.0에서 pnpm install이 0xC0000409 크래시, npm은 정상.) `docs/ENVIRONMENT` + phase M0–M3 명령 갱신.
- core-domain 도메인 타입(백서 §2)·불변식 헬퍼(INV-5/6), shared 출처표기(INV-9)·결정론 직렬화/해시(INV-7) 토대 선반영.

## 다음 할 일
1. **라이브 키 활성화**: ✅Tier1 식약처(932 라면 스냅샷)·✅네이버(Tier2 가격) 실키 가동. ⏭️영양은 **I2790(구버전~2023)이 아니라** data.go.kr 「전국통합식품영양성분정보(가공식품) 표준데이터」 활용신청 + 신규 어댑터 필요(현 키는 품목제조·회수만 인가, 서비스별 신청). 🔒쿠팡은 파트너스 최종승인(누적판매 15만원) 전 — 부분구성 자동 제외. `.env`/Actions secret(INV-1).
2. **운영 연결**: UGC 실DB·사용자 인증(현 인메모리·author 주입 추상), 라이브 가격 서버/엣지(M5 PriceService 호출), approved UGC를 페이지에 결선.
3. **데이터 품질**: 보정 리스트 채우기, LOCALDATA 이관 엔드포인트(ADR-0007), 좌표 EPSG 골든 검증, 영양 매칭율 실측.
4. **후속 기능**: 음식점 상세·지도(좌표 보유)·지역 샤딩, 제조사명 패싯(Manufacturer 이름), 호스팅 확정(Q4)·도메인(Q5).

## 미해결(실데이터 단계 보강 필요)
- **영양 조인 전략(Q2, ADR-0007)**: ✅결정 = 옵션②(보류) 당장. 추가 시 **I2790 아님**(구버전~2023·미인가) → data.go.kr 「전국통합식품영양성분정보(가공식품) 표준데이터」 활용신청 + **신규 어댑터**(다른 엔드포인트/필드) → 기존 식품명+제조사 매칭에 연결. (식약처는 서비스별 활용신청; data.go.kr 15127578은 LOD라 OpenAPI 신청 불가.)
- **음식점 라이브 — 벌크 시드로 전량 커버 완료(2,859 라멘)**: API 어댑터(`datagokr-restaurant.ts`)는 배선했으나 게이트웨이가 깊은 오프셋에서 서버 60s 타임아웃(부분만). **해결 = 벌크 CSV 시드**: `file.localdata.go.kr` 다운로드(CSRF, 692MB·2.28M행·CP949) → `scripts/seed-restaurants-bulk.mjs`(스트리밍·euc-kr 디코드·CSV파싱·라멘필터) → **라멘 2,917곳** → `data/ramen-shops.json`(769KB 커밋). `snapshot.ts`가 시드 있으면 우선 사용(API보다). 좌표 EPSG:5174→WGS84, 48페이지 지도링크 라이브. 주기 갱신 = 재다운로드+재시드+커밋(ADR-0007).
- **CI 자동배포 활성화**: `.github/workflows/snapshot.yml` 준비됨(검증 OK). repo Settings→Secrets에 **`DATA_GO_KR_SERVICE_KEY`** 추가하면 주간/수동 자동배포 동작(미설정 시 가드로 중단).
- ✅**라이브 1건 확정(런북 9) 완료(2026-06-22)**: I1250·I0490 envelope·필드명 실키 대조 일치, SERVICE_ID **I1250 확정**, 제품은 식품유형 서버필터 채택. I2790만 미승인.
- 도메인 필터 보정 리스트는 현재 빈 시드 — **첫 실데이터 오탐 발견**: `천하일미 만능 클로렐라 면`(compact 후 '라면' 부분매칭) → exclude 후보. 라이브 표본으로 채움(제품·음식점 공통).
- 스냅샷 시계열 부재(DISCONTINUED? low) 카운팅은 M2 규칙으로 모델링됨 → 다주차 스냅샷 누적 시 파이프라인에 부재 카운터 연결 필요.
- **좌표계 EPSG 확정**: 기본 EPSG:5174(LOCALDATA 표준 확인됨) → 라이브 표본으로 5174 vs 2097(255m) 검증, 권위 측량점 골든.

## 미결 질문 / 사용자 결정 대기
- Q2 영양 DB ↔ 품목제조보고 로스터 커버리지 갭 실측(M1에서).
- ✅Q4 호스팅 = **GitHub Pages**(정적, gh-pages 브랜치) 채택·가동. 산출 포맷 JSON(ADR-0006).
- Q5 도메인 ramen.live 확보.
- (Q1·Q3는 ADR-0003·0004로 해소. 패키지 매니저는 ADR-0005로 확정.)

## 증거 로그 (최근 게이트 실행)
| phase | 게이트 | 명령 | 결과/수치 | 일시 |
|---|---|---|---|---|
| M0 | build/typecheck/lint/test | `npm run build/typecheck/lint && npm test` | 모두 exit 0 | 2026-06-18 |
| M0 | INV-3 경계 차단 | `npx eslint <위반샘플 3종>` | exit 1, no-restricted-imports 차단 | 2026-06-18 |
| M0 | INV-4 PriceQuote 차단 | `npx eslint <위반샘플 2종>` | exit 1, no-restricted-syntax 차단 | 2026-06-18 |
| M0 | INV-1/2 gitignore | `git check-ignore -v` | .env·snapshots·sqlite 무시, .env.example 추적 | 2026-06-18 |
| M1 | 인제스트·조인 단위테스트 | `npm test -w @ramen/ingest` | 3 files / 28 tests passed, 결정론 | 2026-06-18 |
| M1 | 필터 정밀도 리포트 | filterPrecisionReport | 보정전 P0.8/R0.8(FP1 FN1) → 보정후 1.0/1.0 | 2026-06-18 |
| M2 | status 도출 규칙 | `npm test -w @ramen/core-domain` | 14 tests passed, 우선순위·INV-6·추정·일치율 | 2026-06-18 |
| M3 | 스냅샷 멱등성(INV-7) | `npm run snapshot` ×2 | hash 동일 f48ae65a…, 아티팩트 3 products | 2026-06-18 |
| M3 | diff 분류 | `npm test -w @ramen/pipeline` | 9 tests, added/removed/halted/disc/changed 정확 | 2026-06-18 |
| 전체 | 풀 게이트 | `npm run build/typecheck/lint/test` | 전부 exit 0, 51 테스트 | 2026-06-18 |
| 리뷰 | 적대적 불변식·정확성 | 다중에이전트 워크플로(22 agents) | 17건→14확정 수정, 회귀테스트 +8 | 2026-06-18 |
| 리뷰후 | 풀 게이트 + 차단검증 | build/typecheck/lint/test + 동적import샘플 | 전부 green, 59 테스트, 동적 import 차단 확인 | 2026-06-18 |
| M4 | 좌표 변환(왕복) | `npm test -w @ramen/shared` | 6 tests, 왕복 1e-6, 한국범위 | 2026-06-18 |
| M4 | 음식점 인제스트·조인·필터 | `npm test -w @ramen/ingest` | 58 tests(음식점 +23), 정밀도 0.75→보정 1.0 | 2026-06-18 |
| M4 | 풀 게이트 | build/typecheck/lint/test | 전부 exit 0, 88 테스트 | 2026-06-18 |
| M3+음식점 | 통합 스냅샷 멱등성 | `npm run snapshot` ×2 | hash 동일 87dcb70d(제품+음식점), diff.json 생성 | 2026-06-18 |
| M3+음식점 | 풀 게이트 | build/typecheck/lint/test | 전부 exit 0, 93 테스트 | 2026-06-18 |
| M5 | Tier2 비영속·출처·문구 | `npm test -w @ramen/web` | 21 tests, TTL 재조회·INV-9·INV-10·키가드 | 2026-06-18 |
| M5 | INV-4 영속의존 부재 | grep tier2(fs/DB/persist) | 매치 0(주석만), 비영속 확인 | 2026-06-18 |
| M5 | 풀 게이트 | build/typecheck/lint/test | 전부 exit 0, 114 테스트 | 2026-06-18 |
| M5 하드닝 | 적대적 INV-10 검증 | 단일 에이전트 + 회귀테스트 | 우회 2건 차단(allow-list·단일출구), 117 테스트 | 2026-06-18 |
| Tier2 라이브 | 네이버쇼핑 실키 스모크 | `node --env-file=.env apps/web/dist/tier2-smoke.js 신라면` | 견적 5건 수신(비영속), provider=네이버쇼핑 | 2026-06-22 |
| Tier2 라이브 | INV-10 허위문구 회귀 | 라이브 적발→수정→재실행 | 제3자 쿠팡URL→문구 제거 확인, hasAffiliate 권위신호화 | 2026-06-22 |
| 전체 | 풀 게이트(verify) | `npm run verify` | exit 0, **182 테스트**(web 70) | 2026-06-22 |
| Tier1 라이브 | 런북9 envelope·필드 확정 | 실키 probe `/1/3`·`/1/1000` | I1250·I0490 매퍼 일치, I2790 미승인(200+HTML) | 2026-06-22 |
| Tier1 라이브 | 첫 실데이터 스냅샷 | `SNAPSHOT_NUTRITION=off node --env-file=.env …/snapshot.js` | **932 라면**(BAG743·CUP189) ON_SALE/high, hash da3f00e7 | 2026-06-22 |
| Tier1 라이브 | 어댑터 회귀(서버필터·강등·재시도) | `npm test -w @ramen/ingest` | 73 tests(+5), 식품유형필터·영양강등·재시도 | 2026-06-22 |
| 전체 | 풀 게이트(verify) | `npm run verify` | exit 0, **187 테스트** | 2026-06-22 |

## 막힘 기록 (STOP 발동 시)
- (해소) pnpm install Node 25 크래시(0xC0000409) → npm workspaces 전환으로 해결(ADR-0005).

## 결정 로그
- ADR-0001 — 3-tier 분할, Tier2 비영속(`decisions/0001-data-tiering.md`).
- ADR-0002 — 품목제조보고번호 제품 PK, 바코드 Tier2 브리지(`decisions/0002-product-key.md`).
- ADR-0003 — 외부 데이터(Tier2) 비영속 + 약관 준수 + 대가성 문구(`decisions/0003-external-data-policy.md`).
- ADR-0004 — 라면/라멘 도메인 식별: 코드+키워드+보정(`decisions/0004-domain-filter.md`).
- ADR-0005 — 패키지 매니저 npm workspaces 채택(`decisions/0005-package-manager-npm.md`).
- ADR-0006 — 스냅샷 포맷 JSON + Actions 아티팩트/정적 호스팅(MVP)(`decisions/0006-snapshot-format-hosting.md`).
- ADR-0007 — Tier1 라이브 연동: 식품안전나라 직접 호출 + 영양 조인 키 부재 대응(`decisions/0007-live-ingestion-findings.md`).
