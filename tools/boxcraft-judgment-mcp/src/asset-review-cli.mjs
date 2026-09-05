#!/usr/bin/env node
import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { getAssetTarget, assetGraphHash, formatAssetRequest, judgeAsset, ASSET_CATALOG } from "./asset-engine.mjs";

const [targetId, seed, regnetPath, outPath] = process.argv.slice(2);
if (!targetId || !seed || !regnetPath || !outPath) {
  console.error("usage: asset-review-cli.mjs TARGET SEED REGNET_JSON OUT_JSON");
  process.exit(64);
}
const asset = getAssetTarget(targetId);
if (!asset) {
  console.error(JSON.stringify({ status: "UNKNOWN", errors: ["unknown target"] }));
  process.exit(2);
}
const regnet = JSON.parse(readFileSync(regnetPath, "utf8"));
const candidate = {
  targetId: asset.id,
  seed: String(seed),
  views: asset.required_views,
  componentIds: asset.components.map(component => component.id),
  componentGraphHash: assetGraphHash(asset),
  lineArt: ASSET_CATALOG.lineart_contract,
  hostSurface: asset.host_surface,
  supportChain: asset.support_chain,
  serviceRoute: asset.service_route,
  silhouette: asset.silhouette,
  regnet: { status: regnet.status, ...regnet.scores }
};
const result = judgeAsset(formatAssetRequest(targetId, seed), candidate);
const payload = { schema: "FLESHPUNK MUTATION DECISION 1", targetId, seed: String(seed), regnetReceipt: regnetPath, ...result };
writeFileSync(outPath + ".tmp", JSON.stringify(payload, null, 2) + "\n");
renameSync(outPath + ".tmp", outPath);
console.log(JSON.stringify(payload));
if (result.mutationDecision === "DENY_MUTATION") process.exit(2);
