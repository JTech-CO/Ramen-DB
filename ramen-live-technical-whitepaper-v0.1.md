# ramen.live 기술 백서 (Technical Whitepaper)

| | |
|---|---|
| 프로젝트 | ramen.live — 국내 라면 통합 데이터 플랫폼 |
| 문서 버전 | v0.1 (draft) |
| 상태 | 설계 전제 확정(3-tier), 데이터 소스 매핑 완료, 스키마/파이프라인 초안 |
| 범위 | 봉지/컵 가공라면 + 전국 라면·라멘 음식점. 제품정보·영양·레시피·판매상태·구매경로 |
| 비범위(현 단계) | 해외 라면, 진성 단종 자동 확정, 오프라인 매장별 진열 데이터 |

---

## 0. 설계 전제

ramen.live의 난이도는 사이트나 갱신 파이프라인이 아니라 **데이터 수급**에 있다. 그리고 수집 대상 데이터는 균질하지 않다. **저장·재배포 가능 여부**에 따라 3개 계층으로 갈리며, 계층마다 저장 모델·갱신 주기·법적 처리가 다르다. 본 문서의 모든 설계는 이 3-tier 분할을 관통 원칙으로 한다.

- **Tier 1 (창고형)** — 공공데이터. 합법적으로 적재·재배포 가능. ramen.live의 실제 자산. 주간 풀 스냅샷.
- **Tier 2 (실시간 조회형)** — 상용 검색/쇼핑/지도 API. 영구 저장 금지, 조회 시점 표시 + 출처표기. request-time.
- **Tier 3 (수급 불가/수작업)** — 공개 소스가 없거나 ToS상 자동화 불가. UGC·운영자 큐레이션. human-in-the-loop.

---

## 1. 데이터 소스 매핑

### 1.1 Tier 1 — 공공데이터 (창고형 핵심 자산)

가공라면의 제품·영양·판매상태와 전국 음식점 존재·영업상태가 모두 정부 오픈 API로 합법 확보된다. 식별 키는 `품목제조보고번호`(제품)와 `인허가관리번호`(음식점)다.

| 소스 | 식별/출처 | 주요 제공 항목 | 갱신 | 역할 |
|---|---|---|---|---|
| 식품(첨가물)품목제조보고 | data.go.kr/15062098 (식약처) | 품목제조보고번호, 제품명, 업체명, 품목유형, 원재료 | 정기 | **전체 제품 로스터 원천**, PK 발급처 |
| 식품영양성분 통합 DB | data.go.kr/15127578 (식약처) | 식품코드, 식품명, 에너지·탄수·단백·지방·당·포화/트랜스지방·나트륨·콜레스테롤, 함량기준량, 1회섭취참고량, 품목제조보고번호, 업체명 | 정기 | **영양소** (품목제조보고번호로 조인) |
| 식품 회수·판매중지 정보 | data.go.kr/15074318 (식약처) | 제품명, 회수사유, 제조업체명, **바코드번호**, 품목제조보고번호, 회수등급, **제품사진 URL**, 포장단위 | 수시 | **판매중지/회수 권위 피드** (단종 신호 1차) |
| 식품제조가공업 폐업정보 | 행정안전부 (푸드이음/localdata 계열) | 제조사 영업/폐업 상태 | 정기 | **제조사 단위 단종 신호** (2차) |
| 식품업소 인허가 대장 이력 | 식의약 데이터포털 | 업소 인허가 변경 이력 | 정기 | 제조사 상태 변경 추적 |
| 전국 일반음식점 표준데이터 | data.go.kr/15096283 / localdata.go.kr | 사업장명, 소재지주소, 좌표, 영업상태(영업/폐업), 인허가일자, 업태 | 월말 자동(변동분 별도) | **음식점 존재·위치·영업상태** |
| 모범음식점 정보 | localdata.go.kr | 모범음식점 지정 업소 | 정기 | 음식점 품질 보조 신호 |

