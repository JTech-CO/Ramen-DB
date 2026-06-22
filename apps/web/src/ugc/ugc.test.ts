import { describe, expect, it } from "vitest";
import type { RecipeInput } from "@ramen/core-domain";
import { isPublic } from "@ramen/core-domain";
import { submitCuration, submitRecipe } from "./submission.js";
import { moderate } from "./moderation.js";
import { InMemoryUgcRepository } from "./repository.js";

const KNOWN_PRODUCTS = new Set(["20210001"]);
const KNOWN_SHOPS = new Set(["MGT-0001"]);

function recipeInput(over: Partial<RecipeInput> = {}): RecipeInput {
  return {
    title: "신라면 꿀조합",
    baseProductIds: ["20210001"],
    ingredients: ["신라면 1봉", "계란 1개"],
    steps: ["끓인다", "계란을 푼다"],
    author: "user-1",
    ...over,
  };
}

const ctx = { id: "r1", submittedAt: "2026-06-19T00:00:00.000Z", knownProductIds: KNOWN_PRODUCTS };

describe("submitRecipe — 자체 제출만(INV-8)", () => {
  it("정상 제출 → PENDING 엔티티(검수 대기)", () => {
    const res = submitRecipe(recipeInput(), ctx);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.entity.id).toBe("r1");
      expect(res.entity.moderation).toBe("PENDING");
      expect(res.entity.submittedAt).toBe("2026-06-19T00:00:00.000Z");
      expect(isPublic(res.entity)).toBe(false); // 검수 전 비공개
    }
  });
  it("작성자 없는 제출 거부(INV-8)", () => {
    const res = submitRecipe(recipeInput({ author: "" }), ctx);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.join()).toContain("INV-8");
  });
  it("알 수 없는 제품 참조 거부", () => {
    const res = submitRecipe(recipeInput({ baseProductIds: ["00000000"] }), ctx);
    expect(res.ok).toBe(false);
  });
});

describe("submitCuration", () => {
  it("정상 → PENDING", () => {
    const res = submitCuration(
      { shopId: "MGT-0001", rating: 5, comment: "맛집", author: "u" },
      { id: "c1", submittedAt: "2026-06-19T00:00:00.000Z", knownShopIds: KNOWN_SHOPS },
    );
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.entity.moderation).toBe("PENDING");
  });
});

describe("moderate — 검수", () => {
  it("PENDING → APPROVED → 공개", () => {
    const res = submitRecipe(recipeInput(), ctx);
    if (!res.ok) throw new Error("unexpected");
    const approved = moderate(res.entity, "APPROVED");
    expect(approved.moderation).toBe("APPROVED");
    expect(isPublic(approved)).toBe(true);
    expect(isPublic(moderate(res.entity, "REJECTED"))).toBe(false);
  });
});

describe("InMemoryUgcRepository — publicOnly 필터", () => {
  it("approved만 공개 조회, 전체는 운영자 조회", () => {
    const repo = new InMemoryUgcRepository();
    const pending = submitRecipe(recipeInput(), ctx);
    const approvedRes = submitRecipe(recipeInput(), { ...ctx, id: "r2" });
    if (!pending.ok || !approvedRes.ok) throw new Error("unexpected");
    repo.saveRecipe(pending.entity); // PENDING
    repo.saveRecipe(moderate(approvedRes.entity, "APPROVED")); // APPROVED

    expect(repo.recipesForProduct("20210001").length).toBe(2); // 전체(운영자)
    const pub = repo.recipesForProduct("20210001", { publicOnly: true });
    expect(pub.length).toBe(1); // 공개는 approved만
    expect(pub[0]!.id).toBe("r2");
    expect(repo.recipesForProduct("99999999", { publicOnly: true })).toEqual([]); // 타 제품
  });
});
