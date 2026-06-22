# M2 — 단종 status 도출 ★

**상태**: 완료 ✅  **갱신**: 2026-06-18

## 맥락
회수·판매중지 피드 / 제조사 폐업 / 스냅샷 부재로 제품 status·confidence를 도출한다. 잘못된 단정은 신뢰를 깨므로 INV-6로 강제한다.

## 진입조건 (DoR)
- [x] M1 DoD 통과
- [x] `docs/TECHNICAL` §2(단종 도출 규칙) + INV-6 확인
- [x] 직전 스냅샷 N개 접근 경로 — 도출 함수의 명시 입력(`StatusSignals.consecutiveAbsence`)으로 모델링. 실제 스냅샷 시계열 적재는 M3에서 연결.

## 할 일
회수 피드 매칭(품목제조보고번호/바코드) → `SALES_HALTED`/`RECALLED`(high) → 제조사 폐업 결합 → `DISCONTINUED?`(medium) → 스냅샷 시계열 부재 → `DISCONTINUED?`(low) → 그 외 `ON_SALE` → status+source+confidence 부착.

## 참조
`docs/TECHNICAL` §2, INV-6.

## DoD (완료 게이트)
1. [x] 규칙 우선순위 단위 테스트 그린(각 입력 케이스 → 기대 status·confidence). (9 우선순위 케이스)
2. [x] 모든 출력 레코드에 `source`·`confidence` 존재(INV-6). (assertStatusInfo 통과 + finalizeProduct)
3. [x] confidence<high 레코드는 표기 메타가 '추정'으로 마킹됨(UI 단정 차단 계약). (statusDisplayLabel)
4. [x] 회수 피드 매칭 키(번호/바코드) 일치율 리포트. (recallMatchReport)

## 검증
`npm test -w @ramen/core-domain`; 케이스별 status·confidence 검증.

## 증거
~~~
# 2026-06-18
npm test -w @ramen/core-domain → status.test.ts 14 tests passed (exit 0)
npm run typecheck / lint → exit 0

규칙 우선순위(§2):
  ① 회수 → RECALLED/SALES_HALTED (high, RECALL)   [RECALL > SALES_HALT 우선]
  ② 제조사 폐업 → DISCONTINUED? (medium, MANUFACTURER_CLOSURE)
  ③ 스냅샷 연속부재≥임계 → DISCONTINUED? (low, SNAPSHOT_ABSENCE)
  ④ 그 외 → ON_SALE (high, PRODUCT_REPORT)
  교차검증: 회수>폐업, 폐업(medium)>부재(low), 부재<임계 → ON_SALE.
DoD#2 INV-6: 전 도출결과 assertStatusInfo 통과, finalizeProduct가 status 3필드 부착.
DoD#3 '추정': statusDisplayLabel(DISCONTINUED?, medium|low)="단종 추정", high는 단정. isEstimated 정합.
DoD#4 일치율: recallMatchReport → matchedByNumber/Barcode/unmatched/matchRate(예: 4건 중 2매칭=0.5).
~~~

## 롤백 계획
도출 로직 커밋 분리, 규칙 변경 시 ADR로 기록 후 교체.

## 리스크 / 미지수
- 진성 단종(조용한 단종)은 low 추정이 한계. 회수 피드가 단종의 일부만 커버.

## 주의
confidence<high를 단정형으로 표기하지 않는다(INV-6). '단종 추정'으로만.
