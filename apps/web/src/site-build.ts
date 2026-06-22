// 정적 사이트 생성 CLI — Tier1 스냅샷 JSON(아티팩트) → site/*.html.
// pipeline을 import하지 않고 산출물(JSON)만 읽는다(경계 INV-3 유지). 가격은 런타임 조회이므로
// 정적 상세에는 빈 가격 뷰(자리·안내)로 렌더, 실제 호출은 M5 PriceService(서버/엣지).
// 대량 데이터 대비: 카탈로그/음식점은 페이지네이션(무JS·크롤 가능) + 클라이언트 검색(search.js+index).

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { RamenProduct, RamenShop, Recipe } from "@ramen/core-domain";
import type { Page } from "./catalog/query.js";
import { buildSearchIndex, dedupeProducts, paginate, sortProducts, sortShops } from "./catalog/query.js";
import type { AffiliateView } from "./tier2/affiliate-view.js";
import { InMemoryUgcRepository } from "./ugc/repository.js";
import {
  productHref,
  renderCatalogPage,
  renderDetailPage,
  renderSearchPage,
  renderShopsPage,
} from "./view/render.js";

interface SnapshotFile {
  version: string;
  products: RamenProduct[];
  shops: RamenShop[];
}

const PER_PAGE = Number(process.env.SITE_PER_PAGE ?? 60);

const here = dirname(fileURLToPath(import.meta.url)); // apps/web/dist
const repoRoot = resolve(here, "..", "..", ".."); // dist → web → apps → root
const publicDir = resolve(here, "..", "public"); // apps/web/public
const snapDir = resolve(repoRoot, "snapshots");
const outDir = process.env.SITE_OUT_DIR ? resolve(process.env.SITE_OUT_DIR) : resolve(repoRoot, "site");

/** 빈 가격 뷰 — 정적 빌드(가격은 런타임 조회, 비영속 INV-4). */
const EMPTY_PRICE: AffiliateView = { __tier2RuntimeOnly: true, disclosure: null, quotes: [] };

function loadUgcRepo(): InMemoryUgcRepository {
  const repo = new InMemoryUgcRepository();
  const ugcPath = process.env.SITE_UGC ? resolve(process.env.SITE_UGC) : resolve(snapDir, "ugc.json");
  if (existsSync(ugcPath)) {
    const data = JSON.parse(readFileSync(ugcPath, "utf8")) as { recipes?: Recipe[] };
    for (const r of data.recipes ?? []) repo.saveRecipe(r);
  }
  return repo;
}

function resolveSnapshot(): string | undefined {
  if (process.env.SITE_SNAPSHOT) return resolve(process.env.SITE_SNAPSHOT);
  if (!existsSync(snapDir)) return undefined;
  const files = readdirSync(snapDir).filter(
    (f) => f.endsWith(".json") && !f.endsWith(".meta.json") && !f.endsWith(".diff.json"),
  );
  files.sort();
  const last = files.at(-1);
  return last ? resolve(snapDir, last) : undefined;
}

/** 페이지네이션으로 목록 페이지들을 생성. 1페이지=basePage. */
function writePaged<T>(
  items: T[],
  basePage: string,
  hrefFor: (p: number) => string,
  renderPage: (page: Page<T>, hrefFor: (p: number) => string) => string,
): number {
  const totalPages = Math.max(1, Math.ceil(items.length / PER_PAGE));
  for (let p = 1; p <= totalPages; p++) {
    const pg = paginate(items, p, PER_PAGE);
    const file = p === 1 ? basePage : hrefFor(p);
    writeFileSync(resolve(outDir, file), renderPage(pg, hrefFor), "utf8");
  }
  return totalPages;
}

function main(): void {
  const snapPath = resolveSnapshot();
  if (!snapPath || !existsSync(snapPath)) {
    process.stderr.write(
      "스냅샷 JSON 없음. 먼저 `npm run snapshot -w @ramen/pipeline` 실행(또는 SITE_SNAPSHOT 지정).\n",
    );
    process.exitCode = 1;
    return;
  }
  const snap = JSON.parse(readFileSync(snapPath, "utf8")) as SnapshotFile;
  const ugc = loadUgcRepo();
  mkdirSync(outDir, { recursive: true });

  // 표시 전용 중복 제거: 같은 (제품명+제조사명)의 여러 품목제조보고번호를 대표 1건으로.
  // 스냅샷 원본(전체 PK)은 불변. 카탈로그·상세·검색이 동일한 대표 집합을 쓴다.
  const canonical = dedupeProducts(snap.products);

  // 카탈로그(이름순) 페이지네이션: index.html, products-2.html, …
  const products = sortProducts(canonical, "name");
  const productHrefFor = (p: number): string => (p === 1 ? "index.html" : `products-${p}.html`);
  const productPages = writePaged(products, "index.html", productHrefFor, renderCatalogPage);

  // 음식점(이름순) 페이지네이션: shops.html, shops-2.html, …
  const shops = sortShops(snap.shops);
  const shopHrefFor = (p: number): string => (p === 1 ? "shops.html" : `shops-${p}.html`);
  const shopPages = writePaged(shops, "shops.html", shopHrefFor, renderShopsPage);

  // 제품 상세(+approved UGC) — 대표 제품만.
  let recipeCount = 0;
  for (const p of canonical) {
    const recipes = ugc.recipesForProduct(p.id, { publicOnly: true });
    recipeCount += recipes.length;
    writeFileSync(resolve(outDir, productHref(p.id)), renderDetailPage(p, EMPTY_PRICE, recipes), "utf8");
  }

  // 클라이언트 검색: search.html + search-index.json + search.js
  writeFileSync(resolve(outDir, "search.html"), renderSearchPage(), "utf8");
  writeFileSync(resolve(outDir, "search-index.json"), JSON.stringify(buildSearchIndex(canonical)), "utf8");
  const searchJs = resolve(publicDir, "search.js");
  if (existsSync(searchJs)) copyFileSync(searchJs, resolve(outDir, "search.js"));

  process.stdout.write(
    `site [${snap.version}]: 제품 ${canonical.length}/${snap.products.length}(중복제거 ${snap.products.length - canonical.length})(${productPages}p) · 음식점 ${snap.shops.length}(${shopPages}p) · 꿀조합 ${recipeCount} · 검색인덱스 → ${outDir}\n`,
  );
}

main();
