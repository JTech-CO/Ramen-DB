# ADR-0007: Tier1 라이브 연동 — 식품안전나라 직접 호출 + 영양 조인 키 부재 대응

- **상태**: 채택(배선) + 일부 결정 대기
- **일시**: 2026-06-19
- **관련**: phase M1·M4, Q2, INV-1·INV-5·INV-9, `docs/ENVIRONMENT`, 런북 9·14

## 맥락
라이브 키 연동을 위해 실제 API 스펙을 권위 출처(data.go.kr, openapi.foodsafetykorea.go.kr, localdata.go.kr 개발가이드)로 조사(2026-06-19)한 결과, 픽스처 기반 설계와 라이브 현실 사이에 다음 차이가 드러났다.

1. **식약처 1·2·3은 data.go.kr 표준 envelope가 아니다.** data.go.kr 15062098/15127578/15074318은 실제로 `openapi.foodsafetykorea.go.kr/api/{KEY}/{SERVICE_ID}/json/{START}/{END}`로 호출된다. 서비스키는 **경로**에 삽입, 응답 root = SERVICE_ID, `.row[]`/`.total_count`/`.RESULT.CODE("INFO-000")`. SERVICE_ID: 품목제조보고 **I1250**(15062098 원재료 변형은 C002), 영양 **I2790**, 회수 **I0490**.
2. **영양DB(I2790)에 품목제조보고번호가 없다.** FOOD_CD·DESC_KOR·MAKER_NAME·NUTR_CONT1~ 기반. 따라서 M1의 "품목제조보고번호로 영양 조인"은 **라이브에서 성립하지 않는다.**
3. **품목제조보고(I1250)에 바코드가 없다.** 바코드는 회수(I0490, BRCDNO) 또는 별도 유통바코드 서비스(15064775)에서만 확보.
4. **회수(I0490) 필드명이 픽스처와 다르다**: PRDTNM/BRCDNO/RTRVLPRVNS/RTRVL_GRDCD_NM/IMG_FILE_PATH/BSSHNM/CRET_DTM. 회수↔판매중지 구분 전용 필드는 불명확.
5. **LOCALDATA(localdata.go.kr)는 2026-04-16 폐지·data.go.kr 이관.** 음식점(M4) 라이브 엔드포인트(`/platform/rest/TO0/openDataApi`, authKey 쿼리, `result.body.rows[0].row[]`, opnSvcId 일반음식점 `07_24_04_P`)는 이관본으로 재확인 필요. 모범음식점 opnSvcId 미확정.

## 결정
- 식약처 직접 호출 어댑터 `ingest/adapters/foodsafetykorea.ts` 채택(envelope·페이징·키=경로 확정분). 제품·회수 매퍼 배선. **영양·LOCALDATA는 미배선**(아래 대기).
- Tier2 provider는 `apps/web/tier2/provider-factory.ts`로 env 키에서 구성(키 있는 provider만).
- 실데이터 확정 전 SERVICE_ID(I1250 vs C002)·필드 케이싱·회수구분은 **라이브 1건 호출로 확정**(런북 9).

## 결정 대기 (사용자/후속)
- **영양 조인 전략(Q2)**: I2790에 PK 부재 → ① 식품명+제조사 매칭 + 보정 리스트, ② 영양 보류(nutrition=null, 커버리지 0), ③ 유통바코드 등 매개 키 도입 중 택1. 정밀도·운영비 트레이드오프.
- **LOCALDATA 이관 엔드포인트**: data.go.kr 이관본 spec 확인 후 음식점 어댑터 배선. 모범음식점 데이터셋 ID/opnSvcId 확정.
- **서비스키 발급**: data.go.kr/식품안전나라 키(Tier1), 네이버·쿠팡(Tier2). 운영자 발급 필요(INV-1, env/secret).

