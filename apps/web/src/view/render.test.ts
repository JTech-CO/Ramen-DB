import { describe, expect, it } from "vitest";
import type { RamenProduct, RamenShop } from "@ramen/core-domain";
import type { AffiliateView } from "../tier2/affiliate-view.js";
import { COUPANG_PARTNERS_DISCLOSURE } from "../tier2/disclosure.js";
import {
  pageShell,
  renderCuration,
  renderNutrition,
  renderPagination,
  renderPriceSection,
  renderProductCard,
  renderProductDetail,
  renderRecipe,
  renderSearchPage,
  renderShop,
  renderStatus,
} from "./render.js";
import { STYLES } from "./styles.js";

function product(over: Partial<RamenProduct> = {}): RamenProduct {
  return {
    id: "20210001",
    name: "신라면",
    packageType: "BAG",
    manufacturerId: "MFR-NS",
    manufacturerName: "(주)농심",
    nutrition: { servingBasis: "1회제공량(120g)", energyKcal: 505, carbG: 79, proteinG: 11, fatG: 16, sodiumMg: 1790 },
    sourceRefs: ["PRODUCT_REPORT", "NUTRITION"],
    updatedAt: "2026-06-18",
    status: "ON_SALE",
    statusSource: "PRODUCT_REPORT",
    statusConfidence: "high",
    ...over,
  };
}

describe("renderStatus — INV-6 추정 표기", () => {
  it("ON_SALE high → 판매중(단정), '추정' 없음", () => {
    const html = renderStatus({ status: "ON_SALE", statusConfidence: "high" });
    expect(html).toContain("판매중");
    expect(html).not.toContain("추정");
  });
  it("DISCONTINUED? medium → '단종 추정'(단정형 '단종됨' 미출현)", () => {
    const html = renderStatus({ status: "DISCONTINUED?", statusConfidence: "medium" });
    expect(html).toContain("단종 추정");
    expect(html).not.toContain("단종됨");
  });
});

