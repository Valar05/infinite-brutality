import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CATALOG_PATH = resolve(ROOT, "data/fleshpunk_asset_targets.json");
export const ASSET_CATALOG = Object.freeze(JSON.parse(readFileSync(CATALOG_PATH, "utf8")));
export const ASSET_VIEWS = Object.freeze(["ASSEMBLED", "EXPLODED", "ORTHOGRAPHIC", "TRIPTYCH"]);
export const ANATOMY_SYSTEMS = Object.freeze(["pipe", "valve", "tendon", "connective_tissue"]);
export const ASSET_REQUIREMENTS = Object.freeze(["PIPE", "VALVE", "TENDON", "CONNECTIVE_TISSUE", "ASSEMBLED", "EXPLODED", "ORTHOGRAPHIC", "HOST", "SUPPORT", "SERVICE", "SILHOUETTE"]);
export const ASSET_FORBIDS = Object.freeze(["SHADING", "GRAY", "HATCHING", "GRADIENT", "FILTER", "BLOB", "FLOATING_PART"]);
const stable = value => Array.isArray(value) ? `[${value.map(stable).join(",")}]` : value && typeof value === "object" ? `{${Object.keys(value).sort().map(key => JSON.stringify(key) + ":" + stable(value[key])).join(",")}}` : JSON.stringify(value);
const sha = value => createHash("sha256").update(typeof value === "string" ? value : stable(value)).digest("hex");
const splitList = value => value ? value.split(",").map(item => item.trim()).filter(Boolean) : [];
const sameSet = (a, b) => a.length === b.length && [...a].sort().every((value, index) => value === [...b].sort()[index]);
const bySystem = (asset, system) => asset.components.filter(component => component.system === system).map(component => component.id);
export const assetGraphHash = asset => sha({id:asset.id,support_chain:asset.support_chain,components:asset.components.map(({id,system,function:purpose})=>({id,system,purpose}))});

export function getAssetTarget(id) {
  return ASSET_CATALOG.assets.find(asset => asset.id === id) || null;
}

export function formatAssetRequest(id, seed = "314159") {
  const asset = getAssetTarget(id);
  if (!asset) return null;
  return [
    "ASSET REQUEST 1", `id: ${id}-canary`, `seed: ${seed}`, `target_id: ${id}`, "view: TRIPTYCH",
    `room_roles: ${asset.room_roles.join(", ")}`, `host_surface: ${asset.host_surface}`,
    `support_chain: ${asset.support_chain.join(" > ")}`, `pipes: ${bySystem(asset,"pipe").join(", ")}`,
    `valves: ${bySystem(asset,"valve").join(", ")}`, `tendons: ${bySystem(asset,"tendon").join(", ")}`,
    `connective_tissue: ${bySystem(asset,"connective_tissue").join(", ")}`,
    `interaction: ${asset.interaction}`, `collider: ${asset.collider}`, `service_route: ${asset.service_route}`,
    `silhouette: ${asset.silhouette}`, `require: ${ASSET_REQUIREMENTS.join(", ")}`, `forbid: ${ASSET_FORBIDS.join(", ")}`, ""
  ].join("\n");
}

export function parseAssetRequest(input) {
  if (typeof input !== "string") return {status:"UNKNOWN", errors:["request must be text"]};
  const lines = input.replace(/\r/g, "").split("\n").filter(line => line.trim() && !line.trim().startsWith("#"));
  if (lines.shift()?.trim() !== "ASSET REQUEST 1") return {status:"UNKNOWN", errors:["first line must be ASSET REQUEST 1"]};
  const fields = ["id","seed","target_id","view","room_roles","host_surface","support_chain","pipes","valves","tendons","connective_tissue","interaction","collider","service_route","silhouette","require","forbid"];
  const allowed = new Set(fields), raw = {}, errors = [];
  for (const line of lines) {
    const match = line.match(/^([a-z_]+):\s*(.*)$/);
    if (!match) { errors.push(`invalid line: ${line}`); continue; }
    if (!allowed.has(match[1])) { errors.push(`unknown field: ${match[1]}`); continue; }
    if (match[1] in raw) errors.push(`duplicate field: ${match[1]}`);
    raw[match[1]] = match[2].trim();
  }
  for (const field of fields) if (!(field in raw)) errors.push(`missing field: ${field}`);
  if (errors.length) return {status:"UNKNOWN", errors};
  if (!/^[a-zA-Z0-9_.-]+$/.test(raw.id)) errors.push("id contains unsupported characters");
  if (!ASSET_VIEWS.includes(raw.view)) errors.push(`unknown view: ${raw.view}`);
  const asset = getAssetTarget(raw.target_id);
  if (!asset) errors.push(`unknown target_id: ${raw.target_id}`);
  const require = splitList(raw.require), forbid = splitList(raw.forbid);
  for (const token of require) if (!ASSET_REQUIREMENTS.includes(token)) errors.push(`unknown requirement: ${token}`);
  for (const token of forbid) if (!ASSET_FORBIDS.includes(token)) errors.push(`unknown prohibition: ${token}`);
  if (errors.length) return {status:"UNKNOWN", errors};
  const hardFailures = [];
  const exact = (field, expected) => { if (raw[field] !== expected) hardFailures.push(`${field}_does_not_match_catalog`); };
  if (!sameSet(splitList(raw.room_roles), asset.room_roles)) hardFailures.push("room_roles_do_not_match_catalog");
  exact("host_surface", asset.host_surface);
  if (raw.support_chain.split(">").map(x=>x.trim()).filter(Boolean).join("|") !== asset.support_chain.join("|")) hardFailures.push("support_chain_does_not_match_catalog");
  for (const [field, system] of [["pipes","pipe"],["valves","valve"],["tendons","tendon"],["connective_tissue","connective_tissue"]]) {
    if (!sameSet(splitList(raw[field]), bySystem(asset, system))) hardFailures.push(`${system}_inventory_does_not_match_catalog`);
  }
  for (const field of ["interaction","collider","service_route","silhouette"]) exact(field, asset[field]);
  for (const required of ASSET_REQUIREMENTS) if (!require.includes(required)) hardFailures.push(`required_gate_missing:${required}`);
  for (const prohibited of ASSET_FORBIDS) if (!forbid.includes(prohibited)) hardFailures.push(`prohibition_missing:${prohibited}`);
  const spec = {...raw, room_roles:splitList(raw.room_roles), pipes:splitList(raw.pipes), valves:splitList(raw.valves), tendons:splitList(raw.tendons), connective_tissue:splitList(raw.connective_tissue), support_chain:raw.support_chain.split(">").map(x=>x.trim()).filter(Boolean), require, forbid, graph_hash:assetGraphHash(asset)};
  return hardFailures.length ? {status:"REJECT", errors:hardFailures, spec} : {status:"PROCEED", spec};
}