## 근거 / 트레이드오프
- 확정된 envelope·제품/회수 경로만 배선해 추측 코드를 피했다(증거 기반). 깨진 전제(영양 PK 조인)·폐지된 경로(LOCALDATA)는 의도적으로 미구현해 잘못된 "완료"를 만들지 않는다.
- 비용: 영양 조인·음식점 라이브는 후속 결정/스펙 확인까지 보류. 제품 사전(이름·제조사·판매상태)은 키만으로 라이브 가능.

## 대안
- 픽스처 필드명대로 라이브 강행 — 실응답과 불일치로 빈 데이터(런북 5). 기각.
- 영양 0 강제 매칭 — 잘못된 영양 표시(INV 위배 정신). 기각.

## 라이브 1건 확정 (2026-06-22, 런북 9 완료 — 실키 호출)
실키로 `/1/3`·`/1/1000` 호출해 envelope·필드명·권한·규모를 확정했다.
1. **I1250(품목제조) ✅** — `CODE=INFO-000`, **total_count 1,058,272**(전 식품). 필드 `PRDLST_REPORT_NO/PRDLST_NM/BSSH_NM/PRDLST_DCNM/PRMS_DT/LCNS_NO` 모두 `mapProductReportRow`와 일치. SERVICE_ID는 **I1250 확정**(C002 불요).
2. **I0490(회수) ✅** — `INFO-000`, 351건. 필드 `PRDTNM/BRCDNO/BSSHNM/RTRVLPRVNS/RTRVL_GRDCD_NM/IMG_FILE_PATH/CRET_DTM/RTRVLDSUSE_SEQ` 모두 `mapRecallRow`와 일치.
3. **영양 API ❌ — 두 겹의 문제(2026-06-22 추가 확인)**:
   - **(a) 서비스별 활용신청**: 같은 키로 I1250/I0490은 성공하나 영양·바코드 계열(I2790·I0750·I2590·C005)은 전부 `HTTP 200 + HTML("인증키가 유효하지 않습니다")`. 식약처 OpenAPI는 **서비스별 활용신청**이며 현 키는 품목제조+회수만 인가됨.
   - **(b) I2790은 구버전**: I2790 = "식품영양성분DB(**~2023**)" 레거시. data.go.kr "식품영양성분DB정보"(15127578)는 **LOD(서비스유형 L)** 라 OpenAPI 활용신청 체크박스가 비활성.
   - **(c) 현 영양 데이터의 정본** = data.go.kr **「전국통합식품영양성분정보(가공식품) 표준데이터」**(별도 데이터셋·별도 활용신청·다른 엔드포인트/필드). 우리 어댑터의 I2790 경로는 폐기 대상.
   - 그 전까지 `nutrition=null`(영양 보류, 옵션 ②) — graceful degrade로 스냅샷 무영향.
4. **제품은 식품유형 서버필터로 좁힌다.** I1250 전량(106만)은 비현실적 → `PRDLST_DCNM=유탕면`(1,361)·`건면`(2,777) 등 면류만 서버필터(도메인 필터 ① 단계의 서버사이드 이행, `fetchProductReportsByFoodTypes`). 제품명 부분매칭(`PRDLST_NM=라면`)은 스프·후레이크 등 부재료가 섞여 부적합.
5. **버스트 스로틀링** — `/1/1000` 동시 2건만으로도 식약처가 간헐적으로 같은 인증오류 HTML을 반환(키는 유효). `fetchEnvelope` **선형 백오프 재시도(기본 3회)**로 회복. 진짜 미승인(I2790)은 재시도 소진 후 throw → 호출부가 영양 없이 강등(부분 성공).
6. **첫 실데이터 스냅샷**: 면류 서버필터 + 라면 키워드 도메인 필터 → **932개 라면 제품**(BAG 743·CUP 189), 전부 ON_SALE/high(현재 회수 매칭 0 — 라면 회수 없음, 날조 없음). 키워드 오탐 1건(`천하일미 만능 클로렐라 면` — compact 후 '…클로렐**라면**' 부분매칭) → exclude 보정 후보(ADR-0004 ③).

