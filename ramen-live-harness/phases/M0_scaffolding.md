# M0 — 기반/스캐폴딩

**상태**: 완료 ✅  **갱신**: 2026-06-18

## 맥락
이후 모든 phase가 의존하는 JS/TS 모노레포·도구·경계를 세운다. 경계를 잘못 잡으면 INV-3·INV-4 위반이 반복된다.

## 진입조건 (DoR)
- [x] 저장소 생성(git init, main), 패키지 매니저·Node 결정 → **npm workspaces + Node 25**(ADR-0005, `docs/ENVIRONMENT`)
- [x] 디렉터리/모듈 경계 초안 확정(`docs/FILE_TREE`)

## 할 일
~~pnpm~~ **npm** 워크스페이스 → 패키지 생성(`core-domain` / `ingest` / `pipeline` / `shared`, `apps/web`) → tsconfig·eslint·prettier → import 경계 룰(`no-restricted-imports`/`no-restricted-syntax`) → 기본 CI(빌드/타입체크/린트).

## 참조
`docs/FILE_TREE`(경계 규칙 표), INVARIANTS INV-1·INV-2·INV-3·INV-4.

## DoD (완료 게이트)
1. [x] `npm run build` / `npm run typecheck` / `npm run lint` / `npm test` 전부 그린.
2. [x] 금지된 모듈 상호 import 시 lint 에러로 차단됨(INV-3) — 의도 위반 샘플로 확인.
3. [x] `PriceQuote` 타입을 `apps/web` 외(`core-domain`/`pipeline`/`ingest`/`shared`)에서 import·참조 시 lint 차단됨(INV-4 경계화) — 위반 샘플로 확인.
4. [x] `.gitignore`가 시크릿·대용량 산출물을 제외(INV-1·INV-2).

## 검증
`npm run build && npm run typecheck && npm run lint && npm test`; 경계/Tier2 위반 샘플 4종으로 `npx eslint <samples>` 실패(exit 1) 확인 후 제거 → `npm run lint` 재그린.

## 증거 (통과 시 명령·핵심 출력 붙여넣기)
~~~
# DoD#1 게이트 (2026-06-18)
npm run build      → exit 0 (core-domain/ingest/pipeline/shared/web 5개 tsc 빌드)
npm run typecheck  → exit 0 (tsc --noEmit)
npm run lint       → exit 0 (eslint .)
npm test           → exit 0 (vitest --passWithNoTests ×5)

# DoD#2·#3 경계 차단 (의도적 위반 샘플 4종 → npx eslint → exit 1, 6 errors)
core-domain → @ramen/shared        : no-restricted-imports (INV-3) ✓ 차단
apps/web    → @ramen/ingest         : no-restricted-imports (INV-3) ✓ 차단
pipeline    → @ramen/web            : no-restricted-imports (INV-3) ✓ 차단
ingest      : PriceQuote 타입 참조    : no-restricted-syntax  (INV-4) ✓ 차단
pipeline    : PriceQuote import+참조  : no-restricted-syntax  (INV-4) ✓ 차단
→ 샘플 제거 후 npm run lint = exit 0 재확인.

# DoD#4 .gitignore (git check-ignore -v)
.env / .env.local                  → 무시(INV-1) ✓
snapshots/*, data/raw/*, *.sqlite  → 무시(INV-2) ✓
.env.example                       → 추적(정상) ✓
~~~

## 롤백 계획
스캐폴딩을 커밋 단위로 분리, 설정 오류 시 해당 커밋만 revert.

## 리스크 / 미지수
- 경계 룰이 느슨하면 위반 누적·발견 지연. Tier2 비영속 경계는 시작부터 강제할 것.

## 주의
설정이 "돈다"고 완료가 아니다. 경계 룰이 **실제로 위반을 막는지** 샘플로 확인할 것.
