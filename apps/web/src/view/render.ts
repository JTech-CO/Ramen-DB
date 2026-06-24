// 렌더 함수(순수, HTML 문자열) — 스냅샷 → HTML. 결정론·테스트 가능.
// INV-6(추정 표기)·INV-9(출처·조회시각)·INV-10(대가성 문구)을 렌더 계약으로 강제.

import type {
  Nutrition,
  ProductStatus,
  RamenProduct,
  RamenShop,
  Recipe,
  ShopCuration,
} from "@ramen/core-domain";
import { statusDisplayLabel } from "@ramen/core-domain";
import { attributionLabel } from "@ramen/shared";
import type { AffiliateView } from "../tier2/affiliate-view.js";
import { hasAffiliate } from "../tier2/affiliate-view.js";
import type { Page } from "../catalog/query.js";
import { PACKAGE_LABEL, SHOP_REGION_ORDER, STATUS_LABEL } from "../catalog/query.js";

/** 헤더/히어로 통계 — 스냅샷 규모. */
export interface SiteCounts {
  products: number;
  shops: number;
}
import { escapeAttr, escapeHtml } from "./escape.js";
import { STYLES } from "./styles.js";

/** http/https만 허용(javascript: 등 스킴 차단). 그 외는 무력화('#'). */
function safeUrl(url: string): string {
  const u = url.trim();
  return /^https?:\/\//i.test(u) ? u : "#";
}

function statusClass(status: ProductStatus): string {
  if (status === "ON_SALE") return "on";
  if (status === "DISCONTINUED?") return "disc";
  return "halt";
}

/** status 배지 — confidence<high는 statusDisplayLabel이 '추정'을 붙임(INV-6). */
export function renderStatus(p: Pick<RamenProduct, "status" | "statusConfidence">): string {
  const label = statusDisplayLabel(p.status, p.statusConfidence);
  return `<span class="status ${statusClass(p.status)}"><span class="dot" aria-hidden="true"></span>${escapeHtml(label)}</span>`;
}

function sourcesLine(refs: string[]): string {
  if (refs.length === 0) return "";
  const labels = refs.map((r) => escapeHtml(attributionLabel(r))).join(" · ");
  return `<p class="sources">출처: ${labels}</p>`;
}

export function productHref(id: string): string {
  return `product-${encodeURIComponent(id)}.html`;
}

function makerLine(p: Pick<RamenProduct, "manufacturerName">): string {
  return p.manufacturerName ? `<p class="meta maker">${escapeHtml(p.manufacturerName)}</p>` : "";
}

export function renderProductCard(p: RamenProduct): string {
  const kcal = p.nutrition ? `${p.nutrition.energyKcal} kcal` : "영양 정보 없음";
  return `<article class="card">
  <h3><a href="${escapeAttr(productHref(p.id))}">${escapeHtml(p.name)}</a></h3>
  ${makerLine(p)}<p class="meta">${renderStatus(p)}</p>
  <p class="meta kcal">${escapeHtml(kcal)}</p>
  ${sourcesLine(p.sourceRefs)}
</article>`;
}

export function renderProductList(products: RamenProduct[]): string {
  if (products.length === 0) return `<p class="meta">등록된 제품이 없습니다.</p>`;
  return `<div class="grid">${products.map(renderProductCard).join("\n")}</div>`;
}

const NUTRI_ROWS: Array<[keyof Nutrition, string, string]> = [
  ["energyKcal", "에너지", "kcal"],
  ["carbG", "탄수화물", "g"],
  ["proteinG", "단백질", "g"],
  ["fatG", "지방", "g"],
  ["sugarG", "당류", "g"],
  ["satFatG", "포화지방", "g"],
  ["transFatG", "트랜스지방", "g"],
  ["sodiumMg", "나트륨", "mg"],
  ["cholesterolMg", "콜레스테롤", "mg"],
];