### 갱신된 결정
- 영양 조인 = **옵션 ②(영양 보류)로 당장 진행**(932종 DB는 영양 없이 완결). 추가 시 **I2790이 아니라** data.go.kr 「전국통합식품영양성분정보(가공식품) 표준데이터」를 활용신청하고 **신규 어댑터**를 배선(엔드포인트·필드 상이) → 기존 식품명+제조사 매칭(ADR-0007 옵션①·배선됨)에 연결. `SNAPSHOT_NUTRITION=off`로 미승인 중 호출 생략.
- 제품 SERVICE_ID **I1250 확정**, 식품유형 서버필터를 라이브 기본 경로로 채택.

## 음식점 라이브 — LOCALDATA 폐지·data.go.kr 이관 (2026-06-23, 서브에이전트 조사)
- **LOCALDATA(localdata.go.kr) 2026-04-16 완전 폐지** — REST 호스트(`/platform/rest/TO0/openDataApi?authKey=`) 다운(연결 거부). `file.localdata.go.kr` 벌크 CSV만 잔존. → data.go.kr로 이관.
- **일반음식점(spine) = data.go.kr OpenAPI `15154916`**(행정안전부, 구 `07_24_04_P`). 인증 = data.go.kr **serviceKey 쿼리파라미터**(식약처 path키와 다름). odcloud 변환형(`api.odcloud.kr/api/15154916/v1/uddi:<uuid>?serviceKey=&page=&perPage=`), 행은 `data[]`. 필드: `bplcNm`(상호)·`rdnWhlAddr`(도로명)·`x`/`y`(좌표)·`trdStateNm`(영업상태)·`uptaeNm`(업태 일식/분식)·**`mgtNo`(관리번호=PK)**. 일 10,000콜.
  - **좌표 = EPSG:5174 Bessel 투영미터(경위도 아님)**. proj4: `+proj=tmerc +lat_0=38 +lon_0=127.0028902777778 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +units=m +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43`. (우리 shared/coords.ts EPSG:5174 정의와 일치 — 2097 금지.)
- **모범음식점 = data.go.kr `15064964` = 식약처 `I1590`** — **기존 path키로 호출 가능**(`.../api/{KEY}/I1590/json/1/1000`, 행 `I1590.row[]`). 단 8필드(LCNS_NO·BSSH_NM·SIGNGU_NM·…)로 **주소·좌표·mgtNo 없음** → 표준CSV `15096282`(행안부, 주소+관리번호 보유) 또는 업소명+주소로 일반음식점에 조인.
- **KEY REQUIRED — 새 data.go.kr serviceKey 필요(YES)**: 일반음식점 `15154916` 활용신청(자동승인 ~1–2h) → Decoding 키를 별도 secret(예 `DATA_GO_KR_API_KEY`)로. 식약처 path키로는 호출 불가. (모범음식점 I1590만 예외적으로 기존 키 사용 가능하나 단독으론 불충분.)

