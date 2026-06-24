// 제품·음식점 공용 클라이언트 앱 — 검색·필터·정렬·페이지네이션(점프) + 음식점 지역/즐겨찾기.
// window.__APP__ = { type:"product"|"shop", data:"<index>.json", per:60 } 로 페이지가 구성.
// 정적 목록 페이지(products-N/shops-N)는 JS 없이도 동작(이 앱은 index.html/shops.html에서만).
(function () {
  "use strict";
  var CFG = window.__APP__ || { type: "product", data: "search-index.json", per: 60 };
  var PER = CFG.per || 60;
  var data = [];
  var page = 1;
  var favs = loadFavs();
  var STATUS = { ON_SALE: "판매중", SALES_HALTED: "판매중지", RECALLED: "회수", "DISCONTINUED?": "단종 추정" };
  var PKG = { BAG: "봉지", CUP: "컵", OTHER: "기타" };
  var REGION_ORDER = ["서울","부산","대구","인천","광주","대전","울산","세종","경기","강원","충북","충남","전북","전남","경북","경남","제주","기타"];

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function cmp(a, b) { a = String(a); b = String(b); return a < b ? -1 : a > b ? 1 : 0; }

  // ── 즐겨찾기(localStorage) ──
  var FAV_KEY = "ramendb:favShops";
  function loadFavs() { try { return JSON.parse(localStorage.getItem(FAV_KEY) || "[]"); } catch { return []; } }
  function saveFavs() { try { localStorage.setItem(FAV_KEY, JSON.stringify(favs)); } catch { /* 무시 */ } }
  function isFav(id) { return favs.indexOf(id) >= 0; }
  function toggleFav(id) {
    var i = favs.indexOf(id);
    if (i >= 0) favs.splice(i, 1); else favs.push(id);
    saveFavs();
  }

  function readControls() {
    var c = { q: ($("q").value || "").trim().toLowerCase(), sort: $("sort") ? $("sort").value : "name" };
    if (CFG.type === "product") {
      c.st = $("st") ? $("st").value : "";
      c.pk = $("pk") ? $("pk").value : "";
    } else {
      c.rg = $("rg") ? $("rg").value : "";
      c.favonly = $("favonly") ? $("favonly").checked : false;
    }
    return c;
  }

  function applyFilter(c) {
    return data.filter(function (e) {
      if (c.q) {
        var hay = (CFG.type === "product" ? e.name + " " + (e.mfr || "") : e.name + " " + (e.addr || "")).toLowerCase();
        if (hay.indexOf(c.q) < 0) return false;
      }
      if (CFG.type === "product") {
        if (c.st && e.status !== c.st) return false;
        if (c.pk && e.pkg !== c.pk) return false;
      } else {
        if (c.rg && e.region !== c.rg) return false;
        if (c.favonly && !isFav(e.id)) return false;
      }
      return true;
    });
  }

  function sortResults(arr, c) {
    arr.sort(function (a, b) {
      if (CFG.type === "product" && c.sort === "kcal") {
        var ak = a.kcal == null ? Infinity : a.kcal, bk = b.kcal == null ? Infinity : b.kcal;
        return ak - bk || cmp(a.id, b.id);
      }
      if (CFG.type === "shop" && c.sort === "region") {
        var ar = REGION_ORDER.indexOf(a.region), br = REGION_ORDER.indexOf(b.region);
        if (ar < 0) ar = 99; if (br < 0) br = 99;
        return ar - br || cmp(a.name, b.name) || cmp(a.id, b.id);
      }
      return cmp(a.name, b.name) || cmp(a.id, b.id);
    });
    return arr;
  }

  function cardProduct(e) {
    return '<article class="card"><h3><a href="product-' + encodeURIComponent(e.id) + '.html">' + esc(e.name) + "</a></h3>" +
      (e.mfr ? '<p class="meta maker">' + esc(e.mfr) + "</p>" : "") +
      '<p class="meta">' + esc(STATUS[e.status] || e.status) + " · " + esc(PKG[e.pkg] || e.pkg) + "</p>" +
      '<p class="meta">' + (e.kcal == null ? "영양 정보 없음" : esc(e.kcal) + " kcal") + "</p></article>";
  }
  function cardShop(e) {
    var map = (e.lat != null && e.lng != null)
      ? ' · <a href="https://www.openstreetmap.org/?mlat=' + e.lat + "&mlon=" + e.lng + "#map=18/" + e.lat + "/" + e.lng + '" rel="noopener" target="_blank">지도</a>'
      : "";
    var on = isFav(e.id);
    return '<article class="shop"><div class="top"><div class="name">' + esc(e.name) + "</div>" +
      '<button class="fav" type="button" data-fav="' + esc(e.id) + '" aria-pressed="' + (on ? "true" : "false") + '" aria-label="즐겨찾기" title="즐겨찾기">' + (on ? "★" : "☆") + "</button></div>" +
      '<div class="meta"><span class="region">' + esc(e.region) + "</span>" + (e.cat ? " · " + esc(e.cat) : "") + "</div>" +
      '<div class="addr">' + esc(e.addr) + "</div>" +
      '<div class="meta">' + (e.status === "ACTIVE" ? "영업" : "영업 종료") + map + "</div></article>";
  }

  function renderPager(totalPages) {
    var el = $("pager");
    if (totalPages <= 1) { el.innerHTML = ""; return; }
    function pg(p, label, cur) {
      return cur
        ? '<span class="page current" aria-current="page">' + esc(label) + "</span>"
        : '<button type="button" class="page" data-p="' + p + '">' + esc(label) + "</button>";
    }
    var h = "";
    if (page > 1) h += pg(page - 1, "이전");
    h += pg(1, "1", page === 1);
    if (totalPages >= 2) h += pg(2, "2", page === 2);
    h += '<form class="pg-jump" data-jump><input name="pg" type="number" min="1" max="' + totalPages + '" value="' + page + '" aria-label="페이지 번호로 이동"><span class="of">/ ' + totalPages + '</span><button type="submit">이동</button></form>';
    if (totalPages > 2) h += pg(totalPages, String(totalPages), page === totalPages);
    if (page < totalPages) h += pg(page + 1, "다음");
    el.innerHTML = h;
  }

  function render() {
    var c = readControls();
    var r = sortResults(applyFilter(c), c);
    var totalPages = Math.max(1, Math.ceil(r.length / PER));
    if (page > totalPages) page = totalPages;
    var slice = r.slice((page - 1) * PER, page * PER);
    $("count").textContent = r.length.toLocaleString("ko-KR") + (CFG.type === "product" ? "개" : "곳");
    $("results").innerHTML = slice.map(CFG.type === "product" ? cardProduct : cardShop).join("") ||
      '<p class="count">결과가 없습니다.</p>';
    renderPager(totalPages);
  }

  document.addEventListener("input", function (e) {
    if (e.target.closest && e.target.closest(".toolbar")) { page = 1; render(); }
  });
  document.addEventListener("change", function (e) {
    if (e.target.closest && e.target.closest(".toolbar")) { page = 1; render(); }
  });
  document.addEventListener("click", function (e) {
    var fav = e.target.closest && e.target.closest("[data-fav]");
    if (fav) { toggleFav(fav.getAttribute("data-fav")); render(); return; }
    var p = e.target.closest && e.target.closest("[data-p]");
    if (p) { page = parseInt(p.getAttribute("data-p"), 10); render(); window.scrollTo(0, 0); }
  });
  document.addEventListener("submit", function (e) {
    var jf = e.target.closest && e.target.closest("[data-jump]");
    if (jf) { e.preventDefault(); page = Math.max(1, parseInt(jf.pg.value, 10) || 1); render(); window.scrollTo(0, 0); }
  });

  fetch(CFG.data)
    .then(function (r) { return r.json(); })
    .then(function (d) { data = d; render(); })
    .catch(function () { $("results").innerHTML = '<p class="count">데이터를 불러오지 못했습니다.</p>'; });
})();
