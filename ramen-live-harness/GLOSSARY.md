# GLOSSARY.md — 공유 용어집

> 에이전트와 사람이 같은 단어를 같은 뜻으로 쓰게 한다. 세션 간 용어 표류를 막는 장치.

| 용어 | 정의 |
|---|---|
| DoR (Definition of Ready) | phase 진입조건. 만족해야 작업 시작 가능 |
| DoD (Definition of Done) | phase 완료 게이트. 전부 충족해야 완료 |
| 불변식 (Invariant) | 절대 위반 불가 규칙. 1건 위반 시 통과 금지(`INVARIANTS.md`) |
| 정합성 (Parity) | 같은 로직의 두 구현이 동일 입력에 동일 출력 |
| 게이트 (Gate) | 측정 가능한 통과/실패 판정 기준 |
| 증거 (Evidence) | 게이트 통과의 근거가 되는 명령과 출력 |
| Tier 1 (창고형) | 공공데이터. 합법 적재·재배포 가능. 주간 풀 스냅샷의 대상 |
| Tier 2 (실시간형) | 상용 검색/쇼핑/지도 API. 영속 저장 금지, request-time 조회 |
| Tier 3 (UGC/수작업) | 공개 소스 없음. 사이트 자체 제출·운영자 큐레이션 |
| 품목제조보고번호 | 식약처 발급 제품 식별번호. 제품 불변 PK, 영양·회수 조인 키(INV-5) |
| 바코드(GTIN/KAN) | 유통 표준 상품코드. Tier2(온라인 상품) 매칭 브리지 키 |
| 인허가관리번호 | LOCALDATA 음식점 식별번호. 음식점 PK |
| 단종 추론 | 회수·판매중지 피드(high) → 제조사 폐업(medium) → 스냅샷 부재(low) 순으로 status·confidence 도출 |
| confidence | status 신뢰도 등급(high/medium/low). high 미만은 '추정' 표기 |
| 풀 스냅샷 | Tier1 전체를 재생성하는 산출물. idempotent 재현 가능(INV-7) |
| 변동분(delta) | LOCALDATA 등이 제공하는 증분 갱신 |
| 도메인 필터 | 식품유형코드·업태코드 + 키워드로 라면/라멘을 선별. 불완전 → 보정 리스트 운영 |
