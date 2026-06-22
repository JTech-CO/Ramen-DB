# M3 — 주간 스냅샷 파이프라인

**상태**: 완료 ✅  **갱신**: 2026-06-18

## 맥락
Tier1 전체를 주 1회 idempotent 풀 스냅샷으로 재생성·배포하고, 전주 대비 diff를 산출한다(INV-7).

> **확장(2026-06-18, M4 통합)**: 스냅샷에 음식점 레이어(`RamenShop[]`)를 추가. `buildSnapshot`이 제품+음식점을 함께 산출하고, `diffSnapshots`가 제품(added/removed/nowHalted/nowDiscontinued/changed)·음식점(added/removed/nowClosed/reopened/changed)을 각 섹션으로 분류한다. 멱등 해시 갱신(제품+음식점 포함): `87dcb70d…`. 음식점도 PK 코드유닛 정렬·source(INV-9)·`isPlausibleKoreaLatLng` 결측 처리로 결정론 유지.

## 진입조건 (DoR)
- [x] M2 DoD 통과
- [x] GitHub Actions·산출 호스팅·산출 포맷 결정 → **JSON + Actions 아티팩트/정적**(ADR-0006, Q4 잠정 해소)
- [x] INV-7 확인

## 할 일
파이프라인 오케스트레이션(인제스트 → 필터 → 조인 → status) → 버전 태그 → diff 리포트(신규/판매중지/단종추정/변경) → 산출물(JSON 또는 SQLite) → Actions cron + 배포(CDN/정적 또는 Pi).

## 참조
`docs/TECHNICAL` §3.1, INV-7, ADR-0001.

## DoD (완료 게이트)
1. [x] 동일 입력 2회 실행 → 산출물 해시 동일(INV-7).
2. [x] cron 워크플로 정의·산출 아티팩트 생성. (`.github/workflows/snapshot.yml` + CLI 산출 검증)
3. [x] diff 리포트가 전주 대비 변경을 정확히 분류(고정 2-스냅샷 픽스처로 검증).
4. [x] 서비스키는 Actions secret로만 주입(INV-1).

## 검증
`npm run snapshot -w @ramen/pipeline` 2회 → 해시 비교; `npm test -w @ramen/pipeline`(build·diff 픽스처).

## 증거
~~~
# 2026-06-18
npm test -w @ramen/pipeline → build.test(5) + diff.test(4) = 9 tests passed
npm run build/typecheck/lint/test → 전부 exit 0 (전체 51 테스트)

DoD#1 INV-7: snapshot CLI 2회 실행 → hash 동일
  f48ae65a29bbce64113ae62d9c978e7541c0499352f356e4b48c47051dd9af2b (run1=run2)
  + build.test idempotency(snapshot/serialize/hash 동일).
DoD#2 아티팩트: snapshots/snapshot-2026-W25.json (3 products, 1668B) 생성.
  cron: .github/workflows/snapshot.yml (주 1회 + workflow_dispatch, upload-artifact).
DoD#3 diff(2-스냅샷 픽스처): added[A]/removed[R]/nowHalted[H]/nowDiscontinued[D]/changed[C],
  updatedAt만 다른 U는 변경 제외.
DoD#4 시크릿: snapshot.yml env DATA_GO_KR_SERVICE_KEY=${{ secrets.* }} (INV-1).
부가: snapshots/ gitignore(INV-2), generatedAt는 meta에만(본문 해시 불변, INV-7/RUNBOOK 4).
~~~

## 롤백 계획
워크플로 비활성화로 갱신 중단, 직전 스냅샷 유지. 산출 포맷 변경은 ADR로.

## 리스크 / 미지수
- LOCALDATA delta 증분 전환 시에도 idempotent full-snapshot 재현(INV-7) 유지해야 함.

## 주의
타임스탬프·정렬 미고정은 해시 불일치(런북 4)를 부른다. 생성시각은 산출 본문과 분리.
