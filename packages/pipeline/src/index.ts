// @ramen/pipeline — 스냅샷 오케스트레이션·diff·idempotent 산출(INV-7).
// 허용 import: core-domain, ingest, shared (INV-3). web import 금지.

export type { Snapshot, RawInputs, BuildOptions, BuildReport, BuildResult } from "./build.js";
export { buildSnapshot, serializeSnapshot, snapshotHash } from "./build.js";

export type { SnapshotDiff, ProductChanges, ShopChanges } from "./diff.js";
export { diffSnapshots } from "./diff.js";

export type { LiveFetchOptions } from "./live.js";
export { fetchLiveRawInputs } from "./live.js";
