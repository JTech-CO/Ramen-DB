// 디자인 토큰 + 스타일(anti-cliché): 중성색 1계열 + 단일 accent, flat surface,
// 1px border 분리(그림자 도배 금지), system 폰트, 기능적 status 색(텍스트 동반).
// 그라데이션·네온·blur·장식 모션 없음.

export const STYLES = `
:root {
  --bg: #ffffff;
  --surface: #fafafa;
  --border: #e4e4e7;
  --text: #18181b;
  --muted: #6b7280;
  --accent: #b45309;            /* 단일 accent(따뜻한 갈색, 링크·포커스) */
  --ok: #15803d;                /* 판매중 */
  --warn: #b91c1c;              /* 판매중지/회수 (accent와 구분되는 적색) */
  --idle: #71717a;             /* 단종 추정 */
  --radius: 8px;
  --space: 16px;
  --maxw: 1040px;
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Apple SD Gothic Neo",
    "Malgun Gothic", sans-serif;
  font-size: 16px;
  line-height: 1.6;
}
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
a:focus-visible, button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.wrap { max-width: var(--maxw); margin: 0 auto; padding: 0 var(--space); }
header.site { border-bottom: 1px solid var(--border); }
header.site .wrap { display: flex; align-items: baseline; gap: 20px; padding-top: 18px; padding-bottom: 18px; flex-wrap: wrap; }
.brand { font-size: 20px; font-weight: 600; color: var(--text); }
.brand:hover { text-decoration: none; }
header.site nav { display: flex; gap: 16px; font-size: 14px; }
header.site .muted { color: var(--muted); font-size: 13px; margin-left: auto; }
main { padding: 24px 0 64px; }
main h1 { font-size: 28px; line-height: 1.2; margin: 0 0 4px; font-weight: 600; }
h2.section { font-size: 14px; font-weight: 600; color: var(--muted); text-transform: none;
  margin: 0 0 12px; }
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}
.card {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
  padding: 14px 16px;
}
.card h3 { font-size: 16px; margin: 0 0 6px; font-weight: 600; }
.card .meta { color: var(--muted); font-size: 13px; margin: 2px 0; }
.kcal { font-variant-numeric: tabular-nums; }
.status { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 500; }
.status .dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
.status.on .dot { background: var(--ok); }
.status.halt .dot { background: var(--warn); }
.status.disc .dot { background: var(--idle); }
.status.disc { color: var(--muted); }
.sources { color: var(--muted); font-size: 12px; margin-top: 8px; }
table.nutri { border-collapse: collapse; width: 100%; max-width: 420px; font-size: 14px; }
table.nutri th, table.nutri td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--border); }
table.nutri td.num { text-align: right; font-variant-numeric: tabular-nums; }
.detail { display: grid; gap: 24px; }
.product-img { max-width: 240px; width: 100%; height: auto; border: 1px solid var(--border); border-radius: var(--radius); margin-top: 12px; }
.price {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 16px;
  background: var(--surface);
}
.disclosure {
  font-size: 13px;
  color: var(--text);
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 6px;
  padding: 8px 10px;
  margin: 0 0 12px;
}
.quote { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 14px; }
.quote .src { color: var(--muted); font-size: 12px; }
.shoplist { display: grid; gap: 8px; }
.shop { border: 1px solid var(--border); border-radius: var(--radius); padding: 10px 14px; }
.shop .name { font-weight: 600; }
.shop .addr { color: var(--muted); font-size: 13px; }
.badge { font-size: 12px; color: var(--muted); border: 1px solid var(--border); border-radius: 4px; padding: 1px 6px; }
.recipe { border: 1px solid var(--border); border-radius: var(--radius); padding: 14px 16px; }
.recipe h3 { font-size: 16px; margin: 0 0 4px; font-weight: 600; }
.recipe h4 { font-size: 13px; color: var(--muted); margin: 12px 0 4px; font-weight: 600; }
.recipe ul, .recipe ol { margin: 0; padding-left: 20px; }
.curation { border-bottom: 1px solid var(--border); padding: 8px 0; }
.rating { font-weight: 600; font-variant-numeric: tabular-nums; }
.controls { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 16px; }
.controls input, .controls select {
  font: inherit; padding: 7px 10px; border: 1px solid var(--border); border-radius: 6px;
  background: var(--bg); color: var(--text);
}
.controls input { flex: 1 1 220px; min-width: 0; }
.pagination { display: flex; flex-wrap: wrap; gap: 6px; margin: 20px 0 0; align-items: center; }
.pagination .page {
  display: inline-flex; align-items: center; min-width: 32px; height: 32px; justify-content: center;
  padding: 0 8px; border: 1px solid var(--border); border-radius: 6px; font-size: 14px;
  color: var(--text); background: var(--bg); cursor: pointer;
}
.pagination a.page:hover { border-color: var(--accent); text-decoration: none; }
.pagination .page.current { border-color: var(--accent); color: var(--accent); font-weight: 600; cursor: default; }
.pagination .page.gap { border: 0; cursor: default; color: var(--muted); }
/* 소개(히어로) — 이 사이트가 무엇인지 한눈에. flat surface + border(그림자·그라데이션 없음). */
.hero { border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface);
  padding: 20px 22px; margin: 0 0 24px; }
.hero h1 { font-size: 26px; margin: 0 0 8px; line-height: 1.25; }
.hero p { margin: 0 0 12px; color: var(--text); max-width: 60ch; }
.hero p.sub { color: var(--muted); font-size: 14px; margin: 0; }
.hero .stats { display: flex; flex-wrap: wrap; gap: 10px 24px; margin: 0 0 12px; }
.hero .stat { display: flex; align-items: baseline; gap: 6px; }
.hero .stat b { font-size: 22px; color: var(--accent); font-variant-numeric: tabular-nums; }
.hero .stat span { font-size: 13px; color: var(--muted); }
.toolbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 0 0 16px; }
.toolbar input, .toolbar select { font: inherit; padding: 7px 10px; border: 1px solid var(--border);
  border-radius: 6px; background: var(--bg); color: var(--text); }
.toolbar input[type="search"] { flex: 1 1 240px; min-width: 0; }
.toolbar label.chk { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; color: var(--muted); cursor: pointer; }
.count { color: var(--muted); font-size: 14px; margin: 0 0 12px; }
/* 즐겨찾기 별(기능 토글). */
.fav { border: 0; background: none; cursor: pointer; font-size: 18px; line-height: 1; color: var(--muted);
  padding: 0 2px; }
.fav[aria-pressed="true"] { color: var(--accent); }
.shop .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
.shop .region { font-size: 12px; color: var(--accent); font-weight: 600; }
/* 페이지 점프 입력 — 가운데 페이지(예: 35) 직접 이동. */
.pg-jump { display: inline-flex; align-items: center; gap: 4px; margin: 0; }
.pg-jump input { width: 56px; height: 32px; text-align: center; font: inherit; border: 1px solid var(--border);
  border-radius: 6px; background: var(--bg); color: var(--text); }
.pg-jump .of { color: var(--muted); font-size: 13px; }
.pg-jump button { height: 32px; padding: 0 10px; border: 1px solid var(--border); border-radius: 6px;
  background: var(--bg); color: var(--text); cursor: pointer; font: inherit; }
.pg-jump button:hover { border-color: var(--accent); }
footer.site { border-top: 1px solid var(--border); color: var(--muted); font-size: 12px; }
footer.site .wrap { padding: 20px var(--space); }
footer.site a { color: var(--muted); text-decoration: underline; }
@media (prefers-reduced-motion: no-preference) {
  a, button { transition: color 120ms ease-out; }
}
`;
