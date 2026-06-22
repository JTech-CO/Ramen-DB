// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

/**
 * 모듈 경계(INV-3)·Tier2 비영속(INV-4) 강제.
 * 경계 표 근거: docs/FILE_TREE §3.
 *
 * - core-domain: 순수. 다른 모든 @ramen/* 패키지 import 금지.
 * - shared:      순수 유틸. 도메인·데이터 패키지 import 금지.
 * - ingest:      core-domain·shared 허용. pipeline·web 금지.
 * - pipeline:    core-domain·ingest·shared 허용. web 금지.
 * - web:         core-domain·shared 허용. ingest·pipeline 금지.
 *
 * 추가(INV-4): PriceQuote(Tier2 가격/제휴 타입)는 apps/web에서만 정의·사용.
 * 영속 경로(core-domain/ingest/pipeline/shared)에서 import·참조 금지.
 */

/** @param {string[]} pkgs @param {string} message */
function denyPackages(pkgs, message) {
  return {
    patterns: [
      {
        group: pkgs.flatMap((p) => [p, `${p}/*`]),
        message,
      },
    ],
  };
}

/**
 * 동적 import() 경계 차단 — no-restricted-imports는 정적 import만 검사하므로,
 * `import('@ramen/web')` 같은 동적 우회를 no-restricted-syntax(ImportExpression)로 막는다.
 * @param {string[]} pkgs @param {string} message
 */
function denyDynamic(pkgs, message) {
  return pkgs.map((p) => ({
    selector: `ImportExpression > Literal[value='${p}']`,
    message,
  }));
}

const PRICE_QUOTE_BAN = [
  {
    selector: "ImportSpecifier[imported.name='PriceQuote']",
    message:
      "INV-4: PriceQuote(Tier2 가격/제휴 타입)는 apps/web에서만 정의·사용한다. 영속 경로에서 import 금지.",
  },
  {
    selector: "ImportDefaultSpecifier[local.name='PriceQuote']",
    message: "INV-4: PriceQuote는 apps/web에서만 사용한다.",
  },
  {
    selector: "TSTypeReference > Identifier[name='PriceQuote']",
    message: "INV-4: PriceQuote 타입 참조는 apps/web에서만 허용된다.",
  },
];

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/site/**", // 정적 사이트 생성 산출물(gitignore) — 원본 public/search.js만 린트
      "**/node_modules/**",
      "**/coverage/**",
      "ramen-live-harness/**",
      "**/*.config.js",
      "**/*.config.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      // tsconfig noUnusedParameters와 정합: _ 접두사 인자/변수는 의도적 미사용으로 허용.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
  // ── core-domain: 순수, 모든 다른 패키지 import 금지 ──
  {
    files: ["packages/core-domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        denyPackages(
          ["@ramen/shared", "@ramen/ingest", "@ramen/pipeline", "@ramen/web"],
          "INV-3: core-domain은 순수 도메인이다. 다른 @ramen/* 패키지를 import할 수 없다(docs/FILE_TREE §3).",
        ),
      ],
      "no-restricted-syntax": [
        "error",
        ...PRICE_QUOTE_BAN,
        ...denyDynamic(
          ["@ramen/shared", "@ramen/ingest", "@ramen/pipeline", "@ramen/web"],
          "INV-3: core-domain은 동적 import로도 다른 @ramen/* 패키지를 끌어올 수 없다.",
        ),
      ],
    },
  },
  // ── shared: 순수 유틸, 도메인·데이터 패키지 금지 ──
  {
    files: ["packages/shared/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        denyPackages(
          ["@ramen/core-domain", "@ramen/ingest", "@ramen/pipeline", "@ramen/web"],
          "INV-3: shared는 도메인·데이터를 모르는 순수 유틸이다. @ramen/* import 금지.",
        ),
      ],
      "no-restricted-syntax": [
        "error",
        ...PRICE_QUOTE_BAN,
        ...denyDynamic(
          ["@ramen/core-domain", "@ramen/ingest", "@ramen/pipeline", "@ramen/web"],
          "INV-3: shared는 동적 import로도 @ramen/* 패키지를 끌어올 수 없다.",
        ),
      ],
    },
  },
  // ── ingest: core-domain·shared 허용, pipeline·web 금지 ──
  {
    files: ["packages/ingest/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        denyPackages(
          ["@ramen/pipeline", "@ramen/web"],
          "INV-3: ingest는 pipeline·web을 import할 수 없다(core-domain·shared만 허용).",
        ),
      ],
      "no-restricted-syntax": [
        "error",
        ...PRICE_QUOTE_BAN,
        ...denyDynamic(
          ["@ramen/pipeline", "@ramen/web"],
          "INV-3: ingest는 동적 import로도 pipeline·web을 끌어올 수 없다.",
        ),
      ],
    },
  },
  // ── pipeline: core-domain·ingest·shared 허용, web 금지 ──
  {
    files: ["packages/pipeline/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        denyPackages(
          ["@ramen/web"],
          "INV-3: pipeline은 web을 import할 수 없다(core-domain·ingest·shared만 허용).",
        ),
      ],
      "no-restricted-syntax": [
        "error",
        ...PRICE_QUOTE_BAN,
        ...denyDynamic(
          ["@ramen/web"],
          "INV-3: pipeline은 동적 import로도 web을 끌어올 수 없다.",
        ),
      ],
    },
  },
  // ── web: core-domain·shared 허용, ingest·pipeline 금지. PriceQuote 허용 ──
  {
    files: ["apps/web/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        denyPackages(
          ["@ramen/ingest", "@ramen/pipeline"],
          "INV-3: web은 ingest·pipeline을 import할 수 없다(core-domain 타입·shared만 허용).",
        ),
      ],
      "no-restricted-syntax": [
        "error",
        ...denyDynamic(
          ["@ramen/ingest", "@ramen/pipeline"],
          "INV-3: web은 동적 import로도 ingest·pipeline을 끌어올 수 없다.",
        ),
      ],
    },
  },
  // ── 브라우저 정적 자산(public/*.js): 브라우저 전역 ──
  {
    files: ["apps/web/public/**/*.js"],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  // ── 테스트 파일: 일부 규칙 완화 ──
  {
    files: ["**/*.test.ts", "**/*.spec.ts", "**/__fixtures__/**/*.ts"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
);
