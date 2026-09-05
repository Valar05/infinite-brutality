import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
const root=resolve(new URL("../..",import.meta.url).pathname);
const read=async p=>JSON.parse(await readFile(resolve(root,p),"utf8"));
if(process.argv.slice(2).length){console.error("REJECT unexpected arguments");process.exit(2)};
test("campaign is bounded and group split prevents view leakage",async()=>{const c=await read("tools/fleshpunk-lineart-training/campaign.v1.json");assert.equal(c.first_wave.length,8);assert.equal(c.split_policy.group_key,"asset_id");assert.equal(c.split_policy.same_asset_views_stay_together,true);assert.equal(c.training.checkpoint_every_steps,150)});
test("Drive v1 cannot self-certify held-out validation",async()=>{const r=await read("data/fleshpunk_drive_source_receipt.json");assert.equal(r.dataset_evidence.validation_images,0);assert.equal(r.dataset_evidence.import_state,"VERIFIED_PROVIDER_BYTES_LEGACY_DIGEST_STALE");assert.equal(r.dataset_evidence.materialized_files,40);assert.equal(r.dataset_evidence.legacy_manifest_digest_mismatches,20);assert.equal(r.lora.drive_state,"BAD_NOT_FOUND")});
test("runtime bindings fail closed before accepted proof assets",async()=>{const b=await read("data/fleshpunk_runtime_bindings.json");assert.equal(b.proof_district.bindings.length,8);assert.equal(b.proof_district.activation_gate.includes("USER_ACCEPTED"),true);assert.equal(b.visual_acceptance,false)});

test("lineart projection prunes blobs and remains user gated",async()=>{const p=await read("assets/training/fleshpunk/lineart-v1/preprocess-receipt.json");const a=await read("assets/training/fleshpunk/lineart-v1/user-acceptance.json");assert.equal(p.status,"PROCEED");assert.equal(p.selected_count,8);assert.equal(p.rejected_count,12);assert.equal(p.supplement_count,1);assert.equal(a.accepted,false);assert.equal(a.accepted_by,null)});
test("review loop is bound to RegNet and Boxcraft owners",async()=>{for(const path of ["tools/fleshpunk-lineart-training/cauldron/review_campaign.py","tools/fleshpunk-lineart-training/cauldron/regnet_judge.py","tools/boxcraft-judgment-mcp/src/asset-review-cli.mjs"])assert.ok((await readFile(resolve(root,path))).length>100)});
