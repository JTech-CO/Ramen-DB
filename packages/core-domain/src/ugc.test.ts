import { describe, expect, it } from "vitest";
import {
  isPublic,
  validateCurationInput,
  validateRecipeInput,
  type CurationInput,
  type RecipeInput,
} from "./ugc.js";

const KNOWN_PRODUCTS = new Set(["20210001", "20210002"]);
const KNOWN_SHOPS = new Set(["MGT-0001"]);

function recipe(over: Partial<RecipeInput> = {}): RecipeInput {
  return {
    title: "신라면 짜파게티 조합",
    baseProductIds: ["20210001"],
    ingredients: ["신라면 1봉", "짜파게티 1봉", "물 600ml"],
    steps: ["면을 삶는다", "스프를 넣는다"],
    author: "user-42",
    ...over,
  };
}

describe("validateRecipeInput", () => {
  it("정상 입력 → valid", () => {
    expect(validateRecipeInput(recipe(), KNOWN_PRODUCTS).valid).toBe(true);
  });
  it("작성자 없음 → 거부 (INV-8 자체 제출)", () => {
    const r = validateRecipeInput(recipe({ author: "  " }), KNOWN_PRODUCTS);
    expect(r.valid).toBe(false);
    expect(r.errors.join()).toContain("INV-8");
  });
  it("알 수 없는 제품 참조 → 거부 (INV-5)", () => {
    const r = validateRecipeInput(recipe({ baseProductIds: ["99999999"] }), KNOWN_PRODUCTS);
    expect(r.valid).toBe(false);
    expect(r.errors.join()).toContain("INV-5");
  });
  it("재료·단계·제품 누락 → 각각 거부", () => {
    expect(validateRecipeInput(recipe({ ingredients: [] }), KNOWN_PRODUCTS).valid).toBe(false);
    expect(validateRecipeInput(recipe({ steps: [""] }), KNOWN_PRODUCTS).valid).toBe(false);
    expect(validateRecipeInput(recipe({ baseProductIds: [] }), KNOWN_PRODUCTS).valid).toBe(false);
  });
});

describe("validateCurationInput", () => {
  function cur(over: Partial<CurationInput> = {}): CurationInput {
    return { shopId: "MGT-0001", rating: 4, comment: "국물이 진함", author: "user-7", ...over };
  }
  it("정상 → valid", () => {
    expect(validateCurationInput(cur(), KNOWN_SHOPS).valid).toBe(true);
  });
  it("평점 범위 밖 → 거부", () => {
    expect(validateCurationInput(cur({ rating: 0 }), KNOWN_SHOPS).valid).toBe(false);
    expect(validateCurationInput(cur({ rating: 6 }), KNOWN_SHOPS).valid).toBe(false);
    expect(validateCurationInput(cur({ rating: 3.5 }), KNOWN_SHOPS).valid).toBe(false);
  });
  it("알 수 없는 음식점 → 거부", () => {
    expect(validateCurationInput(cur({ shopId: "X" }), KNOWN_SHOPS).valid).toBe(false);
  });
  it("작성자 없음 → 거부 (INV-8)", () => {
    expect(validateCurationInput(cur({ author: "" }), KNOWN_SHOPS).valid).toBe(false);
  });
});

describe("isPublic", () => {
  it("APPROVED만 공개", () => {
    expect(isPublic({ moderation: "APPROVED" })).toBe(true);
    expect(isPublic({ moderation: "PENDING" })).toBe(false);
    expect(isPublic({ moderation: "REJECTED" })).toBe(false);
  });
});