export function renderNutrition(n: Nutrition | null): string {
  if (!n) return `<p class="meta">영양 정보 없음(영양 DB 미커버).</p>`;
  const rows = NUTRI_ROWS.filter(([k]) => n[k] !== undefined)
    .map(
      ([k, label, unit]) =>
        `<tr><th>${escapeHtml(label)}</th><td class="num">${escapeHtml(String(n[k]))} ${unit}</td></tr>`,
    )
    .join("");
  return `<table class="nutri"><caption class="meta">함량 기준: ${escapeHtml(n.servingBasis)}</caption><tbody>${rows}</tbody></table>`;
}

/**
 * 가격·구매 섹션(Tier2). 제휴 링크가 있으면 view.disclosure(확정형 대가성 문구, INV-10)를
 * 최상단에 렌더한다. 각 견적에 출처·조회시각(INV-9). 견적이 없으면 실시간 조회 안내.
 */
export function renderPriceSection(view: AffiliateView): string {
  // INV-10 렌더 가드: 제휴 링크가 있는데 대가성 문구가 없으면 렌더 거부.
  if (hasAffiliate(view.quotes) && !view.disclosure) {
    throw new Error("INV-10 위반: 제휴 링크 렌더에 확정형 대가성 문구가 누락되었습니다.");
  }
  const disclosure = view.disclosure
    ? `<p class="disclosure">${escapeHtml(view.disclosure)}</p>`
    : "";
  if (view.quotes.length === 0) {
    return `<section class="price" aria-label="가격·구매">${disclosure}<h2 class="section">가격·구매</h2><p class="meta">가격·구매 링크는 상품 진입 시 실시간 조회됩니다(비영속).</p></section>`;
  }
  const rows = view.quotes
    .map((q) => {
      const price = q.price !== undefined ? `${q.price.toLocaleString("ko-KR")}원` : "구매 링크";
      const aff = q.affiliate ? " (제휴)" : "";
      // 제휴(우리가 수수료 받는) 링크에만 sponsored. 제3자 비교 링크엔 붙이지 않는다(오표기 방지).
      const rel = q.affiliate ? "nofollow sponsored noopener" : "nofollow noopener";
      return `<div class="quote"><a href="${escapeAttr(safeUrl(q.url))}" rel="${rel}" target="_blank">${escapeHtml(q.seller)}${aff}</a><span>${escapeHtml(price)} <span class="src">· ${escapeHtml(q.source)} ${escapeHtml(q.fetchedAt)}</span></span></div>`;
    })
    .join("");
  return `<section class="price" aria-label="가격·구매">${disclosure}<h2 class="section">가격·구매</h2>${rows}</section>`;
}

/** UGC 레시피 렌더 — approved만 호출부에서 넘긴다(공개 가드). 작성자 표기·이스케이프(INV-8/9). */
export function renderRecipe(r: Recipe): string {
  const ings = r.ingredients.map((i) => `<li>${escapeHtml(i)}</li>`).join("");
  const steps = r.steps.map((s) => `<li>${escapeHtml(s)}</li>`).join("");
  return `<article class="recipe">
  <h3>${escapeHtml(r.title)}</h3>
  <p class="meta">작성자: ${escapeHtml(r.author)} · ${escapeHtml(r.submittedAt)}</p>
  <h4>재료</h4><ul>${ings}</ul>
  <h4>만들기</h4><ol>${steps}</ol>
</article>`;
}

export function renderRecipes(recipes: Recipe[]): string {
  if (recipes.length === 0) return `<p class="meta">등록된 꿀조합이 없습니다.</p>`;
  return recipes.map(renderRecipe).join("\n");
}

/** UGC 큐레이션 렌더 — approved만. 평점은 텍스트(접근성: 색·기호 외 수치 동반). */
export function renderCuration(c: ShopCuration): string {
  return `<div class="curation">
  <p class="meta"><span class="rating" aria-label="5점 만점에 ${c.rating}점">${escapeHtml(String(c.rating))}/5</span> · ${escapeHtml(c.author)} · ${escapeHtml(c.submittedAt)}</p>
  <p>${escapeHtml(c.comment)}</p>
</div>`;
}