### 음식점 결정 — 배선 완료 (2026-06-23, 실키 확정)
- **엔드포인트는 odcloud이 아니라 표준 data.go.kr REST**: `https://apis.data.go.kr/1741000/general_restaurants/info` (오퍼레이션 `/info`). 인증 = **serviceKey 쿼리**파라미터(`DATA_GO_KR_API_KEY`, 식약처 path키와 별개). 파라미터 `pageNo·numOfRows(≤100)·returnType=json`. 응답 `response.header.resultCode("0" 성공)` / `response.body.items[]` / `totalCount`(=**2,282,129**).
- **실응답 필드 매핑 확정**(`mapRestaurantRow`): `MNG_NO`→MGTNO(PK)·`BPLC_NM`→상호·`ROAD_NM_ADDR`/`LOTNO_ADDR`→주소·`CRD_INFO_X/Y`→좌표·`SALS_STTS_NM`→영업상태·`BZSTAT_SE_NM`→업태·`LCPMT_YMD`→인허가일. 좌표는 **EPSG:5174 확정**(서울 37.5/127, 부산 35.1/129 정상 변환).
- **어댑터 배선 완료**: `ingest/adapters/datagokr-restaurant.ts`(페이지네이션·관리번호 중복제거·재시도). `pipeline/live.ts`가 `DATA_GO_KR_API_KEY` 있으면 수집, `buildSnapshot`의 기존 라멘 shop-filter로 필터. 테스트 +7.
- **서버사이드 업태/지역 필터 없음 + 쿼터 10k콜/일**: 밀도 측정 0.21%(만건당 21개) → 전국 추정 **~4,800 라멘**. 전량 스캔(22.8k콜)은 일일 쿼터 초과 → `SNAPSHOT_SHOP_MAX_ROWS`로 부분 스캔(명시적 opt-in).
- **게이트웨이 성능 한계(라이브 측정)**: 응답시간이 부하에 따라 크게 변동 — 한산할 때 page당 ~2~3s(100page 성공, 21라멘), 혼잡할 때 page당 20~40s + **깊은 오프셋(>~page 50)은 서버 60s 타임아웃으로 막힘**. 어댑터는 페이지 실패를 건너뛰고 6연속 실패 시 부분 결과로 중단(crash 방지). 따라서 **API 커버리지는 게이트웨이 부하에 좌우**되며(혼잡 시 ~5k행=~10라멘, 한산 시 더 많음), 안정적 전량 커버는 **벌크파일(file.localdata.go.kr) 시드가 후속**. CI 주간 실행은 off-peak(월 03:00 KST)라 커버리지에 유리.
- **첫 라이브 배포(2026-06-23)**: 혼잡 시간대 부분 스캔으로 라멘 음식점 2곳 라이브. 통합 검증 완료.

### 음식점 전량 커버 — 벌크파일 시드 (2026-06-23, 완료)
API 게이트웨이의 깊은-페이지 한계를 우회해 **전국 일반음식점 벌크 CSV로 전량 커버**했다.
- **다운로드**: data.go.kr 15045016의 제공URL = `file.localdata.go.kr` 다운로드 페이지(CSRF). 흐름: 페이지 GET(referer=data.go.kr)으로 `XSRF-TOKEN` 쿠키+`<meta _csrf>` 확보 → `GET /file/download/general_restaurants/info`에 `X-XSRF-TOKEN` 헤더+쿠키 → `식품_일반음식점.csv` **692MB, 2,282,138행, CP949**.
- **시드 스크립트** `scripts/seed-restaurants-bulk.mjs`: 스트리밍 + `TextDecoder('euc-kr')` 디코드 + 따옴표 CSV 파싱 → 컬럼 매핑(관리번호[1]·사업장명[8]·업태[9]·도로명주소[19]·영업상태[3]·좌표 X[34]/Y[35]) → 키워드 1차컷 후 `filterRamenShops` 정밀 필터 → **라멘 2,859곳** → `data/ramen-shops.json`(769KB, 커밋).
- **파이프라인**: `snapshot.ts`가 `data/ramen-shops.json` 있으면 음식점 입력으로 사용(API 스캔보다 우선). 좌표 EPSG:5174→WGS84, 라이브 배포 완료(48페이지·지도링크).
- **주기 갱신**: 벌크 재다운로드 → 시드 재생성 → 커밋(데이터는 매일 D-2 갱신). CI는 커밋된 시드를 읽어 692MB 재다운로드 불요.
- **체인 보정(2026-06-23)**: 상호에 라멘/라면 없는 유명 라멘(류) 체인을 벌크 데이터로 검증해 화이트리스트(`RAMEN_SHOP_CHAINS`) 추가 — **잇푸도·무테키야·탄탄면·돈코츠**. 과탐 후보(토리=닭/도토리, 천하일품=일반어, 우마이·하카타 등)는 데이터로 확인해 **제외**. 이치란은 실데이터에 미존재(오탐만). 결과 2,859→**2,917**. 추가 누락(예: 일본어 상호 신규 체인)은 동일 절차로 데이터 검증 후 화이트리스트 확장.
