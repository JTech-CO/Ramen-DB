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

const here = dirname(fileURLToPath(import.meta.url)); // packages/pipeline/dist
const repoRoot = resolve(here, "..", "..", ".."); // dist → pipeline → packages → root
const outDir = process.env.SNAPSHOT_OUT_DIR
  ? resolve(process.env.SNAPSHOT_OUT_DIR)
  : resolve(repoRoot, "snapshots");

async function resolveInputs(): Promise<{ inputs: RawInputs; mode: string }> {
  // 라이브 키가 있으면 식약처 실데이터 수집(스모크 테스트는 SNAPSHOT_MAX_ROWS로 제한 가능).
  if (process.env.DATA_GO_KR_SERVICE_KEY?.trim()) {
    const maxRows = process.env.SNAPSHOT_MAX_ROWS
      ? Number(process.env.SNAPSHOT_MAX_ROWS)
      : undefined;
    // 영양(I2790) 미승인 시 SNAPSHOT_NUTRITION=off로 호출 자체를 생략(불필요한 실패·경고 회피).
    const includeNutrition = process.env.SNAPSHOT_NUTRITION !== "off";
    // 음식점(data.go.kr): 키 + 명시적 상한(SNAPSHOT_SHOP_MAX_ROWS)이 둘 다 있을 때만 수집.
    // 전국 2.28M·서버필터 없음 → 쿼터·시간 보호를 위해 명시적 opt-in.
    const shopMaxRows = process.env.SNAPSHOT_SHOP_MAX_ROWS
      ? Number(process.env.SNAPSHOT_SHOP_MAX_ROWS)
      : undefined;
    const restaurantServiceKey =
      shopMaxRows !== undefined ? process.env.DATA_GO_KR_API_KEY?.trim() : undefined;
    const inputs = await fetchLiveRawInputs({
      includeNutrition,
      ...(maxRows !== undefined ? { maxRows } : {}),
      ...(restaurantServiceKey ? { restaurantServiceKey } : {}),
      ...(shopMaxRows !== undefined ? { restaurantMaxRows: shopMaxRows } : {}),
    });
    const shopsNote = restaurantServiceKey ? "+음식점" : "";
    return {
      inputs,
      mode: `live(식약처${includeNutrition ? "" : "·영양제외"}${shopsNote})`,
    };
  }
  return { inputs: SAMPLE_INPUTS, mode: "sample" };
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
