# M4 — 음식점 레이어 (LOCALDATA)

**상태**: 완료 ✅  **갱신**: 2026-06-18

## 맥락
백서 Phase 1. 전국 라면·라멘 음식점의 **존재·위치·영업상태**를 LOCALDATA(일반음식점 표준데이터 + 모범음식점)로 자동 구성한다. 맛집성(추천·평점)은 보류(Tier3, M7). 음식점 PK는 인허가관리번호. 좌표는 TM(중부원점) → WGS84 변환 필요(런북 11).

## 진입조건 (DoR)
- [x] M3 DoD 통과 (Phase 0 빌드 경로 완성)
- [x] `docs/TECHNICAL` §1.1(음식점 소스)·ADR-0004(음식점 식별) + INV-9 확인
- [x] 출력 스키마(`RamenShop`) 확정 — M0에서 정의(인허가관리번호 PK)
- [~] 공공데이터 LOCALDATA 서비스키 — 라이브 수집 시점 보류. DoD는 고정 픽스처 기반.

## 할 일
shared 좌표 변환기 구현(proj4, EPSG:5174/5181/5179/2097 → WGS84, 런북 11) → 음식점 raw 타입(일반음식점·모범음식점) → 정규화(인허가관리번호 PK·주소·좌표→WGS84·영업상태) → 라멘/라면 음식점 도메인 필터(업태 일식·분식 + 상호 키워드 + 보정, ADR-0004) → 모범음식점 플래그 조인 → `RamenShop` 출력 + 정밀도 리포트.

## 참조
`docs/TECHNICAL` §1.1·§3.1, ADR-0004, INV-9(출처)·INV-7(결정론). 런북 11(좌표).

## DoD (완료 게이트)
1. [x] 고정 픽스처로 인제스트→정규화→필터→조인 단위 테스트 그린, 결정론.
2. [x] 사업장명만 다른 케이스에서 인허가관리번호 동일 레코드 유지(PK 안정).
3. [x] 좌표 변환: TM→WGS84 한국 위경도 범위 내 + 왕복 허용오차 일치. 좌표 결측/무효는 lat/lng 생략.
4. [x] 영업상태(영업/폐업/휴업/말소) → ACTIVE/CLOSED 정규화 정확.
5. [x] 모든 출력 레코드에 `source` 채워짐(INV-9).
6. [x] 도메인 필터 정밀도: 샘플셋 오탐/누락 건수 리포트.

## 검증
`npm test -w @ramen/ingest`(음식점 모듈) + `npm test -w @ramen/shared`(좌표); build/typecheck/lint green.

## 증거
~~~
# 2026-06-18
npm test -w @ramen/shared → coords.test 6 tests (왕복 1e-6, 한국범위) passed
npm test -w @ramen/ingest → 6 files 58 tests passed (shop-normalize 8 / shop-filter 7 / shop-join 8 + 기존)
npm run build/typecheck/lint/test → 전부 exit 0 (전체 88 테스트)

DoD#1 결정론: joinShops 2회 → shops deepEqual + contentHash 동일.
DoD#2 PK 안정: MGT-0001 사업장명 리뉴얼 → id·isModelRestaurant·source 불변, name만 변동.
DoD#3 좌표: proj4 단일 변환기(EPSG:5174/5181/5179/2097→WGS84). 왕복 round-trip 6자리 일치,
  변환 결과 한국 범위(위33-39·경124-132). 좌표 결측(멘야하나)·(0,0)무효 → lat/lng 생략.
DoD#4 영업상태: 영업/정상→ACTIVE, 폐업·휴업·취소/말소→CLOSED.
DoD#5 출처(INV-9): 전 RamenShop source=RESTAURANT.
DoD#6 필터 정밀도: 보정 전 P0.75/R0.75 (FP=라면땅 MGT-0006, FN=하카타분코 MGT-0007),
  보정(include 0007 / exclude 0006) 후 1.0/1.0.
부가: 모범음식점 플래그(MGT-0001), 빈 PK 드롭, 좌표계 기본 EPSG:5174(설정 가능).
~~~

## 롤백 계획
음식점 모듈을 커밋 분리. 좌표계 오판 시 변환기(shared/coords) 한 곳만 갱신(런북 11). 어댑터 스키마 변경은 해당 어댑터만(런북 9).

## 리스크 / 미지수
- **좌표계 혼동**(런북 11): LOCALDATA 좌표 EPSG가 데이터셋별로 5174/5181/5179 등 상이 가능 → 소스별 확인 후 단일 변환기로. 기본 EPSG는 설정 가능.
- 도메인 필터: '라멘'은 일식, 한국식 라면/분식은 분식 — 업태만으론 부족, 상호 키워드+보정 필요(ADR-0004). 편의점·휴게소 컵라면 제외.
- 라이브 LOCALDATA는 delta API 제공 → 증분 전환 가능하나 idempotent full-snapshot(INV-7) 유지.

## 주의
좌표 변환 정확도는 기준점 골든 검증이 이상적이나, 현 단계는 범위+왕복 일관성으로 게이트. 권위 측량점 대조는 라이브 검증 항목. 키워드 필터는 불완전 → 보정 리스트로 관리.