> 핵심 키: **품목제조보고번호**가 품목제조보고 ↔ 영양성분 ↔ 회수·판매중지를 잇는 조인 키다. **바코드(GTIN/KAN)**는 회수 피드에서 확보되며 Tier 2(온라인 상품 매칭)로 가는 브리지 키다. **인허가관리번호**는 음식점 PK다.

### 1.2 Tier 2 — 상용 API (실시간 조회형, 저장 금지)

가격·구매링크·외부 리뷰가 여기 속한다. 이 데이터를 "주간 스냅샷"으로 적재하는 것이 가장 큰 법적 리스크다. 상용 검색/지도/플레이스 API는 대체로 조회 시점 실시간 표시 + 출처표기 모델이며, 영구 DB 저장과 재배포를 약관으로 제한한다.

| 대상 | 후보 소스 | 처리 모델 | 비고 |
|---|---|---|---|
| 온라인 가격 | 네이버 검색(쇼핑) API, 카카오 등 | request-time 조회, 캐시 TTL 후 폐기 | 저장 허용 범위·TTL 약관 확인 필요 |
| 구매 링크 | 쿠팡 파트너스 | 실시간 + 제휴 링크 | 수익화 정당 경로 |
| 외부 리뷰/평점/사진 | 네이버 플레이스, 카카오맵 | 표시만, 적재 금지 | 크롤링 금지 |

> 본 문서는 상용 API의 일반 패턴만 검증했다. 제공자별 정확한 저장 허용 범위·캐시 TTL·출처표기·호출 제한은 운영자가 직접 약관을 확인해야 한다 (Open Question Q1 참조).

### 1.3 Tier 3 — 수급 불가 / 수작업·UGC

| 대상 | 현실 | 처리 |
|---|---|---|
| 진성 단종(조용한 단종) | 공식 피드 없음 | 품목제조보고 스냅샷의 시계열 부재로만 추정. confidence=low |
| 오프라인 매장별 진열 | 깨끗한 공개 소스 없음 | 현 단계 비범위. 추후 제휴/수작업 |
| 맛집 큐레이션·평점 | LOCALDATA는 '존재/영업'만 제공, '맛집성' 미포함 | 운영자 검수 + UGC |
| 유저 꿀조합 레시피 | 블로그 크롤링은 ToS+저작권 위반 | 사이트 자체 UGC 제출만 수용 |

---

## 2. 데이터 스키마

JS/TS 기준 코어 타입 스케치. 영속 엔티티는 Tier 1·3에 한하며, Tier 2(`PriceQuote`)는 **런타임 전용**으로 영속 저장소에 절대 기록하지 않는다.

