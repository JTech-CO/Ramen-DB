# FILE_TREE.md — 디렉터리 구조 + 모듈 경계 규칙

> INV-3·INV-4의 근거. 경계 규칙은 lint(`import/no-restricted-paths` 등)로 강제한다.

## 1. 디렉터리 트리
```
ramen-live/
  packages/
    core-domain/   # 타입·도메인 순수 로직(RamenProduct, status 도출, 불변식 보장)
    ingest/        # 공공데이터 fetch·정규화·도메인 필터 어댑터
    pipeline/      # 스냅샷 오케스트레이션·diff·산출
    shared/        # 공용 유틸(출처표기·로깅·날짜·좌표변환)
  apps/
    web/           # UI + Tier2 실시간 조회·제휴 렌더(PriceQuote는 여기에만)
```

## 2. 패키지별 책임
- **core-domain**: 부수효과 없는 순수 도메인. 타입·status 도출 규칙·불변식 단언. 외부 의존 없음.
- **ingest**: 소스별 어댑터, 정규화, 라면 도메인 필터, 조인. 외부 API 호출은 여기 격리.
- **pipeline**: 인제스트→필터→조인→status 오케스트레이션, idempotent 스냅샷·diff(INV-7).
- **web**: 사용자 화면, Tier2 request-time 조회, 출처표기 렌더, UGC 인입.
- **shared**: 도메인·데이터를 모르는 순수 유틸만.

## 3. 경계 규칙 표 (allow / deny import)
| 패키지 | import 허용 | import 금지 |
|---|---|---|
| core-domain | (없음 — 순수) | 모든 다른 패키지 |
| ingest | core-domain, shared | pipeline, web |
| pipeline | core-domain, ingest, shared | web |
| web | core-domain(타입), shared | ingest, pipeline |
| shared | (없음) | core-domain, ingest, pipeline, web |

추가 강제: **`PriceQuote`(Tier2 런타임 타입)는 `apps/web`에서만 정의·사용**한다. core-domain/ingest/pipeline에서 `PriceQuote` import 시 lint 차단(INV-4).

## 4. 공유 계층
`shared`만 공용. 출처표기·로깅·날짜·좌표변환(EPSG) 헬퍼를 둔다. 도메인 규칙·데이터 fetch를 넣지 않는다.
