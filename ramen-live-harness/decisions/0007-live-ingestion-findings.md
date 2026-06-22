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

### 음식점 결정
- **블로킹: 새 data.go.kr 키 발급 대기.** 키 확보 후 (식약처처럼) 라이브 1건 응답으로 odcloud 경로·파라미터(`page/perPage` vs `pageNo/numOfRows`)·필드 케이싱 확정한 뒤 `ingest/adapters/datagokr-restaurant.ts` 배선(추측 코드 금지). 좌표는 기존 toWgs84(EPSG:5174)로 변환. 대량(~210만행)이라 초기 벌크 시드 + 지역(opnSfTeamCode) 증분.