```typescript
// ── Tier 1: 영속, 주간 스냅샷으로 재생성 가능 ──

type ProductStatus =
  | "ON_SALE"        // 판매중
  | "SALES_HALTED"   // 판매중지 (회수 피드 기반, confidence high)
  | "RECALLED"       // 회수 (회수 피드 기반, confidence high)
  | "DISCONTINUED?"; // 단종추정 (제조사 폐업 or 스냅샷 부재, confidence < high)

interface RamenProduct {
  id: string;                 // 품목제조보고번호 (불변 PK)
  name: string;               // 제품명 (변동 가능, 비키)
  barcode?: string;           // GTIN/KAN, Tier 2 브리지 키
  packageType: "BAG" | "CUP" | "OTHER";
  manufacturerId: string;     // → Manufacturer.id
  nutrition?: Nutrition;      // 영양 DB 미커버 시 null
  status: ProductStatus;
  statusSource: string;       // 상태 근거 데이터셋
  statusConfidence: "high" | "medium" | "low";
  imageUrl?: string;          // 회수 피드 제공분 등
  officialRecipe?: string;    // 패키지 조리법
  sourceRefs: string[];       // 출처 데이터셋 ID 목록
  updatedAt: string;
}

interface Nutrition {
  servingBasis: string;       // 영양성분 함량 기준량
  energyKcal: number;
  carbG: number; proteinG: number; fatG: number;
  sugarG?: number; satFatG?: number; transFatG?: number;
  sodiumMg?: number; cholesterolMg?: number;
}

interface Manufacturer {
  id: string;                 // 업체/업소 식별자 (PK)
  name: string;
  businessStatus: "ACTIVE" | "CLOSED"; // 폐업정보/인허가 이력 기반
  source: string;
}

interface RamenShop {
  id: string;                 // 인허가관리번호 (PK)
  name: string;
  address: string;
  lat?: number; lng?: number;
  businessStatus: "ACTIVE" | "CLOSED";
  category?: string;          // 업태
  isModelRestaurant?: boolean;
  source: string;
}

interface RecallEvent {
  id: string;
  productId?: string;         // 품목제조보고번호
  barcode?: string;
  reason: string;
  grade?: string;             // 회수등급
  reportedAt: string;
  source: string;             // 회수·판매중지 데이터셋
}

// ── Tier 3: 영속, 운영자/UGC ──

interface Recipe {           // 유저 꿀조합
  id: string;
  title: string;
  baseProductIds: string[];  // 사용 라면 제품
  ingredients: string[];
  steps: string[];
  author: string;            // 사이트 가입 유저
  submittedAt: string;
}

// ── Tier 2: 런타임 전용. 영속 저장 금지. ──

interface PriceQuote {       // 절대 DB 미적재. 응답 후 폐기/캐시 TTL.
  seller: string;
  price: number;
  url: string;               // 제휴 링크
  fetchedAt: string;         // 조회시각 (표시 필수)
}
```

**단종 상태 도출 규칙** (status 우선순위):

1. 회수·판매중지 피드에 존재 → `RECALLED` / `SALES_HALTED`, confidence **high**.
2. 제조사 `businessStatus=CLOSED` → 해당 제조사 전 제품 `DISCONTINUED?`, confidence **medium**.
3. 직전 N개 품목제조보고 스냅샷에서 연속 부재 → `DISCONTINUED?`, confidence **low**.
4. 위 어디에도 없으면 → `ON_SALE`.

confidence가 high 미만인 상태는 UI에서 단정형('단종됨')으로 표기하지 않고 추정형('단종 추정')으로만 표기한다.

---

## 3. 갱신 파이프라인

계층별로 갱신 모델이 다르다. "하나의 거대한 주간 ETL"이 아니라 **Tier 1만 주간 풀 스냅샷**, Tier 2는 request-time, Tier 3는 human-in-the-loop이다. Tier 1 데이터량(식품 수만 건, 음식점 수십만 건)은 작아 GitHub Actions + 정적 산출물로 충분하며, 별도 상시 서버가 필수는 아니다 (Pi 또는 Actions artifact 가능).

### 3.1 Tier 1 — 주간 풀 스냅샷 (GitHub Actions cron)

```
[1] Ingest    품목제조보고 / 영양성분 / 회수·판매중지 / 폐업·인허가이력 /
              일반음식점·모범음식점  ← OpenAPI 또는 벌크 파일
   ↓
[2] Filter    라면 도메인 필터
              · 제품: 식품유형코드 + 제품명 키워드(라면/라멘/면). 키워드는
                불완전 → 수동 보정 리스트로 관리
              · 음식점: 업태 + 상호 키워드
   ↓
[3] Normalize 품목제조보고번호로 제품·영양·회수 병합, 바코드 보강,
   & Join      제조사 폐업상태 결합, 좌표 정규화(좌표계 변환)
   ↓
[4] Derive    §2 단종 도출 규칙 적용 → status + source + confidence
   ↓
[5] Snapshot  정적 산출물(JSON/SQLite) + 버전 태그
              + diff 리포트(전주 대비 신규/단종/판매중지/변경)
   ↓
[6] Publish   CDN/정적 호스팅 배포
```

LOCALDATA는 변동분(delta) API를 제공하므로, 음식점 레이어는 풀 스냅샷 대신 증분 갱신으로 전환 가능하다. 단, idempotent full-snapshot 재생성 능력(INV-5)은 유지한다.

