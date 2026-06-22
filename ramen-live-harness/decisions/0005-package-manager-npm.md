# ADR-0005: 패키지 매니저를 pnpm 대신 npm workspaces로 채택한다

- **상태**: 채택
- **일시**: 2026-06-18
- **관련**: phase M0, INV-1·INV-2·INV-3, `docs/ENVIRONMENT`, `docs/FILE_TREE`

## 맥락
M0 스캐폴딩 중 빌드 환경에서 `pnpm install`이 일관되게 크래시했다.

- 환경: Windows 11, Node **v25.2.0**(비-LTS 최신), pnpm 11.5.3, npm 11.6.2.
- 증상: `pnpm install`이 패키지 적재 단계(`added ~100/151`)에서 종료코드 `0xC0000409`(STATUS_STACK_BUFFER_OVERRUN, 네이티브 크래시)로 죽는다. 락파일·심링크·바이너리 미생성.
- 재현: 3가지 구성(기본 / `package-import-method=copy` / `node-linker=hoisted`)에서 동일하게 크래시. git-bash·PowerShell 모두 동일.
- 격리: 동일 Node 25에서 `npm install`은 정상(exit 0, 바이너리·심링크 생성). `node`·`pnpm store path` 등 단순 명령도 정상 → **pnpm 11.5.3의 워커/네이티브 파일 적재 단계가 Node 25와 비호환**으로 판단.
- 제약: nvm/fnm 미설치 → Node 버전 즉시 전환 불가. corepack 미설치.

백서·하네스 문서는 전부 pnpm 명령으로 작성되어 있었다(`pnpm -r`, `pnpm --filter`).

## 결정
패키지 매니저를 **npm workspaces**로 채택한다(사용자 승인 2026-06-18).

- 루트 `package.json`에 `workspaces: ["packages/*", "apps/*"]` 추가.
- 워크스페이스 의존성 specifier를 `workspace:*` → `*`로 변경.
- `pnpm-workspace.yaml`·pnpm용 `.npmrc` 제거, `packageManager` 필드 제거.
- 문서(`docs/ENVIRONMENT`, phase M0–M3)의 검증 명령을 npm으로 갱신.

명령 매핑:

| 용도 | 기존(pnpm) | 신규(npm) |
|---|---|---|
| 설치 | `pnpm install` | `npm install` (CI: `npm ci`) |
| 전체 빌드 | `pnpm -r build` | `npm run build` (= `--workspaces --if-present`) |
| 단일 패키지 테스트 | `pnpm --filter ingest test` | `npm test -w @ramen/ingest` |
| 스냅샷 | `pnpm --filter pipeline snapshot` | `npm run snapshot -w @ramen/pipeline` |
| 타입체크/린트 | `tsc --noEmit` / `eslint .` | 동일 |

## 근거
환경 블로커(pnpm 크래시)를 우회하는 최소 변경 경로다. npm은 같은 Node에서 검증되었고 전역 설치·Node 버전 변경이 불필요하다. 모듈 경계(INV-3)는 패키지 매니저가 아니라 ESLint 룰(`docs/FILE_TREE` §3)로 강제하므로 **전환해도 불변식 보장에 영향이 없다**. 워크스페이스 심링크 구조(타입은 `src/index.ts`, 런타임은 `dist`)도 npm에서 동일하게 동작한다.

## 결과 / 트레이드오프
- 이득: 즉시 빌드 가능. 전역 환경 무변경. INV·경계·디렉터리 구조 그대로 유지.
- 비용: pnpm의 엄격한 phantom-dependency 차단(격리 node_modules)을 잃는다. 모노레포 규모가 작아 영향은 제한적. 추후 Node LTS 환경에서 pnpm 복귀를 원하면 specifier·명령만 되돌리면 된다(역마이그레이션 용이).

## 검토한 대안
- **pnpm 최신(11.7.0) 업그레이드** — Node 25 크래시 해결 불확실 + 전역 환경 변경. 보류.
- **Node LTS(20/22) 설치 후 pnpm 유지** — 백서 'Node LTS' 전제와 가장 부합하나 사용자 소프트웨어 설치 필요·소요 큼. 보류(추후 환경 정비 시 재검토 가능).