export function renderProductDetail(
  p: RamenProduct,
  priceView: AffiliateView,
  recipes: Recipe[] = [],
): string {
  const recipeSection =
    recipes.length > 0
      ? `<div><h2 class="section">유저 꿀조합</h2>${renderRecipes(recipes)}</div>`
      : "";
  const image = p.imageUrl
    ? `<img class="product-img" src="${escapeAttr(safeUrl(p.imageUrl))}" alt="${escapeHtml(p.name)} 제품 사진" loading="lazy">`
    : "";
  return `<div class="detail">
  <div>
    <h1>${escapeHtml(p.name)}</h1>
    ${makerLine(p)}<p class="meta">${renderStatus(p)} · ${escapeHtml(p.packageType === "CUP" ? "컵" : p.packageType === "BAG" ? "봉지" : "기타")}</p>
    ${image}
    ${sourcesLine(p.sourceRefs)}
  </div>
  <div>
    <h2 class="section">영양 정보</h2>
    ${renderNutrition(p.nutrition)}
  </div>
  ${renderPriceSection(priceView)}
  ${recipeSection}
</div>`;
}

export function renderShop(s: RamenShop): string {
  const status = s.businessStatus === "ACTIVE" ? "영업" : "영업 종료";
  const badges = [
    s.isModelRestaurant ? `<span class="badge">모범음식점</span>` : "",
    s.category ? `<span class="badge">${escapeHtml(s.category)}</span>` : "",
  ]
    .filter((b) => b.length > 0)
    .join(" ");
  // 좌표는 raw 숫자 대신 지도 딥링크로(접근성: 의미 있는 링크 텍스트).
  let mapLink = "";
  if (s.lat !== undefined && s.lng !== undefined) {
    const href = `https://www.openstreetmap.org/?mlat=${s.lat}&mlon=${s.lng}#map=18/${s.lat}/${s.lng}`;
    mapLink = ` · <a href="${escapeAttr(href)}" rel="noopener" target="_blank" aria-label="${escapeHtml(s.name)} 지도에서 보기">지도</a>`;
  }
  return `<article class="shop">
  <div class="name">${escapeHtml(s.name)}${badges ? ` ${badges}` : ""}</div>
  <div class="addr">${escapeHtml(s.address)}</div>
  <div class="meta">${escapeHtml(status)}${mapLink}</div>
</article>`;
}

export function renderShopList(shops: RamenShop[]): string {
  if (shops.length === 0) return `<p class="meta">등록된 음식점이 없습니다.</p>`;
  return `<div class="shoplist">${shops.map(renderShop).join("\n")}</div>`;
}

