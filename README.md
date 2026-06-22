# Ramen-DB

> 🔗 라이브 사이트: **https://jtech-co.github.io/Ramen-DB/** (전국 라면 932종, 식약처 공공데이터)

국내 라면(봉지/컵 가공라면 + 전국 라면·라멘 음식점)의 제품·영양·판매상태·구매경로를 통합 제공하는 데이터 플랫폼.
데이터는 3-tier로 분할 관리한다 — **Tier1**(공공데이터, 영속·재배포) / **Tier2**(상용 API, 비영속 request-time) / **Tier3**(UGC).

기획·운영 규율은 [`ramen-live-harness/`](ramen-live-harness/), 기술 백서는 [`ramen-live-harness/docs/TECHNICAL.md`](ramen-live-harness/docs/TECHNICAL.md) 참조.

## 모노레포 구조

```
packages/
  core-domain/   타입·도메인 순수 로직(RamenProduct, status 도출, 불변식)  ← 외부 의존 없음
  shared/        공용 유틸(출처표기·결정론 직렬화/해시·좌표변환)
  ingest/        공공데이터 fetch·정규화·라면 도메인 필터·조인 어댑터
  pipeline/      스냅샷 오케스트레이션·diff·idempotent 산출(INV-7)
apps/
  web/           UI + Tier2 실시간 조회·제휴 렌더 (PriceQuote는 여기에만, INV-4)
```

모듈 경계는 ESLint(`no-restricted-imports`/`no-restricted-syntax`)로 강제한다 — `ramen-live-harness/docs/FILE_TREE.md` §3.

## 명령

```bash
npm install              # 의존성 설치 (npm workspaces, ADR-0005)
npm run build            # 전체 워크스페이스 빌드
npm run typecheck        # tsc --noEmit
npm run lint             # eslint . (경계 INV-3 / Tier2 비영속 INV-4)
npm test                 # 전체 테스트
npm test -w @ramen/ingest    # 단일 패키지 테스트
npm run verify           # build + typecheck + lint + test 일괄
```

## 불변식(요약)
시크릿/대용량 미커밋(INV-1/2) · 모듈 경계(INV-3) · **Tier2 비영속**(INV-4) · 품목제조보고번호 불변 PK(INV-5) · **status는 source·confidence 동반**(INV-6) · 스냅샷 idempotency(INV-7) · UGC 자체 제출만(INV-8) · 출처표기(INV-9) · 제휴 대가성 문구(INV-10). 전문은 `ramen-live-harness/INVARIANTS.md`.