describe("renderProductCard — INV-9 출처 + 이스케이프 + 결정론", () => {
  it("이름·상태·출처 포함", () => {
    const html = renderProductCard(product());
    expect(html).toContain("신라면");
    expect(html).toContain("판매중");
    expect(html).toContain("출처:");
    expect(html).toContain("식품(첨가물)품목제조보고"); // attributionLabel
  });
  it("XSS: 외부 데이터 HTML 이스케이프", () => {
    const html = renderProductCard(product({ name: '<script>alert(1)</script>' }));
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
  it("제조사명 표기(동명 제품 구분), 없으면 미표기", () => {
    expect(renderProductCard(product())).toContain("(주)농심");
    const noMaker = renderProductCard(product({ manufacturerName: undefined }));
    expect(noMaker).not.toContain('class="meta maker"');
  });
  it("결정론: 같은 입력 → 같은 HTML", () => {
    expect(renderProductCard(product())).toBe(renderProductCard(product()));
  });
});

describe("renderNutrition", () => {
  it("영양 표 렌더(있는 필드만)", () => {
    const html = renderNutrition(product().nutrition);
    expect(html).toContain("505");
    expect(html).toContain("나트륨");
    expect(html).not.toContain("콜레스테롤"); // 미제공 필드 제외
  });
  it("null → 미커버 안내", () => {
    expect(renderNutrition(null)).toContain("영양 정보 없음");
  });
});

describe("renderPriceSection — INV-10 대가성 문구 + INV-9 출처·조회시각", () => {
  it("제휴 뷰 → 확정형 문구 + 출처·조회시각 + sponsored rel", () => {
    const view: AffiliateView = {
      __tier2RuntimeOnly: true,
      disclosure: COUPANG_PARTNERS_DISCLOSURE,
      quotes: [
        { seller: "쿠팡", url: "https://link.coupang.com/x", fetchedAt: "2026-06-18T00:00:00.000Z", source: "쿠팡", affiliate: true },
      ],
    };
    const html = renderPriceSection(view);
    expect(html).toContain(COUPANG_PARTNERS_DISCLOSURE); // INV-10
    expect(html).toContain("쿠팡"); // 출처
    expect(html).toContain("2026-06-18T00:00:00.000Z"); // 조회시각 INV-9
    expect(html).toContain('rel="nofollow sponsored noopener"');
  });
  it("비제휴(네이버) 링크는 sponsored 미부착 — rel=nofollow noopener", () => {
    const view: AffiliateView = {
      __tier2RuntimeOnly: true,
      disclosure: null,
      quotes: [
        { seller: "A마트", price: 9900, url: "https://shop/1", fetchedAt: "t", source: "네이버쇼핑", affiliate: false },
      ],
    };
    const html = renderPriceSection(view);
    expect(html).toContain('rel="nofollow noopener"');
    expect(html).not.toContain("sponsored");
  });
  it("빈 뷰 → 실시간 조회 안내, 문구 없음", () => {
    const html = renderPriceSection({ __tier2RuntimeOnly: true, disclosure: null, quotes: [] });
    expect(html).toContain("실시간 조회");
    expect(html).not.toContain(COUPANG_PARTNERS_DISCLOSURE);
  });
  it("INV-10 렌더 가드: 제휴 링크 있는데 disclosure null → throw", () => {
    const bad: AffiliateView = {
      __tier2RuntimeOnly: true,
      disclosure: null,
      quotes: [{ seller: "쿠팡", url: "https://link.coupang.com/x", fetchedAt: "t", source: "쿠팡", affiliate: true }],
    };
    expect(() => renderPriceSection(bad)).toThrow(/INV-10/);
  });
  it("safeUrl: javascript: 스킴 차단(#)", () => {
    const view: AffiliateView = {
      __tier2RuntimeOnly: true,
      disclosure: null,
      quotes: [{ seller: "x", url: "javascript:alert(1)", fetchedAt: "t", source: "네이버쇼핑", affiliate: false }],
    };
    const html = renderPriceSection(view);
    expect(html).not.toContain("javascript:");
    expect(html).toContain('href="#"');
  });
});

describe("renderShop", () => {
  it("모범음식점 배지·영업상태 + 좌표는 지도 딥링크", () => {
    const shop: RamenShop = {
      id: "MGT-0001",
      name: "스미스라멘",
      address: "서울 중구",
      lat: 37.5,
      lng: 127,
      businessStatus: "ACTIVE",
      category: "일식",
      isModelRestaurant: true,
      source: "RESTAURANT",
    };
    const html = renderShop(shop);
    expect(html).toContain("스미스라멘");
    expect(html).toContain("모범음식점");
    expect(html).toContain("영업");
    expect(html).toContain("openstreetmap.org"); // 좌표 → 지도 링크
    expect(html).toContain("지도");
  });
  it("배지·좌표 없는 음식점: 이중 공백 없음", () => {
    const shop: RamenShop = {
      id: "MGT-0009",
      name: "이름만",
      address: "주소",
      businessStatus: "CLOSED",
      source: "RESTAURANT",
    };
    const html = renderShop(shop);
    expect(html).toContain('<div class="name">이름만</div>'); // trailing 공백/빈 배지 없음
    expect(html).not.toContain("openstreetmap"); // 좌표 없음
  });
});

describe("renderProductDetail — 제품 사진(imageUrl)", () => {
  const EMPTY: AffiliateView = { __tier2RuntimeOnly: true, disclosure: null, quotes: [] };
  it("imageUrl 있으면 lazy img 렌더", () => {
    const html = renderProductDetail(product({ imageUrl: "https://img/x.jpg" }), EMPTY);
    expect(html).toContain('<img class="product-img"');
    expect(html).toContain('src="https://img/x.jpg"');
    expect(html).toContain('loading="lazy"');
  });
  it("imageUrl 없으면 img 없음", () => {
    expect(renderProductDetail(product(), EMPTY)).not.toContain("<img");
  });
  it("approved 레시피 결선 시 꿀조합 섹션 노출", () => {
    const html = renderProductDetail(product(), EMPTY, [
      {
        id: "r1",
        title: "테스트 조합",
        baseProductIds: ["20210001"],
        ingredients: ["a"],
        steps: ["b"],
        author: "u",
        submittedAt: "t",
        moderation: "APPROVED",
      },
    ]);
    expect(html).toContain("유저 꿀조합");
    expect(html).toContain("테스트 조합");
  });
});

describe("renderCuration — aria-label 순서", () => {
  it("'5점 만점에 N점' 순서 + 이스케이프", () => {
    const html = renderCuration({
      id: "c1",
      shopId: "MGT-0001",
      rating: 4,
      comment: "<b>국물</b>",
      author: "u",
      submittedAt: "t",
      moderation: "APPROVED",
    });
    expect(html).toContain('aria-label="5점 만점에 4점"');
    expect(html).toContain("4/5");
    expect(html).not.toContain("<b>국물</b>");
  });
});

describe("renderRecipe — UGC(M7) 작성자 표기 + 이스케이프", () => {
  it("제목·작성자·재료·단계 렌더, XSS 이스케이프", () => {
    const html = renderRecipe({
      id: "r1",
      title: "신라면 <b>꿀</b>조합",
      baseProductIds: ["20210001"],
      ingredients: ["신라면 1봉", "계란"],
      steps: ["끓인다"],
      author: "user-1",
      submittedAt: "2026-06-19T00:00:00.000Z",
      moderation: "APPROVED",
    });
    expect(html).toContain("작성자: user-1");
    expect(html).toContain("신라면 1봉");
    expect(html).not.toContain("<b>꿀</b>");
    expect(html).toContain("&lt;b&gt;");
  });
});

describe("renderPagination", () => {
  const href = (p: number) => (p === 1 ? "index.html" : `products-${p}.html`);
  it("1페이지면 빈 문자열", () => {
    expect(renderPagination(1, 1, href)).toBe("");
  });
  it("중간 페이지: 이전/다음 + 현재 표시 + href", () => {
    const html = renderPagination(2, 5, href);
    expect(html).toContain("이전");
    expect(html).toContain("다음");
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('href="products-3.html"');
    expect(html).toContain('href="index.html"'); // 1페이지 href
  });
  it("먼 페이지: 생략(…) 포함", () => {
    expect(renderPagination(5, 10, href)).toContain("…");
  });
});

describe("renderSearchPage", () => {
  it("검색 컨트롤 + search.js + noscript 폴백", () => {
    const html = renderSearchPage();
    expect(html).toContain('id="q"');
    expect(html).toContain('id="controls"');
    expect(html).toContain('src="search.js"');
    expect(html).toContain("<noscript>");
    expect(html).toContain("판매중"); // status 옵션 라벨
  });
});

describe("pageShell + anti-cliché 가드", () => {
  it("lang=ko, 제목 이스케이프, 스타일 포함", () => {
    const html = pageShell("제목 <x>", "<p>본문</p>");
    expect(html).toContain('<html lang="ko">');
    expect(html).toContain("제목 &lt;x&gt;");
    expect(html).toContain("<p>본문</p>");
  });
  it("스타일에 클리셰 패턴 부재(그라데이션·blur·네온 글로우)", () => {
    expect(STYLES).not.toMatch(/linear-gradient|radial-gradient|conic-gradient/);
    expect(STYLES).not.toMatch(/backdrop-filter|backdrop-blur/);
    // 그림자 도배/네온 글로우 금지 — 이 디자인은 border 분리만 사용(그림자 미사용).
    expect(STYLES).not.toMatch(/text-shadow|box-shadow/);
    expect(STYLES).not.toMatch(/bg-clip-text/);
  });
});
