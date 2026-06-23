// 스냅샷 CLI — `npm run snapshot -w @ramen/pipeline`. Tier1 풀 스냅샷 1회 산출.
// 산출물(JSON, INV-2 → snapshots/ 디렉터리는 .gitignore). 생성시각은 본문과 분리(INV-7).
// DATA_GO_KR_SERVICE_KEY가 있으면 식약처 라이브 수집, 없으면 샘플 데이터(데모/CI).
// 라이브 실행: node --env-file=.env packages/pipeline/dist/snapshot.js (또는 SNAPSHOT_LIVE 미사용 시 샘플).

import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildSnapshot,
  serializeSnapshot,
  snapshotHash,
  type RawInputs,
  type Snapshot,
} from "./build.js";
import { diffSnapshots } from "./diff.js";
import { fetchLiveRawInputs } from "./live.js";
import { SAMPLE_AS_OF, SAMPLE_INPUTS, SAMPLE_VERSION } from "./sample-data.js";
import type { RawRestaurant } from "@ramen/ingest";

const here = dirname(fileURLToPath(import.meta.url)); // packages/pipeline/dist
const repoRoot = resolve(here, "..", "..", ".."); // dist → pipeline → packages → root
const outDir = process.env.SNAPSHOT_OUT_DIR
  ? resolve(process.env.SNAPSHOT_OUT_DIR)
  : resolve(repoRoot, "snapshots");

async function resolveInputs(): Promise<{ inputs: RawInputs; mode: string }> {
  // 음식점 벌크 시드(전량 커버) — 있으면 API 스캔보다 우선한다(ADR-0007).
  const shopsFile = process.env.SNAPSHOT_SHOPS_FILE
    ? resolve(process.env.SNAPSHOT_SHOPS_FILE)
    : resolve(repoRoot, "data", "ramen-shops.json");
  const fileShops = existsSync(shopsFile)
    ? (JSON.parse(readFileSync(shopsFile, "utf8")) as RawRestaurant[])
    : undefined;

  let inputs: RawInputs;
  let mode: string;
  // 라이브 키가 있으면 식약처 실데이터 수집(스모크 테스트는 SNAPSHOT_MAX_ROWS로 제한 가능).
  if (process.env.DATA_GO_KR_SERVICE_KEY?.trim()) {
    const maxRows = process.env.SNAPSHOT_MAX_ROWS
      ? Number(process.env.SNAPSHOT_MAX_ROWS)
      : undefined;
    // 영양(I2790) 미승인 시 SNAPSHOT_NUTRITION=off로 호출 자체를 생략(불필요한 실패·경고 회피).
    const includeNutrition = process.env.SNAPSHOT_NUTRITION !== "off";
    // 음식점 API 스캔: 시드 파일이 없을 때만(파일이 전량 커버). 키+상한 둘 다 있을 때만.
    const shopMaxRows =
      !fileShops && process.env.SNAPSHOT_SHOP_MAX_ROWS
        ? Number(process.env.SNAPSHOT_SHOP_MAX_ROWS)
        : undefined;
    const restaurantServiceKey =
      shopMaxRows !== undefined ? process.env.DATA_GO_KR_API_KEY?.trim() : undefined;
    inputs = await fetchLiveRawInputs({
      includeNutrition,
      ...(maxRows !== undefined ? { maxRows } : {}),
      ...(restaurantServiceKey ? { restaurantServiceKey } : {}),
      ...(shopMaxRows !== undefined ? { restaurantMaxRows: shopMaxRows } : {}),
    });
    mode = `live(식약처${includeNutrition ? "" : "·영양제외"}${restaurantServiceKey ? "+음식점API" : ""})`;
  } else {
    inputs = SAMPLE_INPUTS;
    mode = "sample";
  }

  // 시드 파일이 있으면 음식점은 이것으로 확정(전량 커버, API보다 우선).
  if (fileShops) {
    inputs = { ...inputs, restaurants: fileShops };
    mode += `+음식점시드(${fileShops.length})`;
  }
  return { inputs, mode };
}

async function main(): Promise<void> {
  const asOf = process.env.SNAPSHOT_AS_OF ?? SAMPLE_AS_OF;
  const version = process.env.SNAPSHOT_VERSION ?? SAMPLE_VERSION;

  const { inputs, mode } = await resolveInputs();
  const { snapshot, report } = buildSnapshot(inputs, { asOf, version });
  const body = serializeSnapshot(snapshot); // 결정론(키 정렬)
  const hash = snapshotHash(snapshot);

  mkdirSync(outDir, { recursive: true });
  const bodyPath = resolve(outDir, `${version}.json`);
  const metaPath = resolve(outDir, `${version}.meta.json`);

  writeFileSync(bodyPath, body, "utf8");
  // 생성시각·해시·리포트·모드는 메타에만(본문 해시 불변, INV-7).
  writeFileSync(
    metaPath,
    JSON.stringify({ version, mode, generatedAt: new Date().toISOString(), hash, report }, null, 2),
    "utf8",
  );

  const prevPath = process.env.SNAPSHOT_PREV ? resolve(process.env.SNAPSHOT_PREV) : undefined;
  if (prevPath && existsSync(prevPath)) {
    const prev = JSON.parse(readFileSync(prevPath, "utf8")) as Snapshot;
    const diff = diffSnapshots(prev, snapshot);
    writeFileSync(resolve(outDir, `${version}.diff.json`), JSON.stringify(diff, null, 2), "utf8");
    process.stdout.write(`diff products: ${JSON.stringify(diff.products.counts)}\n`);
    process.stdout.write(`diff shops: ${JSON.stringify(diff.shops.counts)}\n`);
  }

  process.stdout.write(
    `snapshot ${version} [${mode}]: ${snapshot.products.length} products, ${snapshot.shops.length} shops\n`,
  );
  process.stdout.write(`nutrition matched: ${report.nutritionMatched}/${report.ramenProducts}\n`);
  process.stdout.write(`hash: ${hash}\n`);
  process.stdout.write(`out: ${bodyPath}\n`);
}

void main();
