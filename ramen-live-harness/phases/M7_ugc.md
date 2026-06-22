# M7 — UGC (레시피 꿀조합 · 맛집 큐레이션)

**상태**: 완료 ✅  **갱신**: 2026-06-19

## 맥락
백서 Phase 3 / Tier3. 유저 꿀조합 레시피와 맛집 큐레이션(평점·추천)을 받는다. **핵심 제약 INV-8**: 사이트 자체 제출분만 수용하고 외부 블로그·플레이스를 **크롤링하지 않는다**. 운영자 검수(moderation) 후 approved만 공개. 레시피는 라면 제품(품목제조보고번호), 큐레이션은 음식점(인허가관리번호)을 참조한다. 인입 경로는 `apps/web`(INV-8 범위).

## 진입조건 (DoR)
- [x] M6 DoD 통과 (UI 렌더)
- [x] `docs/TECHNICAL` §1.3·§2(Recipe)·§3.3 + INV-8 확인
- [x] 제품/음식점 PK(참조 무결성) 확보(M1·M4)

## 할 일
core-domain: ModerationStatus·ShopCuration 타입 + 레시피/큐레이션 검증(순수). web/ugc: 제출(검증→엔티티, **외부 fetch 없음**)·검수(pending→approved/rejected)·저장소(Tier3 영속 추상, 인메모리 구현). render: approved UGC만 노출(작성자 표기·이스케이프).

## 참조
`docs/TECHNICAL` §1.3·§2·§3.3, INV-8(자체 제출·크롤링 금지)·INV-5(PK 참조)·INV-9(작성자/출처). DOD_GUIDE 아키타입 2·7.

## DoD (완료 게이트)
1. build/typecheck/lint/test green.
2. **INV-8**: UGC 인입은 자체 제출만 — ugc 경로에 외부 fetch/크롤러 부재(grep), 인증된 author 필수(없으면 거부).
3. 레시피 검증: 필수 필드(제목·재료·단계·author) + baseProductIds가 알려진 품목제조보고번호 참조(미존재 거부, INV-5). 결정론.
4. 큐레이션 검증: 인허가관리번호 참조 + 평점 범위(1–5).
5. 검수: pending→approved/rejected, approved만 공개(isPublic).
6. 렌더: approved UGC만 노출, 작성자 표기·XSS 이스케이프.

## 검증
`npm test -w @ramen/core-domain`(검증) + `npm test -w @ramen/web`(제출·검수·렌더); grep으로 ugc 경로 크롤러 부재 확인.

## 증거
~~~
# 2026-06-19
npm test -w @ramen/core-domain → ugc.test 9 (검증) / npm test -w @ramen/web → ugc.test 7 + render recipe 1
build/typecheck/lint/test → exit 0 (전체 158 테스트)

DoD#2 INV-8: grep apps/web/src/ugc (fetch|http|crawl|scrape|axios|puppeteer|cheerio) → 매치 0(주석만).
  submitRecipe/submitCuration는 폼 입력 객체만 받고 외부 수집 없음. author 없으면 거부(INV-8).
DoD#3 레시피 검증: 제목·재료·단계·author 필수, baseProductIds 미존재 제품 거부(INV-5). 결정론(id·submittedAt 주입).
DoD#4 큐레이션: 평점 1–5 정수 범위, 인허가관리번호 미존재 거부.
DoD#5 검수: submitRecipe→PENDING(isPublic=false), moderate→APPROVED(isPublic=true)/REJECTED.
  InMemoryUgcRepository publicOnly 필터: 전체 2 vs 공개 1(approved).
DoD#6 렌더: renderRecipe 작성자 표기 + XSS 이스케이프(<b> → &lt;b&gt;). approved만 호출부 전달.
미배선(후속): 실제 사용자 인증·DB 영속(인메모리·author 주입으로 추상), 정적 페이지에 approved UGC 결선(영속 소스 필요).
~~~

## 롤백 계획
ugc 모듈 커밋 분리. Tier3 저장소는 인터페이스로 추상화 — 실제 영속 구현 교체 시 한 곳만.

## 리스크 / 미지수
- 실제 사용자 인증·영속 저장소(DB)는 배포 단계 연결(현재 인메모리·author 주입으로 추상화).
- 스팸·악성 제출 대응(rate limit·신고)은 후속.

## 주의
**외부 콘텐츠 크롤링 금지(INV-8 레드라인).** 어떤 ugc 경로도 외부 fetch를 하지 않는다. approved 아닌 UGC는 공개 렌더 금지. 사용자 입력은 이스케이프.
