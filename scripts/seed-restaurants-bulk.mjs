// 벌크 일반음식점 CSV(CP949, 약 2.13M행) → 라멘 RawRestaurant[] → data/ramen-shops.json.
// data.go.kr 일반음식점 전체를 스트리밍 파싱·라멘 도메인 필터로 컴팩트 시드를 만든다.
// API 게이트웨이의 깊은-페이지(서버 60s) 한계를 우회한 전량 커버 경로(ADR-0007). 주기적 재실행.
//
// 1) 벌크 CSV 다운로드(file.localdata.go.kr, CSRF 플로우)로 data/raw/general_restaurants.csv 저장
// 2) node scripts/seed-restaurants-bulk.mjs  → data/ramen-shops.json
//
// 컬럼 인덱스(0-based)는 2026-06-23 실파일 헤더로 확정. 헤더 변경 시 여기만 갱신(런북 9).

import { createReadStream, writeFileSync } from "node:fs";
import { filterRamenShops, normalizeRestaurant } from "@ramen/ingest";

const SRC = process.env.SHOPS_CSV ?? "data/raw/general_restaurants.csv";
const OUT = process.env.SHOPS_OUT ?? "data/ramen-shops.json";

// 라멘 키워드 1차 컷(전건 정규화 회피). 업태·음성키워드 정밀필터는 classifyShop이 수행.
const KW = /라멘|라면|멘야|麺/;

// 컬럼 인덱스(0-based)
const C_MGTNO = 1;
const C_APV = 2;
const C_TRD = 3;
const C_NAME = 8;
const C_UPTAE = 9;
const C_ROAD = 19;
const C_DTL = 23;
const C_X = 34;
const C_Y = 35;

/** CSV 한 줄 파싱(따옴표 필드 + "" 이스케이프). 임베디드 개행 없음 가정(LOCALDATA 주소). */
function parseLine(line) {
  const out = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

function toRaw(f) {
  const s = (i) => (f[i] ?? "").trim();
  const raw = { MGTNO: s(C_MGTNO), BPLCNM: s(C_NAME) };
  const road = s(C_ROAD);
  const x = s(C_X);
  const y = s(C_Y);
  const trd = s(C_TRD);
  const dtl = s(C_DTL);
  const up = s(C_UPTAE);
  const apv = s(C_APV);
  if (road) raw.RDNWHLADDR = road;
  if (x) raw.X = x;
  if (y) raw.Y = y;
  if (trd) raw.TRDSTATENM = trd;
  if (dtl) raw.DTLSTATENM = dtl;
  if (up) raw.UPTAENM = up;
  if (apv) raw.APVPERMYMD = apv;
  return raw;
}

async function main() {
  const decoder = new TextDecoder("euc-kr");
  const stream = createReadStream(SRC);
  let buf = "";
  let lineNo = 0;
  let total = 0;
  let matched = 0;
  const raws = [];
  const handle = (line) => {
    lineNo++;
    if (lineNo === 1 || line === "") return; // 헤더/빈줄
    total++;
    if (!KW.test(line)) return; // 키워드 1차 컷
    matched++;
    const raw = toRaw(parseLine(line));
    if (raw.MGTNO && raw.BPLCNM) raws.push(raw);
  };

  for await (const chunk of stream) {
    buf += decoder.decode(chunk, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      let line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      handle(line);
    }
  }
  buf += decoder.decode();
  if (buf) handle(buf.endsWith("\r") ? buf.slice(0, -1) : buf);

  // PK 중복 제거 후 정밀 라멘 필터(업태·음성키워드). normalizeRestaurant로 분류 입력 생성.
  const seen = new Set();
  const dedup = raws.filter((r) => {
    const id = r.MGTNO.trim();
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  const ramen = filterRamenShops(
    dedup.map((r) => normalizeRestaurant(r)),
    { version: "bulk", include: [], exclude: [] },
  );
  const keep = new Set(ramen.map((s) => s.id));
  const out = dedup.filter((r) => keep.has(r.MGTNO.trim()));
  out.sort((a, b) => (a.MGTNO < b.MGTNO ? -1 : a.MGTNO > b.MGTNO ? 1 : 0)); // 결정론
  writeFileSync(OUT, JSON.stringify(out));
  console.log(
    `스캔 ${total}행 · 키워드매치 ${matched} · PK중복제거 ${dedup.length} · 라멘확정 ${out.length} → ${OUT}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
