// UGC 저장소(M7) — Tier3 영속 추상화. 실제 영속 구현(DB/파일)은 배포 단계에서 교체.
// 외부 fetch 없음(INV-8): 저장·조회만 한다.

import type { Recipe, ShopCuration } from "@ramen/core-domain";
import { isPublic } from "@ramen/core-domain";

export interface ListOptions {
  /** approved만(공개 렌더용). 기본 false(운영자용 전체). */
  publicOnly?: boolean;
}

export interface UgcRepository {
  saveRecipe(recipe: Recipe): void;
  recipesForProduct(productId: string, opts?: ListOptions): Recipe[];
  saveCuration(curation: ShopCuration): void;
  curationsForShop(shopId: string, opts?: ListOptions): ShopCuration[];
}

/** 인메모리 구현(MVP·테스트). 결정론: 조회는 id 정렬. */
export class InMemoryUgcRepository implements UgcRepository {
  private readonly recipes = new Map<string, Recipe>();
  private readonly curations = new Map<string, ShopCuration>();

  saveRecipe(recipe: Recipe): void {
    this.recipes.set(recipe.id, recipe);
  }

  recipesForProduct(productId: string, opts: ListOptions = {}): Recipe[] {
    return [...this.recipes.values()]
      .filter((r) => r.baseProductIds.includes(productId) && (!opts.publicOnly || isPublic(r)))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  saveCuration(curation: ShopCuration): void {
    this.curations.set(curation.id, curation);
  }

  curationsForShop(shopId: string, opts: ListOptions = {}): ShopCuration[] {
    return [...this.curations.values()]
      .filter((c) => c.shopId === shopId && (!opts.publicOnly || isPublic(c)))
      .sort((a, b) => a.id.localeCompare(b.id));
  }
}