export function judgeAsset(request, candidate = null) {
  const compiled = parseAssetRequest(request);
  if (compiled.status !== "PROCEED") return compiled;
  if (!candidate || typeof candidate !== "object") return {status:"UNKNOWN", errors:["candidate must be an object"], spec:compiled.spec};
  const asset = getAssetTarget(compiled.spec.target_id), hardFailures = [];
  if (candidate.targetId !== asset.id) hardFailures.push("candidate_target_mismatch");
  if (String(candidate.seed) !== String(compiled.spec.seed)) hardFailures.push("candidate_seed_mismatch");
  if (candidate.componentGraphHash !== assetGraphHash(asset)) hardFailures.push("component_graph_changed");
  const expectedComponents = asset.components.map(component => component.id);
  if (!sameSet(candidate.componentIds || [], expectedComponents)) hardFailures.push("component_inventory_changed");
  if (!sameSet(candidate.views || [], asset.required_views)) hardFailures.push("required_views_missing");
  const line = candidate.lineArt || {};
  if (line.background !== "#ffffff" || line.stroke !== "#000000") hardFailures.push("lineart_palette_violation");
  for (const flag of ["shading","gray","hatching","gradients","filters"]) if (line[flag] !== false) hardFailures.push(`lineart_${flag}_violation`);
  if (candidate.hostSurface !== asset.host_surface) hardFailures.push("host_surface_missing");
  if (!sameSet(candidate.supportChain || [], asset.support_chain)) hardFailures.push("support_chain_missing");
  if (candidate.serviceRoute !== asset.service_route) hardFailures.push("service_route_missing");
  if (candidate.silhouette !== asset.silhouette) hardFailures.push("silhouette_missing");
  if (hardFailures.length) return {status:"REJECT", verdict:"REJECT", hardFailures:[...new Set(hardFailures)], mutationDecision:"DENY_MUTATION", finalAcceptance:"USER_ONLY"};
  const regnet = candidate.regnet || {status:"UNKNOWN"};
  if (regnet.status === "REJECT") return {status:"REJECT", verdict:"REJECT", hardFailures:["regnet_rejected"], mutationDecision:"DENY_MUTATION", finalAcceptance:"USER_ONLY"};
  if (regnet.status !== "PROCEED") return {status:"OBSERVE", verdict:"OBSERVE", hardFailures:[], mutationDecision:"WAIT_FOR_REGNET", finalAcceptance:"USER_ONLY"};
  const scores = [regnet.traceSimilarity, regnet.recreationSimilarity, regnet.identityContinuity];
  if (scores.some(score => typeof score !== "number" || score < 0.82)) return {status:"REJECT", verdict:"REJECT", hardFailures:["regnet_similarity_below_0.82"], mutationDecision:"DENY_MUTATION", finalAcceptance:"USER_ONLY"};
  return {status:"OBSERVE", verdict:"OBSERVE", hardFailures:[], internalVerdict:"PROCEED", mutationDecision:"APPROVE_INTERNAL", finalAcceptance:"USER_ONLY"};
}

export function listAssetTargets({wave} = {}) {
  const assets = wave ? ASSET_CATALOG.assets.filter(asset => asset.wave === wave) : ASSET_CATALOG.assets;
  return {status:"PROCEED", schema:ASSET_CATALOG.schema, family:ASSET_CATALOG.family, proofDistrict:ASSET_CATALOG.proof_district, assets:assets.map(asset=>({...asset,graph_hash:assetGraphHash(asset)}))};
}
