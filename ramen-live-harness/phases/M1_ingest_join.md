# M1 — Tier1 인제스트·정규화·조인 ★

**상태**: 완료 ✅  **갱신**: 2026-06-18

## 맥락
Tier1 공공데이터(품목제조보고·영양성분·회수/판매중지·제조사 상태)를 수집·정규화하고 품목제조보고번호로 조인해 제품 레코드를 구성한다. ramen.live의 핵심 자산.

## 진입조건 (DoR)
- [x] M0 DoD 통과
- [~] 공공데이터 활용신청·서비스키 확보 — **라이브 수집 시점으로 보류**. M1 DoD는 고정 픽스처 기반이라 키 없이 통과. fetch 어댑터(`adapters/data-go-kr.ts`)는 인터페이스로 준비, 키는 env에서만(INV-1).
- [x] `docs/TECHNICAL` §1.1·§2 + INV-5·INV-9 확인
- [x] 출력 스키마(`RamenProduct`) 확정 — M0에서 정의. 조인 산출=`ProductDraft`(status 도출 전 중간형, M2 입력)

## 할 일
소스별 fetch 어댑터(품목제조보고 → 영양성분 → 회수/판매중지 → 폐업/인허가이력) → 정규화(필드 매핑·인코딩·단위) → 라면 도메인 필터(식품유형코드 + 제품명 키워드 + 보정 리스트) → 품목제조보고번호 조인(제품+영양+회수+제조사상태) → 바코드 보강 → `RamenProduct` 출력.

## 참조
`docs/TECHNICAL` §1.1·§2, INV-5(PK)·INV-9(출처).

## DoD (완료 게이트)
1. [x] 고정 픽스처로 인제스트→정규화→조인 단위 테스트 그린, 결정론. (28 테스트, `contentHash` 2회 일치)
2. [x] 제품명만 다른(리뉴얼) 케이스에서 품목제조보고번호 동일 레코드 유지(INV-5).
3. [x] 영양 미커버 제품은 `nutrition=null`로 명시(빈칸 미채움). (P6, coverage 0.8 리포트)
4. [x] 모든 출력 레코드에 `sourceRefs` 채워짐(INV-9). (전 레코드 PRODUCT_REPORT 포함)
5. [x] 도메인 필터 정밀도: 샘플셋 오탐/누락 건수 리포트. (보정 전 FP1·FN1 / 보정 후 0·0)

## 검증
`npm test -w @ramen/ingest`; 리뉴얼 픽스처로 PK 안정성·null 처리 확인.

## 증거
~~~
# 2026-06-18
npm test -w @ramen/ingest → 3 files, 28 tests passed (exit 0)
  normalize.test.ts (11) / domain-filter.test.ts (7) / join.test.ts (10)
npm run build / typecheck / lint → 전부 exit 0

DoD#1 결정론: join 2회 → products deepEqual + contentHash 동일.
DoD#2 INV-5: id="20210001" 리뉴얼(이름만 변경) → id·manufacturerId·sourceRefs 불변, name만 변동.
DoD#3 nutrition=null: P6(20210006) 영양 미커버 → null. nutritionMatched=4 missing=1 coverage=0.8.
DoD#4 sourceRefs(INV-9): 전 레코드 PRODUCT_REPORT 포함.
  P1=[PRODUCT_REPORT,NUTRITION,RECALL,MANUFACTURER_CLOSURE] P6=[PRODUCT_REPORT,MANUFACTURER_CLOSURE].
DoD#5 필터 정밀도: 보정 전 precision 0.8/recall 0.8 (FP=라면스프, FN=안성탕면),
  보정(include 안성탕면 / exclude 라면스프) 후 1.0/1.0.
부가: 바코드 보강(P2 회수피드 바코드), 회수매칭 번호(P2)·바코드(P1), 제조사 폐업(P6 CLOSED),
  품목제조보고번호 공백키 정규화(RUNBOOK 6) 조인 성공.
~~~

## 롤백 계획
어댑터·조인을 커밋 분리. 소스 스키마 변경 시 해당 어댑터만 갱신(런북 9).

## 리스크 / 미지수
- 영양↔로스터 커버리지 갭(Q2), 도메인 필터 오탐(Q3), 공공데이터 API 스키마 변경.

## 주의
키워드 필터는 불완전하다. 보정 리스트로 관리하고 "다 잡혔다"고 단정하지 않는다.
