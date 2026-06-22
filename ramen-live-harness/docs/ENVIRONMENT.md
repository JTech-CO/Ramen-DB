# ENVIRONMENT.md — 환경 셋업

## 1. 사전 요구
- Node LTS 권장. (실측 셋업: Node v25.2.0 + **npm** workspaces — ADR-0005. pnpm은 Node 25에서 install 크래시로 미사용.)
- 패키지 매니저: **npm**(워크스페이스). `package-lock.json` 커밋.

## 2. 설치
```
npm install        # 로컬
npm ci             # CI(락파일 고정)
```

## 3. 환경변수 · 시크릿 (.env 키 목록 — 값은 비움, 커밋 금지 INV-1)
`.env.example` 참조. 키 목록:
```
# Tier 1 공공데이터
DATA_GO_KR_SERVICE_KEY=

# Tier 2 상용 API (ADR-0003 약관 준수, 비영속 request-time 전용)
NAVER_SEARCH_CLIENT_ID=
NAVER_SEARCH_CLIENT_SECRET=
COUPANG_PARTNERS_ACCESS_KEY=
COUPANG_PARTNERS_SECRET_KEY=
```
CI(GitHub Actions)에서는 위 값을 repository secret로만 주입한다.

## 4. 실행
```
npm run build                      # 전체 워크스페이스 빌드
npm run snapshot -w @ramen/pipeline  # Tier1 풀 스냅샷 1회(M3)
```

## 5. 검증
```
npm run build           # = npm run build --workspaces --if-present
npm run typecheck       # tsc --noEmit -p tsconfig.json
npm run lint            # eslint . (모듈 경계 INV-3 / Tier2 비영속 INV-4)
npm test                # 전체 워크스페이스 테스트
npm test -w @ramen/ingest    # 단일 패키지 테스트
npm run verify          # build + typecheck + lint + test 일괄
```

## 6. 자원 요건
- Tier1 데이터량은 작아(식품 수만·음식점 수십만 건) 정적 산출·CDN 또는 Raspberry Pi로 충분. (호스팅 확정은 Q4)

## 6.1 라이브 엔드포인트 (ADR-0007)
- **Tier1 식약처(품목제조보고·영양·회수)**: `http://openapi.foodsafetykorea.go.kr/api/{KEY}/{SID}/json/{start}/{end}` — 키는 **경로**, root=SID, `.row/.total_count/.RESULT.CODE`. SID: 품목제조보고 `I1250`(15062098 원재료변형 C002), 영양 `I2790`, 회수 `I0490`. 어댑터 `ingest/adapters/foodsafetykorea.ts`.
- **영양 조인 주의**: I2790에 품목제조보고번호 **없음** → 영양 라이브 조인은 결정 대기(ADR-0007 Q2).
- **음식점 LOCALDATA**: localdata.go.kr **2026-04-16 폐지·data.go.kr 이관** → 이관본 엔드포인트 재확인 필요(미배선).
- **Tier2**: 네이버 `openapi.naver.com/v1/search/shop.json`(헤더 키), 쿠팡 `api-gateway.coupang.com/.../deeplink`(HMAC). `apps/web/tier2/provider-factory.ts`가 env 키로 구성.

## 7. 주의
- 모든 키는 `.env`/Actions secret로만. 커밋 금지(INV-1).
- Tier2 호출은 각 제공자 약관(저장 범위·TTL·출처표기·호출 제한) 확인 후 활성화 — ADR-0003로 해소(비영속·표시·출처·대가성 문구).
- 라이브 1건 호출로 SERVICE_ID·필드 케이싱·회수구분 확정 필요(런북 9, ADR-0007).
- 패키지 매니저 전환 경위·명령 매핑은 ADR-0005.
