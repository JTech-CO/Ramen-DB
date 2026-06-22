// 클라이언트 검색·필터·정렬·페이지네이션 — search-index.json 소비(무프레임워크).
// 순수 로직은 apps/web/src/catalog/query.ts와 동일 개념(빌드타임 페이지와 정합). 정적 페이지는 JS 없이도 동작.
(function () {
  "use strict";
  var data = [];
  var perPage = 60;
  var page = 1;
  var STATUS = { ON_SALE: "판매중", SALES_HALTED: "판매중지", RECALLED: "회수", "DISCONTINUED?": "단종 추정" };
  var PKG = { BAG: "봉지", CUP: "컵", OTHER: "기타" };
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function read() {
    return { q: $("q").value.trim().toLowerCase(), st: $("st").value, pk: $("pk").value, sort: $("sort").value };
  }
  function apply() {
    var f = read();
    var r = data.filter(function (e) {
      if (f.q && e.name.toLowerCase().indexOf(f.q) < 0) return false;
      if (f.st && e.status !== f.st) return false;
      if (f.pk && e.pkg !== f.pk) return false;
      return true;
    });
    r.sort(function (a, b) {
      if (f.sort === "kcal") {
        var ak = a.kcal == null ? Infinity : a.kcal, bk = b.kcal == null ? Infinity : b.kcal;
        return ak - bk || (a.id < b.id ? -1 : 1);
      }
      return a.name < b.name ? -1 : a.name > b.name ? 1 : a.id < b.id ? -1 : 1;
    });
    return r;
  }
  function render() {
    var r = apply();
    var totalPages = Math.max(1, Math.ceil(r.length / perPage));
    if (page > totalPages) page = totalPages;
    var slice = r.slice((page - 1) * perPage, page * perPage);
    $("count").textContent = r.length + "개";
    $("results").innerHTML =
      slice
        .map(function (e) {
          return (
            '<article class="card"><h3><a href="product-' + encodeURIComponent(e.id) + '.html">' +
            esc(e.name) + "</a></h3>" +
            '<p class="meta">' + esc(STATUS[e.status] || e.status) + " · " + esc(PKG[e.pkg] || e.pkg) + "</p>" +
            '<p class="meta">' + (e.kcal == null ? "영양 정보 없음" : esc(e.kcal) + " kcal") + "</p></article>"
          );
        })
        .join("") || '<p class="meta">결과가 없습니다.</p>';
    var pg = "";
    if (page > 1) pg += '<button type="button" data-p="' + (page - 1) + '" class="page">이전</button>';
    pg += '<span class="page current">' + page + " / " + totalPages + "</span>";
    if (page < totalPages) pg += '<button type="button" data-p="' + (page + 1) + '" class="page">다음</button>';
    $("pager").innerHTML = pg;
  }
  document.addEventListener("input", function (e) {
    if (e.target.closest && e.target.closest("#controls")) { page = 1; render(); }
  });
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-p]");
    if (b) { page = parseInt(b.getAttribute("data-p"), 10); render(); window.scrollTo(0, 0); }
  });
  fetch("search-index.json")
    .then(function (r) { return r.json(); })
    .then(function (d) { data = d; render(); })
    .catch(function () { $("results").innerHTML = '<p class="meta">검색 인덱스를 불러오지 못했습니다.</p>'; });
})();