export function pageShell(title: string, body: string): string {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="식약처·행정안전부 공공데이터로 만든 전국 라면 제품·라멘 음식점 데이터베이스. 판매상태·영양·지도·검색.">
<style>${STYLES}</style>
</head>
<body>
<header class="site"><div class="wrap">
  <a class="brand" href="index.html">Ramen-DB</a>
  <nav><a href="index.html">제품</a> <a href="shops.html">음식점</a></nav>
  <span class="muted">전국 라면·라멘 데이터베이스</span>
</div></header>
<main><div class="wrap">${body}</div></main>
<footer class="site"><div class="wrap">출처: 식품의약품안전처·행정안전부 공공데이터. 가격·제휴는 실시간 조회(비영속). · <a href="products-1.html">제품 전체목록</a> · <a href="shops-1.html">음식점 전체목록</a></div></footer>
</body>
</html>`;
}

/** 사이트 소개(히어로) — 무엇을 하는 곳인지 한눈에. 별도 메인페이지 없이 목록 상단에 둔다. */
export function renderHero(kind: "product" | "shop", counts: SiteCounts): string {
  const fmt = (n: number): string => n.toLocaleString("ko-KR");
  const intro =
    kind === "product"
      ? "봉지·컵 라면을 제품명·제조사로 검색하고 판매상태·영양 정보를 확인하세요."
      : "전국 라멘·라면 음식점을 지역별로 찾고, 즐겨찾기에 담아 지도로 바로 여세요.";
  return `<section class="hero">
  <h1>Ramen-DB — 전국 라면·라멘 데이터베이스</h1>
  <div class="stats">
    <span class="stat"><b>${fmt(counts.products)}</b><span>라면 제품</span></span>
    <span class="stat"><b>${fmt(counts.shops)}</b><span>라멘 음식점</span></span>
  </div>
  <p>${escapeHtml(intro)}</p>
  <p class="sub">식품의약품안전처·행정안전부 공공데이터 기반 · 정보 제공용</p>
</section>`;
}

/** 페이지 점프 입력(가운데 페이지 직접 이동). 정적 페이지에서만 렌더(jump 패턴 제공 시). */
function renderPageJump(
  page: number,
  totalPages: number,
  jump?: { prefix: string; suffix: string },
): string {
  if (!jump) return "";
  const go =
    `var n=Math.min(Math.max(1,parseInt(this.pg.value,10)||1),${totalPages});` +
    `location.href=${JSON.stringify(jump.prefix)}+n+${JSON.stringify(jump.suffix)};return false;`;
  return `<form class="pg-jump" onsubmit="${escapeAttr(go)}"><input name="pg" type="number" min="1" max="${totalPages}" value="${page}" aria-label="페이지 번호로 이동"><span class="of">/ ${totalPages}</span><button type="submit">이동</button></form>`;
}

/**
 * 페이지네이션 — 1, 2, [숫자입력], 끝번호 + 이전/다음. 가운데 페이지(예: 35)도 입력으로 바로 이동.
 * jump 미지정(앱 동적 페이저 등) 시 입력 박스 생략. totalPages<=1이면 빈 문자열.
 */
export function renderPagination(
  page: number,
  totalPages: number,
  hrefFor: (p: number) => string,
  jump?: { prefix: string; suffix: string },
): string {
  if (totalPages <= 1) return "";
  const link = (p: number, label: string, current = false): string =>
    current
      ? `<span class="page current" aria-current="page">${escapeHtml(label)}</span>`
      : `<a class="page" href="${escapeAttr(hrefFor(p))}">${escapeHtml(label)}</a>`;
  const parts: string[] = [];
  if (page > 1) parts.push(link(page - 1, "이전"));
  parts.push(link(1, "1", page === 1));
  if (totalPages >= 2) parts.push(link(2, "2", page === 2));
  parts.push(renderPageJump(page, totalPages, jump));
  if (totalPages > 2) parts.push(link(totalPages, String(totalPages), page === totalPages));
  if (page < totalPages) parts.push(link(page + 1, "다음"));
  return `<nav class="pagination" aria-label="페이지 이동">${parts.join("")}</nav>`;
}

/** 정적 제품 목록 페이지(무JS·크롤용). 히어로 + 그리드 + 점프 페이지네이션. */
export function renderCatalogPage(
  page: Page<RamenProduct>,
  hrefFor: (p: number) => string,
  counts: SiteCounts,
): string {
  const body = `${renderHero("product", counts)}
<h2 class="section">제품 전체 목록 · ${page.total.toLocaleString("ko-KR")}개 (${page.page}/${page.totalPages})</h2>
${renderProductList(page.items)}
${renderPagination(page.page, page.totalPages, hrefFor, { prefix: "products-", suffix: ".html" })}`;
  return pageShell("라면 제품 목록 — Ramen-DB", body);
}

/** 정적 음식점 목록 페이지(무JS·크롤용). */
export function renderShopsPage(
  page: Page<RamenShop>,
  hrefFor: (p: number) => string,
  counts: SiteCounts,
): string {
  const body = `${renderHero("shop", counts)}
<h2 class="section">음식점 전체 목록 · ${page.total.toLocaleString("ko-KR")}곳 (${page.page}/${page.totalPages})</h2>
${renderShopList(page.items)}
${renderPagination(page.page, page.totalPages, hrefFor, { prefix: "shops-", suffix: ".html" })}`;
  return pageShell("라멘 음식점 목록 — Ramen-DB", body);
}

/** 제품 검색·필터 앱(index.html). app.js가 search-index.json을 소비. noscript는 정적 목록으로. */
export function renderProductAppPage(counts: SiteCounts): string {
  const statusOpts = Object.entries(STATUS_LABEL)
    .map(([v, l]) => `<option value="${escapeAttr(v)}">${escapeHtml(l)}</option>`)
    .join("");
  const pkgOpts = Object.entries(PACKAGE_LABEL)
    .map(([v, l]) => `<option value="${escapeAttr(v)}">${escapeHtml(l)}</option>`)
    .join("");
  const body = `${renderHero("product", counts)}
<form class="toolbar" role="search" onsubmit="return false">
  <input id="q" type="search" placeholder="제품명·제조사 검색" aria-label="제품명·제조사 검색" autocomplete="off">
  <select id="st" aria-label="판매상태"><option value="">상태 전체</option>${statusOpts}</select>
  <select id="pk" aria-label="포장"><option value="">포장 전체</option>${pkgOpts}</select>
  <select id="sort" aria-label="정렬"><option value="name">이름순</option><option value="kcal">칼로리 낮은순</option></select>
</form>
<p class="count"><span id="count">불러오는 중…</span></p>
<div id="results" class="grid" aria-live="polite"></div>
<nav id="pager" class="pagination" aria-label="페이지 이동"></nav>
<noscript><p class="count">검색은 JavaScript가 필요합니다. <a href="products-1.html">제품 전체 목록 보기</a></p></noscript>
<script>window.__APP__={type:"product",data:"search-index.json",per:60};</script>
<script src="app.js" defer></script>`;
  return pageShell("라면 제품 — Ramen-DB", body);
}

/** 음식점 검색·지역·즐겨찾기 앱(shops.html). app.js가 shops-index.json을 소비. */
export function renderShopAppPage(counts: SiteCounts): string {
  const regionOpts = SHOP_REGION_ORDER.map(
    (r) => `<option value="${escapeAttr(r)}">${escapeHtml(r)}</option>`,
  ).join("");
  const body = `${renderHero("shop", counts)}
<form class="toolbar" role="search" onsubmit="return false">
  <input id="q" type="search" placeholder="음식점명·주소 검색" aria-label="음식점명·주소 검색" autocomplete="off">
  <select id="rg" aria-label="지역"><option value="">지역 전체</option>${regionOpts}</select>
  <select id="sort" aria-label="정렬"><option value="region">지역순</option><option value="name">이름순</option></select>
  <label class="chk"><input type="checkbox" id="favonly"> ★ 즐겨찾기만</label>
</form>
<p class="count"><span id="count">불러오는 중…</span></p>
<div id="results" class="shoplist" aria-live="polite"></div>
<nav id="pager" class="pagination" aria-label="페이지 이동"></nav>
<noscript><p class="count">검색은 JavaScript가 필요합니다. <a href="shops-1.html">음식점 전체 목록 보기</a></p></noscript>
<script>window.__APP__={type:"shop",data:"shops-index.json",per:60};</script>
<script src="app.js" defer></script>`;
  return pageShell("라멘 음식점 — Ramen-DB", body);
}

export function renderDetailPage(
  p: RamenProduct,
  priceView: AffiliateView,
  recipes: Recipe[] = [],
): string {
  return pageShell(`${p.name} — Ramen-DB`, renderProductDetail(p, priceView, recipes));
}