### 3.2 Tier 2 — request-time

제품 상세 진입 시 바코드/제품명으로 쇼핑 API 실시간 조회 → 제휴 링크 렌더 → 캐시 TTL 후 폐기. 응답에 출처·조회시각 표기.

### 3.3 Tier 3 — human-in-the-loop

음식점은 LOCALDATA로 '존재/위치/영업상태'만 자동 채우고, '맛집성'(추천·큐레이션·평점)은 운영자 검수와 UGC로 채운다. 레시피 꿀조합은 가입 유저 제출분만 수용.

---

## 4. INVARIANTS

프로젝트 전 기간 불변. 위반 시 빌드/머지 차단 대상.

- **INV-1** `품목제조보고번호`는 가공라면 제품의 불변 PK다. 제품명·제조사명 변경에도 동일 레코드를 유지한다.
- **INV-2** Tier 2 데이터(가격/구매링크/외부 리뷰)는 어떤 경우에도 영속 저장소에 기록하지 않는다. 런타임 조회 + 약관 허용 범위 내 캐시(TTL)만 허용하며, 응답에 출처·조회시각을 표기한다.
- **INV-3** 모든 `status`는 `source`와 `confidence`를 동반한다. confidence가 high 미만인 상태를 단정형으로 표기하지 않는다.
- **INV-4** 모든 외부 출처 데이터는 표시 시 출처를 명시한다(공공데이터 라이선스·상용 API 약관 준수).
- **INV-5** Tier 1 전체 데이터셋은 idempotent full-snapshot으로 재생성 가능하다. 특정 주차 산출물이 손상돼도 재실행으로 동일 결과를 얻는다.
- **INV-6** UGC(레시피·꿀조합·맛집 큐레이션)는 사이트 자체 제출분만 수용한다. 외부 블로그·플레이스 크롤링을 하지 않는다.

---

## 5. 미해결 / 리스크

- **진성 단종**: 제조사가 조용히 단종한 케이스는 공식 피드가 없어 스냅샷 부재 추론(confidence low)이 한계다. 회수·판매중지 피드가 단종의 일부만 커버함을 명시한다.
- **영양 DB 커버리지 갭**: 품목제조보고 로스터에 있으나 영양 DB에 없는 제품 존재 가능 → `nutrition=null`로 명시, 빈칸을 채우지 않는다.
- **도메인 필터 정밀도**: 라면/라멘 식별을 식품유형코드·업태코드 + 키워드로 하되 오탐/누락 불가피 → 보정 리스트 운영.
- **상용 API 약관**: Tier 2 저장 범위·TTL·출처표기·호출 제한은 운영자 직접 확인 필요(Q1).

---

## 6. MVP 범위 및 단계

- **Phase 0 (방어적 핵심)** — Tier 1 가공라면 제품 DB (품목제조보고 + 영양 + 회수·판매중지). 제품명·영양·제조사·판매상태 사전. **이것만으로 제품 가치 성립.** 합법적·고품질·자기완결.
- **Phase 1** — 음식점 레이어(LOCALDATA): 존재·위치·영업상태 지도. 맛집성은 보류.
- **Phase 2** — Tier 2 가격/구매 실시간 + 쿠팡 파트너스 제휴.
- **Phase 3** — UGC 레시피/꿀조합, 맛집 큐레이션·평점.

---

## 7. Open Questions (ADR 후보)

- **Q1** 네이버 검색·카카오 로컬·쿠팡 파트너스 각각의 저장 허용 범위·캐시 TTL·출처표기·호출 제한 확정.
- **Q2** 영양 DB ↔ 품목제조보고 로스터 커버리지 갭 실측.
- **Q3** 라면/라멘 도메인 필터의 식품유형코드·업태코드 매핑 확정.
- **Q4** 호스팅 형태(정적/CDN vs Raspberry Pi 상시) 및 스냅샷 산출 포맷(JSON vs SQLite).
- **Q5** domain ramen.live 확보 상태.
